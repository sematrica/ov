"use client";
import { useState } from "react";
import type {
  SpacecraftRecord,
  SpacecraftTrajectoryResult,
} from "@/models/spacecraft";
import { SPACECRAFT_CATALOG } from "@/lib/spacecraft/metadata";
import { useSpacecraft } from "@/hooks/useSpacecraft";
import { DAY, utcDate } from "@/lib/astronomy/time";
import { parseDate } from "@/lib/neows/window";
import type { ObjectId } from "@/models/trajectory";
export function SpacecraftExplorer({
  manager,
  time,
  onSelect,
  onReady,
  onNavigate,
  initialRecord,
}: {
  manager: ReturnType<typeof useSpacecraft>;
  initialRecord?: SpacecraftRecord;
  time: number;
  onSelect: (id: ObjectId) => void;
  onReady: (id: ObjectId, data: SpacecraftTrajectoryResult) => void;
  onNavigate: (id: ObjectId, follow: boolean) => void;
}) {
  const [query, setQuery] = useState(
    initialRecord?.spacecraft.name ?? "Voyager",
  );
  const [chosen, setChosen] = useState<SpacecraftRecord | undefined>(initialRecord);
  const [start, setStart] = useState(() => utcDate(time - 30 * DAY));
  const [end, setEnd] = useState(() => utcDate(time + 30 * DAY));
  const [error, setError] = useState<string>();
  const [searched, setSearched] = useState(false);
  function search(q: string) {
    setQuery(q);
    setSearched(true);
    void manager.search(q);
  }
  function choose(record: SpacecraftRecord) {
    setChosen(record);
    manager.select(record);
    onSelect(record.spacecraft.id);
  }
  function load() {
    if (!chosen) return;
    try {
      const range = { start: parseDate(start), end: parseDate(end) };
      if (range.end <= range.start || range.end - range.start > 366 * DAY)
        throw new Error("Choose a range of 1–366 days.");
      setError(undefined);
      void manager.add(chosen, range, (d) => onReady(chosen.spacecraft.id, d));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid range.");
    }
  }
  const entry = chosen ? manager.entries[chosen.spacecraft.id] : undefined;
  return (
    <section aria-label="Spacecraft Explorer" className="spacecraft-explorer">
      <h2>Spacecraft Explorer</h2>
      <p className="explorer-note">
        Human exploration, modeled by NASA/JPL Horizons.
      </p>
      <div className="explorer-presets">
        {SPACECRAFT_CATALOG.map((name) => (
          <button key={name} onClick={() => search(name)}>
            {name}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(query);
        }}
      >
        <label>
          Search spacecraft…
          <input
            aria-label="Search spacecraft"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={80}
            required
          />
        </label>
        <button disabled={manager.searching}>Search Horizons</button>
      </form>
      {manager.searching && (
        <p role="status">Searching JPL spacecraft records…</p>
      )}
      {manager.searchError && <p role="alert">{manager.searchError}</p>}
      {!manager.searching &&
        searched &&
        !manager.searchError &&
        !manager.results.length && (
          <p>No spacecraft found. Try a name, alias, or designation.</p>
        )}
      <div className="spacecraft-results">
        {manager.results.map((record) => (
          <button
            key={record.spacecraft.id}
            onClick={() => choose(record)}
            aria-pressed={record.spacecraft.id === chosen?.spacecraft.id}
          >
            <strong>{record.spacecraft.name}</strong>
            <span>
              Horizons {record.spacecraft.horizonsId} ·{" "}
              {record.spacecraft.designation ?? "No launch designation"}
            </span>
          </button>
        ))}
      </div>
      {chosen && (
        <div className="spacecraft-choice">
          <h3>{chosen.spacecraft.name}</h3>
          <p>
            {chosen.metadata?.mission ?? "Mission metadata unavailable."}
            <br />
            Launch: {chosen.metadata?.launchDate ?? "Unknown"}
            <br />
            Status:{" "}
            {chosen.metadata?.missionStatus ??
              "Not supplied by metadata provider"}
          </p>
          <p className="explorer-note">
            Horizons target resolved. Date coverage is verified when loading;
            mission dates are not ephemeris coverage limits.
          </p>
          <div className="explorer-date-range">
            <label>
              Start (UTC)
              <input
                aria-label="Spacecraft start date"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              End (UTC)
              <input
                aria-label="Spacecraft end date"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
          <button
            onClick={() => {
              setStart(utcDate(time - 30 * DAY));
              setEnd(utcDate(time + 30 * DAY));
            }}
          >
            Around simulation date
          </button>
          <button disabled={entry?.status === "loading"} onClick={load}>
            {entry?.status === "loading"
              ? "Loading ephemeris…"
              : "Add to visualization"}
          </button>
          {error && <p role="alert">{error}</p>}
          {entry?.error && <p role="alert">{entry.error}</p>}
          <p className="explorer-note">
            Historical missions need a range within their mission. Loading
            outside Horizons coverage leaves the existing scene available.
          </p>
        </div>
      )}
      <h3>In this session</h3>
      {Object.values(manager.entries).flatMap((e) =>
        e
          ? [
              <article key={e.spacecraft.id} className="spacecraft-session">
                <button onClick={() => choose(e)}>{e.spacecraft.name}</button>
                <span>{e.status}</span>
                {e.data && (
                  <div className="event-actions">
                    <button onClick={() => onNavigate(e.spacecraft.id, false)}>
                      Focus
                    </button>
                    <button onClick={() => onNavigate(e.spacecraft.id, true)}>
                      Follow
                    </button>
                    <button
                      onClick={() => manager.toggle(e.spacecraft.id, "visible")}
                    >
                      {e.visible ? "Hide" : "Show"}
                    </button>
                    <button
                      onClick={() =>
                        manager.toggle(e.spacecraft.id, "showTrajectory")
                      }
                    >
                      {e.showTrajectory ? "Hide trajectory" : "Show trajectory"}
                    </button>
                  </div>
                )}
                <button onClick={() => manager.remove(e.spacecraft.id)}>
                  {e.status === "loading" ? "Cancel loading" : "Remove"}
                </button>
              </article>,
            ]
          : [],
      )}
    </section>
  );
}
