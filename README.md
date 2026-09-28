# Nearby — Orbital Observatory

A Phase 1 proof of concept for exploring Earth and **99942 Apophis (2004 MN4)** around the Sun. Drag the bottom timeline to move both bodies through time, inspect their heliocentric coordinates, and orbit the camera.

Built with Next.js App Router, strict TypeScript, React, React Three Fiber, Three.js, Drei, and plain CSS. No API keys, environment variables, external fonts, or invented trajectory fallback are used.

## Run

Requires Node.js 20.9 or newer and npm. Node 22 LTS or newer is recommended.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. The server needs outbound HTTPS access to `ssd.jpl.nasa.gov`. Initial loading may take several seconds while JPL integrates Apophis; an outage produces a visible error and Retry button.

```sh
npm run typecheck
npm test
npm run build
npm start
```

The development server must be stopped before starting production on the same port. To use another port: `npm start -- --port 3001`.

## Controls

- **Timeline:** drag or focus and use arrow keys. Scrubbing pauses playback.
- **Play / Pause:** advance the shared clock. Playback stops at the data boundaries.
- **Left / right arrows:** choose backward or forward playback; press Play to begin.
- **Skip buttons:** step backward or forward one day and pause.
- **Speed:** 1 hour, 1 day, 10 days, or 30 days per real second.
- **Now:** pause and return to the current time, clamped to the loaded window.
- **Map:** drag to orbit, scroll/pinch to zoom, right-drag or two-finger drag to pan.
- **Selection:** click a body, its label, or its object-list button.
- **View buttons:** reset the camera, toggle a top-down view, or show navigation help.

## Architecture and files

```text
src/
  app/
    api/trajectories/route.ts      Server-only HTTP boundary; meaningful 502 errors
    page.tsx, layout.tsx          Application entry and metadata
    globals.css                  Responsive observatory styling
  components/
    Observatory.tsx              Loading/error states and workspace composition
    ObjectPanel.tsx              Selected object's coordinates and distance
    controls/TimeControls.tsx     Timeline and transport controls
    space/OrbitScene.tsx          Scene, body markers, sampled paths, camera
    space/SceneLabels.tsx         Accessible DOM labels projected from the scene
  hooks/
    useTrajectories.ts            Loads our API once; keeps the dataset in memory
    useSimulation.ts              Shared UTC clock and elapsed-time playback
  lib/
    jpl/horizons.ts               HorizonsService, request options, bounded cache
    jpl/parser.ts                 JSON-result extraction, identity/frame validation, CSV parsing
    astronomy/interpolate.ts      Binary search, interpolation, coordinate rotation
    astronomy/time.ts             UTC range, clamping, elapsed-time calculations
  models/trajectory.ts            Serializable data contracts
tests/                           Focused tests and a real JPL response fixture
```

Data flow:

```text
Official JPL Horizons API
  → server-side HorizonsService
  → isolated parser + validation
  → normalized trajectories (AU / UTC milliseconds)
  → GET /api/trajectories
  → browser memory cache + central simulation clock
  → interpolation
  → React Three Fiber scene and information panel
```

The renderer never constructs JPL URLs or parses Horizons output. Both object positions and the selected information panel derive from the same simulation timestamp. Animation uses elapsed `requestAnimationFrame` time multiplied by the selected rate, rather than assuming a frame rate. Hidden tabs suspend elapsed-time accumulation.

## Authoritative data source

**JPL Horizons is the authoritative trajectory/ephemeris source for this visualization.**

- [Horizons API reference](https://ssd-api.jpl.nasa.gov/doc/horizons.html)
- [Horizons manual and object designation rules](https://ssd.jpl.nasa.gov/horizons/manual.html)
- Endpoint: `https://ssd.jpl.nasa.gov/api/horizons.api`

Earth uses `COMMAND='399'` (Earth's center, not the Earth–Moon barycenter). Apophis uses the exact provisional designation `COMMAND='DES=2004 MN4;'`, verified against a live JPL response identifying **99942 Apophis (2004 MN4)**. Every vector response must match the expected target. Ambiguous object responses are explicitly rejected rather than choosing a result.

Requests use:

| Parameter              | Value                                         |
| ---------------------- | --------------------------------------------- |
| EPHEM_TYPE             | VECTORS                                       |
| CENTER                 | 500@10 — center of the Sun                    |
| REF_PLANE / REF_SYSTEM | ECLIPTIC / ICRF — J2000 ecliptic              |
| OUT_UNITS              | AU-D — AU and AU/day                          |
| VEC_TABLE / VEC_CORR   | 2 / NONE — geometric position and velocity    |
| TIME_TYPE              | UT — UTC for the contemporary dates used here |
| CSV_FORMAT             | YES                                           |
| STEP_SIZE              | 6 h                                           |

The current day is aligned to UTC midnight; the range runs from 365 days before it through 366 days after it, ensuring the whole current day is included. Each body has **2,925 samples** across that 731-day window. JPL requests run sequentially, in accordance with its API usage guidance. The current dataset and in-flight request are cached in server memory for six hours, with at most one window retained. Failed requests are not cached. HTTP responses may be cached privately for an hour; browser animation operates entirely on its loaded memory dataset.

The parser reads the API JSON's `result` field, extracts only `$$SOE`…`$$EOE` CSV rows, converts Julian UTC dates to Unix milliseconds, and validates target identity, units, Sun origin, reference frame, finite vectors, increasing timestamps, and complete requested coverage. Tests use a real five-sample JPL response saved in `tests/fixtures/apophis-horizons.json` on 2026-09-27. That fixture is only imported by tests; it is never used as application fallback data.

## Coordinate and visual scales

One scene unit equals **one astronomical unit**. The ecliptic coordinates are rotated into Three.js as `(x, y, z) → (x, z, −y)`, preserving distances and handedness while putting the ecliptic north axis upward. The information panel displays the original JPL x/y/z values.

Sun, Earth, and asteroid marker sizes are deliberately exaggerated and are unrelated to physical diameter. Their center positions and path distances are not rescaled individually. Background stars are decorative, not an astrometric catalog.

## Validation

Focused tests cover real-response parsing, ambiguous matches, invalid identity/origin/units/frame/time scale, malformed or unordered samples, interpolation and boundaries, coordinate distance preservation, UTC leap-year windows, reverse playback, and frame-rate independence. `npm run typecheck` and `npm run build` validate the application and server route.

## Phase 1 limitations

- Only the Sun, Earth, and Apophis are supported. This is a visualization, not mission-planning or impact-risk software.
- Linear interpolation between six-hour samples approximates the trajectory between authoritative samples. It is not a continuous JPL integrator and is not suitable for resolving close-approach details. Six decimal places in the panel are display precision, not an accuracy guarantee.
- Paths show the complete sampled time window. Multiple revolutions may overlap; the lines are not fixed Kepler ellipses or artificially closed paths.
- No light-time correction, observer perspective, uncertainty regions, or physical surface textures.
- Time is displayed in UTC using JavaScript dates; leap seconds cannot be individually represented. The loaded window is fixed until page reload. Playback pauses on tab hiding and at the range ends.
- Memory caching is per server process and per browser session; there is no persistent/offline cache. Multiple server processes do not share a request queue.
- WebGL and hardware acceleration are required. The layout adapts to narrow screens with vertically stacked panels.

## Phase 2 plan — not implemented

1. Add a server-side **NeoWsService** for discovering NEOs and close-approach metadata. Keep the NASA API key on the server and introduce `.env.example` when that integration exists.
2. Add a server-side **SBDBService** for object identity, physical properties, orbit metadata, and uncertainties.
3. Keep **HorizonsService** responsible for authoritative trajectories. Normalize each service's output behind separate models and let the API layer compose them; do not move provider logic into Three.js components.
4. Add object search/selection, adaptive sampling around close approaches, longer range loading, and durable caches with coordinated JPL request scheduling.
5. Improve interpolation accuracy and validation before adding close-approach or uncertainty visualizations.

These are documented extension points only: there are no fake NeoWs or SBDB implementations.
