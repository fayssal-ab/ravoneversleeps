import { FlushLogo } from "@/components/ui/FlushLogo";
import { QzinoLogo } from "@/components/ui/QzinoLogo";
import { FLUSH_URL, QZINO_CODE, QZINO_URL } from "@/lib/constants";

// Endless strip of both partners (Flush first, Qzino second). The row is
// rendered twice so the -50% marquee loops without a seam; the copy is hidden
// from screen readers and keyboard.
function Row({ copy = false }: { copy?: boolean }) {
  const link = copy ? { tabIndex: -1, "aria-hidden": true } : {};
  return (
    <div className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={copy || undefined}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-10">
          <a href={FLUSH_URL} target="_blank" rel="noopener noreferrer sponsored" className="partner-chip" aria-label="Flush" {...link}>
            <FlushLogo className="h-6 w-auto" />
          </a>
          <span className="spark-dot" />
          <span className="font-head text-xs font-bold uppercase tracking-[0.3em] text-muted">Official partners</span>
          <span className="spark-dot" />
          <a href={QZINO_URL} target="_blank" rel="noopener noreferrer sponsored" className="partner-chip" aria-label="Qzino" {...link}>
            <QzinoLogo className="h-6 w-auto" />
          </a>
          <span className="spark-dot" />
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-neon">Code {QZINO_CODE}</span>
          <span className="spark-dot" />
        </div>
      ))}
    </div>
  );
}

export function PartnerMarquee({ className = "" }: { className?: string }) {
  return (
    <div className={`partner-marquee ${className}`} role="region" aria-label="Partners: Flush and Qzino">
      <div className="partner-marquee-track">
        <Row />
        <Row copy />
      </div>
    </div>
  );
}
