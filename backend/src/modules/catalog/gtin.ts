// Barcodes (GTIN): EAN-8, UPC-A (12), EAN-13, GTIN-14. The last digit is a
// check digit, so a mistyped or truncated code is recognisable without asking
// anyone — which keeps short codes typed on the keypad (PLU "104") and junk
// out of the barcode catalogue and away from the network.

export function isValidGtin(code: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop() as number;
  // Weights alternate 3, 1, 3, 1 … starting from the digit next to the check digit.
  let sum = 0;
  digits.reverse().forEach((digit, index) => {
    sum += digit * (index % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check;
}

// UPC-A is EAN-13 without its leading zero; different scanners and catalogues
// spell the same product either way.
export function barcodeVariants(code: string): string[] {
  const variants = new Set([code]);
  if (/^\d{12}$/.test(code)) variants.add("0" + code);
  if (/^0\d{12}$/.test(code)) variants.add(code.slice(1));
  return Array.from(variants);
}

// One spelling per product for storage: 13 digits where the code has 12 or 13.
export function canonicalBarcode(code: string): string {
  return /^\d{12}$/.test(code) ? "0" + code : code;
}

// GS1 prefixes of the countries whose goods fill Uzbek shelves — used to keep
// the regional part of the catalogue snapshot. (The prefix says where the code
// was issued, not where the goods were made, but it is a good proxy.)
const REGIONAL_PREFIXES = [
  "478", // Uzbekistan
  "470", // Kyrgyzstan
  "476", // Azerbaijan
  "481", "482", "483", "484", "485", "486", "487", "488", // Belarus, Ukraine, Turkmenistan, Moldova, Armenia, Georgia, Kazakhstan, Tajikistan
  "868", "869", // Turkey
  ...Array.from({ length: 10 }, (_, i) => `46${i}`), // Russia 460–469
];

// Goods that reach Uzbek shops from further trade partners — Iran, the Emirates,
// Egypt, China, Korea. Their codes are not "regional", but even a modestly
// scanned one is more likely to be on a local shelf than a random French cheese.
const TRADE_PREFIXES = ["622", "626", "629", "880", ...Array.from({ length: 10 }, (_, i) => `69${i}`)];

export function hasTradePrefix(code: string): boolean {
  const ean13 = code.length <= 13 ? code.padStart(13, "0") : code.slice(-13);
  return TRADE_PREFIXES.some((prefix) => ean13.startsWith(prefix));
}

/** Issued by GS1 Uzbekistan (prefix 478) — goods that carry it are made or packed in Uzbekistan. */
export function hasUzbekPrefix(code: string): boolean {
  const ean = code.length === 8 ? code : code.length <= 13 ? code.padStart(13, "0") : code.slice(-13);
  return ean.startsWith("478");
}

export function hasRegionalPrefix(code: string): boolean {
  const ean13 = code.length <= 13 ? code.padStart(13, "0") : code.slice(-13);
  return REGIONAL_PREFIXES.some((prefix) => ean13.startsWith(prefix));
}

// GS1 keeps some prefixes for use inside one shop or company: the labels a
// scale prints for weighed goods (200–299), coupons, refund slips. Such a code
// means something only in the shop that printed it — it is neither looked up
// nor shared.
export function isRestrictedCirculation(code: string): boolean {
  if (code.length === 8) return code.startsWith("2");
  const ean13 = code.length <= 13 ? code.padStart(13, "0") : code.slice(-13);
  // "0000…" is no real UPC-A either: such codes are in-store labels or typos that happen to add up.
  return /^(0000|2\d\d|02\d|04\d|05\d|98[0-9]|99\d)/.test(ean13);
}

/** A real, world-unique product code — the only kind the shared catalogue holds. */
export function isCatalogBarcode(code: string): boolean {
  return isValidGtin(code) && !isRestrictedCirculation(code);
}
