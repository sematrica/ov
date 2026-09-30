import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { NeoWsService } from "../src/lib/neows/service";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("NeoWs server error handling and credentials", () => {
  it("uses the development-only demo fallback without returning provider secrets", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NASA_API_KEY", "");
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ near_earth_objects: {} }), {
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    const result = await new NeoWsService().discover("2026-09-27");
    expect(result.demoKey).toBe(true);
    expect(String(fetcher.mock.calls[0][0])).toContain("api_key=DEMO_KEY");
    expect(result).not.toHaveProperty("apiKey");
  });
  it("requires explicit configuration in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NASA_API_KEY", "");
    await expect(new NeoWsService().discover("2026-09-27")).rejects.toThrow(
      /not configured/,
    );
  });
  it.each([
    [429, "rate limit"],
    [401, "rejected the API key"],
    [403, "rejected the API key"],
    [503, "unavailable"],
  ])(
    "handles HTTP %s without leaking provider response bodies",
    async (status, message) => {
      vi.stubEnv("NASA_API_KEY", "private-test-value");
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response("private-test-value", { status: Number(status) }),
        ),
      );
      await expect(new NeoWsService().discover("2026-09-27")).rejects.toThrow(
        String(message),
      );
    },
  );
  it("normalizes network and malformed JSON errors", async () => {
    vi.stubEnv("NASA_API_KEY", "private-test-value");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("private-test-value");
      }),
    );
    await expect(new NeoWsService().discover("2026-09-27")).rejects.toThrow(
      /unavailable/,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not json")),
    );
    await expect(new NeoWsService().discover("2026-09-27")).rejects.toThrow(
      /malformed/,
    );
  });
});
