// The shop's slug doubles as the code an admin reads out when pairing a
// terminal, so it has to stay readable for names written in Cyrillic: without
// transliteration «Продукты Барака» collapsed to an empty string and every such
// shop became "shop", "shop-2", ...

const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  // Uzbek Cyrillic
  ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .split("")
    .map((ch) => (ch in CYRILLIC ? CYRILLIC[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
