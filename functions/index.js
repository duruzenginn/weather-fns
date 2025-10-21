// functions/index.js
const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");

// Gen-2 HTTP function that calls Open-Meteo (no API key)
exports.getWeather = onRequest(
  {
    region: "europe-west1", // close to Italy
    cors: true,             // dev convenience; lock down later
  },
  async (req, res) => {
    try {
      const { city, lat, lon } = req.query;

      const getJSON = async (url) => {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
        return r.json();
      };

      // Resolve coordinates
      let latitude, longitude, resolved;
      if (city) {
        const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
        url.searchParams.set("name", String(city));
        url.searchParams.set("count", "1");
        url.searchParams.set("language", "en");
        url.searchParams.set("format", "json");
        const geo = await getJSON(url);
        if (!geo.results?.length) {
          return res.status(404).json({ error: `City not found: ${city}` });
        }
        const hit = geo.results[0];
        latitude = hit.latitude;
        longitude = hit.longitude;
        resolved = { city: hit.name, country: hit.country };
      } else if (lat && lon) {
        latitude = Number(lat);
        longitude = Number(lon);
      } else {
        return res.status(400).json({ error: "Provide ?city=Name or ?lat=&lon=" });
      }

      // Fetch current weather
      const wurl = new URL("https://api.open-meteo.com/v1/forecast");
      wurl.searchParams.set("latitude", String(latitude));
      wurl.searchParams.set("longitude", String(longitude));
      wurl.searchParams.set("current_weather", "true");
      wurl.searchParams.set("timezone", "Europe/Rome");
      const weather = await getJSON(wurl);

      // Light client cache
      res.set("Cache-Control", "public, max-age=60, s-maxage=60");

      res.json({
        ok: true,
        location: resolved ?? { lat: latitude, lon: longitude },
        current: weather.current_weather, // temperature, windspeed, etc.
        meta: { provider: "open-meteo.com" },
      });
    } catch (err) {
      logger.error(err);
      res.status(500).json({ error: String(err.message || err) });
    }
  }
);
