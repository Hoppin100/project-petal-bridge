import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: mockRpc },
}));

import { countdownParts, fetchDailyChallenge, targetBeatingRule } from "@/lib/daily-challenge";

describe("daily challenge helpers", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("formats time remaining as days, hours, minutes, and seconds", () => {
    expect(countdownParts(90_061_000)).toEqual([1, 1, 1, 1]);
    expect(countdownParts(-1)).toEqual([0, 0, 0, 0]);
  });

  it("explains which direction beats the target", () => {
    expect(targetBeatingRule(false)).toBe("Beat the target with a lower completion time.");
    expect(targetBeatingRule(true)).toBe("Beat the target with a higher completion time.");
  });

  it("handles a day with no eligible verified records without inventing a challenge", async () => {
    mockRpc.mockImplementation(
      async () =>
        ({
          data: {
            challenge_date: "2026-11-10",
            next_reset_at: "2026-11-11T00:00:00+00:00",
            challenge: null,
          },
          error: null,
        }) as never,
    );

    await expect(fetchDailyChallenge()).resolves.toEqual({
      challenge: null,
      challengeDate: "2026-11-10",
      nextResetAt: "2026-11-11T00:00:00+00:00",
      error: null,
    });
  });

  it("accepts a complete saved challenge with its record direction and metadata", async () => {
    const challenge = {
      challenge_date: "2026-11-10",
      game_id: "game-1",
      game_slug: "bike-universe",
      game_title: "Bike Universe",
      game_cover_url: null,
      game_page_url: "https://example.com/game",
      category_id: "category-1",
      category_name: "Any%",
      subcategory_id: null,
      subcategory_name: null,
      record_id: "record-1",
      record_time_ms: 123456,
      record_video_url: "https://youtube.com/watch?v=abcdefghijk",
      record_holder_username: "player",
      rules: "Any vehicle allowed.",
      higher_is_better: true,
    };
    mockRpc.mockImplementation(
      async () =>
        ({
          data: {
            challenge_date: "2026-11-10",
            next_reset_at: "2026-11-11T00:00:00+00:00",
            challenge,
          },
          error: null,
        }) as never,
    );

    await expect(fetchDailyChallenge()).resolves.toEqual({
      challenge,
      challengeDate: "2026-11-10",
      nextResetAt: "2026-11-11T00:00:00+00:00",
      error: null,
    });
  });

  it("rejects an incomplete saved challenge response", async () => {
    mockRpc.mockImplementation(
      async () =>
        ({
          data: {
            challenge_date: "2026-11-10",
            next_reset_at: "2026-11-11T00:00:00+00:00",
            challenge: { game_title: "Game" },
          },
          error: null,
        }) as never,
    );

    await expect(fetchDailyChallenge()).resolves.toMatchObject({
      challenge: null,
      error: "The daily challenge data was incomplete.",
    });
  });

  it("returns backend errors for the page to display", async () => {
    mockRpc.mockImplementation(
      async () =>
        ({
          data: null,
          error: { message: "Daily challenge migration is not installed" },
        }) as never,
    );

    await expect(fetchDailyChallenge()).resolves.toMatchObject({
      challenge: null,
      error: "Daily challenge migration is not installed",
    });
  });
});
