import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  LaunchCountdown,
  LAUNCH_AT,
} from '@/components/LaunchCountdown';

describe('LaunchCountdown', () => {
  it('counts down to 8 PM EST on November 7, 2026', () => {
    expect(new Date(LAUNCH_AT).toISOString()).toBe(
      '2026-11-08T01:00:00.000Z'
    );

    render(
      <LaunchCountdown
        now={LAUNCH_AT - 2 * 86_400_000 - 3_600_000 - 4 * 60_000 - 5_000}
        onOpenAuth={vi.fn()}
      />
    );

    expect(
      screen.getByText(/November 7, 2026 at 8:00 PM EST/)
    ).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('04')).toBeInTheDocument();
    expect(screen.getByText('05')).toBeInTheDocument();
  });

  it('lets visitors open sign-up and sign-in', () => {
    const onOpenAuth = vi.fn();

    render(
      <LaunchCountdown now={LAUNCH_AT - 1} onOpenAuth={onOpenAuth} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(onOpenAuth).toHaveBeenNthCalledWith(1, 'signup');
    expect(onOpenAuth).toHaveBeenNthCalledWith(2, 'signin');
  });
});
