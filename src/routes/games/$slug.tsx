import { createFileRoute } from '@tanstack/react-router';
import { GameDetailPage } from '@/views/GameDetailPage';
function Detail() {
  const { slug } = Route.useParams();
  return <GameDetailPage key={slug} slug={slug} />;
}

export const Route = createFileRoute('/games/$slug')({
  head: () => ({
    meta: [
      { title: 'Game Leaderboard — SplitRush' },
      { name: 'description', content: 'Speedrun leaderboard and categories for this game on SplitRush.' },
      { property: 'og:title', content: 'Game Leaderboard — SplitRush' },
      { property: 'og:description', content: 'Speedrun leaderboard and categories for this game on SplitRush.' },
    ],
  }),
  component: Detail,
});
