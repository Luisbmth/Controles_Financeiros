import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/categories";
import { useCustomCategories } from "@/lib/profile";
import { parseMoneyInput, formatBRL } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { addMonths, format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/new")({
  head: () => ({ meta: [{ title: "Nova conta · Saldo" }] }),
  component: NewBill,
});

function NewBill() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: customCats = [] } = useCustomCategories();

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("Outros");
  const [customCat, setCustomCat] = useState("");
  const [dueDate, setDueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"pending" | "paid">("pending");
  const [isFixed, setIsFixed] = useState(false);
  const [isInstallment, setIsInstallment] = useState(false);
  const [isOneOff, setIsOneOff] = useState(false);
  const [installments, setInstallments] = useState("2");
  const [busy, setBusy] = useState(false);

  const value = parseMoneyInput(amount);
  const n = Math.max(2, Math.min(60, parseInt(installments) || 2));

  const resolveCategory = async (): Promise<string> => {
    if (category !== "__custom") return category;
    const name = customCat.trim();
    if (!name) { toast.error("Digite a categoria"); throw new Error("no cat"); }
    if (!customCats.includes(name) && user) {
      await supabase.from("custom_categories").insert({ user_id: user.id, name }).select();
      qc.invalidateQueries({ queryKey: ["custom-categories"] });
    }
    return name;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim() || value <= 0) { toast.error("Preencha nome e valor"); return; }
    setBusy(true);
    try {
      const cat = await resolveCategory();
      if (isOneOff) {
        const { error } = await supabase.from("bills").insert({
          user_id: user.id,
          name: name.trim(), amount: value, category: cat,
          due_date: dueDate, notes: notes.trim() || null,
          is_one_off: true, status: "paid", paid_at: new Date().toISOString(),
        });
        if (error) throw error;
      } else if (isFixed) {
        const day = new Date(dueDate).getUTCDate();
        const { data: fixed, error: fe } = await supabase.from("fixed_bills").insert({
          user_id: user.id, name: name.trim(), amount: value, category: cat,
          day_of_month: day, notes: notes.trim() || null, active: true,
        }).select().single();
        if (fe) throw fe;
        const { error: be } = await supabase.from("bills").insert({
          user_id: user.id, name: name.trim(), amount: value, category: cat,
          due_date: dueDate, notes: notes.trim() || null,
          fixed_bill_id: fixed!.id, status,
          paid_at: status === "paid" ? new Date().toISOString() : null,
        });
        if (be) throw be;
      } else if (isInstallment) {
        const groupId = crypto.randomUUID();
        const base = new Date(dueDate);
        const rows = Array.from({ length: n }, (_, i) => ({
          user_id: user.id,
          name: name.trim(), amount: value, category: cat,
          due_date: format(addMonths(base, i), "yyyy-MM-dd"),
          notes: notes.trim() || null,
          installment_number: i + 1, installment_total: n, installment_group: groupId,
          status: i === 0 ? status : "pending" as const,
          paid_at: i === 0 && status === "paid" ? new Date().toISOString() : null,
        }));
        const { error } = await supabase.from("bills").insert(rows);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bills").insert({
          user_id: user.id, name: name.trim(), amount: value, category: cat,
          due_date: dueDate, notes: notes.trim() || null, status,
          paid_at: status === "paid" ? new Date().toISOString() : null,
        });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["fixed-bills"] });
      toast.success("Salvo ✓");
      navigate({ to: "/app" });
    } catch (err: any) {
      if (err?.message !== "no cat") toast.error(err.message ?? "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <header className="flex items-center gap-3 px-5 pb-4 pt-10">
        <button onClick={() => navigate({ to: "/app" })} className="rounded-full p-2 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-2xl font-bold">Nova conta</h1>
      </header>

      <form onSubmit={submit} className="space-y-5 px-5">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Internet Vivo" className="h-12" maxLength={120} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input id="amount" required inputMode="decimal" value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className="h-12" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="due">{isOneOff ? "Data" : "Vencimento"}</Label>
            <Input id="due" type="date" required value={dueDate}
              onChange={(e) => setDueDate(e.target.value)} className="h-12" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              {customCats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              <SelectItem value="__custom">+ Nova categoria…</SelectItem>
            </SelectContent>
          </Select>
          {category === "__custom" && (
            <Input className="mt-2 h-12" placeholder="Nome da nova categoria"
              maxLength={40} value={customCat} onChange={(e) => setCustomCat(e.target.value)} />
          )}
        </div>

        {!isOneOff && (
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="paid">Paga</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="notes">Observações</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Opcional" rows={2} maxLength={500} />
        </div>

        <div className="space-y-3 rounded-2xl bg-surface-muted p-4 ring-1 ring-border">
          <Row label="Gasto avulso" sub="Só este mês, marca como pago"
            checked={isOneOff}
            onChange={(v) => { setIsOneOff(v); if (v) { setIsFixed(false); setIsInstallment(false); } }} />
          {!isOneOff && (
            <>
              <Row label="Conta fixa" sub="Repete todo mês"
                checked={isFixed}
                onChange={(v) => { setIsFixed(v); if (v) setIsInstallment(false); }} />
              <Row label="Parcelada" sub="Divide o valor em várias parcelas mensais"
                checked={isInstallment}
                onChange={(v) => { setIsInstallment(v); if (v) setIsFixed(false); }} />
              {isInstallment && (
                <div className="space-y-1.5 pt-2">
                  <Label htmlFor="parcelas">Número de parcelas</Label>
                  <Input id="parcelas" type="number" min={2} max={60} value={installments}
                    onChange={(e) => setInstallments(e.target.value)} className="h-12" />
                  {value > 0 && (
                    <p className="rounded-lg bg-primary/10 p-2 text-xs text-primary">
                      {n}× de <strong>{formatBRL(value / n)}</strong> (total {formatBRL(value)})
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <Button type="submit" disabled={busy} className="h-14 w-full text-base font-bold">
          {busy ? "Salvando…" : "Salvar"}
        </Button>
      </form>
    </div>
  );
}

function Row({ label, sub, checked, onChange }: {
  label: string; sub: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
