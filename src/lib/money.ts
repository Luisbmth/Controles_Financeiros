export const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const formatBRL = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  return BRL.format(Number.isFinite(v) ? v : 0);
};

export const parseMoneyInput = (s: string): number => {
  if (!s) return 0;
  const cleaned = s.replace(/\./g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
  const v = parseFloat(cleaned);
  return Number.isFinite(v) ? v : 0;
};
