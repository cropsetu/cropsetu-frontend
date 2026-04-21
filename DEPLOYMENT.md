# Deployment — CropSetu Farmer App

End-to-end guide to build and publish the farmer React Native app.

---

## Prerequisites

- GitHub repo: **https://github.com/cropsetu/cropsetu-frontend** (already pushed)
- Expo account: **cropsetu** (sign up at [expo.dev](https://expo.dev))
- EAS project ID: `9681090a-1af6-4835-8a2f-7b0ea7681b9a` (already wired in `app.json`)
- Backend deployed first — see [cropsetu-backend/DEPLOYMENT.md](https://github.com/cropsetu/cropsetu-backend/blob/main/DEPLOYMENT.md)
- For Android release: Google Play Console developer account ($25 one-time)
- For iOS: Apple Developer account ($99/year) + a Mac

---

## Step 1 — Install EAS CLI and log in

On your Mac:

```bash
npm install -g eas-cli
eas login                     # use your cropsetu Expo account
```

Verify the project is linked correctly:

```bash
cd ~/Desktop/Farmeasy-froontend
eas whoami                    # → cropsetu
cat app.json | grep projectId # → 9681090a-1af6-4835-8a2f-7b0ea7681b9a
```

## Step 2 — Point the app at the production backend

Edit [`src/constants/config.js`](./src/constants/config.js) — replace the production Railway URL with your actual one:

```js
export const API_BASE_URL = __DEV__
  ? `http://${DEV_HOST}:3001/api/v1`
  : 'https://<your-railway-domain>/api/v1';  // ← update here

export const SOCKET_URL = __DEV__
  ? `http://${DEV_HOST}:3001`
  : 'wss://<your-railway-domain>';           // ← and here
```

Alternatively, put it in [`eas.json`](./eas.json) under `build.production.env.EXPO_PUBLIC_API_BASE_URL` and read from `process.env.EXPO_PUBLIC_API_BASE_URL` in config.js (more flexible for multiple environments).

## Step 3 — Build profiles (configured in [eas.json](./eas.json))

| Profile | Output | Use for |
|---|---|---|
| `development` | Dev client APK | Local testing with Metro |
| `preview` | Standalone APK | Internal testing, share link to install |
| `production` | AAB (Android App Bundle) | Play Store upload |

## Step 4 — First preview build (Android APK)

```bash
eas build --profile preview --platform android
```

What happens:
1. EAS uploads your source to the cloud builder (~1 min)
2. Builds in the cloud for ~10–15 min
3. You get a shareable URL to the APK when done

Install on any Android phone by opening the URL on the device (enable "Install from unknown sources" for the browser).

## Step 5 — Production build (Play Store upload)

```bash
eas build --profile production --platform android
```

Produces an AAB (Android App Bundle) — this is what Play Store requires.

Download the AAB or let EAS submit it for you (see Step 7).

## Step 6 — Play Store setup (one-time, ~30 min)

1. Sign up at https://play.google.com/console ($25 one-time fee)
2. Create a new app:
   - Name: **CropSetu** (or FarmEasy if you prefer to keep the display name)
   - Default language: Hindi or English
   - App or game: App
   - Free or paid: Free
3. Fill the **Main Store Listing**:
   - Short description, full description, screenshots (at least 2 phone screenshots), feature graphic (1024×500), icon
4. Fill **App Content**: privacy policy, data safety, content rating, target audience
5. Create an **Internal testing track** → upload your first AAB → add your own email as a tester → install via the link Google Play provides

## Step 7 — Submit via EAS (skip Google Play Console upload UI)

Get a service account JSON from Play Console:
- Play Console → **Setup → API access** → **Create service account** → give it **Release Manager** role → download JSON
- Save to `play-store-credentials.json` at repo root (it's in `.gitignore`)

Then:
```bash
eas submit --platform android --profile production
```

EAS reads `submit.production.android.serviceAccountKeyPath` from [`eas.json`](./eas.json) and uploads to the Play Store internal track automatically.

## Step 8 — OTA updates (push JS bug fixes without rebuilding APK)

Once published, you can push JS-only updates without a new APK build:

```bash
eas update --branch production --message "Fix login bug"
```

Users get the update on next app launch. Native changes (adding a package that has native code) still require a new build.

---

## CI / GitHub Actions

Two workflows at [`.github/workflows/`](./.github/workflows/):

- **`ci.yml`** — runs on every push/PR. Installs deps, runs a Metro bundle check, scans for leaked API keys.
- **`eas-build.yml`** — manual trigger. Go to GitHub → **Actions** → **EAS Build** → **Run workflow** → pick `preview` or `production` + platform.

### Setting up EAS Build in CI

The `eas-build.yml` workflow needs an Expo access token:

1. Go to https://expo.dev/accounts/cropsetu/settings/access-tokens → **Create Token**
2. GitHub repo → **Settings → Secrets and variables → Actions → New secret**:
   - Name: `EXPO_TOKEN`
   - Value: the token

After that, anyone with repo write access can trigger cloud builds from GitHub UI.

---

## Pixel emulator (local dev)

Already working end-to-end. Quick restart:

```bash
# Emulator
~/Library/Android/sdk/emulator/emulator -avd Pixel_8 &

# Metro
cd ~/Desktop/Farmeasy-froontend && npx expo start --port 8081

# If dev client isn't installed on emulator yet:
npx expo run:android
```

App connects to `http://10.0.2.2:3001` (host loopback) for the backend — wired in [config.js](./src/constants/config.js).

---

## Versioning

- **Bump `version`** in [app.json](./app.json) for every user-visible release (e.g. `1.0.0` → `1.0.1`)
- **`versionCode` (Android) and `buildNumber` (iOS)** auto-increment thanks to `autoIncrement: true` in `eas.json` `production` profile
- EAS tracks both under your project → Settings → Versions

---

## Known gaps (don't block deployment, but worth knowing)

- Backend code (`src/app.js`, `src/server.js`, `src/routes/*`) is bundled alongside the RN app. Metro ignores it — no crash. Tidy-up suggestion: move to a separate `server/` subfolder or delete.
- iOS not tested yet. `eas build --platform ios` should work if you have an Apple Developer account; first build will ask to either generate or upload certificates.

---

## Quick reference

```bash
# Rebuild the dev APK for local Pixel
eas build --profile development --platform android

# Build a shareable preview APK
eas build --profile preview --platform android

# Build for Play Store
eas build --profile production --platform android
eas submit --platform android --profile production

# Push a JS-only update to users
eas update --branch production --message "..."

# See build history
eas build:list

# See recent OTA updates
eas update:list
```
