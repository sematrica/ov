# Nearby — Orbital Observatory

An interactive Near-Earth Object explorer built with Next.js, strict TypeScript, React Three Fiber, Three.js, Drei, and CSS. **Stage 4** adds major planets, search, a date-range Event Explorer, layers, smooth object navigation, and shareable links. Stage 3 Earth Encounter Mode retains real Moon ephemeris, high-resolution trajectories, and live distance/velocity telemetry. It preserves Stage 2 NASA NeoWs discovery and multiple asteroid trajectories, and the Stage 1 Sun, Earth, simulation clock, and interpolation engine.

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
- No uncertainty regions, physical surface textures, light-time corrections, orbital propagation, impact prediction, or additional planets in Solar System Mode. JavaScript dates cannot individually represent leap seconds.
- The name-based resolver deliberately supports a constrained set of asteroid naming formats. Unsupported or not-yet-available objects produce explicit errors instead of guessed identities. SBDB resolution is a future extension.
- Caches and provider queues are per server process, not durable or coordinated across deployed instances. A browser cache can outlive the server's discovery cache, so a later uncached manual addition may need a fresh NASA request for canonical metadata.
- WebGL is required. Rendering targets roughly 3–20 loaded NEOs, not thousands. Dense labels may overlap; the details panel and sidebar remain selectable alternatives. Panels scroll internally on desktop and stack on narrow screens.
- Horizons acquisition can take time. Already-started requests may finish after cancellation; stale results are kept out of the scene. No offline fallback is supplied.

## Stage 3 — Earth Encounter Mode

Select a discovered asteroid, then choose **View Close Approach** (a long-range asteroid trajectory is not required). The action uses the smallest published Earth miss-distance event in that discovery window, matching the metadata panel. **SOLAR SYSTEM** restores the broad heliocentric view; **EARTH ENCOUNTER** prepares the selected encounter. Loading leaves the existing view and clock usable, with cancellation and retry. Encounter playback starts paused at 24 hours before the event; press Play to animate.

### Architecture and coordinates

`Observatory` owns one `useSimulation` clock. Mode changes its active range and controls, not the time system. `OrbitScene` retains the same Canvas, renderer and decorative background; it switches celestial content and camera controllers. `EncounterScene` renders Earth, Moon, asteroid, optional trails and distance line. Earth focus, asteroid focus, follow and overview use damped camera movement. Manual orbit/zoom remains available; follow translates the camera with the asteroid while preserving the user's viewing offset.

Horizons remains the sole ephemeris source. All three bodies use geometric heliocentric J2000 ecliptic vectors (`CENTER=500@10`, `REF_PLANE=ECLIPTIC`, `REF_SYSTEM=ICRF`, `TIME_TYPE=UT`, `OUT_UNITS=AU-D`, `VEC_TABLE=2`, `VEC_CORR=NONE`). The astronomy layer subtracts Earth's interpolated position from the asteroid and Moon, and subtracts Earth's velocity from each body's velocity. Earth is consequently at the origin. The common rotation `(x,y,z) → (x,z,−y)` preserves handedness. See the [JPL Horizons API documentation](https://ssd-api.jpl.nasa.gov/doc/horizons.html).

A single uniform display conversion maps one scene unit to one lunar distance for **all** encounter geometry. No independent Moon-orbit scaling occurs. Body markers are exaggerated, with minimum screen sizes for legibility; they do not represent physical diameters or contact distances. Earth’s marker is largest. At distant encounters, use Focus Earth to inspect the Moon, and Overview to compare the full geometry. Trails distinguish the brighter past from the dimmer future.

### High-resolution ephemeris and Moon

`/api/encounter` re-resolves canonical NeoWs metadata rather than accepting arbitrary Horizons commands. It requests the asteroid, Earth (399), and Moon (301) over the same ±24-hour window, at 10-minute intervals: 289 samples per body. `encounterWindow` accepts a configurable half-duration (default 24 hours); cadence is centralized as `ENCOUNTER_STEP_MINUTES`. This is a bounded inspection window, not a new year-long high-resolution dataset. The Moon has real heliocentric Horizons vectors, not a circular animation.

The existing serial JPL queue is shared by broad and encounter requests. A separate bounded six-hour server cache keys target ID/command, start, end and sample interval. Earth/Moon vectors can be reused for exactly matching windows. A bounded browser cache avoids refetching successful encounter datasets. Failed Moon responses allow a partial encounter, show a warning, and are not browser-cached so re-entry retries. Earth or asteroid failure preserves Solar System Mode. Data outside available ephemeris coverage is rejected; no encounter extrapolation or frozen endpoint fallback is used. Requests already submitted to providers may finish after cancellation, but stale responses cannot switch the view.

### Live telemetry versus published metadata

Live distance is the magnitude of `asteroidPosition − earthPosition`, multiplied by **149,597,870.7 km/AU**. Lunar distances divide kilometers by the conventional mean **384,400 km/LD**; this reference is not the Moon's varying instantaneous distance. Live relative speed is the magnitude of the difference of interpolated Horizons velocity vectors, converted from AU/day to km/s. No speed is inferred from animation frames.

**SIMULATION NOW** reports the shared clock's distance and relative speed. **NASA CLOSE APPROACH** separately shows NeoWs's published timestamp, miss distance, velocity and potentially-hazardous classification. A potentially hazardous classification is not an impact prediction. The clickable trajectory marker and timeline diamond use NASA's event time. A separate piecewise-linear trajectory minimum is labeled **Visualization minimum based on sampled/interpolated trajectory**; it never replaces NASA metadata.

The existing transport supports 1 minute/sec, 10 minutes/sec, 1 hour/sec and 6 hours/sec in encounter mode, forward/reverse playback, 10-minute steps and closest-approach jumps. The shared clock pauses at data boundaries. No provider requests occur during playback or scrubbing.

### Verification and limitations

Unit tests cover relative coordinates, 3D distances, units, vector velocities, configurable windows, coverage rejection, interpolated minima and cache keys. Browser tests cover canvas reuse, shared-clock seeking, cached re-entry, live telemetry changes, camera controls, partial Moon failure, full encounter failure, and mobile layout. `tests/fixtures/encounter.json` records actual Horizons Earth/Moon/(2008 ST) responses for 2026-09-25 23:54 through 2026-09-27 23:54 UTC; it is test data only.

Ten-minute linear position/velocity interpolation is an approximation; there is no adaptive sampling or uncertainty analysis. The displayed minimum may differ from NeoWs and is limited by sampling and orbit-solution differences. Date-only NeoWs events retain their day-precision label and center the window on that supplied day timestamp; no precise event time is invented. Only one encounter is active at a time, and its ±24-hour path need not contain a global orbital minimum. Distant encounters may place the asteroid outside the Earth-focused view; Overview restores the full geometry. Stage 4 adds date/object/event links (see below). Existing process-local cache/quota and WebGL limitations remain. No impact simulation or collision probability is implemented.

### Stage 3 follow-up context

Prioritize adaptive close-approach sampling with quantified interpolation error, encounter URL links, improved label placement, and robust SBDB identity resolution. Broader planet context could follow as a separate feature. Keep risk assessment and impact simulation outside this visualization until separately specified and scientifically validated.

## Stage 4 — Solar-system exploration and Event Explorer

### Bodies, coordinates, and rendering

`lib/explorer/catalog.ts` normalizes Sun, Mercury, Venus, Earth, Moon, Mars, Jupiter, and Saturn metadata. Planet targets use the physical body centers (199, 299, 399, 301, 499, 599, 699), not decorative circles or separately scaled orbits. `/api/planet` uses the existing Horizons parser, interpolation model, and shared serial provider queue. `usePlanets` loads each body independently and keeps successes visible if another fails; Data status shows queued/loading/error states and a retry action. The existing Earth-first startup remains usable while planets load.

Solar mode keeps **one scene unit = one AU**. Encounter mode keeps **one scene unit = 384,400 km**, uniformly applied to Earth-relative Moon and asteroid coordinates. Body display radii and minimum pixel sizes are exaggerated independently of positions. Camera near/far planes cover these navigation scales; no orbital distances are altered. Orbit lines show the loaded time interval, not an invented closed ellipse. In particular, a two-year Saturn/Jupiter track is only part of an orbit. Optional Uranus/Neptune are not included.

Planet and asteroid rendering share the same body/path components. Labels prioritize the selected object and major bodies, suppress overlapping labels, and hide unselected distant asteroid labels. Search remains an alternative when a label is hidden. There is no attempt to render the full asteroid catalog.

### Event Explorer and provider requests

`/api/events` splits an inclusive custom range into **nonoverlapping seven-calendar-day windows**, with a maximum of **90 days per query** (at most 13 windows). Requests run sequentially and reuse normalized NeoWs window caches. Today, Next 7 days, Next 30 days, and Previous 7 days populate the date controls; Browse events explicitly starts acquisition. Historical custom ranges are supported between 1900 and 2100, subject to provider availability. Dates and presets use UTC, matching simulation time.

Each event has its own `object ID + approach timestamp + Earth` identity; multiple approaches for one asteroid remain separate. Results are deduplicated, sorted by date/distance/diameter/velocity, and filtered by maximum lunar distance, minimum estimated diameter, and potentially hazardous classification. Unknown measurements fail the applicable numeric filter rather than being treated as zero. The diameter filter uses the published maximum estimate. Lists render 25 rows per page.

Failed windows are reported alongside successful results. Rate-limit/configuration errors stop remaining calls and identify skipped windows. Only fully successful combined results enter the browser event cache; individual successful windows remain server-cached, so retrying partial results avoids repeating completed provider work. NASA keys stay server-only. DEMO_KEY quotas can be exhausted by large queries; use a configured NASA key for regular browsing. No high-resolution trajectories are requested merely to display event rows.

### Events, clock, and camera

View Encounter passes the **selected event's exact timestamp** to the Stage 3 pipeline rather than choosing another approach of that asteroid. It loads matching high-resolution Earth/Moon/asteroid data, selects the body, and starts paused before the event. View in Solar System reuses the same acquired vectors in heliocentric coordinates and frames Earth plus the asteroid. This solar event context has a bounded ±24-hour timeline; the Solar System mode button returns to the broad timeline. Existing planetary and asteroid trajectories are shown only while they cover the active time, never frozen outside their range. Historical event contexts can therefore lack planets until returning to/reloading a broad date-centered window.

A single selected-event marker appears on the timeline when covered; thousands of event markers are never rendered. Previous/Next encounter navigates the chronologically loaded event list. Today and Jump to date manipulate the same clock; dates outside the current range reopen the application with a new date-centered broad window.

Camera presets provide Solar System overview, Inner planets, Earth, and Focus/Follow selected object. Transitions are damped. Manual controls can interrupt a transition, and follow preserves the camera offset while tracking movement. Earth Encounter retains its dedicated focus/follow/overview controls. Compact Layers menus control planets, planetary paths, Moon, asteroids, asteroid paths, labels, and encounter distance lines.

### Search and links

Search normalizes case, whitespace, and parentheses and matches names, designations, and provider IDs among catalog bodies, discovered NEOs, and Event Explorer results. Selecting metadata-only objects exposes their existing trajectory/encounter actions. No arbitrary remote asteroid-catalog search is added: an absent Apophis/Bennu/designation should be discovered through an appropriate event date range first. This avoids ambiguous or guessed Horizons commands.

Date and body links, for example `/?date=2026-10-03&object=jupiter&mode=solar`, restore the broad window and selection. Event actions automatically write `date`, `object=neo:<NASA ID>`, `mode`, and the exact `event` UTC epoch to the address bar. **Update link** captures the current meaningful selection. Opening an event link queries that day's NeoWs metadata and reuses the same encounter loader. Bare names/numbers can resolve only when a matching event occurs on the linked date; missing matches produce a clear message. Invalid query values are rejected. Links do not encode camera rotation, layers, or playback animation frames. Native history replacement uses Next.js's supported browser-history integration.

### Caches and performance

Trajectory keys centralize object/command, coordinate frame and units, start/end, cadence, and purpose (`planet-wide`, `long-range-asteroid`, `encounter-high-resolution`). Cache instances remain separate and bounded, with in-flight deduplication. All Horizons acquisition shares the existing **single-request queue**, which deliberately stays stricter than 2–4 concurrent requests to follow JPL's sequential-request guidance.

Sampling is centralized in the data layer: Mercury/Venus/Earth/Moon every six hours; Mars every 12 hours; Jupiter/Saturn daily; long-range asteroids every six hours; encounters every 10 minutes. A 731-day outer-planet track has 732 samples instead of a high-resolution multi-year dataset. No provider calls occur during animation. Existing 20-loaded-NEO limits remain; event metadata is paginated independently of rendered objects. Caches/queues are per process, not coordinated across deployments.

### Checks, limitations, and next stage

`tests/explorer.test.ts` adds event normalization, splitting, deduplication, sorting/filtering, URL parsing, search normalization, cache keys, and catalog tests. Browser coverage checks planet search, labels/layers, exact event jumps, generated-link reload, mobile layout, and partial failures alongside all Stage 1–3 regressions. `tests/fixtures/planets.json` records actual JPL samples for 2026-09-27 through 2026-09-28 and is not a production fallback.

Linear interpolation, finite provider coverage, and approximate display markers remain limitations. The Moon can overlap Earth's exaggerated marker in solar mode; use Earth Encounter for lunar-scale inspection. Search is restricted to known/discovered objects. Large metadata ranges require multiple requests and can be slow or rate-limited; use smaller windows as needed. URL state does not restore arbitrary free-form camera poses or exact sub-day playhead positions. No uncertainty visualization, impact probability, or impact trajectories are generated; potentially hazardous remains a classification, not a prediction.

Recommended Stage 5 planning: quantify interpolation error and consider adaptive sampling, improve remote identity resolution and label layout, and assess durable shared caches with coordinated quotas. Any AI, mission, account, notification, or impact-risk work needs separate scope and validation. **No Stage 5 features are implemented.**

## Spacecraft Explorer

Open **Spacecraft Explorer**, choose a showcase mission or search by name, select an explicit Horizons result, then choose a UTC date range and **Add to visualization**. Voyager 1 and Voyager 2 are the initial interstellar showcases. New Horizons, Cassini, Galileo, and Juno are also in the discovery catalog. Search can find other Horizons spacecraft, including supported Pioneer missions; availability depends on the requested dates. Historical missions need historical ranges: try Cassini on 2010-01-01 through 2010-01-03 or Galileo on 2000-01-01 through 2000-01-03.

### Identity and trajectory pipeline

`models/spacecraft.ts` defines generic `spacecraft:<Horizons ID>` identities and keeps mission metadata separate from the shared `SpaceObjectTrajectory` model. `HorizonsSpacecraftSearchService` calls the official [Horizons Lookup API](https://ssd-api.jpl.nasa.gov/doc/horizons_lookup.html) with `group=sct`. Results retain canonical identifiers, aliases, and COSPAR designations. Multiple results are presented for explicit selection; names are never guessed into numeric commands. Even curated catalog buttons perform lookup. Lookup availability does not guarantee ephemerides for every date.

`/api/spacecraft/trajectory` verifies the selected identifier through lookup before using the existing Horizons service, vector parser, cache, interpolation, scene, and simulation clock. All vectors use the existing heliocentric J2000 ecliptic AU/day convention. Historical and future vectors are accepted only where Horizons supplies them. No mission description, fixture, propagation model, or invented coordinates supplies production positions.

Requests accept 1–366-day windows between 1900 and 2100, subject to provider coverage. Sampling is hourly for windows of up to seven days and every six hours otherwise. The shared serial JPL queue also handles lookup. Server spacecraft trajectories use a bounded six-hour cache; the browser cache holds up to 24 successful windows for six hours. Keys include identity/command, time bounds, cadence, coordinate frame, units, and spacecraft purpose. Lookup and curated metadata have separate 24-hour caches. There are no provider requests during animation.

### Navigation and measurements

Teal symbolic spacecraft markers share the normal body selection and path rendering. Each craft supports focus, follow, visibility, path visibility, and a label. **Human spacecraft**, **Spacecraft trajectories**, and **Spacecraft labels** are independent layers. Camera presets include inner planets, outer solar system, interstellar overview, and individual loaded spacecraft. Smooth transitions and follow preserve the existing manual controls. Positions remain uniformly scaled at one AU per scene unit; the extended camera range and logarithmic depth buffer support distant probes without distorting their positions. Marker sizes are symbolic.

The selected panel reports position at simulation time, heliocentric speed, Sun and Earth distances in AU and km, and calculated one-way signal travel time. Distances and speed come from interpolated vectors, using 149,597,870.7 km/AU and 299,792.458 km/s for light speed. Signal travel time is the simultaneous geometric separation divided by light speed: it is an approximation, not a relativistic or retarded-time communications solution. A matching Earth trajectory is requested separately; if unavailable, Earth distance and signal travel time remain unavailable while spacecraft/Sun values still work.

The shared clock is bounded to the loaded window. Returning to Solar System restores the broad timeline. Objects outside their available samples are omitted, never frozen at an endpoint or extrapolated. The panel's coverage is the loaded request interval, not the mission's entire archive. **Update link** preserves spacecraft identity and date; reopening resolves the craft and loads a one-day window for that date, not the original custom range.

### Ephemeris, mission metadata, and telemetry

**Horizons provides ephemerides, not raw spacecraft telemetry.** The panel labels its vectors as modeled position at simulation time. Mission descriptions, launch dates, status snapshots, and day-precision milestones come from a separate curated NASA mission-profile adapter. Each profile has source links and a review date; it is not a current operational-status feed. Unknown metadata fields remain unavailable. No page scraping or live page-number polling is implemented.

`SpacecraftDataProvider` exposes metadata and an optional telemetry capability with provider-specific freshness. Timeline events are part of the metadata result. The provider registry in `lib/providers/registry.ts` centralizes the official Horizons, spacecraft lookup, NeoWs, and mission-profile sources. New mission-specific adapters can be registered without changing trajectory parsing or rendering.

No telemetry adapter is currently registered, so every spacecraft explicitly reports **Public telemetry feed not available.** Not every spacecraft has a public real-time telemetry API. No engineering or instrument measurements are synthesized. Additional adapters must have a documented authoritative API, provenance, units, timestamps, and a freshness policy before claiming telemetry support.

### Reliability, verification, and limits

Empty searches, ambiguous identities, provider failures, and unavailable historical/future coverage are handled separately. An unsupported date produces **Trajectory unavailable for selected date** with the provider reason. One craft's failure does not remove other objects. Earth or metadata failures preserve usable spacecraft ephemerides. Failed or partial responses are not cached as fully successful browser loads; retry can reuse successful server requests. Removed or superseded loads cannot reappear from late responses.

Tests cover lookup normalization, exact identifier resolution, generic domain mapping, the real Horizons request/parser pipeline, cache deduplication and keys, provider selection, unsupported telemetry, interpolation coverage, vector distances/speed/light-time, and spacecraft URL parsing. Browser tests exercise Voyager selection, playback, focus/follow, visibility/layers, cache reuse, link restoration, historical coverage errors and recovery, and narrow-screen layout alongside all Stage 1–4 regressions. `tests/fixtures/spacecraft.json` contains recorded official responses used only in tests. Live checks succeeded for Voyager 1/2 and New Horizons in October 2026, Cassini in January 2010, Galileo in January 2000, and Juno in January 2020; this is not a claim of complete archive coverage.

Known limits: finite date windows, linear interpolation rather than adaptive maneuver sampling, no complete coverage-index discovery, no live telemetry, curated metadata for only six showcase missions, and process-local caches/queues. Other searched spacecraft can work without mission metadata. Widely separated spacecraft are easiest to inspect with their individual camera presets. Existing WebGL and provider availability limitations apply.

For the next provider integration, first evaluate NASA Science's public structured mission-content endpoint for profile refreshes (for example, its [Voyager 1 mission record](https://science.nasa.gov/wp-json/wp/v2/mission?slug=voyager-1)). It supplies publishing content, not a standardized engineering telemetry feed. Validate its schema and date provenance before automating metadata updates. Keep Horizons as the position authority; assess any later mission telemetry API individually rather than assuming that a mission website or archive is a live feed. No speculative additional providers are implemented.
