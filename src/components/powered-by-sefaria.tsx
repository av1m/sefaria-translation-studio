const SEFARIA_HOME = "https://www.sefaria.org";

const BADGE_SRC = {
  color: "/badges/powered-by-sefaria.png",
  white: "/badges/powered-by-sefaria-white.png",
} as const;

export function PoweredBySefaria({
  className = "",
  lazy = false,
  variant = "color",
}: {
  className?: string;
  lazy?: boolean;
  variant?: "color" | "white";
}) {
  return (
    <a
      href={SEFARIA_HOME}
      target="_blank"
      rel="noreferrer"
      title="Powered by Sefaria — not developed by Sefaria"
      className={`inline-flex shrink-0 ${className}`}
    >
      <img
        src={BADGE_SRC[variant]}
        alt="Powered by Sefaria"
        width={154}
        height={80}
        className="h-10 w-auto"
        loading={lazy ? "lazy" : undefined}
      />
    </a>
  );
}
