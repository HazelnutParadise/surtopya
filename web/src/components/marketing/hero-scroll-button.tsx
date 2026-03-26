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

    target.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <button
      type="button"
      onClick={handleScroll}
      aria-label={label}
      className="group relative inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-white/90 shadow-[0_10px_30px_rgba(0,0,0,0.32)] backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-white/45 hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    >
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="relative h-5 w-5 transition-transform duration-300 group-hover:translate-y-0.5"
      >
        <path d="m6 10 6 6 6-6" />
      </svg>
    </button>
  );
}
