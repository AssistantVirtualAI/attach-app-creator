---
name: CI/CD and desktop build files are protected
description: Never modify GitHub Actions workflows or the desktop app's build config — they break the release pipeline
type: constraint
---
**Never modify these files** — any change breaks the CI/CD or desktop release pipeline.

GitHub Actions workflows (all of `.github/workflows/`):
- `.github/workflows/auto-release.yml`
- `.github/workflows/release-desktop.yml`
- `.github/workflows/build-electron.yml`
- `.github/workflows/build-all-platforms.yml`

Desktop build config:
- `apps/ava-softphone-desktop/electron-builder.yml`
- `apps/ava-softphone-desktop/package.json` — specifically the `repository` field (other fields may be edited only with explicit user approval)

**Why:** these files control CI/CD and the Electron release pipeline. Any modification can break automatic builds, signing, and publishing of the AVA Softphone desktop app.

**How to apply:** if a task seems to require editing one of these files, stop and ask the user first. Never edit silently, never "fix formatting", never reorder keys.
