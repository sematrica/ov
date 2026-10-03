"use client";
import { useMemo, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import type { ObjectId, TrajectoryDataset } from "@/models/trajectory";
import { interpolatePosition, toScene } from "@/lib/astronomy/interpolate";
export type LabelElements = RefObject<
  Partial<Record<ObjectId | "sun", HTMLDivElement | null>>
>;
/** Project world positions onto a DOM overlay owned by the main React root.
 * Keeping DOM ownership outside the canvas avoids nested-root cleanup races. */
export function LabelProjection({
  data,
  time,
  elements,
  selected,
  showSun = true,
}: {
  data: TrajectoryDataset;
  time: number;
  elements: LabelElements;
  selected?: ObjectId;
  showSun?: boolean;
}) {
  const vector = useMemo(() => new Vector3(), []);
  const positions = useMemo(
    () => [
      ...(showSun
        ? [
            {
              id: "sun" as const,
              point: [0, -0.075, 0] as [number, number, number],
            },
          ]
        : []),
      ...data.objects.map((object) => ({
        id: object.id,
        point: toScene(interpolatePosition(object.points, time)),
      })),
    ],
    [data, time, showSun],
  );
  useFrame(({ camera, size }) => {
    const occupied: { x: number; y: number }[] = [];
    const prioritized = [...positions].sort(
      (a, b) =>
        (a.id === selected ? -2 : a.id.startsWith("neo:") ? 1 : 0) -
        (b.id === selected ? -2 : b.id.startsWith("neo:") ? 1 : 0),
    );
    for (const { id, point } of prioritized) {
      const element = elements.current[id];
      if (!element) continue;
      const farAsteroid =
        id.startsWith("neo:") &&
        id !== selected &&
        camera.position.distanceTo(vector.set(...point)) > 4;
      vector.set(...point).project(camera);
      const x = ((vector.x + 1) * size.width) / 2;
      const y = ((1 - vector.y) * size.height) / 2;
      const overlap =
        id !== selected &&
        occupied.some((p) => Math.abs(p.x - x) < 100 && Math.abs(p.y - y) < 22);
      if (!farAsteroid && !overlap) occupied.push({ x, y });
      element.style.setProperty(
        "visibility",
        farAsteroid ||
          overlap ||
          vector.z < -1 ||
          vector.z > 1 ||
          x < 0 ||
          x > size.width ||
          y < 0 ||
          y > size.height
          ? "hidden"
          : "visible",
      );
      element.style.setProperty(
        "transform",
        `translate3d(${x + (id === "sun" ? -12 : 18)}px, ${y - 10}px, 0)`,
      );
    }
  });
  return null;
}
