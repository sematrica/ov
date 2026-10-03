"use client";
import { useState } from "react";
import {
  BODIES,
  matchesSearch,
  type Layers,
  type SolarCamera,
} from "@/lib/explorer/catalog";
import type { NearEarthObject } from "@/models/neo";
import type { ObjectId } from "@/models/trajectory";
export function ExplorerControls({
  neos,
  layers,
  onLayers,
  onSelect,
  onCamera,
  onEvents,
  onSpacecraft,
  spacecrafts,
  onSpacecraftFocus,
  statuses,
  onRetry,
  onDate,
  onShare,
}: {
  neos: NearEarthObject[];
  layers: Layers;
  onLayers: (layers: Layers) => void;
  onSelect: (id: ObjectId) => void;
  onCamera: (mode: SolarCamera["mode"]) => void;
  onEvents: () => void;
  onSpacecraft: () => void;
  spacecrafts: { id: ObjectId; name: string }[];
  onSpacecraftFocus: (id: ObjectId) => void;
  statuses: Record<string, string>;
  onRetry: () => void;
  onDate: (date: string) => void;
  onShare: () => void;
}) {
  const [query, setQuery] = useState("");
  const [jump, setJump] = useState("");
  const items = [...BODIES, ...neos];
  const matches = items
    .filter((o) =>
      matchesSearch(query, o.name, o.id, "nasaId" in o ? o.nasaId : ""),
    )
    .slice(0, 12);
  return (
    <div className="explorer-toolbar">
      <details className="search-menu">
        <summary>Search objects</summary>
        <label>
          Object name or designation
          <input
            aria-label="Search objects"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Earth, Apophis, 99942…"
          />
        </label>
        <div className="search-results">
          {matches.map((o) => (
            <button key={o.id} onClick={() => onSelect(o.id)}>
              {o.name}
            </button>
          ))}
        </div>
        {!matches.length && (
          <p>
            No match in loaded bodies or discovered events. Browse another event
            date range to expand the search.
          </p>
        )}
      </details>
      <button onClick={onEvents}>Event Explorer</button>
      <button onClick={onSpacecraft}>Spacecraft Explorer</button>
      <details>
        <summary>Camera</summary>
        <div className="search-results">
          {(
            ["overview", "inner", "interstellar", "focus", "follow"] as const
          ).map((mode) => (
            <button key={mode} onClick={() => onCamera(mode)}>
              {
                {
                  overview: "Outer Solar System",
                  interstellar: "Interstellar overview",
                  inner: "Inner planets",
                  focus: "Focus selected object",
                  follow: "Follow selected object",
                }[mode]
              }
            </button>
          ))}
          {spacecrafts.map((s) => (
            <button key={s.id} onClick={() => onSpacecraftFocus(s.id)}>
              {s.name}
            </button>
          ))}
          <button
            onClick={() => {
              onSelect("earth");
              onCamera("focus");
            }}
          >
            Earth
          </button>
        </div>
      </details>
      <details>
        <summary>Layers</summary>
        {(Object.keys(layers) as (keyof Layers)[]).map((key) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={(e) => onLayers({ ...layers, [key]: e.target.checked })}
            />
            {
              {
                planets: "Planets",
                planetOrbits: "Planet orbits",
                moon: "Moon",
                asteroids: "Asteroids",
                asteroidTrajectories: "Asteroid trajectories",
                labels: "Labels",
                distanceLines: "Distance lines",
                spacecraft: "Human spacecraft",
                spacecraftTrajectories: "Spacecraft trajectories",
                spacecraftLabels: "Spacecraft labels",
              }[key]
            }
          </label>
        ))}
      </details>
      <details>
        <summary>Date</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onDate(jump);
          }}
        >
          <input
            aria-label="Jump to date"
            required
            type="date"
            min="1900-01-01"
            max="2100-12-31"
            value={jump}
            onChange={(e) => setJump(e.target.value)}
          />
          <button>Jump to date</button>
        </form>
      </details>
      <details>
        <summary>Data status</summary>
        {BODIES.filter((b) => b.id !== "sun" && b.id !== "earth").map((b) => (
          <p key={b.id}>
            {b.name}: {statuses[b.id] ?? "Queued"}
          </p>
        ))}
        <button onClick={onRetry}>Retry planet loading</button>
      </details>
      <button onClick={onShare}>Update link</button>
    </div>
  );
}
