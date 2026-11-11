import { describe, expect, it } from "vitest";
import { bestRunTime, compareRunTimes, isSlowerIsBetterGame } from "@/lib/game-rules";

describe("game-specific time rules", () => {
  it("recognizes Bike Universe by slug or title", () => {
    expect(isSlowerIsBetterGame({ slug: "bike-universe", title: "Bike Universe" })).toBe(true);
    expect(isSlowerIsBetterGame({ slug: "", title: "Bike Universe" })).toBe(true);
  });

  it("does not apply Bike Universe scoring to other games", () => {
    expect(isSlowerIsBetterGame({ slug: "grand-theft-auto-v", title: "Grand Theft Auto V" })).toBe(
      false,
    );
  });

  it("sorts higher times first only when slower is better", () => {
    expect([120_000, 180_000, 90_000].sort((a, b) => compareRunTimes(a, b))).toEqual([
      90_000, 120_000, 180_000,
    ]);
    expect([120_000, 180_000, 90_000].sort((a, b) => compareRunTimes(a, b, true))).toEqual([
      180_000, 120_000, 90_000,
    ]);
  });

  it("selects the winning time according to the game scoring rule", () => {
    expect(bestRunTime([120_000, 180_000, 90_000])).toBe(90_000);
    expect(bestRunTime([120_000, 180_000, 90_000], true)).toBe(180_000);
    expect(bestRunTime([], true)).toBeNull();
  });
});
