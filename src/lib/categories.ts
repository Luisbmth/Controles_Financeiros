export const CATEGORIES = [
  "Moradia",
  "Água",
  "Energia",
  "Internet",
  "Cartão de Crédito",
  "Alimentação",
  "Transporte",
  "Saúde",
  "Lazer",
  "Investimentos",
  "Outros",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_COLOR: Record<string, string> = {
  Moradia: "oklch(0.55 0.15 260)",
  "Água": "oklch(0.7 0.13 220)",
  Energia: "oklch(0.78 0.16 75)",
  Internet: "oklch(0.6 0.18 290)",
  "Cartão de Crédito": "oklch(0.6 0.22 25)",
  "Alimentação": "oklch(0.72 0.18 145)",
  Transporte: "oklch(0.6 0.14 200)",
  "Saúde": "oklch(0.65 0.2 10)",
  Lazer: "oklch(0.7 0.18 320)",
  Investimentos: "oklch(0.5 0.1 160)",
  Outros: "oklch(0.55 0.02 260)",
};
