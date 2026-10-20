import Link from "next/link";
import { AdminTitle, Card, Field } from "@/components/admin/ui";
import { Flash } from "@/components/ui/bits";
import { getTopPrizes } from "@/lib/leaderboardPrizes";
import { saveTopPrizesAction } from "../actions";

const PLACE = ["1st place", "2nd place", "3rd place"];

export default async function AdminLeaderboardPrizes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const top = await getTopPrizes();
  return (
    <>
      <AdminTitle title="Leaderboard prizes">
        What the top 3 of the running monthly leaderboard win, shown on the leaderboard, the home page and in the prize pool.
        Write an amount (<code>$3,000</code>) or an item (<code>AirPods Pro Max 2</code>); leave a field empty for no prize.
        Places 4 and below keep the prizes set on Q-boards. Rankings themselves come from <Link href="https://q-boards.com/ravoneversleeps" className="text-neon underline" target="_blank">Q-boards</Link>.
      </AdminTitle>
      <Flash ok={sp.ok} error={sp.error} detail={sp.detail} okText="Prizes saved." />
      <Card title="Top 3 prizes">
        <form action={saveTopPrizesAction} className="grid gap-4 sm:grid-cols-3">
          {PLACE.map((label, i) => (
            <Field key={label} label={label}>
              <input name={`p${i + 1}`} defaultValue={top[i] ?? ""} maxLength={60} placeholder={["$3,000", "$2,000", "AirPods Pro Max 2"][i]} className="field" />
            </Field>
          ))}
          <div className="sm:col-span-3"><button className="btn btn-neon btn-sm">Save prizes</button></div>
        </form>
      </Card>
    </>
  );
}
