import { createFileRoute } from '@tanstack/react-router';
import { HomePage } from '@/views/HomePage';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'SplitRush — Speedrun Leaderboards' },
      { name: 'description', content: 'Track speedrun times, compare runs, and climb the SplitRush leaderboards.' },
      { property: 'og:title', content: 'SplitRush — Speedrun Leaderboards' },
      { property: 'og:description', content: 'Track speedrun times, compare runs, and climb the SplitRush leaderboards.' },
    ],
  }),
  component: HomePage,
});
