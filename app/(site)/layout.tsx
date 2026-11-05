import { PartnerMarquee } from "@/components/home/PartnerMarquee";
import { Snow } from "@/components/season/Snow";
import { isHolidaySeason } from "@/lib/season";
import { SmoothScroll } from "@/components/shell/SmoothScroll";
import { AutoUpdate } from "@/components/shell/AutoUpdate";
import { Backdrop } from "@/components/shell/Backdrop";
import { CookieBanner } from "@/components/shell/CookieBanner";
import { Footer } from "@/components/shell/Footer";
import { Preloader } from "@/components/shell/Preloader";
import { TopBar } from "@/components/shell/TopBar";
import { getViewer } from "@/lib/account";
import { getLiveStatus } from "@/lib/stream";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [viewer, live] = await Promise.all([getViewer(), getLiveStatus()]);
  return (
    <>
      <Preloader />
      <Backdrop />
      {isHolidaySeason() && <Snow />}
      <TopBar
        live={live.live}
        viewer={viewer && { name: viewer.display_name, avatar: viewer.avatar, points: viewer.points, level: viewer.level }}
      />
      <div className="relative isolate overflow-x-clip">
        <main className="pt-[calc(var(--nav-h)+1.5rem)]">{children}</main>
        <PartnerMarquee className="mt-24" />
        <Footer />
      </div>
      <CookieBanner />
      <AutoUpdate />
      <SmoothScroll />
    </>
  );
}
