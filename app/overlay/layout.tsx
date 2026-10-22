import type { Metadata } from "next";
import { AutoUpdate } from "@/components/shell/AutoUpdate";

export const metadata: Metadata = { robots: { index: false } };

// OBS browser sources: transparent page, no site chrome. A new deploy
// reloads the source by itself.
export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{"html,body{background:transparent!important;overflow:hidden}"}</style>
      {children}
      <AutoUpdate every={30_000} />
    </>
  );
}
