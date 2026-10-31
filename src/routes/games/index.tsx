import { createFileRoute } from '@tanstack/react-router';
import { GamesPage } from '@/views/GamesPage';


export const Route = createFileRoute('/games/')({
  head: () => ({
    meta: [
      { title: 'Games — SplitRush' },
      { name: 'description', content: 'Browse every game with speedrun leaderboards on SplitRush.' },
      { property: 'og:title', content: 'Games — SplitRush' },
      { property: 'og:description', content: 'Browse every game with speedrun leaderboards on SplitRush.' },
    ],
  }),
  component: GamesPage,
});
