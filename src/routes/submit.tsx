import { createFileRoute } from '@tanstack/react-router';
import { SubmitRunPage } from '@/views/SubmitRunPage';
import { useOpenAuth } from '@/lib/auth-modal';
function Submit() {
  const openAuth = useOpenAuth();
  return <SubmitRunPage onRequireAuth={() => openAuth('signin')} />;
}

export const Route = createFileRoute('/submit')({
  head: () => ({
    meta: [
      { title: 'Submit a Run — SplitRush' },
      { name: 'description', content: 'Submit your speedrun with video proof to SplitRush.' },
      { property: 'og:title', content: 'Submit a Run — SplitRush' },
      { property: 'og:description', content: 'Submit your speedrun with video proof to SplitRush.' },
    ],
  }),
  component: Submit,
});
