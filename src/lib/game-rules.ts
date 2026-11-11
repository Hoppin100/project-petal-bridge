import type { Game } from "@/lib/types";

export function isSlowerIsBetterGame(
  game: Pick<Game, "slug" | "title">,
  isOwner = false,
): boolean {
  if (!isOwner) return false;

  const slug = game.slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const title = game.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return slug === "bike-universe" || title === "bike universe";
}

export function compareRunTimes(
  firstTime: number,
  secondTime: number,
  slowerIsBetter = false,
): number {
  return slowerIsBetter ? secondTime - firstTime : firstTime - secondTime;
}

export function bestRunTime(times: number[], slowerIsBetter = false): number | null {
  if (times.length === 0) return null;
  return times.reduce((best, time) =>
    compareRunTimes(time, best, slowerIsBetter) < 0 ? time : best,
  );
}
