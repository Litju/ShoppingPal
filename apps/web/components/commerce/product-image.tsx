import { cn } from "@/lib/utils";

/**
 * Deterministic product artwork. Instead of external images (licensing,
 * offline builds, layout shift), every product gets a generated SVG tile:
 * stable two-tone wash + category glyph + brand mark.
 */

const PALETTES: Array<[string, string]> = [
  ["#E7EBE4", "#CBD5C0"],
  ["#E9E4DC", "#D3C8B8"],
  ["#E2E8EC", "#BCCBD6"],
  ["#EFE9E2", "#D9CFC4"],
  ["#E5E9EE", "#C6CFDA"],
  ["#ECE7E1", "#D6CCC2"],
];

const CATEGORY_GLYPHS: Record<string, string> = {
  computers: "M4 5h16v10H4z M9 19h6",
  "computer-accessories": "M7 11a5 5 0 1 1 10 0 M12 11v7",
  audio: "M4 13a8 8 0 0 1 16 0 M6 14h3v6H6z M15 14h3v6h-3z",
  "phones-accessories": "M8 3h8v18H8z M11 18.5h2",
  fitness: "M4 9v6 M7 7v10 M17 7v10 M20 9v6 M7 12h10",
  home: "M4 11l8-7 8 7 M6 10v10h12V10",
  kitchen: "M6 3c-1 4 0 6 2 7v8h8v-8c2-1 3-3 2-7z M12 10v8",
  outdoors: "M3 19l7-12 4 7 2-3 5 8z",
  "everyday-carry": "M7 8V6a5 5 0 0 1 10 0v2 M5 8h14l-1 12H6L5 8z",
};

function hashString(text: string): number {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function ProductImage({
  slug,
  category,
  title,
  className,
}: {
  slug: string;
  category: string;
  title: string;
  className?: string;
}) {
  const h = hashString(slug);
  const palette = PALETTES[h % PALETTES.length] ?? PALETTES[0] ?? (["#E7EBE4", "#CBD5C0"] as const);
  const [from, to] = palette;
  const angle = 30 + (h % 60);
  const glyph = CATEGORY_GLYPHS[category] ?? "M4 4h16v16H4z";
  const initials = title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={title}
      className={cn("h-full w-full", className)}
    >
      <defs>
        <linearGradient id={`g-${slug}`} gradientTransform={`rotate(${angle} .5 .5)`}>
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="200" height="200" fill={`url(#g-${slug})`} rx="0" />
      <g
        transform="translate(100 96)"
        stroke="#1F2937"
        strokeOpacity="0.55"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d={glyph} />
      </g>
      <text
        x="16"
        y="186"
        fontFamily="ui-sans-serif, system-ui"
        fontSize="13"
        fontWeight={600}
        letterSpacing={2}
        fill="#111827"
        fillOpacity="0.45"
      >
        {initials}
      </text>
    </svg>
  );
}
