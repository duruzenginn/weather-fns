const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

exports.getWeather = onRequest(
  {
    region: "europe-west1",
    cors: true,
  },
  async (req, res) => {
    try {
      const city = (req.query.city ?? "").toString().trim();
      if (!city) return res.status(400).json({ ok: false, error: "Missing 'city' query. Example: ?city=Turin" });

      // Helpers
      const getJSON = async (url) => {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
        return r.json();
      };

      // Robust Timestamp -> ms conversion (supports Firestore Timestamp and plain objects)
      const tsToMillis = (t) => {
        try {
          if (!t) return 0;
          if (typeof t.toMillis === "function") return t.toMillis();
          if (typeof t._seconds === "number") {
            const ms = (t._seconds * 1000) + Math.floor((t._nanoseconds || 0) / 1e6);
            return ms;
          }
        } catch (_) { /* ignore */ }
        return 0;
      };

      const cityKey = city.toLowerCase();
      const docRef = db.collection("weatherCache").doc(cityKey);

      // 1) Check cache (TTL = 10 minutes)
      const snap = await docRef.get();
      const now = Date.now();
      const TTL_MS = 10 * 60 * 1000;

      if (snap.exists) {
        const d = snap.data();
        const cachedAtMs = tsToMillis(d.cachedAt);
        const age = now - cachedAtMs;
        if (cachedAtMs > 0 && age >= 0 && age < TTL_MS && d.current && d.city && d.country) {
          return res.json({ ok: true, cached: true, ...d, provider: "open-meteo.com" });
        }
      }

      // 2) Geocode
      const geoURL = new URL("https://geocoding-api.open-meteo.com/v1/search");
      geoURL.searchParams.set("name", city);
      geoURL.searchParams.set("count", "1");
      geoURL.searchParams.set("language", "en");
      geoURL.searchParams.set("format", "json");
      const geo = await getJSON(geoURL);
      if (!geo.results?.length) return res.status(404).json({ ok: false, error: `City not found: ${city}` });

      const hit = geo.results[0];
      const latitude = hit.latitude;
      const longitude = hit.longitude;

      // 3) Fetch current weather
      const wURL = new URL("https://api.open-meteo.com/v1/forecast");
      wURL.searchParams.set("latitude", String(latitude));
      wURL.searchParams.set("longitude", String(longitude));
      wURL.searchParams.set("current_weather", "true");
      wURL.searchParams.set("timezone", "Europe/Rome");
      const weather = await getJSON(wURL);

      const payload = {
        city: hit.name,
        country: hit.country,
        coords: { lat: latitude, lon: longitude },
        current: weather.current_weather,
        cachedAt: Timestamp.fromMillis(now),
      };

      // 4) Save to cache
      await docRef.set(payload, { merge: true });

      // Light client cache headers
      res.set("Cache-Control", "public, max-age=60, s-maxage=60");
      return res.json({ ok: true, cached: false, ...payload, provider: "open-meteo.com" });
    } catch (err) {
      logger.error(err);
      return res.status(500).json({ ok: false, error: String(err.message || err) });
    }
  }
);
//fixfirebase