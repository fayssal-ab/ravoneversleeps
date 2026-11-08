import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "@/components/account/LogoutButton";
import { AdminNav } from "@/components/admin/AdminNav";
import { ConfirmHost } from "@/components/ui/confirm";
import { isOwner, requireAdmin } from "@/lib/admin";
import { openChallengeClaimCount, pendingVerifications } from "@/lib/verification";
import { listVipApplications } from "@/lib/vip";
import { pendingRedemptionCount } from "@/lib/store";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  // what's waiting, shown as badges in the sidebar on every admin page
  const [verify, vip, challenges, store, owner] = await Promise.all([
    pendingVerifications().then((r) => r.length).catch(() => 0),
    listVipApplications("pending").then((r) => r.length).catch(() => 0),
    openChallengeClaimCount().catch(() => 0),
    pendingRedemptionCount().catch(() => 0),
    isOwner(),
  ]);
  // the owner is in through their site sign-in: signing out ends that
  const logout = owner ? { endpoint: "/api/auth/user/logout", to: "/" } : { endpoint: "/api/auth/logout", to: "/login" };
  const counts = { "/admin/users": verify, "/admin/vip": vip, "/admin/challenges": challenges, "/admin/store": store };
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-white/[0.06] bg-bg-2 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 lg:px-5 lg:pt-5">
          <Link href="/" className="flex items-center gap-2.5" title="Open the site">
            <Image src="/media/ravo-avatar.webp" alt="" width={34} height={34} className="rounded-full" />
            <span className="font-head text-base font-bold">RAVO <span className="font-medium text-muted">admin</span></span>
          </Link>
          <div className="lg:hidden"><LogoutButton {...logout} /></div>
        </div>
        <div className="px-3 py-3 lg:flex-1 lg:overflow-y-auto lg:py-6"><AdminNav counts={counts} owner={owner} /></div>
        <div className="hidden border-t border-white/[0.06] p-4 lg:block"><LogoutButton {...logout} /></div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      <ConfirmHost />
    </div>
  );
}
