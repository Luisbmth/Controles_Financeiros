import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMonthBills, togglePaid, type Bill } from "@/lib/bills";
import { formatBRL } from "@/lib/money";
import { CATEGORY_COLOR } from "@/lib/categories";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Wallet, AlertTriangle, Undo2, LogOut, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { BillEditSheet } from "@/components/BillEditSheet";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Início · Saldo" }] }),
  component: Dashboard,
});

function Dashboard() {
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() + 1 });
  const { data: bills = [], isLoading } = useMonthBills(cursor.y, cursor.m);
  const qc = useQueryClient();
  const { user } = useAuth();
  const [editing, setEditing] = useState<Bill | null>(null);

  const totals = useMemo(() => {
    const total = bills.reduce((s, b) => s + Number(b.amount), 0);
    const paid = bills.filter((b) => b.status === "paid").reduce((s, b) => s + Number(b.amount), 0);
    const pending = total - paid;
    const overdue = bills.filter(
      (b) => b.status === "pending" && differenceInCalendarDays(parseISO(b.due_date), today) < 0
    );
    return {
      total, paid, pending,
      pendingCount: bills.filter((b) => b.status === "pending").length,
      paidCount: bills.filter((b) => b.status === "paid").length,
      overdueCount: overdue.length,
    };
  }, [bills]);

  const upcoming = useMemo(
    () => bills.filter((b) => b.status === "pending")
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 8),
    [bills]
  );

  const paid = useMemo(
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

  return (
    <div className="min-h-dvh">
      <header className="brand-gradient px-6 pb-8 pt-12 text-primary-foreground rounded-b-3xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-primary-foreground/70">Olá</p>
            <h1 className="font-display text-2xl font-bold">{user?.email?.split("@")[0]}</h1>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-full p-2 hover:bg-white/10"
            aria-label="Sair"
          >
            <LogOut className="h-5 w-5" />
          </button>
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
          <p className="text-xs text-primary-foreground/70">Pendente este mês</p>
          <p className="mt-1 font-display text-3xl font-bold tabular-nums">{formatBRL(totals.pending)}</p>
          <div className="mt-3 flex gap-4 text-xs">
            <span>de <strong className="font-semibold">{formatBRL(totals.total)}</strong> total</span>
            <span className="opacity-70">·</span>
            <span>{totals.pendingCount} pendentes</span>
          </div>
        </div>
      </header>

      <section className="px-5 pt-5">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Pago" value={formatBRL(totals.paid)} sub={`${totals.paidCount} contas`} tone="success" />
          <StatCard label="Pendente" value={String(totals.pendingCount)} sub="contas" tone="warning" />
          <StatCard label="Atrasadas" value={String(totals.overdueCount)} sub="contas" tone={totals.overdueCount ? "danger" : "muted"} />
        </div>
      </section>

      <section className="px-5 pt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Próximos vencimentos</h2>
          <Link to="/calendar" className="text-xs font-semibold text-primary">Ver calendário</Link>
        </div>
        {isLoading ? (
          <SkeletonList />
        ) : upcoming.length === 0 ? (
          <EmptyState month={monthLabel} />
        ) : (
          <ul className="space-y-2.5">
            {upcoming.map((b) => <BillRow key={b.id} bill={b} onPay={onPay} onEdit={setEditing} today={today} />)}
          </ul>
        )}
      </section>

      {paid.length > 0 && (
        <section className="px-5 pt-8">
          <h2 className="mb-3 font-display text-lg font-bold">Pagas</h2>
          <ul className="space-y-2.5">
            {paid.slice(0, 6).map((b) => <BillRow key={b.id} bill={b} onPay={onPay} onEdit={setEditing} today={today} />)}
          </ul>
        </section>
      )}

      <section className="px-5 pt-8">
        <Link to="/month" className="flex items-center justify-between rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-border">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
              <TrendingUp className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display font-bold">Visão do mês</p>
              <p className="text-xs text-muted-foreground">Salário, gastos e sobra prevista</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
      </section>

      <BillEditSheet bill={editing} open={!!editing} onOpenChange={(v) => !v && setEditing(null)} />
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
    <div className="rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-border">
      <span className={cn("inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", toneClass)}>{label}</span>
      <p className="mt-2 font-display text-lg font-bold tabular-nums leading-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function BillRow({ bill, onPay, onEdit, today }: { bill: Bill; onPay: (b: Bill) => void; onEdit: (b: Bill) => void; today: Date }) {
  const due = parseISO(bill.due_date);
  const diff = differenceInCalendarDays(due, today);
  const overdue = bill.status === "pending" && diff < 0;
  const dueLabel =
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
      <span
        className="h-10 w-1 rounded-full"
        style={{ background: CATEGORY_COLOR[bill.category] ?? "var(--color-muted)" }}
      />
      <button
        type="button"
        onClick={() => onEdit(bill)}
        className="min-w-0 flex-1 text-left active:opacity-70"
        aria-label={`Editar ${bill.name}`}
      >
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{bill.name}</p>
          {bill.installment_total && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {bill.installment_number}/{bill.installment_total}
            </span>
          )}
        </div>
        <p className={cn(
          "mt-0.5 flex items-center gap-1 text-xs",
          overdue ? "text-destructive" : "text-muted-foreground"
        )}>
          {overdue && <AlertTriangle className="h-3 w-3" />}
          {dueLabel} · {bill.category}
        </p>
      </button>
      <button type="button" onClick={() => onEdit(bill)} className="text-right active:opacity-70">
        <p className="font-display font-bold tabular-nums">{formatBRL(bill.amount)}</p>
      </button>
      <button
        onClick={() => onPay(bill)}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all active:scale-95",
          bill.status === "paid"
            ? "bg-muted text-muted-foreground hover:bg-muted/70"
            : "bg-success text-success-foreground hover:opacity-90"
        )}
        aria-label={bill.status === "paid" ? "Desfazer pagamento" : "Marcar como paga"}
      >
        {bill.status === "paid" ? <Undo2 className="h-5 w-5" /> : <Check className="h-5 w-5" strokeWidth={3} />}
      </button>
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
      {[0, 1, 2].map((i) => (
        <li key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
      ))}
    </ul>
  );
}
