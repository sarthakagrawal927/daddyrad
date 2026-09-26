# DaddyRad shared macOS release pipeline

Status: proposed · 2026-09-25

## Problem

StorageDaddy, BrowserDaddy, PerformanceDaddy, and ContextDaddy each build a native macOS app, but release work is split across app-specific scripts and manual steps. All four GitHub workflows currently stop after tests and a Release build. A push does not create a notarized download, update a feed, or update an installed app. ContextDaddy currently has no in-app updater and its package script fixes the version and build at `0.1.0` and `1`.

The result is easy to misread: source, a signed candidate, a notarized DMG, a live download, and an installed update can all be different builds. Manual packaging also produces extra local app bundles unless output ownership is explicit.

## Goal

One auditable release contract for the four native Daddy apps, owned in this repository. Each app keeps its own build inputs, entitlements, update key, website, and product acceptance checks. The shared pipeline takes an exact source commit through candidate, Apple distribution, publication, and installed-app verification, recording a separate receipt for each gate.

## Existing evidence and constraints

| App | Packaging today | Distribution today | Update path |
| --- | --- | --- | --- |
| StorageDaddy | `scripts/release-dmg.py` signs and can notarize | Site-hosted DMG and `site/release.json` | Sparkle feed |
| BrowserDaddy | `scripts/package-release.py` signs; notarization is separate | GitHub release and site assets | Sparkle feed |
| PerformanceDaddy | `scripts/package-release.py` signs; notarization is separate | GitHub release and site assets | Sparkle feed |
| ContextDaddy | `scripts/release-contextdaddy.py` signs and notarizes | Site-hosted DMG and GitHub release | Manual download only |

DaddyRad is the shared tooling owner. Each app's repository remains the owner of its native code and its site/download route. Do not move the sites into DaddyRad. The app repositories and DaddyRad are currently public and under the same GitHub account; a public reusable workflow can be called across these repositories. The implementation must use a pinned, immutable workflow revision for a credential-bearing job.

## Release contract

1. A push to `main` runs tests and produces a **candidate receipt** for that exact commit. It never signs, installs, or publishes a production update.
2. A push of `v<major>.<minor>.<patch>-<build>` requests a release for that commit. The tag commit must be reachable from the app's public release branch; a dirty local checkout or an unrelated feature branch is ineligible. Version and build must match the packaged `Info.plist`; the build number must exceed the last published build for that bundle ID.
3. The release job assembles one fresh app bundle and one DMG in an isolated output directory. App-specific adapters supply resources, helpers, entitlements, architecture checks, and privacy/product acceptance gates. Shared code owns input validation, SHA-256 receipts, nested-signature inspection, notarization submission and log capture, stapling, and Gatekeeper checks.
4. The exact qualified DMG is published with a checksum and source commit. Publication updates the app-owned download route and, where present, its signed Sparkle appcast. The pipeline verifies the live download checksum and feed enclosure before marking publication complete.
5. Installed-app verification is a separate receipt: bundle ID, Team ID, version/build, executable hash, launch, and the app's primary journey. A GitHub release or live feed alone is not an installed update.

## Shared implementation in DaddyRad

- `release/`: standard-library release utilities and tests for manifests, version/tag rules, receipts, notarization results, checksum and appcast verification. No credential values or app binaries are committed.
- `.github/workflows/mac-candidate.yml`: reusable, read-only tests/build/receipt workflow called by small app-repo workflows on `main` and pull requests.
- `.github/workflows/mac-release.yml`: reusable tagged-release workflow. It builds from the exact tag, uses a protected release environment for signing and publication credentials, and fails closed when a gate or credential is absent.
- `release/apps/`: one declarative manifest per app containing repository, bundle ID, executable, minimum OS/architectures, packaging adapter, release branch, download URL, and optional appcast URL. Manifests contain no secrets and cannot supply arbitrary shell commands to the credential-bearing job.
- `release/templates/`: a caller-workflow skeleton and app-adapter contract. Pin the DaddyRad workflow to a reviewed commit; update the pin through a normal PR in each app.

The shared pipeline may use the same Apple Developer ID identity and team-scoped notarization credential for these apps. Each Sparkle app keeps a distinct EdDSA update key and public key. A release job must never run a public pull request with signing or publication credentials. First choose and prove one credential location: protected GitHub environments in each caller repo, or a dedicated release service with central credentials. Reusable workflows execute in the caller's context, so a DaddyRad environment alone must not be assumed to supply secrets to other repositories.

## Product and permission requirements

- ContextDaddy gets a new build number and an in-app update path before an automatic release is advertised. Its first updater migration must be tested from the currently installed notarized build; until then, a live DMG is a manual update.
- Preserve each app's stable bundle ID and Developer ID Team ID to avoid unnecessary macOS permission prompts. BrowserDaddy's sandbox/container migration and user-granted browser roots need their own update test.
- Never install candidate apps or register them with LaunchServices during CI. Only the exact qualified production artifact can replace `/Applications/<App>.app`, using one recoverable prior-version backup during local acceptance.
- Release jobs do not read personal browser/history data, agent transcripts, or app user data. They handle source, build products, signing credentials, and public release metadata only.
- No release claim from a green CI check, a signing success, an accepted notary submission, or a draft release by itself.

## Rollout

1. **Shared candidate lane:** add manifests, validators, tests, reusable workflow, and tiny callers. Preserve existing CI while comparing results. No Apple or Cloudflare credentials required.
2. **One production pilot:** use PerformanceDaddy's existing Sparkle path to prove exact-tag build, signing, notarization, appcast, site download, and installed update. Keep its current release scripts as adapters until parity is proven.
3. **Adopt siblings:** migrate BrowserDaddy and StorageDaddy while preserving their site routes and update keys. Bring ContextDaddy in after its updater and version/build generation are ready. Do not feed ContextDaddy's inherited feature-branch history into a public release.
4. **Retire duplicate gates:** remove only release logic that is demonstrably covered by the shared runner and its tests. Keep app-specific packaging and acceptance checks near each app.

## Acceptance criteria

- A reviewer can identify source SHA, version/build, bundle ID, artifact SHA-256, Apple submission ID/status, stapling result, live download SHA-256, feed signature/version, and installed binary SHA-256 from one release receipt.
- A wrong repository/app pair, malformed or reused tag, wrong bundle ID/Team ID, stale build, unsigned nested executable, rejected notary submission, missing ticket, changed DMG, mismatched live asset, or missing Sparkle signature stops promotion.
- A pull request and ordinary `main` push cannot reach signing or publication credentials. A production tag cannot publish before all required checks pass.
- One local qualification creates at most one staged app bundle and one recoverable installed-app backup; cleanup is explicit and does not remove unrelated versions.
- The same shared code passes fixture tests for all four manifests and a production pilot demonstrates a real Sparkle update from a previous notarized build.

## Open implementation decisions

1. **Credential host:** compare protected GitHub-hosted macOS jobs with a dedicated signer. The choice must prove Keychain/notary and Sparkle access, least-privilege GitHub permissions, credential rotation, and no public-PR execution on the signer.
2. **Publication adapter:** choose one artifact store and asset update method per app without changing existing download URLs. StorageDaddy's site release metadata and the other apps' feed-driven download routes require different adapters.
3. **Release trigger:** production tags are the proposed trigger. If every `main` push needs a downloadable build, use a separate development channel with a unique build number and no production appcast promotion.

## Platform references

- [GitHub reusable workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations) and [self-hosted runner access](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/manage-access)
- [Apple notarization](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution) and [custom notarization workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow)

## Deferred ContextDaddy completion

This work is deliberately queued after the PRD review. The current local source changes and staged `0.1.0` build 2 are not a published release. The staged bundle has a valid Developer ID signature, but Gatekeeper rejects it as `Unnotarized Developer ID`; an installed-app check has not been completed. The installed app remains `0.1.0` build 1. The owner confirmed that no `notarytool` profile is set up; the one-time interactive setup was stopped when this work was deferred.

Complete these steps before calling the new ContextDaddy design installed or ready:

1. Create one `notarytool` Keychain profile through a user-entered secure prompt. Record only its profile name; keep Apple credentials out of the repository, shell arguments, logs, and release receipts.
2. Submit the signed build 2 candidate to Apple, inspect the notarization log, staple the accepted ticket to the exact app or distributable, then pass `codesign`, `stapler validate`, and `spctl` checks.
3. Replace only `/Applications/ContextDaddy.app`, preserving one recoverable copy of build 1. Launch the installed build 2 and verify its bundle ID, Team ID, version/build, Usage scrolling and dates, Devin inside Local History, Skills cleanup/sharing, and Projects context breakdown.
4. Reconcile the installed result with source and tests. A public update additionally requires an exact safe-branch commit, a versioned release artifact, live download verification, and the separate updater work described above. Do not publish the inherited `feature/contextdaddy-v1` history.
