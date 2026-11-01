import { createFileRoute } from '@tanstack/react-router';
import { MembersPage } from '@/views/MembersPage';

export const Route = createFileRoute('/members')({
  head: () => ({ meta: [
    { title: 'Members — SplitRush' },
    { name: 'description', content: 'Owners can manage SplitRush member and owner access.' },
    { property: 'og:title', content: 'Members — SplitRush' },
    { property: 'og:description', content: 'Owners can manage SplitRush member and owner access.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: MembersPage,
});