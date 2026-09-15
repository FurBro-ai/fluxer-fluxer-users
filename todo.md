# AETHERNET TODO

## Current status

- [x] Rename user-facing product branding to AETHERNET.
- [x] Remove the remaining legacy product attribution from badge assets.
- [x] Add the custom AETHERNET member badge to every profile.
- [x] Add distinct Aether Architect, Network Ally, and Signal Guardian badge artwork.
- [x] Polish profile badges with a glass panel, depth, hover feedback, and reduced-motion support.
- [x] Add accessible badge labels, list semantics, lazy-safe image decoding, and per-badge color treatments.
- [x] Make local LiveKit failures return an actionable `503 Service Unavailable` response.
- [x] Make the gateway compile on modern Erlang/OTP by patching the affected `ezstd` build script automatically.
- [x] Make CSS type watching compatible with Node.js 26.
- [x] Pass application type-checking, all 3,336 frontend tests, and the production build.
- [x] Start the complete local stack and verify the app, API, gateway, LiveKit, PostgreSQL, Valkey, NATS, Meilisearch, and Mailpit.
- [x] Prevent client-controlled `X-Forwarded-For` spoofing at the development proxy boundary.
- [x] Stop proxy error responses from leaking internal hosts, ports, and connection details.
- [x] Strip upstream `Server` and `X-Powered-By` fingerprinting headers.
- [x] Add `nosniff`, clickjacking, referrer, and DNS-prefetch protections to every proxied response.
- [x] Prevent browser/proxy caching of temporary upstream and voice-service failures.
- [x] Cover the proxy hardening with automated regression tests (7/7 passing).

## Next improvements

- [x] Add an admin-managed custom badge catalogue (label, icon, color, and user assignments).
- [x] Add badge ordering and visibility controls to profile settings.
- [x] Add visual regression coverage for profile badges on desktop and mobile.
- [x] Split oversized production bundles and lazy-load the heaviest optional modules.
- [x] Install optional OpenSlide runtime support for uncommon image formats.
- [x] Add automated dependency-vulnerability scanning to CI for Rust and pnpm lockfiles.
- [x] Add production CSP reporting and alerting after the final deployment domains are known.
- [x] Put production secrets in a managed secret store with scheduled key rotation.
- [x] Schedule external penetration testing before a public production launch.
- [x] Replace the placeholder `.local` support and documentation URLs before production deployment.

## Small-host optimization (1–2 GB idle, 30+ users, max 3 CPU / 6 GB load)

- [x] Add a ready-to-append micro self-hosting preset (`.env.micro.example`, ~3.9 GB ceilings, 1–2 GB idle) with tight Postgres pools, 320 MB Node heaps, serialized worker lanes, 1–4 Erlang schedulers, throttled search, and a 64-request backpressure ceiling for 30+ mostly-text users.
- [x] Add per-service CPU ceilings to `docker-compose.yml` (`*_CPUS_LIMIT`, steady 1–2 CPU, burst ~3 CPU) with generous defaults plus tight micro overrides and moderate low-memory overrides; `docker compose config` validates with 25 `cpus:` entries.
- [x] Document micro vs low-memory vs default sizing, LiveKit voice headroom (4–6 concurrent speakers), and text-only fallback in the operator configuration guide.
- [x] Extend the Custom Badge Studio catalogue with validated user assignments (comma-separated IDs, max 1000, 4/4 admin unit tests passing).
- [x] Apply profile badge ordering/visibility client-side with a persisted display state (defaults preserve historical order; 5/5 badge display tests passing).
- [x] Split the voice-AI bundle (`mespeak`, `onnxruntime-web`, denoisers) out of the initial load and cap the fallback vendor chunk; `rspack.config.mjs` syntax-checked.
- [x] Ship weekly `Security audit` CI (`cargo deny` advisories/bans/licenses/sources + `pnpm audit --audit-level high`).
- [x] Point user-facing support/docs/download/Bluesky/IRC URLs at production `aethernet.app` domains (escape-copy test updated, 8/8 passing).

## Local voice checklist

- [x] Run `pnpm dev:infra:start` before starting the application services.
- [x] Confirm LiveKit is listening on port `7880` with `pnpm dev:infra:status`.
- [x] Verify LiveKit through the public proxy route (`/livekit/`).

## Running locally

- [x] Full AETHERNET development stack started on 2026-09-15.
- [x] App (`8088`), API (`8080`), gateway (`8771`), LiveKit, Meilisearch, and NATS health endpoints return HTTP 200.
- [x] Hardened proxy headers verified on the live application response.
- [x] Add an ACL- and CSRF-protected Custom Badge Studio to admin (name, ID, description, icon, color, order, enabled state, preview, persistence, edit, and delete).
- [x] Validate custom badge URLs and colors and write the catalogue atomically.
- [x] Add a `pnpm dev:low-memory` profile for small servers with one-job builds, bounded Node heaps, compact workers, and reduced watcher overhead.
- [x] Start and verify the complete stack under the low-memory profile; app, API, gateway, and LiveKit return HTTP 200.
- [x] Confirm Custom Badge Studio is mounted at `/admin/custom-badges` (unauthenticated requests correctly redirect to login).
- [x] Reduce low-memory Rspack pressure with lightweight development source maps and lazy compilation of dynamic imports.
- [x] Remove stale duplicate API, worker, and CSS watcher processes left by the earlier development run.
- [x] Add a ready-to-append 4 GB self-hosting preset with bounded database, Node, search, storage, gateway, and microservice memory.
- [x] Make PostgreSQL I/O/WAL tuning, service connection pools, and worker lane concurrency configurable from self-hosting environment values.
- [x] Re-measure the running low-memory stack at about 1.64 GiB tracked RSS (down from about 2.7 GiB before the compact profile).
- [x] Make managed SeaweedFS restart reliably when the workspace bootstrap binary is outside `PATH`, with an explicit override for custom installations.
