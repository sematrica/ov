import { memo } from "react";
import type { NeoEntry } from "@/models/neo";
import type { ObjectId } from "@/models/trajectory";
import { closestApproach } from "@/lib/neo/selection";
import { approachDate, diameterLabel, measurement } from "@/lib/neo/format";
export const NeoRow = memo(function NeoRow({
  entry,
  selected,
  onSelect,
  onAdd,
  onRemove,
  onVisible,
}: {
  entry: NeoEntry;
  selected: boolean;
  onSelect: (id: ObjectId) => void;
  onAdd: (id: ObjectId) => void;
  onRemove: (id: ObjectId) => void;
  onVisible: (id: ObjectId, visible: boolean) => void;
}) {
  const neo = entry.metadata,
    approach = closestApproach(neo);
  return (
    <article className={`neo-row ${selected ? "selected" : ""}`}>
      <button
        className="neo-name"
        onClick={() => onSelect(neo.id)}
        aria-pressed={selected}
      >
        {neo.name}
        <span className="neo-state">
          {entry.status === "loaded" ? "LOADED" : "DISCOVERED"}
        </span>
      </button>
      <p className="neo-approach">{approachDate(approach)}</p>
      <dl className="neo-metrics">
        <div>
          <dt>Diameter</dt>
          <dd>{diameterLabel(neo)}</dd>
        </div>
        <div>
          <dt>Miss distance</dt>
          <dd>{measurement(approach?.missDistanceLunar, 2)} LD</dd>
        </div>
        <div>
          <dt>Velocity</dt>
          <dd>{measurement(approach?.relativeVelocityKmPerSecond, 2)} km/s</dd>
        </div>
      </dl>
      <span
        className={`hazard-status ${neo.potentiallyHazardous ? "classified" : ""}`}
      >
        Potentially hazardous: {neo.potentiallyHazardous ? "Yes" : "No"}
      </span>
      <div className="neo-actions">
        {entry.status === "loaded" ? (
          <>
            <button
              onClick={() => onVisible(neo.id, !entry.visible)}
              aria-label={`${entry.visible ? "Hide" : "Show"} ${neo.name}`}
              aria-pressed={entry.visible}
            >
              {entry.visible ? "Visible" : "Hidden"}
            </button>
            <button onClick={() => onRemove(neo.id)}>Remove</button>
          </>
        ) : entry.status === "loading" ? (
          <>
            <span role="status">Loading trajectory…</span>
            <button onClick={() => onRemove(neo.id)}>Cancel</button>
          </>
        ) : (
          <button onClick={() => onAdd(neo.id)}>
            {entry.status === "error"
              ? "Retry trajectory"
              : "Add to visualization"}
          </button>
        )}
      </div>
      {entry.error && (
        <p className="inline-error" role="alert">
          {entry.error}
        </p>
      )}
    </article>
  );
});
