"use client";
import { memo, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ObjectId, TimeRange } from "@/models/trajectory";
import type { NeoDiscovery } from "@/hooks/useNeoDiscovery";
import { utcDate } from "@/lib/astronomy/time";
import { filterNeos, sortNeos, type NeoSort } from "@/lib/neo/selection";
import { NeoRow } from "./NeoRow";
export const DiscoveryPanel = memo(function DiscoveryPanel({
  manager,
  range,
  selected,
  onSelect,
  getSimulationDate,
}: {
  manager: NeoDiscovery;
  range: TimeRange;
  selected: ObjectId;
  onSelect: (id: ObjectId) => void;
  getSimulationDate: () => string;
}) {
  const [date, setDate] = useState(() =>
    utcDate(Math.max(range.start, Math.min(range.end, Date.now()))),
  );
  const [collapsed, setCollapsed] = useState(false);
  const [sort, setSort] = useState<NeoSort>("distance");
  const [hazardousOnly, setHazardousOnly] = useState(false);
  const [minDiameter, setMinDiameter] = useState(0);
  const list = useMemo(
    () =>
      sortNeos(
        filterNeos(
          manager.discovery?.objects ?? [],
          hazardousOnly,
          minDiameter,
        ),
        sort,
      ),
    [manager.discovery, hazardousOnly, minDiameter, sort],
  );
  const currentIds = new Set(manager.discovery?.objects.map((neo) => neo.id));
  const retained = Object.values(manager.store).filter(
    (entry) =>
      entry &&
      !currentIds.has(entry.metadata.id) &&
      entry.status !== "discovered",
  );
  return (
    <aside
      className={`discovery-panel ${collapsed ? "collapsed" : ""}`}
      aria-label="Near-Earth object discovery"
    >
      <button
        className="discovery-heading"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
      >
        <span>
          NEO DISCOVERY{" "}
          <small>{manager.discovery?.objects.length ?? "—"}</small>
        </span>
        {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
      </button>
      {!collapsed && (
        <div className="discovery-content">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void manager.discover(date);
            }}
          >
            <label className="date-label">
              Discovery date (UTC)
              <input
                required
                type="date"
                value={date}
                min={utcDate(range.start)}
                max={utcDate(range.end)}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="use-time"
              onClick={() => setDate(getSimulationDate())}
            >
              Use simulation date
            </button>
            <button className="discover-button" type="submit">
              Load NEOs for {date || "selected date"}
            </button>
          </form>
          <p className="discovery-hint">
            Selected date ±1 day. Up to 3 closest objects load automatically.
          </p>
          {manager.loading && (
            <p role="status" className="discovery-message">
              Loading near-Earth objects…
            </p>
          )}
          {manager.error && (
            <p role="alert" className="inline-error">
              {manager.error}
            </p>
          )}
          {manager.discovery && (
            <>
              <div className="discovery-window">
                LOADED WINDOW
                <span>
                  {manager.discovery.window.start} —{" "}
                  {manager.discovery.window.end}
                </span>
              </div>
              {manager.discovery.demoKey && (
                <p className="demo-key-note">
                  NASA DEMO_KEY · 30 requests/hour, 50/day per IP. Real NASA
                  data.
                </p>
              )}
              <details className="filter-disclosure">
                <summary>Sort &amp; filter</summary>
                <div className="discovery-filters">
                  <label>
                    Sort by
                    <select
                      value={sort}
                      onChange={(event) =>
                        setSort(event.target.value as NeoSort)
                      }
                    >
                      <option value="distance">Closest distance</option>
                      <option value="diameter">Largest diameter</option>
                      <option value="date">Approach date</option>
                    </select>
                  </label>
                  <label>
                    Show
                    <select
                      value={hazardousOnly ? "hazardous" : "all"}
                      onChange={(event) =>
                        setHazardousOnly(event.target.value === "hazardous")
                      }
                    >
                      <option value="all">All objects</option>
                      <option value="hazardous">Potentially hazardous</option>
                    </select>
                  </label>
                  <label className="diameter-filter">
                    Max diameter ≥ (m)
                    <input
                      type="number"
                      min="0"
                      max="100000"
                      step="1"
                      value={minDiameter || ""}
                      placeholder="Any"
                      onChange={(event) =>
                        setMinDiameter(Math.max(0, Number(event.target.value)))
                      }
                    />
                  </label>
                </div>
              </details>
              <p className="classification-note">
                Potentially hazardous is NASA’s classification, not a prediction
                of impact.
              </p>
              {!list.length && (
                <p className="discovery-message">
                  {manager.discovery.objects.length
                    ? "No objects match these filters."
                    : "No Earth approaches returned for this window."}
                </p>
              )}
              {list.map(
                (neo) =>
                  manager.store[neo.id] && (
                    <NeoRow
                      key={neo.id}
                      entry={manager.store[neo.id]!}
                      selected={selected === neo.id}
                      onSelect={onSelect}
                      onAdd={manager.add}
                      onRemove={manager.remove}
                      onVisible={manager.setVisible}
                    />
                  ),
              )}
            </>
          )}
          {retained.length > 0 && (
            <>
              <p className="eyebrow retained-heading">FROM PREVIOUS WINDOWS</p>
              {retained.map(
                (entry) =>
                  entry && (
                    <NeoRow
                      key={entry.metadata.id}
                      entry={entry}
                      selected={selected === entry.metadata.id}
                      onSelect={onSelect}
                      onAdd={manager.add}
                      onRemove={manager.remove}
                      onVisible={manager.setVisible}
                    />
                  ),
              )}
            </>
          )}
        </div>
      )}
    </aside>
  );
});
