"use client";

/**
 * Minimal empty-state illustration for the dashboard.
 * Restrained geometric shapes suggesting learning — book, dots, abstract lines.
 * Uses only design-system CSS custom properties so it adapts to light/dark mode.
 */
export default function EmptyStateIllustration() {
  return (
    <svg
      viewBox="0 0 200 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-40 h-24 md:w-48 md:h-28 shrink-0"
      aria-hidden="true"
    >
      {/* Book base */}
      <path
        d="M36 28 L100 18 L164 28 L164 96 L100 86 L36 96 Z"
        stroke="currentColor"
        className="text-muted-foreground/20"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Spine */}
      <line
        x1="100"
        y1="18"
        x2="100"
        y2="86"
        stroke="currentColor"
        className="text-muted-foreground/20"
        strokeWidth="1.5"
      />
      {/* Left page lines */}
      <line x1="50" y1="34" x2="86" y2="26" stroke="currentColor" className="text-muted-foreground/15" strokeWidth="1" />
      <line x1="50" y1="48" x2="86" y2="40" stroke="currentColor" className="text-muted-foreground/15" strokeWidth="1" />
      <line x1="50" y1="62" x2="86" y2="54" stroke="currentColor" className="text-muted-foreground/15" strokeWidth="1" />
      <line x1="50" y1="76" x2="86" y2="68" stroke="currentColor" className="text-muted-foreground/15" strokeWidth="1" />
      {/* Right page lines */}
      <line x1="114" y1="26" x2="150" y2="34" stroke="currentColor" className="text-muted-foreground/15" strokeWidth="1" />
      <line x1="114" y1="40" x2="150" y2="48" stroke="currentColor" className="text-muted-foreground/15" strokeWidth="1" />
      <line x1="114" y1="54" x2="150" y2="62" stroke="currentColor" className="text-muted-foreground/15" strokeWidth="1" />
      <line x1="114" y1="68" x2="150" y2="76" stroke="currentColor" className="text-muted-foreground/15" strokeWidth="1" />
      {/* Floating dots */}
      <circle cx="20" cy="42" r="2" className="fill-muted-foreground/20" />
      <circle cx="180" cy="55" r="2" className="fill-muted-foreground/20" />
      <circle cx="14" cy="78" r="1.5" className="fill-muted-foreground/15" />
      <circle cx="186" cy="32" r="1.5" className="fill-muted-foreground/15" />
      <circle cx="28" cy="95" r="1" className="fill-muted-foreground/10" />
      <circle cx="172" cy="90" r="1" className="fill-muted-foreground/10" />
      {/* Accent dot (primary tint) */}
      <circle cx="100" cy="100" r="2.5" className="fill-primary/30" />
    </svg>
  );
}