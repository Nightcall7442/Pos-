// Контраст по WCAG — для цветов, которые задаёт пользователь (цвет категории):
// подпись на таком фоне должна читаться, какой бы цвет ни выбрали.

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return 1;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE = "#ffffff";
const INK = "#15191b";

/** Белый или графит — что читается лучше на этом фоне. Не цвет — графит. */
export function readableOn(background: string | null | undefined): string {
  if (!background || luminance(background) === null) return INK;
  return contrastRatio(WHITE, background) >= contrastRatio(INK, background) ? WHITE : INK;
}
