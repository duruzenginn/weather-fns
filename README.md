## How to run locally
1) Start emulators: `firebase emulators:start`
2) Test: `curl "http://localhost:5001/weather-fns-demo-1/europe-west1/getWeather?city=Turin"`

## Deploy to Cloud

Prereqs
- You must upgrade your Firebase project to the Blaze (pay‑as‑you‑go) plan and add a billing account. Cloud Functions (2nd gen) requires Cloud Build and Artifact Registry, which are only available with billing enabled.
- Install the Firebase CLI and log in: `firebase --version` should work and `firebase login` once per machine.

Project selection
- This repo is already configured with `.firebaserc` defaulting to project `weather-fns-demo-1`. If you want to use a different project, run `firebase use --add` and select it.

Deploy
1) Install deps for functions: from repo root run `npm --prefix functions install`
2) Deploy only functions: `firebase deploy --only functions`

On success the CLI prints the HTTPS function URL, e.g.:
```
Function URL (getWeather): https://europe-west1-weather-fns-demo-1.cloudfunctions.net/getWeather
```

Smoke test
```
curl "https://europe-west1-weather-fns-demo-1.cloudfunctions.net/getWeather?city=Turin"
```

Notes
- Runtime is set to Node.js 20 in `functions/package.json` to match Cloud Functions supported versions.
- You can change the region in `functions/index.js` (currently `europe-west1`).
