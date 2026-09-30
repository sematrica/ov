# Nearby — Orbital Observatory

An interactive Near-Earth Object explorer built with Next.js, strict TypeScript, React Three Fiber, Three.js, Drei, and CSS. **Stage 2** adds date-based NASA NeoWs discovery and multiple independently loaded asteroid trajectories to the Stage 1 Sun, Earth, simulation clock, and interpolation engine.

**NeoWs supplies discovery and close-approach metadata. JPL Horizons remains the authoritative trajectory/ephemeris source for all spatial positions.** NeoWs miss distances and velocities are never used to place an asteroid in the 3D scene.

## Run and configure

Use Node.js 22 or newer and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3000. The server needs outbound HTTPS access to `api.nasa.gov` and `ssd.jpl.nasa.gov`.

Set your own key in `.env.local`:

```dotenv
NASA_API_KEY=your_nasa_api_key
```

Get a key from [NASA Open APIs](https://api.nasa.gov/). **Never prefix it with `NEXT_PUBLIC_`**. The key is used only by the server-side NeoWs service; it is not sent to the browser. `.env.local` is ignored by Git; `.env.example` contains only the public `DEMO_KEY`.

If the variable is absent in **development**, the service explicitly falls back to `DEMO_KEY`. In production, an explicit `NASA_API_KEY` value is required; setting it explicitly to `DEMO_KEY` is permitted for a limited smoke test. The UI indicates demo-key mode. This is still real NASA data, not a demo trajectory dataset.

NASA documents DEMO_KEY limits of **30 requests per hour and 50 per day per IP**. Registered keys normally allow 1,000 requests per hour, shared across NASA APIs. Limits may vary by service. See [NASA authentication and rate limits](https://api.nasa.gov/assets/html/authentication.html). Restart the server after changing credentials.

For production:

```sh
npm run build
npm start
```

Stop the development server before using the same port, or use `npm start -- --port 3001`.

## Stage 2 workflow

1. Earth loads from Horizons independently. The initial scene has the Sun and Earth; no asteroid is hard-coded.
2. Choose a **Discovery date (UTC)**, or click **Use simulation date**, then **Load NEOs for …**. Merely changing a date, scrubbing, or playing does not make discovery requests.
3. NeoWs retrieves the inclusive three-day window, selected date minus one day through plus one day. The window radius is isolated in `discoveryWindow`; supported configurable radii produce at most seven calendar days.
4. The list shows normalized names, approach times, estimated diameter ranges, miss distance in lunar distances (LD), relative velocity, and NASA's potentially hazardous classification. **Sort & filter** exposes distance, maximum estimated diameter, approach date, hazardous-only, and minimum maximum-diameter filters. Missing measurements remain unavailable, not zero.
5. `selectDefaultObjects` selects up to three objects with the smallest known Earth miss distances in the window. It does not rank scientific importance. The default count is configured by `DEFAULT_NEO_COUNT`.
6. Each selected object resolves independently in Horizons. Successful trajectories enter the scene; one failure does not block Earth or other objects. Manually use **Add to visualization** for other discoveries.
7. Click a sidebar row, marker, or label to use the same selection state and information panel. **Visible / Hidden** toggles rendering; **Remove** releases a loaded slot while retaining metadata. A later add can reuse the trajectory cache. At most 20 NEO trajectories may be loaded or loading, including hidden ones (`MAX_LOADED_NEOS`).

Discovery results and the simulation clock are independent. The picker is restricted to the loaded approximately ±1-year timeline. Changing the discovery date does not move the clock. The details panel distinguishes **NASA close-approach data** (the closest Earth approach in that loaded window) from **current simulated position**, including distance from the Sun and Earth.

**Potentially hazardous is NASA's classification, not a prediction that the object will hit Earth.** The app makes no collision warnings, risk assessments, or impact predictions.

## Architecture and data flow

```text
Explicit discovery date
  → GET /api/discovery?date=YYYY-MM-DD
  → server-side NeoWsService + NASA feed
  → isolated parser → normalized NearEarthObject[]
  → discovery list / filters / default selection
  → Add to visualization
  → GET /api/neo-trajectory?id=…&date=…&start=…&end=…
  → canonical metadata from server discovery cache
  → HorizonsTargetResolver
  → queued HorizonsService request
  → validated SpaceObjectTrajectory
  → keyed multi-object React store + shared simulation clock
  → existing interpolation → React Three Fiber
```

`GET /api/trajectories` still supplies the initial Earth trajectory and timeline. The Three.js components contain no provider URLs, NASA keys, raw API parsing, or identifier conversions.

Key files:

| Location                                                         | Responsibility                                                                      |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/models/trajectory.ts`, `neo.ts`                             | Serializable trajectory, metadata, discovery, and per-object state contracts        |
| `src/lib/neows/window.ts`, `parser.ts`, `service.ts`             | UTC windows, runtime validation and normalization, server-only NASA requests        |
| `src/lib/jpl/resolver.ts`                                        | Translate canonical NASA names into constrained Horizons targets                    |
| `src/lib/jpl/horizons.ts`, `parser.ts`                           | Authoritative vectors, Earth bootstrap, queued requests, validated CSV parsing      |
| `src/lib/cache/asyncCache.ts`                                    | Separate bounded caches, pending-request deduplication, serial queues               |
| `src/lib/neo/selection.ts`, `store.ts`, `client.ts`, `format.ts` | Sorting/default selection, reducer, application API clients, display formatting     |
| `src/hooks/useNeoDiscovery.ts`                                   | Discovery generations, request tokens, object lifecycle, independent loading/errors |
| `src/hooks/useSimulation.ts`, `useTrajectories.ts`               | Shared clock and initial Earth loading                                              |
| `src/components/discovery/`                                      | Collapsible discovery sidebar and per-object controls                               |
| `src/components/ObjectPanel.tsx`                                 | NASA approach metadata and separately timed JPL positions                           |
| `src/components/space/`                                          | Multiple paths/markers, projected accessible labels, camera controls                |
| `src/lib/astronomy/`                                             | Reused interpolation, coordinate rotation, UTC range/time calculations              |
| `src/app/api/`                                                   | Validated server-side HTTP boundaries with relevant error responses                 |

### Horizons resolution

NeoWs `id` and `neo_reference_id` are NASA keys, **not assumed to be Horizons IDs**. A scene ID is namespaced as `neo:<NASA id>`, with `earth` reserved.

The resolver extracts an exact recognized provisional designation from the canonical NASA name, e.g. `99942 Apophis (2004 MN4)` → `DES=2004 MN4;`. For a numbered name without a provisional designation, e.g. `433 Eros`, it uses the documented small-body lookup `433;`. Unrecognized names are rejected without guessing. The endpoint retrieves canonical metadata from the requested NASA discovery window; the browser cannot submit arbitrary Horizons commands.

Horizons must return a target matching the expected designation or permanent number. No matches, ambiguous matches, API errors, wrong identities, and malformed vectors become per-object errors. No first-match selection or invented coordinates are used. Some newly discovered or unusually named bodies may not resolve yet; their metadata remains inspectable.

Requests use `EPHEM_TYPE=VECTORS`, `CENTER=500@10`, `REF_PLANE=ECLIPTIC`, `REF_SYSTEM=ICRF`, `OUT_UNITS=AU-D`, `VEC_TABLE=2`, `VEC_CORR=NONE`, `TIME_TYPE=UT`, `CSV_FORMAT=YES`, and a six-hour step. For contemporary dates, Horizons UT is UTC. Its JSON `result` contains the table between `$$SOE` and `$$EOE`; the parser validates identity, Sun origin, frame, units, time scale, finite vectors, increasing dates, and full requested endpoint coverage.

References: [Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html), [Horizons designation rules and manual](https://ssd.jpl.nasa.gov/horizons/manual.html).

### Caching and request management

- **NeoWs server cache:** 32 successful date windows, one-hour TTL, separate in-flight deduplication.
- **Horizons server cache:** 64 successful object/command/range/step entries, six-hour TTL, separate in-flight deduplication. The original one-window Earth dataset cache remains.
- **Browser session caches:** up to 32 discoveries and 64 trajectories, retained in memory until page reload or eviction. Repeat loads, removal/re-addition, and visibility changes avoid repeat provider calls while cached. Private HTTP caches also permit one-hour reuse.
- **Errors are never retained in data caches.** A row keeps its error until an explicit retry. There are no aggressive automatic retries.
- Each provider has a serial server queue. Automatic asteroid additions are also sequential. Concurrent requests for the same cache key share one promise; loaded/loading objects are not requested twice.
- A discovery-generation counter ignores responses from superseded dates. New discoveries stop the previous automatic-add loop after any already-started object request. Existing loaded objects remain under **From previous windows** and keep their original metadata window until rediscovered.
- Cancellation/removal invalidates an object's request token, so late data cannot make it visible again. The underlying shared request may finish and enter the cache; it is not forcibly aborted. Repeat discovery does not automatically re-add objects explicitly removed or hidden in the same session.

## Time, units, and rendering

One scene unit is one **AU**. Ecliptic `(x, y, z)` rotates to Three.js `(x, z, −y)`, preserving distances and handedness. The panel displays original JPL coordinates. Marker radii are deliberately exaggerated and independent of physical diameter. Colors identify objects visually and do not encode risk. Background stars are decorative.

The existing shared UTC clock, timeline, forward/reverse playback, one-day steps, Now reset, and four speed settings remain. Elapsed real time drives simulation time. Hidden tabs do not accumulate playback jumps, and playback stops at the sampled boundaries. Both scene positions and information-panel coordinates use this same clock. The default 731-day timeline contains 2,925 six-hour samples per object. Orbit paths represent the entire loaded interval and may contain overlapping revolutions.

## Checks and fixtures

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

The lint configuration uses Next.js's recommended rules. ESLint 9 is pinned to remain compatible with the React/import/accessibility plugins bundled with this Next.js version; upgrade these together when their ESLint 10 support is available.

Browser tests require the app running in another terminal. They use recorded real responses and do not contact NASA/JPL:

```sh
npm run dev
# In another terminal, using installed Google Chrome:
npm run test:browser
# Or install Playwright Chromium once:
npx playwright install chromium
PLAYWRIGHT_CHANNEL=chromium npm run test:browser
```

Set `TEST_BASE_URL` to test a different local port. Unit tests cover normalization, malformed/empty responses, UTC windows, sorting/filtering/default selection, target resolution, isolated object state, cache expiry/deduplication, provider queues, rate limits, credentials, and the original interpolation/time cases. Browser tests cover explicit loading, three-object defaults, selection, visibility, removal/re-add cache reuse, playback without API traffic, individual failures, stale discovery responses, cancellation, rate-limit recovery, and narrow-screen controls.

Fixtures under `tests/fixtures` are real NASA/JPL responses or reduced subsets used **only by tests**. `neows-feed.json` records 2026-09-26 through 2026-09-28 with raw provider links removed. `stage2-browser.json` includes five real samples per body over 2026-09-27 through 2026-09-28. None are imported into production data paths.

## Known Stage 2 limitations

- Discovery is limited to the existing approximately ±1-year trajectory window; expanding or paging time ranges is not implemented.
- Six-hour linear interpolation is an approximation, particularly during close approaches. NASA closest-approach metadata and interpolated current distances should not be expected to match at sub-sample precision. Display decimals are not an accuracy guarantee.
- No uncertainty regions, physical surface textures, light-time corrections, orbital propagation, impact prediction, or additional planets/Moon. JavaScript dates cannot individually represent leap seconds.
- The name-based resolver deliberately supports a constrained set of asteroid naming formats. Unsupported or not-yet-available objects produce explicit errors instead of guessed identities. SBDB resolution is a future extension.
- Caches and provider queues are per server process, not durable or coordinated across deployed instances. A browser cache can outlive the server's discovery cache, so a later uncached manual addition may need a fresh NASA request for canonical metadata.
- WebGL is required. Rendering targets roughly 3–20 loaded NEOs, not thousands. Dense labels may overlap; the details panel and sidebar remain selectable alternatives. Panels scroll internally on desktop and stack on narrow screens.
- Horizons acquisition can take time. Already-started requests may finish after cancellation; stale results are kept out of the scene. No offline fallback is supplied.

## Recommended Stage 3 scope — not implemented

Focus next on JPL SBDB identity/physical metadata, sampling accuracy around close approaches, user-selectable trajectory windows, and durable shared caches with coordinated provider quotas. Improve crowded-label layout and camera focus as object counts grow. Preserve Horizons as the authoritative position source and validate interpolation error before adding richer close-approach analysis.

Moon/other planets, collision or impact simulation, thousands of objects, streaming, custom physics, AI assistants, accounts, and cloud persistence are outside this Stage 2 implementation.
