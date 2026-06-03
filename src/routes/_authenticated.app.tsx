import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMonthBills, togglePaid, type Bill } from "@/lib/bills";
import { formatBRL, parseMoneyInput } from "@/lib/money";
import { CATEGORY_COLOR } from "@/lib/categories";
import { useProfile } from "@/lib/profile";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Wallet, AlertTriangle, Undo2, User, TrendingUp, Zap, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { BillEditSheet } from "@/components/BillEditSheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Início · Saldo" }] }),
  component: Dashboard,
});

function Dashboard() {
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() + 1 });
  const { data: bills = [], isLoading } = useMonthBills(cursor.y, cursor.m);
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [editing, setEditing] = useState<Bill | null>(null);
  const [income, setIncome] = useState(0);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [salaryStr, setSalaryStr] = useState("");
  const [salaryBusy, setSalaryBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Pega o salário mais recente definido até (inclusive) o mês corrente.
    // Assim o valor persiste em meses futuros até uma nova alteração.
    supabase.from("monthly_income").select("amount, year, month")
      .or(`year.lt.${cursor.y},and(year.eq.${cursor.y},month.lte.${cursor.m})`)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setIncome(data?.amount ? Number(data.amount) : 0));
  }, [user, cursor.y, cursor.m]);

  const totals = useMemo(() => {
    const total = bills.reduce((s, b) => s + Number(b.amount), 0);
    const paid = bills.filter((b) => b.status === "paid").reduce((s, b) => s + Number(b.amount), 0);
    const pending = total - paid;
    const overdue = bills.filter(
      (b) => b.status === "pending" && differenceInCalendarDays(parseISO(b.due_date), today) < 0
    );
    return { total, paid, pending,
      pendingCount: bills.filter((b) => b.status === "pending").length,
      paidCount: bills.filter((b) => b.status === "paid").length,
      overdueCount: overdue.length };
  }, [bills]);

  // Salário do mês = salário cadastrado − o que já foi PAGO
  const remaining = income - totals.paid;
  const alertAt = profile?.alert_threshold ?? 0;
  const isLow = income > 0 && remaining <= alertAt;

  const openSalary = () => {
    setSalaryStr(income ? income.toFixed(2).replace(".", ",") : "");
    setSalaryOpen(true);
  };
  const saveSalary = async () => {
    if (!user) return;
    const v = parseMoneyInput(salaryStr);
    setSalaryBusy(true);
    const { error } = await supabase.from("monthly_income").upsert(
      { user_id: user.id, year: cursor.y, month: cursor.m, amount: v },
      { onConflict: "user_id,year,month" }
    );
    setSalaryBusy(false);
    if (error) return toast.error(error.message);
    setIncome(v);
    setSalaryOpen(false);
    toast.success("Salário atualizado ✓");
  };

  const upcoming = useMemo(
    () => bills.filter((b) => b.status === "pending" && !b.is_one_off)
      .sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 8),
    [bills]
  );
  const recent = useMemo(
    () => bills.filter((b) => b.status === "paid")
      .sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? "")),
    [bills]
  );

  const onPay = async (b: Bill) => {
    const r = await togglePaid(b);
    if (r.error) { toast.error(r.error.message); return; }
    qc.invalidateQueries({ queryKey: ["bills"] });
    toast.success(b.status === "paid" ? "Pagamento desfeito" : "Conta paga ✓");
  };

  const monthLabel = format(new Date(cursor.y, cursor.m - 1), "MMMM 'de' yyyy", { locale: ptBR });
  const greeting = profile?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0];

  return (
    <div className="min-h-dvh">
      <header className="brand-gradient rounded-b-3xl px-6 pb-8 pt-12 text-primary-foreground">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-primary-foreground/70">Olá</p>
            <h1 className="font-display text-2xl font-bold">{greeting}</h1>
          </div>
          <Link to="/profile" className="rounded-full p-2 hover:bg-white/10" aria-label="Perfil">
            <User className="h-5 w-5" />
          </Link>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm">
          <button onClick={() => setCursor(prevMonth(cursor))} className="rounded-full p-1.5 hover:bg-white/10">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="font-medium capitalize">{monthLabel}</span>
          <button onClick={() => setCursor(nextMonth(cursor))} className="rounded-full p-1.5 hover:bg-white/10">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 rounded-2xl bg-white/10 p-4 backdrop-blur">
          <p className="text-xs text-primary-foreground/70">Gasto do mês</p>
          <p className="mt-1 font-display text-3xl font-bold tabular-nums">{formatBRL(totals.total)}</p>
          <div className="mt-3 flex gap-4 text-xs">
            <span>{formatBRL(totals.paid)} pago</span>
            <span className="opacity-70">·</span>
            <span>{formatBRL(totals.pending)} a pagar</span>
          </div>
        </div>
      </header>

      <section className="px-5 pt-5">
        <button onClick={openSalary} className="w-full text-left">
          <div className={cn(
            "flex items-center gap-4 rounded-2xl p-4 shadow-sm ring-1 transition active:scale-[0.99]",
            income === 0 ? "bg-surface ring-border border border-dashed border-border" :
            isLow ? "bg-destructive/5 ring-destructive/40" : "bg-surface ring-border"
          )}>
            <span className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl",
              income === 0 ? "bg-muted text-muted-foreground" :
              isLow ? "bg-destructive/15 text-destructive" : "bg-success/10 text-success"
            )}>
              {income === 0 ? <Pencil className="h-5 w-5" /> :
                isLow ? <AlertTriangle className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {income === 0 ? "Cadastrar salário" : "Salário do mês"}
              </p>
              {income === 0 ? (
                <p className="font-display text-lg font-semibold text-muted-foreground">Toque para informar</p>
              ) : (
                <>
                  <p className={cn("font-display text-2xl font-bold tabular-nums", isLow && "text-destructive")}>
                    {formatBRL(remaining)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBRL(income)} − {formatBRL(totals.paid)} pago
                  </p>
                </>
              )}
            </div>
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      </section>

      <section className="px-5 pt-4">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Pago" value={formatBRL(totals.paid)} sub={`${totals.paidCount}`} tone="success" />
          <StatCard label="A pagar" value={formatBRL(totals.pending)} sub={`${totals.pendingCount}`} tone="warning" />
          <StatCard label="Atrasadas" value={String(totals.overdueCount)} sub="contas" tone={totals.overdueCount ? "danger" : "muted"} />
        </div>
      </section>

      <section className="px-5 pt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Próximos vencimentos</h2>
          <Link to="/calendar" className="text-xs font-semibold text-primary">Ver calendário</Link>
        </div>
        {isLoading ? <SkeletonList /> :
          upcoming.length === 0 ? <EmptyState month={monthLabel} /> :
          <ul className="space-y-2.5">
            {upcoming.map((b) => <BillRow key={b.id} bill={b} onPay={onPay} onEdit={setEditing} today={today} />)}
          </ul>}
      </section>

      {recent.length > 0 && (
        <section className="px-5 pt-8">
          <h2 className="mb-3 font-display text-lg font-bold">Gastos do mês</h2>
          <ul className="space-y-2.5">
            {recent.slice(0, 8).map((b) => <BillRow key={b.id} bill={b} onPay={onPay} onEdit={setEditing} today={today} />)}
          </ul>
        </section>
      )}

      <section className="space-y-2 px-5 pt-8">
        <Link to="/new" className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-border">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent-foreground">
            <Zap className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="font-display font-bold">Lançar gasto rápido</p>
            <p className="text-xs text-muted-foreground">Almoço, marmita, etc. (só este mês)</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>

        <Link to="/month" className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-border">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
            <TrendingUp className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="font-display font-bold">Visão do mês</p>
            <p className="text-xs text-muted-foreground">Salário, gastos e sobra prevista</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
      </section>

      <BillEditSheet bill={editing} open={!!editing} onOpenChange={(v) => !v && setEditing(null)} />

      <Dialog open={salaryOpen} onOpenChange={setSalaryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salário do mês</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="salary">Valor (R$)</Label>
            <Input id="salary" autoFocus inputMode="decimal" placeholder="0,00"
              value={salaryStr} onChange={(e) => setSalaryStr(e.target.value)} className="h-12" />
            <p className="text-xs text-muted-foreground">
              O saldo do mês é o salário menos o que já foi pago.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSalaryOpen(false)}>Cancelar</Button>
            <Button onClick={saveSalary} disabled={salaryBusy}>
              {salaryBusy ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function prevMonth({ y, m }: { y: number; m: number }) {
  return m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
}
function nextMonth({ y, m }: { y: number; m: number }) {
  return m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "success" | "warning" | "danger" | "muted" }) {
  const toneClass = {
    success: "bg-success/10 text-success",
    warning: "bg-accent/15 text-accent-foreground",
    danger: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-border">
      <span className={cn("inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", toneClass)}>{label}</span>
      <p className="mt-2 font-display text-base font-bold tabular-nums leading-tight break-all">{value}</p>
      <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
    </div>
  );
}

function BillRow({ bill, onPay, onEdit, today }: { bill: Bill; onPay: (b: Bill) => void; onEdit: (b: Bill) => void; today: Date }) {
  const due = parseISO(bill.due_date);
  const diff = differenceInCalendarDays(due, today);
  const overdue = bill.status === "pending" && diff < 0;
  const dueLabel =
    bill.is_one_off ? "Gasto avulso" :
    bill.status === "paid" ? "Pago" :
    diff === 0 ? "Vence hoje" :
    diff === 1 ? "Vence amanhã" :
    diff > 0 ? `Vence em ${diff} dias` :
    `Atrasada há ${Math.abs(diff)} ${Math.abs(diff) === 1 ? "dia" : "dias"}`;

  return (
    <li className={cn(
      "flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-border",
      overdue && "ring-destructive/30 bg-destructive/5"
    )}>
      <span className="h-10 w-1 rounded-full"
        style={{ background: CATEGORY_COLOR[bill.category] ?? "var(--color-muted)" }} />
      <button type="button" onClick={() => onEdit(bill)}
        className="min-w-0 flex-1 text-left active:opacity-70" aria-label={`Editar ${bill.name}`}>
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{bill.name}</p>
          {bill.installment_total && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {bill.installment_number}/{bill.installment_total}
            </span>
          )}
        </div>
        <p className={cn("mt-0.5 flex items-center gap-1 text-xs",
          overdue ? "text-destructive" : "text-muted-foreground")}>
          {overdue && <AlertTriangle className="h-3 w-3" />}
          {dueLabel} · {bill.category}
        </p>
      </button>
      <button type="button" onClick={() => onEdit(bill)} className="text-right active:opacity-70">
        <p className="font-display font-bold tabular-nums">{formatBRL(bill.amount)}</p>
      </button>
      {!bill.is_one_off && (
        <button onClick={() => onPay(bill)} className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all active:scale-95",
            bill.status === "paid"
              ? "bg-muted text-muted-foreground hover:bg-muted/70"
              : "bg-success text-success-foreground hover:opacity-90"
          )}
          aria-label={bill.status === "paid" ? "Desfazer pagamento" : "Marcar como paga"}>
          {bill.status === "paid" ? <Undo2 className="h-5 w-5" /> : <Check className="h-5 w-5" strokeWidth={3} />}
        </button>
      )}
    </li>
  );
}

function EmptyState({ month }: { month: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center">
      <Wallet className="mx-auto h-10 w-10 text-muted-foreground/60" />
      <p className="mt-3 font-semibold">Nada por aqui em {month}</p>
      <p className="mt-1 text-sm text-muted-foreground">Toque no + para adicionar sua primeira conta.</p>
    </div>
  );
}

function SkeletonList() {
  return (
    <ul className="space-y-2.5">
      {[0, 1, 2].map((i) => <li key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}
    </ul>
  );
}
