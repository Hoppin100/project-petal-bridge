import { createFileRoute } from '@tanstack/react-router';
import { AccountPage } from '@/views/AccountPage';


export const Route = createFileRoute('/account')({
  head: () => ({
    meta: [
      { title: 'Account — SplitRush' },
      { name: 'description', content: 'Manage your SplitRush profile and settings.' },
      { property: 'og:title', content: 'Account — SplitRush' },
      { property: 'og:description', content: 'Manage your SplitRush profile and settings.' },
    ],
  }),
  component: AccountPage,
});
