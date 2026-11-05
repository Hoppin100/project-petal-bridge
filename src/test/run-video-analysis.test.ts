import { afterEach, describe, expect, it, vi } from "vitest";

import {
  analyzeRunVideos,
  RUN_VIDEO_MODEL,
  type ApprovedRunVideo,
} from "@/lib/run-video-analysis.server";

const response = {
  recommendation: "needs_review",
  confidence: 0.72,
  summary: "The submitted video shows gameplay and a visible timer.",
  observations: ["Frames show the selected game."],
  concerns: [],
  speculation: ["The sampled frames cannot establish uninterrupted play."],
};

const submittedRun: ApprovedRunVideo = {
  id: "run-current",
  time_ms: 125000,
  video_id: "abcdefghijk",
  platform: "PC",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Gemini run video analysis", () => {
  it("sends the submitted video and up to two approved examples for visual comparison", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "completed",
        steps: [
          {
            type: "model_output",
            content: [{ type: "text", text: JSON.stringify(response) }],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const approvedRuns: ApprovedRunVideo[] = [
      { id: "approved-1", time_ms: 110000, video_id: "lmnopqrstuv", platform: "PC" },
      { id: "approved-2", time_ms: 115000, video_id: "ABCDEFGHIJK", platform: "PC" },
      { id: "approved-3", time_ms: 120000, video_id: "0123456789_", platform: "PC" },
    ];

    const result = await analyzeRunVideos({
      apiKey: "test-key",
      gameTitle: "Example Game",
      categoryName: "Any%",
      timingRules: "Timer starts at control.",
      submittedRun,
      approvedRuns,
      rejectedRuns: [],
    });

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-goog-api-key": "test-key" }),
      }),
    );
    expect(body.model).toBe(RUN_VIDEO_MODEL);
    expect(body.store).toBe(false);
    expect(body.input.filter((part: { type: string }) => part.type === "video")).toEqual([
      { type: "video", uri: "https://www.youtube.com/watch?v=lmnopqrstuv" },
      { type: "video", uri: "https://www.youtube.com/watch?v=ABCDEFGHIJK" },
      { type: "video", uri: "https://www.youtube.com/watch?v=abcdefghijk" },
    ]);
    expect(body.response_format.mime_type).toBe("application/json");
    expect(result.approvedRunIds).toEqual(["approved-1", "approved-2"]);
    expect(result.analyzedVideoIds).toHaveLength(3);
    expect(result.recommendation).toBe("needs_review");
    expect(result.modelVersion).toBe(RUN_VIDEO_MODEL);
  });

  it("rejects a submitted video without a valid YouTube ID before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      analyzeRunVideos({
        apiKey: "test-key",
        gameTitle: "Example Game",
        categoryName: "Any%",
        timingRules: null,
        submittedRun: { ...submittedRun, video_id: "invalid" },
        approvedRuns: [],
        rejectedRuns: [],
      }),
    ).rejects.toThrow("supported YouTube video ID");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects incomplete or malformed model output", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: "completed",
          steps: [{ type: "model_output", content: [{ type: "text", text: '{"confidence":2}' }] }],
        }),
      }),
    );

    await expect(
      analyzeRunVideos({
        apiKey: "test-key",
        gameTitle: "Example Game",
        categoryName: "Any%",
        timingRules: null,
        submittedRun,
        approvedRuns: [],
        rejectedRuns: [],
      }),
    ).rejects.toThrow("incomplete video analysis response");
  });

  it("includes owner-rejected examples and their notes in later video assessments", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "completed",
        steps: [
          {
            type: "model_output",
            content: [{ type: "text", text: JSON.stringify(response) }],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const rejectedRuns = [
      {
        id: "rejected-1",
        time_ms: 90000,
        video_id: "lmnopqrstuv",
        platform: "PC",
        reason: "The video skips the final section.",
      },
      {
        id: "rejected-2",
        time_ms: 95000,
        video_id: "0123456789_",
        platform: "PC",
        reason: null,
      },
      {
        id: "rejected-3",
        time_ms: 100000,
        video_id: "ZYXWVUTSRQP",
        platform: "PC",
        reason: null,
      },
    ];
    const result = await analyzeRunVideos({
      apiKey: "test-key",
      gameTitle: "Example Game",
      categoryName: "Any%",
      timingRules: null,
      submittedRun,
      approvedRuns: [],
      rejectedRuns,
    });

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body));
    expect(body.input[0].text).toContain("Rejected reference 1");
    expect(body.input[0].text).toContain("The video skips the final section.");
    expect(body.input.filter((part: { type: string }) => part.type === "video")).toEqual([
      { type: "video", uri: "https://www.youtube.com/watch?v=lmnopqrstuv" },
      { type: "video", uri: "https://www.youtube.com/watch?v=0123456789_" },
      { type: "video", uri: "https://www.youtube.com/watch?v=abcdefghijk" },
    ]);
    expect(result.rejectedRunIds).toEqual(["rejected-1", "rejected-2"]);
  });
});
