import { render, screen, waitFor } from "@testing-library/react";
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
  const chain: unknown = new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === "then" || prop === "catch" || prop === "finally") return undefined;
      return () => chain;
    },
  });
  return { chain };
});

vi.mock("@/lib/auth", () => ({
  useAuth: () => auth.state as never,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: () => client.chain },
}));

vi.mock("@/lib/verify-run.functions", () => ({
  runVerification: async () => ({}),
}));

describe("Run submission sign-in prompt", () => {
  beforeEach(() => {
    auth.state.session = null;
    auth.state.profile = null;
    auth.state.loading = true;
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
});
