// Fixed atmosphere behind every page: drifting smoke, pixel grid, grain, a
// few twinkling sparks and the two partners (Flush, Qzino) as huge faint
// marks drifting through the dark (positions fixed so server and client
// render the same).
const SPARKS = [
  { top: "12%", left: "8%", delay: "0s", size: 12 },
  { top: "22%", left: "88%", delay: "1.1s", size: 16 },
  { top: "48%", left: "4%", delay: "2.2s", size: 9 },
  { top: "64%", left: "94%", delay: "0.6s", size: 11 },
  { top: "82%", left: "16%", delay: "1.7s", size: 14 },
  { top: "35%", left: "60%", delay: "2.8s", size: 8 },
  { top: "90%", left: "72%", delay: "0.3s", size: 10 },
];

export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <div className="smoke smoke-a" />
      <div className="smoke smoke-b" />
      <div className="smoke smoke-c" />
      <div className="pixel-grid" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/media/flush-logo.svg" alt="" className="ghost-logo ghost-flush" draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/media/qzino-logo.svg" alt="" className="ghost-logo ghost-qzino" draggable={false} />
      <div className="flush-beam" />
      {SPARKS.map((s, i) => (
        <span key={i} className="spark" style={{ top: s.top, left: s.left, animationDelay: s.delay, width: s.size, height: s.size }} />
      ))}
      <div className="grain" />
    </div>
  );
}
