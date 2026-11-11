import { supabase } from "@/lib/supabase";

export interface DailyChallenge {
  challenge_date: string;
  game_id: string;
  game_slug: string;
  game_title: string;
  game_cover_url: string | null;
  game_page_url: string | null;
  category_id: string;
  category_name: string;
  subcategory_id: string | null;
  subcategory_name: string | null;
  record_id: string;
  record_time_ms: number;
  record_video_url: string;
  record_holder_username: string;
  rules: string | null;
  higher_is_better: boolean;
}

export interface DailyChallengeResult {
  challenge: DailyChallenge | null;
  challengeDate: string;
  nextResetAt: string;
  error: string | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function parseChallenge(value: unknown): DailyChallenge | null {
  if (!isObject(value)) return null;

  const requiredStrings = [
    "challenge_date",
    "game_id",
    "game_slug",
    "game_title",
    "category_id",
    "category_name",
    "record_id",
    "record_video_url",
    "record_holder_username",
  ] as const;
  if (requiredStrings.some((key) => typeof value[key] !== "string")) return null;
  if (
    !isNullableString(value["game_cover_url"]) ||
    !isNullableString(value["game_page_url"]) ||
    !isNullableString(value["subcategory_id"]) ||
    !isNullableString(value["subcategory_name"]) ||
    !isNullableString(value["rules"]) ||
    typeof value["record_time_ms"] !== "number" ||
    !Number.isFinite(value["record_time_ms"]) ||
    value["record_time_ms"] <= 0 ||
    typeof value["higher_is_better"] !== "boolean"
  ) {
    return null;
  }

  return {
    challenge_date: value["challenge_date"] as string,
    game_id: value["game_id"] as string,
    game_slug: value["game_slug"] as string,
    game_title: value["game_title"] as string,
    game_cover_url: value["game_cover_url"],
    game_page_url: value["game_page_url"],
    category_id: value["category_id"] as string,
    category_name: value["category_name"] as string,
    subcategory_id: value["subcategory_id"],
    subcategory_name: value["subcategory_name"],
    record_id: value["record_id"] as string,
    record_time_ms: value["record_time_ms"],
    record_video_url: value["record_video_url"] as string,
    record_holder_username: value["record_holder_username"] as string,
    rules: value["rules"],
    higher_is_better: value["higher_is_better"],
  };
}

export async function fetchDailyChallenge(): Promise<DailyChallengeResult> {
  const { data, error } = await supabase.rpc("get_daily_challenge");
  if (error) {
    return {
      challenge: null,
      challengeDate: "",
      nextResetAt: "",
      error: error.message,
    };
  }

  if (
    !isObject(data) ||
    typeof data["challenge_date"] !== "string" ||
    typeof data["next_reset_at"] !== "string" ||
    !Number.isFinite(Date.parse(data["next_reset_at"]))
  ) {
    return {
      challenge: null,
      challengeDate: "",
      nextResetAt: "",
      error: "The daily challenge response was invalid.",
    };
  }

  if (data["challenge"] === null) {
    return {
      challenge: null,
      challengeDate: data["challenge_date"],
      nextResetAt: data["next_reset_at"],
      error: null,
    };
  }

  const challenge = parseChallenge(data["challenge"]);
  if (!challenge || challenge.challenge_date !== data["challenge_date"]) {
    return {
      challenge: null,
      challengeDate: "",
      nextResetAt: "",
      error: "The daily challenge data was incomplete.",
    };
  }

  return {
    challenge,
    challengeDate: data["challenge_date"],
    nextResetAt: data["next_reset_at"],
    error: null,
  };
}

export function targetBeatingRule(higherIsBetter: boolean): string {
  return higherIsBetter
    ? "Beat the target with a higher completion time."
    : "Beat the target with a lower completion time.";
}

export function countdownParts(milliseconds: number): [number, number, number, number] {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return [days, hours, minutes, seconds % 60];
}
