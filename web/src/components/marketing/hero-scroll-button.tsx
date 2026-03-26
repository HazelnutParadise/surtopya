"use client";

type HeroScrollButtonProps = {
  targetId: string;
  label?: string;
};

export function HeroScrollButton({
  targetId,
  label = "Scroll to next section",
}: HeroScrollButtonProps) {
  const handleScroll = () => {
    const target = document.getElementById(targetId);
    if (!target) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const offsetPx = 72;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - offsetPx;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <button
      type="button"
      onClick={handleScroll}
      aria-label={label}
      className="group relative inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-fuchsia-300/55 bg-gradient-to-b from-fuchsia-500/85 to-pink-600/85 text-white shadow-[0_12px_30px_rgba(190,24,93,0.45)] transition duration-300 hover:border-fuchsia-200/80 hover:from-fuchsia-400 hover:to-pink-500 hover:text-white active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/80"
    >
      {/* Pulsing ring on hover */}
      <span className="absolute inset-0 animate-ping rounded-full border border-fuchsia-200/60 opacity-0 transition-opacity group-hover:opacity-70" style={{ animationDuration: "1.5s" }} />
      <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/20 via-fuchsia-200/15 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-95" />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="relative h-5 w-5"
      >
        <path d="m6 10 6 6 6-6" />
      </svg>
    </button>
  );
}
