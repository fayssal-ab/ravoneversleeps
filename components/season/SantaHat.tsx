/** Small Santa hat in RAVO colours (emerald, not red) for the mascot. */
export function SantaHat({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden>
      <defs>
        <linearGradient id="hat-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2e9a3e" />
          <stop offset="0.55" stopColor="#1f6b2b" />
          <stop offset="1" stopColor="#0c3517" />
        </linearGradient>
        <radialGradient id="hat-fur" cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9e1dc" />
        </radialGradient>
      </defs>
      <path d="M14 76 C22 40 48 12 80 10 C96 9 108 20 104 36 C98 30 90 28 84 34 C76 44 80 62 92 76 Z" fill="url(#hat-body)" />
      <path d="M40 30 C56 18 72 14 84 16" stroke="rgb(255 255 255 / 0.18)" strokeWidth="4" fill="none" strokeLinecap="round" />
      <rect x="6" y="70" width="96" height="20" rx="10" fill="url(#hat-fur)" />
      <circle cx="104" cy="38" r="11" fill="url(#hat-fur)" />
    </svg>
  );
}
