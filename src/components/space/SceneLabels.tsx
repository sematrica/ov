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
}: {
  data: TrajectoryDataset;
  time: number;
  elements: LabelElements;
}) {
  const vector = useMemo(() => new Vector3(), []);
  const positions = useMemo(
    () => [
      { id: "sun" as const, point: [0, -0.075, 0] as [number, number, number] },
      ...data.objects.map((object) => ({
        id: object.id,
        point: toScene(interpolatePosition(object.points, time)),
      })),
    ],
    [data, time],
  );
  useFrame(({ camera, size }) => {
    for (const { id, point } of positions) {
      const element = elements.current[id];
      if (!element) continue;
      vector.set(...point).project(camera);
      const x = ((vector.x + 1) * size.width) / 2;
      const y = ((1 - vector.y) * size.height) / 2;
      element.style.visibility =
        vector.z < -1 ||
        vector.z > 1 ||
        x < 0 ||
        x > size.width ||
        y < 0 ||
        y > size.height
          ? "hidden"
          : "visible";
      element.style.transform = `translate3d(${x + (id === "sun" ? -12 : 18)}px, ${y - 10}px, 0)`;
    }
  });
  return null;
}
