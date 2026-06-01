import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { parseCSV, mapRows, type ImportRow } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { formatBRL } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/profile/import")({
  head: () => ({ meta: [{ title: "Importar · Saldo" }] }),
  component: ImportPage,
});

function ImportPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File | null) => {
    if (!f) return;
    setText(await f.text());
  };

  const analyze = () => {
    const rows = parseCSV(text);
    const { ok, errors } = mapRows(rows);
    setPreview(ok);
    setErrors(errors);
    if (ok.length === 0 && errors.length) toast.error("Nenhuma linha válida");
  };

  const importAll = async () => {
    if (!user || preview.length === 0) return;
    setBusy(true);
    const rows = preview.map((p) => ({
      user_id: user.id,
      name: p.name,
      amount: p.amount,
      category: p.category,
      due_date: p.due_date,
      status: p.status,
      paid_at: p.status === "paid" ? new Date().toISOString() : null,
    }));
    const { error } = await supabase.from("bills").insert(rows);
    setBusy(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["bills"] });
    toast.success(`${rows.length} contas importadas ✓`);
    navigate({ to: "/app" });
  };

  return (
    <div className="min-h-dvh">
      <header className="flex items-center gap-3 px-5 pb-4 pt-10">
        <button onClick={() => navigate({ to: "/profile" })} className="rounded-full p-2 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-2xl font-bold">Importar CSV</h1>
      </header>

      <div className="space-y-4 px-5">
        <div className="rounded-2xl bg-surface-muted p-4 text-sm ring-1 ring-border">
          <p className="font-semibold">Formato esperado</p>
          <p className="text-xs text-muted-foreground">
            Colunas (na 1ª linha): <code>nome, valor, categoria, vencimento, status</code>.<br />
            Datas em <code>dd/mm/aaaa</code> ou <code>aaaa-mm-dd</code>. Valores em R$ (ex.: 1.234,56).
          </p>
        </div>

        <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface text-muted-foreground hover:bg-surface-muted">
          <Upload className="h-6 w-6" />
          <span className="text-sm">Selecionar arquivo .csv</span>
          <input type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        </label>

        <Textarea rows={6} placeholder="…ou cole o conteúdo CSV aqui"
          value={text} onChange={(e) => setText(e.target.value)} />

        <Button onClick={analyze} disabled={!text.trim()} className="h-12 w-full">
          Analisar
        </Button>

        {errors.length > 0 && (
          <div className="rounded-2xl bg-destructive/10 p-3 text-xs text-destructive">
            {errors.slice(0, 5).map((e, i) => <p key={i}>{e}</p>)}
            {errors.length > 5 && <p>+{errors.length - 5} erros…</p>}
          </div>
        )}

        {preview.length > 0 && (
          <>
            <div className="rounded-2xl bg-surface ring-1 ring-border">
              <div className="border-b border-border p-3 text-sm font-semibold">
                {preview.length} contas prontas para importar
              </div>
              <ul className="max-h-72 divide-y divide-border overflow-y-auto">
                {preview.slice(0, 50).map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.due_date} · {r.category} · {r.status}</p>
                    </div>
                    <p className="font-bold tabular-nums">{formatBRL(r.amount)}</p>
                  </li>
                ))}
              </ul>
            </div>
            <Button onClick={importAll} disabled={busy} className="h-12 w-full">
              {busy ? "Importando…" : `Importar ${preview.length} contas`}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
