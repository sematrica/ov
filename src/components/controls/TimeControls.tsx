"use client";
import {
  ArrowLeft,
  ArrowRight,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import type { TimeRange } from "@/models/trajectory";
import { DAY, formatDate } from "@/lib/astronomy/time";
import { SPEEDS, type Simulation } from "@/hooks/useSimulation";
export function TimeControls({
  simulation: s,
  range,
}: {
  simulation: Simulation;
  range: TimeRange;
}) {
  const progress = ((s.time - range.start) / (range.end - range.start)) * 100;
  return (
    <section className="time-panel" aria-label="Simulation time controls">
      <div className="time-top">
        <div className="clock">
          <span className="eyebrow">
            SIMULATION TIME <span className="utc">UTC</span>
          </span>
          <div>
            <time dateTime={new Date(s.time).toISOString()}>
              {formatDate(s.time)}
            </time>
            <span className="clock-hours">
              {new Date(s.time).toISOString().slice(11, 19)}
            </span>
          </div>
        </div>
        <div className="transport">
          <button
            className={`icon-button direction ${s.direction === -1 ? "active" : ""}`}
            aria-label="Run time backward"
            aria-pressed={s.direction === -1}
            title="Run time backward"
            onClick={() => s.setDirection(-1)}
          >
            <ArrowLeft size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Step backward one day"
            title="Step backward one day"
            onClick={() => s.seek(s.time - DAY)}
          >
            <SkipBack size={17} />
          </button>
          <button
            className="play-button"
            aria-label={s.playing ? "Pause simulation" : "Play simulation"}
            onClick={() => s.setPlaying(!s.playing)}
          >
            {s.playing ? (
              <Pause size={19} fill="currentColor" />
            ) : (
              <Play size={19} fill="currentColor" />
            )}
          </button>
          <button
            className="icon-button"
            aria-label="Step forward one day"
            title="Step forward one day"
            onClick={() => s.seek(s.time + DAY)}
          >
            <SkipForward size={17} />
          </button>
          <button
            className={`icon-button direction ${s.direction === 1 ? "active" : ""}`}
            aria-label="Run time forward"
            aria-pressed={s.direction === 1}
            title="Run time forward"
            onClick={() => s.setDirection(1)}
          >
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="time-options">
          <label className="speed-label">
            <span className="eyebrow">PLAYBACK SPEED</span>
            <select
              aria-label="Simulation speed"
              value={s.rate}
              onChange={(event) => s.setRate(Number(event.target.value))}
            >
              {SPEEDS.map((speed) => (
                <option key={speed.rate} value={speed.rate}>
                  {speed.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="now-button"
            onClick={s.reset}
            title="Reset to current time"
          >
            <RotateCcw size={14} /> Now
          </button>
        </div>
      </div>
      <div className="timeline-wrap">
        <input
          className="timeline"
          type="range"
          min={range.start}
          max={range.end}
          step={60_000}
          value={s.time}
          aria-label="Simulation timeline"
          aria-valuetext={`${formatDate(s.time)}, ${new Date(s.time).toISOString().slice(11, 16)} UTC`}
          onChange={(event) => s.seek(Number(event.target.value))}
          style={{
            background: `linear-gradient(to right, #b99c72 0%, #b99c72 ${progress}%, #30343c ${progress}%, #30343c 100%)`,
          }}
        />
        <div className="timeline-ticks" aria-hidden="true">
          {Array.from({ length: 49 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
      </div>
      <div className="timeline-dates">
        <span>{formatDate(range.start)}</span>
        <span className="drag-hint">DRAG TO EXPLORE TIME</span>
        <span>{formatDate(range.end)}</span>
      </div>
    </section>
  );
}
