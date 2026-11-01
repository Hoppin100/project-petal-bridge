import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  listResult: {
    data: [] as Array<Record<string, string>>,
    error: null as { message: string } | null,
  },
  insertResult: {
    data: null as Record<string, string> | null,
    error: null as { message: string } | null,
  },
  deleteError: null as { message: string } | null,
  insertedPayload: null as Record<string, string> | null,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: async () => mockState.listResult,
        }),
      }),
      insert: (payload: Record<string, string>) => {
        mockState.insertedPayload = payload;
        return {
          select: () => ({
            single: async () => mockState.insertResult,
          }),
        };
      },
      delete: () => ({
        eq: async () => ({ error: mockState.deleteError }),
      }),
    }),
  },
}));

import { AdminUpdatesPanel } from "@/components/AdminUpdatesPanel";

describe("Admin update log", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    mockState.listResult = { data: [], error: null };
    mockState.insertResult = { data: null, error: null };
    mockState.deleteError = null;
    mockState.insertedPayload = null;
  });

  it("shows previously saved updates", async () => {
    mockState.listResult.data = [
      {
        id: "update-1",
        title: "Added member management",
        update_type: "feature",
        description: "Owners can manage member roles.",
        created_by: "owner-1",
        created_at: "2026-10-31T12:00:00.000Z",
      },
    ];

    render(<AdminUpdatesPanel actorId="owner-1" />);

    expect(await screen.findByText("Added member management")).toBeInTheDocument();
    expect(screen.getByText("Owners can manage member roles.")).toBeInTheDocument();
    expect(screen.getAllByText("New feature")).toHaveLength(2);
  });

  it("saves a typed update and displays it", async () => {
    const savedUpdate = {
      id: "update-2",
      title: "Fixed profile links",
      update_type: "fix",
      description: "Profile links now open correctly.",
      created_by: "owner-1",
      created_at: "2026-10-31T12:00:00.000Z",
    };
    mockState.insertResult.data = savedUpdate;

    render(<AdminUpdatesPanel actorId="owner-1" />);
    fireEvent.change(screen.getByLabelText("Update type"), { target: { value: "fix" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Fixed profile links" } });
    fireEvent.change(screen.getByLabelText("What changed?"), {
      target: { value: "Profile links now open correctly." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save update" }));

    expect(await screen.findByText("Update saved.")).toBeInTheDocument();
    expect(mockState.insertedPayload).toEqual({
      title: "Fixed profile links",
      update_type: "fix",
      description: "Profile links now open correctly.",
      created_by: "owner-1",
    });
    expect(screen.getByText("Fixed profile links")).toBeInTheDocument();
  });

  it("deletes an update after owner confirmation", async () => {
    mockState.listResult.data = [
      {
        id: "update-3",
        title: "Old update",
        update_type: "other",
        description: "This note is no longer needed.",
        created_by: "owner-1",
        created_at: "2026-10-31T12:00:00.000Z",
      },
    ];
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );

    render(<AdminUpdatesPanel actorId="owner-1" />);
    await screen.findByText("Old update");
    fireEvent.click(screen.getByRole("button", { name: "Delete update: Old update" }));

    expect(await screen.findByText("Update deleted.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Old update")).toBeNull());
  });
});
