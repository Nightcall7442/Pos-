// Same currency table as the terminal and the admin panel (utils/money.ts
// there): the printed receipt must show the same amounts as the screen.
// It used to hardcode "₽" and two decimals, so a shop working in сўм got
// "22320.00 ₽" on paper.

interface CurrencyFormat {
  symbol: string;
  suffix: boolean;
  fractionDigits: number;
}

const FORMATS: Record<string, CurrencyFormat> = {
  USD: { symbol: "$", suffix: false, fractionDigits: 2 },
  EUR: { symbol: "€", suffix: true, fractionDigits: 2 },
  RUB: { symbol: "₽", suffix: true, fractionDigits: 2 },
  UZS: { symbol: "сўм", suffix: true, fractionDigits: 0 },
  KZT: { symbol: "₸", suffix: true, fractionDigits: 0 },
};

export function formatMoney(amount: number | string | null | undefined, currency?: string | null): string {
  const code = (currency || "USD").toUpperCase();
  const fmt = FORMATS[code] ?? { symbol: code, suffix: true, fractionDigits: 2 };
  const text = (Number(amount) || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: fmt.fractionDigits,
    maximumFractionDigits: fmt.fractionDigits,
  });
  return fmt.suffix ? `${text} ${fmt.symbol}` : `${fmt.symbol}${text}`;
}
