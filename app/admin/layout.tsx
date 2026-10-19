import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "@/components/account/LogoutButton";
import { AdminNav } from "@/components/admin/AdminNav";
import { ConfirmHost } from "@/components/ui/confirm";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-white/[0.06] bg-bg-2 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 lg:px-5 lg:pt-5">
          <Link href="/" className="flex items-center gap-2.5" title="Open the site">
            <Image src="/media/ravo-avatar.webp" alt="" width={34} height={34} className="rounded-full" />
            <span className="font-head text-base font-bold">RAVO <span className="font-medium text-muted">admin</span></span>
          </Link>
          <div className="lg:hidden"><LogoutButton endpoint="/api/auth/logout" to="/login" /></div>
        </div>
        <div className="px-3 py-3 lg:flex-1 lg:overflow-y-auto lg:py-6"><AdminNav /></div>
        <div className="hidden border-t border-white/[0.06] p-4 lg:block"><LogoutButton endpoint="/api/auth/logout" to="/login" /></div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      <ConfirmHost />
    </div>
  );
}
