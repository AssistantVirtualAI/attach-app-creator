# Desktop CI/CD — Signing & Release Checklist

## GitHub Secrets required

| Secret | Purpose |
|---|---|
| `WIN_CSC_LINK` | Base64 of the Windows `.pfx` code-signing cert |
| `WIN_CSC_KEY_PASSWORD` | Password of the `.pfx` |
| `MAC_CSC_LINK` | Base64 of the macOS Developer ID `.p12` |
| `MAC_CSC_KEY_PASSWORD` | Password of the `.p12` |
| `APPLE_ID` | Apple Developer account email (for notarization) |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | 10-char Apple Team ID |

Encode certs once with: `base64 -i cert.pfx | pbcopy` (mac) / `certutil -encode cert.pfx out.b64` (win).

## Release flow

1. **Bump & tag** — Actions → *Bump Desktop Version & Tag* → choose `patch|minor|major`.
   Commits the new `package.json` version and pushes `desktop-v<X.Y.Z>`.
2. **Build & release** — pushing the tag triggers *Release AVA Softphone Desktop*:
   - `verify-version` ensures tag = `package.json` version (fail-fast).
   - `build-windows` → NSIS `.exe` signed (SHA-256, RFC3161 timestamp). Validated via `Get-AuthenticodeSignature`.
   - `build-mac` → `.dmg` + `.zip`, hardened runtime, notarized + stapled. Validated via `codesign --verify` + `spctl -a`.
   - `build-linux` → `.AppImage` + `.deb` (unsigned per ecosystem norms).
   - `create-release` attaches every artifact and confirms updater manifests (`latest.yml`, `latest-mac.yml`, `latest-linux.yml`) exist.

## Auto-update

`electron-updater` reads from GitHub Releases (`AssistantVirtualAI/ava-softphone-releases`):

- Check 5 s after launch, then hourly.
- Background download with progress events.
- `<UpdateBanner />` shows live %, then **Restart & Update** when ready.
- Falls back to `autoInstallOnAppQuit` if user dismisses.

## Manual smoke test

1. Install v1.0.0, then publish v1.0.1 via the bump workflow.
2. Launch v1.0.0 → within ~10 s banner shows download progress → "Update ready".
3. Click **Restart & Update** → app relaunches as v1.0.1 (verify via `window.electronAPI.getAppVersion()`).
