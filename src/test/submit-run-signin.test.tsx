import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SubmitRunPage } from "@/views/SubmitRunPage";

// The auth store and the database client are replaced so the test only
// exercises the sign-in prompt rule: never ask someone to sign in while
// their stored session is still being read.
const auth = vi.hoisted(() => {
  const state = {
    session: null as unknown,
    profile: null as unknown,
    loading: true,
    refreshProfile: async () => {},
    signOut: async () => {},
  };
  return { state };
});

const client = vi.hoisted(() => {
  return {
    games: [] as unknown[],
    categories: [] as unknown[],
  };
});

vi.mock("@/lib/auth", () => ({
  useAuth: () => auth.state as never,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      const chain: unknown = new Proxy(function () {}, {
        get(_target, prop) {
          if (prop === "then") {
            return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
              Promise.resolve({
                data: table === "games" ? client.games : client.categories,
                error: null,
              }).then(resolve, reject);
          }
          if (prop === "catch" || prop === "finally") return undefined;
          return () => chain;
        },
      });
      return chain;
    },
  },
}));

vi.mock("@/lib/verify-run.functions", () => ({
  runVerification: async () => ({}),
}));

describe("Run submission sign-in prompt", () => {
  beforeEach(() => {
    auth.state.session = null;
    auth.state.profile = null;
    auth.state.loading = true;
    client.games = [];
    client.categories = [];
  });

  it("does not ask someone whose session is still being read to sign in", async () => {
    const onRequireAuth = vi.fn();

    render(<SubmitRunPage onRequireAuth={onRequireAuth} />);
    await waitFor(() => expect(screen.getByText("Loading…")).toBeInTheDocument());

    expect(onRequireAuth).not.toHaveBeenCalled();
    expect(screen.queryByText("Sign in to submit a run.")).toBeNull();
  });

  it("asks someone with no session to sign in", async () => {
    auth.state.loading = false;
    const onRequireAuth = vi.fn();

    render(<SubmitRunPage onRequireAuth={onRequireAuth} />);

    await waitFor(() => expect(onRequireAuth).toHaveBeenCalled());
    expect(screen.getByText("Sign in to submit a run.")).toBeInTheDocument();
  });

  it("shows a main category's subcategories after expanding it", async () => {
    auth.state.session = { user: { id: "runner-id" } };
    auth.state.profile = { id: "runner-id", role: "member" };
    auth.state.loading = false;
    client.games = [{ id: "game-id", title: "Test game" }];
    client.categories = [
      {
        id: "main-1",
        game_id: "game-id",
        parent_category_id: null,
        name: "Player 1",
        timing_rules: null,
        sort_order: 1,
        created_at: "",
      },
      {
        id: "main-4",
        game_id: "game-id",
        parent_category_id: null,
        name: "Player 4",
        timing_rules: null,
        sort_order: 2,
        created_at: "",
      },
      {
        id: "subcategory-4",
        game_id: "game-id",
        parent_category_id: "main-4",
        name: "Glitchless",
        timing_rules: "Player 4 rules",
        sort_order: 3,
        created_at: "",
      },
    ];

    render(<SubmitRunPage onRequireAuth={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText("Game"), { target: { value: "game-id" } });

    const playerFourButton = await screen.findByRole("button", { name: "Player 4" });
    expect(playerFourButton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(playerFourButton);
    const subcategorySelect = await screen.findByLabelText("Subcategory");
    expect(subcategorySelect).toBeInTheDocument();
    expect(playerFourButton).toHaveAttribute("aria-expanded", "true");

    fireEvent.change(subcategorySelect, { target: { value: "subcategory-4" } });
    expect(subcategorySelect).toHaveValue("subcategory-4");
    expect(screen.getByText("Player 4 rules")).toBeInTheDocument();
  });
});
