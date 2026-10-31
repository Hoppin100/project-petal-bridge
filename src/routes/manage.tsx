import { createFileRoute } from '@tanstack/react-router';
import { ManageGamesPage } from '@/views/ManageGamesPage';


export const Route = createFileRoute('/manage')({
  head: () => ({
    meta: [
      { title: 'Manage Games — SplitRush' },
      { name: 'description', content: 'Add and organize games and categories on SplitRush.' },
      { property: 'og:title', content: 'Manage Games — SplitRush' },
      { property: 'og:description', content: 'Add and organize games and categories on SplitRush.' },
    ],
  }),
  component: ManageGamesPage,
});
