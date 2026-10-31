import { createFileRoute } from '@tanstack/react-router';
import { DashboardPage } from '@/views/DashboardPage';


export const Route = createFileRoute('/dashboard')({
  head: () => ({
    meta: [
      { title: 'Owner Dashboard — SplitRush' },
      { name: 'description', content: 'Review pending speedrun submissions on SplitRush.' },
      { property: 'og:title', content: 'Owner Dashboard — SplitRush' },
      { property: 'og:description', content: 'Review pending speedrun submissions on SplitRush.' },
    ],
  }),
  component: DashboardPage,
});
