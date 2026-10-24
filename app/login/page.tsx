import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Backdrop } from "@/components/shell/Backdrop";
import { LoginForm } from "@/components/admin/LoginForm";
import { isAdminSession } from "@/lib/admin";

export const metadata: Metadata = { title: "Admin login", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAdminSession()) redirect("/admin");
  return (
    <>
      <Backdrop />
      <main className="grid min-h-dvh place-items-center px-4">
        <div className="panel neon-frame is-on w-full max-w-sm p-8">
          <div className="flex flex-col items-center text-center">
            <Image src="/media/ravo-avatar.webp" alt="" width={72} height={72} className="rounded-full ring-2 ring-neon/50" />
            <h1 className="mt-4 font-display text-4xl"><span className="chrome">Control</span> <span className="neon-text">room</span></h1>
          </div>
          <LoginForm />
          <a href="/api/auth/discord/start?next=/admin" className="btn btn-ghost btn-sm mt-4 w-full">Owner: sign in with Discord</a>
        </div>
      </main>
    </>
  );
}
