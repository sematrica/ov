import { PROVIDERS } from "../providers/registry";
import "server-only";
import type { DiscoveryWindow, DiscoveryResult } from "../../models/neo";
import { AsyncCache, SerialQueue } from "../cache/asyncCache";
import { normalizeFeed } from "./parser";
import { discoveryWindow } from "./window";
export class NeoWsError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
    this.name = "NeoWsError";
  }
}
export class NeoWsService {
  async discover(
    date: string,
    window: DiscoveryWindow = discoveryWindow(date),
  ): Promise<DiscoveryResult> {
    const configured = process.env.NASA_API_KEY?.trim();
    const key =
      configured ||
      (process.env.NODE_ENV === "development" ? "DEMO_KEY" : undefined);
    if (!key)
      throw new NeoWsError(
        "NASA_API_KEY is not configured on the server. Set it in .env.local and restart the application.",
        503,
      );
    const params = new URLSearchParams({
      start_date: window.start,
      end_date: window.end,
      api_key: key,
    });
    let response: Response;
    try {
      response = await fetch(`${PROVIDERS.neows.endpoint}?${params}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new NeoWsError(
        "NASA NeoWs is unavailable. Please try again later.",
      );
    }
    if (response.status === 429)
      throw new NeoWsError(
        "NASA rate limit exceeded. Wait before retrying; DEMO_KEY has especially restrictive limits.",
        429,
      );
    if (response.status === 401 || response.status === 403)
      throw new NeoWsError(
        "NASA rejected the API key. Check NASA_API_KEY on the server.",
        503,
      );
    if (!response.ok)
      throw new NeoWsError(
        `NASA NeoWs is unavailable (HTTP ${response.status}).`,
      );
    try {
      const payload: unknown = await response.json();
      return {
        date,
        window,
        objects: normalizeFeed(payload, window),
        demoKey: key === "DEMO_KEY",
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      throw new NeoWsError(
        "NASA NeoWs returned a malformed response. Please try again later.",
      );
    }
  }
}
const discoveryCache = new AsyncCache<DiscoveryResult>(60 * 60_000, 32);
const nasaQueue = new SerialQueue();
export function discoverNeos(date: string): Promise<DiscoveryResult> {
  const window = discoveryWindow(date);
  return discoveryCache.get(`${window.start}:${window.end}`, () =>
    nasaQueue.run(() => new NeoWsService().discover(date)),
  );
}

export function discoverNeoWindow(
  window: DiscoveryWindow,
): Promise<DiscoveryResult> {
  return discoveryCache.get(`${window.start}:${window.end}`, () =>
    nasaQueue.run(() => new NeoWsService().discover(window.start, window)),
  );
}
