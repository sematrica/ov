"use client";
import { useMemo, useState } from "react";
import { useEvents } from "@/hooks/useEvents";
import {
  filterEvents,
  sortEvents,
  type CloseApproachEvent,
  type EventSort,
} from "@/lib/explorer/events";
import { DAY, utcDate } from "@/lib/astronomy/time";
import { diameterLabel, measurement } from "@/lib/neo/format";
export function EventExplorer({
  events,
  onEvent,
  busy,
}: {
  events: ReturnType<typeof useEvents>;
  onEvent: (event: CloseApproachEvent, mode: "solar" | "encounter") => void;
  busy: boolean;
}) {
  const [start, setStart] = useState(() => utcDate(Date.now()));
  const [end, setEnd] = useState(start);
  const [sort, setSort] = useState<EventSort>("date");
  const [hazardous, setHazardous] = useState(false);
  const [maxDistance, setMaxDistance] = useState(0);
  const [minDiameter, setMinDiameter] = useState(0);
  const [page, setPage] = useState(0);
  const list = useMemo(
    () =>
      sortEvents(
        filterEvents(events.result.events, {
          hazardous,
          maxDistance,
          minDiameter,
        }),
        sort,
      ),
    [events.result.events, hazardous, maxDistance, minDiameter, sort],
  );
  const pageNumber = Math.min(
    page,
    Math.max(0, Math.ceil(list.length / 25) - 1),
  );
  function preset(days: number, previous = false) {
    const today = Math.floor(Date.now() / DAY) * DAY;
    setStart(utcDate(previous ? today - days * DAY : today));
    setEnd(utcDate(previous ? today - DAY : today + (days - 1) * DAY));
  }
  return (
    <section
      className="event-explorer"
      aria-label="Close-approach Event Explorer"
    >
      <h2>Close approaches</h2>
      <p className="explorer-note">
        NASA’s published Earth encounters. Classification does not predict
        impact.
      </p>
      <div className="explorer-presets">
        <button onClick={() => preset(1)}>Today</button>
        <button onClick={() => preset(7)}>Next 7 days</button>
        <button onClick={() => preset(30)}>Next 30 days</button>
        <button onClick={() => preset(7, true)}>Previous 7 days</button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          void events.load(start, end);
        }}
      >
        <div className="explorer-date-range">
          <label>
            From
            <input
              aria-label="Event start date"
              type="date"
              min="1900-01-01"
              max="2100-12-31"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Through
            <input
              aria-label="Event end date"
              type="date"
              min="1900-01-01"
              max="2100-12-31"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <button disabled={events.loading}>Browse events</button>
        {events.loading && (
          <button type="button" onClick={events.cancel}>
            Cancel
          </button>
        )}
      </form>
      <details>
        <summary>Sort & filters</summary>
        <label>
          Sort
          <select
            aria-label="Sort events"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as EventSort);
              setPage(0);
            }}
          >
            <option value="date">Date</option>
            <option value="distance">Closest approach</option>
            <option value="diameter">Largest diameter</option>
            <option value="velocity">Highest velocity</option>
          </select>
        </label>
        <label>
          Maximum distance (LD; 0 = any)
          <input
            type="number"
            min="0"
            value={maxDistance}
            onChange={(e) => {
              setMaxDistance(Math.max(0, Number(e.target.value)));
              setPage(0);
            }}
          />
        </label>
        <label>
          Minimum estimated diameter (m)
          <input
            type="number"
            min="0"
            value={minDiameter}
            onChange={(e) => {
              setMinDiameter(Math.max(0, Number(e.target.value)));
              setPage(0);
            }}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={hazardous}
            onChange={(e) => {
              setHazardous(e.target.checked);
              setPage(0);
            }}
          />{" "}
          Potentially hazardous only
        </label>
      </details>
      {events.loading && (
        <p role="status">
          Loading close approaches… Existing results remain available.
        </p>
      )}
      {events.error && <p role="alert">{events.error}</p>}
      {events.result.failures.length > 0 && (
        <details open className="inline-error">
          <summary>
            Partial results — {events.result.failures.length} windows failed
          </summary>
          {events.result.failures.map((f) => (
            <p key={f.window.start}>
              {f.window.start}–{f.window.end}: {f.error}
            </p>
          ))}
        </details>
      )}
      <p className="explorer-note">
        {list.length} events · up to 90 days per query
      </p>
      {list.slice(pageNumber * 25, pageNumber * 25 + 25).map((event) => (
        <article className="event-row" key={event.id}>
          <h3>{event.object.name}</h3>
          <time>
            {new Date(event.approach.time)
              .toISOString()
              .slice(0, event.approach.timePrecision === "day" ? 10 : 16)
              .replace("T", " ")}{" "}
            UTC
          </time>
          <p>
            {measurement(event.approach.missDistanceKm, 0)} km ·{" "}
            {measurement(event.approach.missDistanceLunar, 2)} LD
            <br />
            {measurement(event.approach.relativeVelocityKmPerSecond, 2)} km/s ·{" "}
            {diameterLabel(event.object)}
            <br />
            Potentially hazardous:{" "}
            {event.object.potentiallyHazardous ? "Yes" : "No"}
          </p>
          <div className="event-actions">
            <button disabled={busy} onClick={() => onEvent(event, "encounter")}>
              View Encounter
            </button>
            <button disabled={busy} onClick={() => onEvent(event, "solar")}>
              View in Solar System
            </button>
          </div>
        </article>
      ))}
      {!list.length && !events.loading && (
        <p className="explorer-note">
          Choose a date range and browse, or adjust your filters.
        </p>
      )}
      {list.length > 25 && (
        <div className="event-actions">
          <button
            disabled={!pageNumber}
            onClick={() => setPage(pageNumber - 1)}
          >
            Previous page
          </button>
          <span>
            {pageNumber + 1} / {Math.ceil(list.length / 25)}
          </span>
          <button
            disabled={(pageNumber + 1) * 25 >= list.length}
            onClick={() => setPage(pageNumber + 1)}
          >
            Next page
          </button>
        </div>
      )}
    </section>
  );
}
