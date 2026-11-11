import { createFileRoute } from "@tanstack/react-router";
import { DailyChallengePage } from "@/views/DailyChallengePage";

export const Route = createFileRoute("/daily-challenge")({
  head: () => ({
    meta: [
      { title: "Daily Challenge — SplitRush" },
      {
        name: "description",
        content:
          "Take on the same verified record challenge as everyone else. New challenge at 00:00 UTC.",
      },
    ],
  }),
  component: DailyChallengePage,
});
