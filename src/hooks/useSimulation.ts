"use client";
import { useCallback, useEffect, useState } from "react";
import { advanceTime, clampTime, DAY, HOUR } from "@/lib/astronomy/time";
import type { TimeRange } from "@/models/trajectory";
export const SPEEDS = [
  { label: "1 hour / sec", rate: HOUR / 1000 },
  { label: "1 day / sec", rate: DAY / 1000 },
  { label: "10 days / sec", rate: (10 * DAY) / 1000 },
  { label: "30 days / sec", rate: (30 * DAY) / 1000 },
];
export function useSimulation(range: TimeRange) {
  const [time, setTime] = useState(() => clampTime(Date.now(), range));
  const [playing, setPlaying] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [rate, setRate] = useState(SPEEDS[2].rate);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous: number | null = null;
    const resetElapsed = () => {
      previous = null;
    };
    document.addEventListener("visibilitychange", resetElapsed);
    const tick = (now: number) => {
      // Pause elapsed-time accumulation in hidden tabs; do not jump on return.
      if (previous !== null && !document.hidden) {
        const elapsed = now - previous;
        setTime((current) =>
          advanceTime(current, elapsed, rate * direction, range),
        );
      }
      previous = document.hidden ? null : now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", resetElapsed);
    };
  }, [playing, rate, direction, range]);
  useEffect(() => {
    if (
      (direction === 1 && time >= range.end) ||
      (direction === -1 && time <= range.start)
    )
      setPlaying(false);
  }, [time, direction, range, playing]);
  const seek = useCallback(
    (value: number) => {
      setPlaying(false);
      setTime(clampTime(value, range));
    },
    [range],
  );
  const reset = useCallback(() => seek(Date.now()), [seek]);
  return {
    time,
    playing,
    setPlaying,
    direction,
    setDirection,
    rate,
    setRate,
    seek,
    reset,
  };
}
export type Simulation = ReturnType<typeof useSimulation>;
