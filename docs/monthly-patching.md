# Monthly patching

Add a dated section after each month's dependency review. Record resolved versions, the reason for each change, and any findings left for follow-up.

## 2026-10-27

| Dependency | From | To | Why |
| --- | --- | --- | --- |
| `axios` | 1.19.0 | 1.20.0 | Fix high-severity advisories. |
| `body-parser` | 2.3.0 | 2.4.0 | Fix the request-body denial-of-service advisory. |
| `moment` | 2.30.1 | 2.31.0 | Fix the path-traversal advisory. |
| `vitest` and `@vitest/coverage-v8` | 4.1.11 | 4.1.12 | Fix moderate Vitest and mocker advisories. |
| `follow-redirects` (lockfile) | 1.16.0 | 1.16.1 | Fix credential-stripping advisories. |
| `proxy-addr` (lockfile) | 2.0.7 | 2.0.8 | Fix the critical IP-spoofing advisory. |
| `source-map-js` (lockfile) | 1.2.1 | 1.2.2 | Fix the event-loop denial-of-service advisory. |
| `vite` (lockfile) | 8.1.3 | 8.3.5 | Resolve past the affected `<=8.1.5` versions; 8.1.6 is the first patched 8.x release. |

The initial audit reported 10 vulnerabilities (1 critical, 5 high, 4 moderate). After patching, both the full and production audits report zero vulnerabilities. The lockfile-only audit fix updated compatible transitive dependencies; no overrides were needed.

The coverage-enabled test suite passed: 6 test files and 73 tests. The Vite build passed, with existing Sass `@import` deprecation and unresolved GOV.UK asset warnings. The explicit Biome check passed for `package.json`; `npm run quality` returned 1 because its changed-file scan found no supported files to process. No security findings remain; review the existing Sass and asset warnings separately.

The full local Docker stack was rebuilt with the patched dependencies. App and verify returned HTTP 200, all five internal service checks passed, and PostgreSQL, Redis, ClamAV and pgAdmin responded. Running service dependency versions matched the patched lockfiles. Existing databases and Orbit stub state were retained; live payment, email and address-provider transactions were not exercised.
