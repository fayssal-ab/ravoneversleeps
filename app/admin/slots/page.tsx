import { AdminTitle, Card } from "@/components/admin/ui";
import { Flash } from "@/components/ui/bits";
import { SlotArt } from "@/components/ui/SlotArt";
import { getCatalogStats, popularSlots } from "@/lib/slots";
import { syncSlotsAction } from "../actions";

export default async function AdminSlots({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [stats, top] = await Promise.all([getCatalogStats(), popularSlots(24)]);
  return (
    <>
      <AdminTitle title="Slot catalogue">
        Names, providers and art for bonus hunts and tournaments. It re-syncs once a day via <code className="text-neon">/api/cron/slots</code>; sync by hand here any time.
      </AdminTitle>
      <Flash ok={sp.ok} error={sp.error} detail={sp.detail} okText="Catalogue synced." />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[["Slots", stats.total], ["With art", stats.withArt], ["Providers", stats.providers], ["Hidden (Stake only)", stats.hidden]].map(([l, v]) => (
              <div key={l}><p className="font-mono text-3xl font-bold text-neon">{Number(v).toLocaleString("en-US")}</p><p className="text-xs uppercase tracking-widest text-dim">{l}</p></div>
            ))}
          </div>
          <form action={syncSlotsAction}><button className="btn btn-neon">Sync now</button></form>
        </div>
        <p className="mt-3 text-xs text-dim">Last sync: {stats.syncedAt ? `${stats.syncedAt} UTC` : "never"}</p>
      </Card>
      {top.length > 0 && (
        <Card title="Most played" className="mt-6">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-8">
            {top.map((s) => (
              <div key={s.id} className="text-center">
                <SlotArt name={s.name} src={s.imageUrl} fluid="100%" className="aspect-[3/4] !h-auto" />
                <p className="mt-1 truncate text-xs">{s.name}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
