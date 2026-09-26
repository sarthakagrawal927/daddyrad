# Shared Daddy app foundation

Status: implementation in progress · 2026-09-25 · [tracking issue](https://github.com/sass-maker/saas-maker/issues/139)

Implementation record: [shared tooling PR](https://github.com/sass-maker/saas-maker/pull/140), [StorageDaddy PR](https://github.com/sarthakagrawal927/storagedaddy/pull/39), [PerformanceDaddy PR](https://github.com/sarthakagrawal927/performancedaddy/pull/4), [BrowserDaddy PR](https://github.com/sarthakagrawal927/browserdaddy/pull/8), and [ContextDaddy PR](https://github.com/sarthakagrawal927/contextdaddy/pull/3). The first PR heads passed both existing and shared candidate CI in all four apps. GitHub's `production-release` environments now require owner review and allow only `main`. The app PRs add manual exact-tag release preflight; signing credentials are not yet configured and no app release has run. Signing, notarization, publication, and installed-app acceptance remain open gates.

## Purpose and scope

Give StorageDaddy, PerformanceDaddy, BrowserDaddy, and ContextDaddy one maintainable repository and CI/CD contract. A new Daddy macOS app should start with the same directory roles, candidate checks, release evidence, and update rules, while retaining its own native behavior, permissions, assets, signing inputs, and acceptance tests.

The landing pages are already shared and are outside this work. This PRD covers native app repositories, update-serving code where it is duplicated, and the path from source commit to verified release. It does not authorize a deployment or release.

The closed [StorageDaddy issue #30](https://github.com/sarthakagrawal927/storagedaddy/issues/30) completed a narrower three-app layout and Sparkle-copy rollout. It did not cover ContextDaddy or establish a four-app CI/CD system. This document establishes the four-app structure, CI/CD gates, and ownership contract.

## Evidence from the four checkouts

| Area | StorageDaddy | PerformanceDaddy | BrowserDaddy | ContextDaddy |
| --- | --- | --- | --- | --- |
| Current layout | `scripts/`, `Support/`, `Sources/`, `Tests/`, `site/`, `artifacts/`, plus `Assets/` | Same core directories | Same core directories | Same core directories |
| PR and `main` CI | Swift test/build and Sparkle Python test | Same, plus update Worker test | Same, plus update Worker test | Swift test/build; skips machine-local design snapshots |
| Distribution | Local packager, signed DMG, optional notarization, release receipt, Sparkle appcast | Local packager, separate notarization/publication steps, Sparkle appcast | Same, with sandbox entitlements and container migration | Local packager and notarized DMG; no active Sparkle updater or appcast |
| Shared code evidence | Sparkle helper and appcast script | Sparkle helper, appcast script, update Worker | Near-identical PerformanceDaddy scripts/Worker with app-specific values and one Sparkle setting | Local feature branch has a byte-identical `prepare-memory-pack.py`; public `main` does not |

All four checked-in GitHub workflows currently stop at tests and a Release build. They do not qualify and publish an exact artifact. PerformanceDaddy and BrowserDaddy package scripts are close copies; their asset lists and BrowserDaddy's entitlements/container migration are real product differences. StorageDaddy and ContextDaddy share signing, DMG, notary, stapling, checksum, and receipt steps, but bundle different helpers and resources. The three Sparkle apps share the packaging mechanism while keeping distinct feed URLs and EdDSA keys. Current app-side `AppUpdates.swift` files also have different busy and permission behavior.

## Target repository convention

Each app retains its own Git repository and a small, consistent shape:

```text
Package.swift
Sources/                  native app and app-owned core
Tests/                    app behavior and package tests
Support/                  Info.plist, icons, entitlements, public update key as applicable
scripts/                  thin local build/package adapters and app-specific checks
site/                     app-owned download/update route; landing implementation stays where it is
artifacts/                ignored local build and qualification output
.github/workflows/ci.yml  small caller for shared candidate checks plus local gates
.github/workflows/release.yml  app-owned, protected signed-release job when enabled
```

`Assets/`, bundled helper source, resource bundles, and additional targets remain optional. A path name does not imply every app needs every dependency: ContextDaddy does not gain Sparkle merely for layout parity. Each app's package, bundle ID, Team ID, entitlements, privacy controls, and tests remain locally owned.

## Sharing decisions

| Component | Shared contract or implementation | App-owned input or behavior |
| --- | --- | --- |
| Candidate CI | One credential-free reusable macOS workflow: checkout the caller, select the supported Xcode, run Swift tests and Release build, run declared Python/Worker tests, produce a source/build receipt | Test target selection, ContextDaddy snapshot exclusion, resource/helper preparation, app-specific tests |
| Release validation | Common allowlisted manifest schema and pure validators for tag/version/build, source SHA, bundle/Team ID, architectures, nested signatures, checksums, receipt transitions, appcast enclosure, and live asset equality | Bundle assembly, entitlements, bundled helpers, native acceptance, publication destination |
| Signing and notarization | Same stage order and receipt format; reusable local validation functions with fixture tests | Credential-bearing GitHub job, identity/profile references, protected environment, product packaging adapter |
| Sparkle tooling | Share tested embed/sign/appcast logic or a generated, parity-checked copy from one source; retain separate EdDSA keys and public keys | Feed URL, key account, app-specific `SU*` options, idle/busy gate, UI, ContextDaddy updater adoption |
| Memory Pack preparation | One source for the currently byte-identical `prepare-memory-pack.py`, with a reproducible pinned copy or invocation in both consumers | Whether to bundle Memory Pack and each app's helper/product acceptance |
| Update-serving Worker | Reuse the near-identical PerformanceDaddy/BrowserDaddy routing and security logic after route tests prove parity | Hostnames, legacy redirects, update assets, Cloudflare configuration and deployment |
| Native Swift utilities | Share only small, stable pure code after proving identical semantics and independent build quality | Storage scanning, browser permission model, process diagnostics, agent discovery, update busy policy |

Do not create a cross-app Swift framework for incidental lookalikes. The package graphs and privacy/permission contracts differ. Prefer a shared conformance test or generated source copy when that keeps each app independently buildable. Extraction is warranted when one source removes real drift without introducing a runtime or release dependency on another app's checkout.

## Ownership and execution

- SaaS Maker `tooling/` owns public, credential-free shared scripts, schemas, fixtures, and templates. GitHub requires reusable workflow entrypoints under SaaS Maker's `.github/workflows/`; supporting code remains under `tooling/`. Callers pin the workflow to a reviewed full commit SHA. The reusable workflow uses the standard caller checkout and receives no signing or deployment credentials.
- Each Daddy app owns its credential-bearing release workflow, packaging adapter, site/update assets, and production credentials. No reusable SaaS Maker workflow signs, notarizes, publishes, or accesses a private repository. App jobs may consume pinned public validation code, but must fail closed if its reviewed revision is unavailable.
- DaddyRad owns the series-level product contract and this PRD. It does not become a second landing implementation, credential store, or owner of app bundles.
- Shared manifests contain data only: an allowlisted app identifier, expected bundle/executable/targets, architecture, release branch, update mode, and public route. They cannot inject arbitrary shell commands into a credential-bearing job.

## Pipeline contract

1. A pull request and ordinary `main` push run candidate checks with read-only permissions. They record exact source SHA, toolchain, tests, and build result. They cannot sign, install, or publish a production update.
2. A protected production tag or explicitly approved release dispatch selects one immutable source SHA. The app-owned job verifies tag ancestry, version/build monotonicity, manifest identity, resource freshness, and product-specific checks before packaging.
3. The app adapter assembles one fresh app bundle and DMG in a new output directory. Shared validators verify nested signatures, architecture, bundle/Team identity, notarization acceptance, stapling, Gatekeeper, and post-staple SHA-256. A notary submission receipt alone is insufficient.
4. Publication uses the app's existing destination. For Sparkle apps, the appcast must contain a valid EdDSA signature and the exact qualified enclosure. ContextDaddy remains a manual DMG path until its updater is implemented and migration-tested. Verify the live bytes and metadata after publication.
5. Installed-app acceptance is separate: installed bundle ID, Team ID, version/build, executable hash, launch, and a primary product journey. Release receipts distinguish candidate, Apple-qualified, published, and installed states.

Never expose signing, notary, Sparkle private-key, GitHub publication, or Cloudflare credentials to pull-request code. Preserve each app's existing stable identity and update key. The release workflow must not silently install apps or register candidates with LaunchServices.

## Rollout

1. **Record the contract:** add four allowlisted manifests and fixture tests for the current differences. Establish one documented repo layout without moving healthy native code or landing pages.
2. **Share candidate CI:** add a credential-free reusable workflow in SaaS Maker and pin four small callers. Preserve each app's current CI until the shared lane passes the same tests. Account for ContextDaddy's machine-local snapshot tests and the two update Worker tests.
3. **Extract proven utility duplication:** start with Memory Pack preparation and the PerformanceDaddy/BrowserDaddy appcast/Worker logic. Keep executable app adapters and per-app keys local. Compare generated copies byte-for-byte if copies are retained for independent builds.
4. **Unify release evidence:** add pure receipt/signature/appcast validators, then pilot one app-owned protected release job against an exact tag. Verify a previous installed build can update where Sparkle exists. Migrate siblings only after parity is demonstrated.
5. **Adopt ContextDaddy deliberately:** first make version/build and manual release reproducible; add Sparkle only with a tested migration from the installed notarized build. Do not classify its existing public DMG as an in-app update.

## Acceptance criteria

- All four repos follow the documented core layout and call one pinned candidate contract; their app-specific tests still run. A new app can adopt the contract by adding a manifest, adapters, and product gates, without copying an entire workflow.
- PR and `main` checks cannot reach signing/publication credentials. The shared workflow and validators remain public, credential-free, and independently tested.
- Fixture tests reject wrong app/repository identity, malformed or reused build, stale resource, wrong bundle/Team ID, unsigned nested binary, nonaccepted notarization, absent staple, changed DMG, and mismatched or unsigned Sparkle enclosure.
- A release receipt links source SHA, version/build, bundle/Team ID, artifact SHA-256, Apple submission/status, staple/Gatekeeper result, live download/feed check, and installed binary hash, with each promotion gate reported separately.
- One pilot proves the exact qualified artifact reaches its existing update/download route and the previous installed app updates successfully. The other apps are not declared migrated from source or CI parity alone.
- The sharing work does not change the landing pages, product data access, app permissions, public download policy, or installed apps without separate review and authorization.

## Decisions to resolve during implementation

1. Whether the shared pure validation code runs from a pinned SaaS Maker checkout in app release jobs or is synchronized as a pinned, tested copy for offline local releases. Independent local packaging must remain possible.
2. Which protected credential host each app will use for signing and notarization. The first pilot must prove credential isolation, rotation, and no execution on public PRs.
3. Whether PerformanceDaddy/BrowserDaddy update Worker code becomes one generated template or remains paired copies with a parity test. Preserve each app's route and deployment ownership.
