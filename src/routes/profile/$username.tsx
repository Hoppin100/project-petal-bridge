import { createFileRoute } from '@tanstack/react-router';
import { ProfilePage } from '@/views/ProfilePage';
function Profile() {
  const { username } = Route.useParams();
  return <ProfilePage key={username} username={username} />;
}

export const Route = createFileRoute('/profile/$username')({
  head: () => ({
    meta: [
      { title: 'Runner Profile — SplitRush' },
      { name: 'description', content: 'A speedrunner profile and their runs on SplitRush.' },
      { property: 'og:title', content: 'Runner Profile — SplitRush' },
      { property: 'og:description', content: 'A speedrunner profile and their runs on SplitRush.' },
    ],
  }),
  component: Profile,
});
