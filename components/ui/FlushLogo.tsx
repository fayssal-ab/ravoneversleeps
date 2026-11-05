import Image from "next/image";

/** Flush's official logo from public/media/flush-logo.svg. */
export function FlushLogo({ className = "h-8 w-auto", priority = false }: { className?: string; priority?: boolean }) {
  return <Image src="/media/flush-logo.svg" alt="Flush" width={104} height={32} className={className} priority={priority} draggable={false} unoptimized />;
}
