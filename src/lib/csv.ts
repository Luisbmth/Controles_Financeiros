/** Minimal CSV parser. Handles quoted fields with commas and double-quote escapes. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (field !== "" || cur.length) { cur.push(field); rows.push(cur); cur = []; field = ""; }
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else field += c;
    }
  }
  if (field !== "" || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

export type ImportRow = {
  name: string;
  amount: number;
  category: string;
  due_date: string; // yyyy-MM-dd
  status: "paid" | "pending";
};

const HEADER_MAP: Record<string, keyof ImportRow> = {
  nome: "name", name: "name", descricao: "name", descrição: "name",
  valor: "amount", amount: "amount", preco: "amount", preço: "amount",
  categoria: "category", category: "category",
  vencimento: "due_date", data: "due_date", "due date": "due_date", due_date: "due_date",
  status: "status", situacao: "status", situação: "status",
};

const norm = (s: string) => s.trim().toLowerCase();

function parseDate(s: string): string | null {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (br) {
    let [, d, m, y] = br;
    if (y.length === 2) y = "20" + y;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parseAmount(s: string): number {
  const clean = s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const v = parseFloat(clean);
  return Number.isFinite(v) ? v : NaN;
}

export function mapRows(rows: string[][]): { ok: ImportRow[]; errors: string[] } {
  if (rows.length === 0) return { ok: [], errors: ["Arquivo vazio"] };
  const headers = rows[0].map(norm);
  const idx: Partial<Record<keyof ImportRow, number>> = {};
  headers.forEach((h, i) => { const k = HEADER_MAP[h]; if (k) idx[k] = i; });
  if (idx.name === undefined || idx.amount === undefined || idx.due_date === undefined) {
    return { ok: [], errors: ["Cabeçalhos obrigatórios: nome, valor, vencimento"] };
  }
  const ok: ImportRow[] = [];
  const errors: string[] = [];
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const name = r[idx.name!]?.trim();
    const amount = parseAmount(r[idx.amount!] ?? "");
    const due = parseDate(r[idx.due_date!] ?? "");
    if (!name) return errors.push(`Linha ${line}: nome vazio`);
    if (!Number.isFinite(amount) || amount <= 0) return errors.push(`Linha ${line}: valor inválido`);
    if (!due) return errors.push(`Linha ${line}: data inválida`);
    const statusRaw = idx.status !== undefined ? norm(r[idx.status] ?? "") : "";
    const status: "paid" | "pending" =
      ["pago", "paga", "paid"].includes(statusRaw) ? "paid" : "pending";
    ok.push({
      name,
      amount,
      category: (idx.category !== undefined && r[idx.category]?.trim()) || "Outros",
      due_date: due,
      status,
    });
  });
  return { ok, errors };
}
