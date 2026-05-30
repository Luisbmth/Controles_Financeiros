import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useMonthBills } from "@/lib/bills";
import { formatBRL, parseMoneyInput } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/month")({
  head: () => ({ meta: [{ title: "Visão do mês · Saldo" }] }),
  component: MonthView,
});

function MonthView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth() + 1;

  const { data: bills = [] } = useMonthBills(y, m);
  const [income, setIncome] = useState("");
  const [saved, setSaved] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("monthly_income").select("amount")
      .eq("year", y).eq("month", m).maybeSingle()
      .then(({ data }) => {
        const v = data?.amount ? Number(data.amount) : 0;
        setSaved(v);
        if (v) setIncome(v.toString().replace(".", ","));
      });
  }, [user, y, m]);

  const total = bills.reduce((s, b) => s + Number(b.amount), 0);
  const paid = bills.filter((b) => b.status === "paid").reduce((s, b) => s + Number(b.amount), 0);
  const sobra = saved - total;
  const sobraReal = saved - paid;

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const v = parseMoneyInput(income);
    const { error } = await supabase.from("monthly_income").upsert(
      { user_id: user.id, year: y, month: m, amount: v },
      { onConflict: "user_id,year,month" }
    );
    setBusy(false);
    if (error) toast.error(error.message);
    else { setSaved(v); toast.success("Receita salva ✓"); }
  };

  return (
    <div className="min-h-dvh">
      <header className="flex items-center gap-3 px-5 pb-4 pt-10">
        <button onClick={() => navigate({ to: "/app" })} className="rounded-full p-2 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold">Visão do mês</h1>
          <p className="text-xs capitalize text-muted-foreground">
            {format(new Date(y, m - 1), "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
      </header>

      <section className="px-5 pt-2">
        <div className="space-y-1.5 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-border">
          <Label htmlFor="income" className="text-xs uppercase tracking-wider text-muted-foreground">
            Receita / salário do mês
          </Label>
          <div className="flex gap-2">
            <Input id="income" inputMode="decimal" value={income}
              onChange={(e) => setIncome(e.target.value)} placeholder="0,00" className="h-12" />
            <Button onClick={save} disabled={busy} className="h-12">Salvar</Button>
          </div>
        </div>
      </section>

      <section className="space-y-3 px-5 pt-5">
        <Card icon={<TrendingUp className="h-5 w-5" />} tone="success"
          label="Receita" value={formatBRL(saved)} />
        <Card icon={<TrendingDown className="h-5 w-5" />} tone="warning"
          label="Contas do mês" value={formatBRL(total)} sub={`${formatBRL(paid)} já pago`} />
        <Card icon={<Wallet className="h-5 w-5" />} tone={sobra >= 0 ? "success" : "danger"}
          label="Sobra prevista" value={formatBRL(sobra)}
          sub={`Sobra atual: ${formatBRL(sobraReal)}`} big />
      </section>
    </div>
  );
}

function Card({ icon, label, value, sub, tone, big }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  tone: "success" | "warning" | "danger"; big?: boolean;
}) {
  const t = {
    success: "bg-success/10 text-success",
    warning: "bg-accent/15 text-accent-foreground",
    danger: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-border">
      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${t}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`font-display font-bold tabular-nums ${big ? "text-3xl" : "text-xl"}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
