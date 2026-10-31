import { createFileRoute } from '@tanstack/react-router';
import { GameRequestPage } from '@/views/GameRequestPage';
import { useOpenAuth } from '@/lib/auth-modal';
function RequestGame() {
  const openAuth = useOpenAuth();
  return <GameRequestPage onRequireAuth={() => openAuth('signin')} />;
}

export const Route = createFileRoute('/request-game')({
  head: () => ({
    meta: [
      { title: 'Request a Game — SplitRush' },
      { name: 'description', content: 'Ask the SplitRush owners to add a new game.' },
      { property: 'og:title', content: 'Request a Game — SplitRush' },
      { property: 'og:description', content: 'Ask the SplitRush owners to add a new game.' },
    ],
  }),
  component: RequestGame,
});
