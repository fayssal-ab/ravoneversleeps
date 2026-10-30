import Link from "next/link";
import { ExternalLink, MonitorPlay } from "lucide-react";
import { AdminTitle } from "@/components/admin/ui";
import { KoArchiveAdmin, type ArchiveRow } from "@/components/tournament/KoArchiveAdmin";
import { KoDashboard } from "@/components/tournament/KoDashboard";
import { SITE_URL } from "@/lib/constants";
import { getFeaturedKo, getKoState, listKoAdmin, type KoState } from "@/lib/knockout";
import { ensureCatalog } from "@/lib/slots";

export const dynamic = "force-dynamic";

export default async function AdminTournaments() {
  await ensureCatalog();
  let initial: KoState | null = null;
  const archive: ArchiveRow[] = await listKoAdmin().catch(() => []);
  try {
    const t = await getFeaturedKo();
    initial = t ? await getKoState(t) : null;
  } catch { /* the dashboard shows the live error state */ }
  return (
    <>
      <AdminTitle title="Tournament">
        Pick 4, 8, 16 or 32 players → open registration → viewers type <code className="text-neon">!join &lt;slot&gt;</code> in Kick chat (received by the Kick webhook, this page can be closed) or you add them here.
        Plain <code className="text-neon">!join</code> gives a random slot. Roll 2 players → confirm → start → enter both bonus results: the higher multiplier wins.
      </AdminTitle>
      <div className="mb-6 flex flex-wrap gap-2">
        <Link href="/overlay/tournament" target="_blank" className="btn btn-ghost btn-sm"><MonitorPlay className="size-4" /> OBS overlay</Link>
        <Link href="/tournaments" target="_blank" className="btn btn-ghost btn-sm"><ExternalLink className="size-4" /> Public page</Link>
      </div>
      <KoDashboard initial={initial} overlayUrl={`${SITE_URL.replace(/\/$/, "")}/overlay/tournament`} />
      <KoArchiveAdmin rows={archive} />
    </>
  );
}
