// The old episode "hub" has been folded into the Studio. Anyone landing here
// (old bookmarks, dashboard links) gets bounced straight to the Studio.
import { redirect } from 'next/navigation';

export default function EpisodeRedirect({ params }: { params: { id: string } }) {
  redirect(`/admin/episodes/${params.id}/studio`);
}
