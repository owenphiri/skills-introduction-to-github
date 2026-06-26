# VoltexAI Mobile (Expo / React Native)

The native companion app — same backend, same brand. Bottom-tab navigation:

- **Markets** — live quotes across forex, metals, indices, crypto and stocks (auto-refresh).
- **Signals** — the algorithmic confluence scanner with entry / stop / TP brackets.
- **AI Terminal** — Claude-powered chat (Terminal / Analysis / Signals / Academy modes), with inline login/signup.
- **More** — managed-AUM snapshot, top prop firms, Africa-friendly brokers.

## Run it

```bash
cd voltexai/mobile
npm install
npx expo start          # open in Expo Go (iOS/Android) or a simulator
```

Point the app at your backend in `app.json`:

```json
"extra": { "apiUrl": "https://your-api-host" }
```

For local development against a backend on your machine, use your LAN IP
(e.g. `http://192.168.1.20:8000`) so the phone can reach it.

## Build for the stores

```bash
npm install -g eas-cli
eas build -p android   # Play Store (.aab)
eas build -p ios       # App Store
```

The app shares the VoltexAI design tokens (`src/theme.js`) and a thin API client
(`src/api.js`) that mirrors the web `services/` layer.
