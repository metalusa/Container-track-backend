import express from "express";
import axios from "axios";

const app = express();
const PORT = 3000;

// Allow frontend access
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

/**
 * 1) LDB BASIC API
 * Returns last event + sorted movement list
 */
app.get("/ldb", async (req, res) => {
  const container = (req.query.container || "").trim().toUpperCase();

  if (!container) {
    return res.status(400).json({ error: "Missing container parameter" });
  }

  try {
    const url = `https://www.ldb.co.in/api/ldb/container/search?cntrNo=${container}&searchType=39`;

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
      }
    });

    const data = response.data.object;

    // Sort movements oldest → newest
    const movements = (data.trackLog || [])
      .slice()
      .sort((a, b) => new Date(a.timestampTimezone) - new Date(b.timestampTimezone))
      .map(ev => ({
        event: ev.eventName,
        location: ev.currentLocation,
        timestamp: ev.timestampTimezone,
        mode: ev.transportmode,
        lat: ev.latitude,
        lng: ev.longitude
      }));

    const last = data.lastEvent
      ? {
          event: data.lastEvent.eventName,
          location: data.lastEvent.currentLocation,
          timestamp: data.lastEvent.timestampTimezone,
          mode: data.lastEvent.transportmode
        }
      : null;

    res.json({
      container,
      lastEvent: last,
      movements
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch from LDB API" });
  }
});

/**
 * 2) LDB FULL API (more detailed)
 */
app.get("/ldb-full", async (req, res) => {
  const container = (req.query.container || "").trim().toUpperCase();

  if (!container) {
    return res.status(400).json({ error: "Missing container parameter" });
  }

  try {
    const response = await axios.post(
      "https://www.ldb.co.in/ldb/containersearch/getContainerTrackingDetails",
      new URLSearchParams({
        cntrNo: container,
        searchType: "39",
        searchParam: container
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144 Safari/537.36",
          "Origin": "https://www.ldb.co.in",
          "Referer": "https://www.ldb.co.in/ldb/containersearch",
          "X-Requested-With": "XMLHttpRequest"
        }
      }
    );

    const data = response.data.object || {};

    const movements = (data.trackLog || []).map(ev => ({
      event: ev.eventName || null,
      location: ev.currentLocation || null,
      timestamp: ev.timestampTimezone || null,
      mode: ev.transportmode || null,
      lat: ev.latitude || null,
      lng: ev.longitude || null
    }));

    res.json({
      container,
      lastEvent: data.lastEvent || null,
      movements
    });

  } catch (err) {
    console.error("LDB FULL ERROR:", err);
    res.status(500).json({ error: "Failed to fetch full LDB data" });
  }
});

/**
 * 3) MASTER TRACKING ENDPOINT
 * Combines LDB + Shipping Line (MSC, MAERSK, CMA, etc.)
 */
app.get("/track", async (req, res) => {
  const container = (req.query.container || "").trim().toUpperCase();

  if (!container) {
    return res.status(400).json({ error: "Missing container parameter" });
  }

  const prefix = container.substring(0, 4);

  try {
    let result = {};

    // Always include LDB
    const ldb = await axios.get(`http://localhost:3000/ldb?container=${container}`);
    result.ldb = ldb.data;

    // MSC
    if (prefix === "MSMU") {
      result.line = "MSC";
      // MSC API will be added here later
    }

    res.json(result);

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Tracking failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
