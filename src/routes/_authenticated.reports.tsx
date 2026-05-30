import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMemo } from "react";
import { formatBRL } from "@/lib/money";
import { CATEGORY_COLOR } from "@/lib/categories";
import { format, parseISO, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { Bill } from "@/lib/bills";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Relatórios · Saldo" }] }),
  component: Reports,
});

function Reports() {
  const { user } = useAuth();
  const today = new Date();
  const from = startOfMonth(subMonths(today, 5));
  const to = endOfMonth(today);

  const { data: bills = [] } = useQuery({
    queryKey: ["bills-range", user?.id, format(from, "yyyy-MM"), format(to, "yyyy-MM")],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("bills").select("*")
        .gte("due_date", format(from, "yyyy-MM-dd"))
        .lte("due_date", format(to, "yyyy-MM-dd"));
      if (error) throw error;
      return (data ?? []) as Bill[];
    },
  });

  const byMonth = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(today, i);
      m.set(format(d, "yyyy-MM"), 0);
    }
    for (const b of bills) {
      const k = format(parseISO(b.due_date), "yyyy-MM");
      m.set(k, (m.get(k) ?? 0) + Number(b.amount));
    }
    return Array.from(m.entries()).map(([k, v]) => ({
      month: format(parseISO(k + "-01"), "MMM", { locale: ptBR }),
      total: v,
    }));
  }, [bills]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of bills) m.set(b.category, (m.get(b.category) ?? 0) + Number(b.amount));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [bills]);

  const total = bills.reduce((s, b) => s + Number(b.amount), 0);
  const avg = total / 6;

  return (
    <div className="min-h-dvh">
      <header className="brand-gradient rounded-b-3xl px-6 pb-8 pt-12 text-primary-foreground">
        <h1 className="font-display text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-primary-foreground/80">Últimos 6 meses</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
            <p className="text-xs text-primary-foreground/70">Total no período</p>
            <p className="font-display text-xl font-bold tabular-nums">{formatBRL(total)}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
            <p className="text-xs text-primary-foreground/70">Média mensal</p>
            <p className="font-display text-xl font-bold tabular-nums">{formatBRL(avg)}</p>
          </div>
        </div>
      </header>

      <section className="px-5 pt-6">
        <h2 className="mb-3 font-display text-lg font-bold">Evolução mensal</h2>
        <div className="rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-border">
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={byMonth}>
                <XAxis dataKey="month" fontSize={11} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 12 }}
                  formatter={(v: number) => formatBRL(v)}
                />
                <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                  {byMonth.map((_, i) => (
                    <Cell key={i} fill="var(--color-primary)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="px-5 pt-6">
        <h2 className="mb-3 font-display text-lg font-bold">Gastos por categoria</h2>
        {byCategory.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Sem dados.</p>
        ) : (
          <ul className="space-y-2">
            {byCategory.map(([cat, v]) => {
              const pct = total > 0 ? (v / total) * 100 : 0;
              return (
                <li key={cat} className="rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{cat}</span>
                    <span className="font-display font-bold tabular-nums">{formatBRL(v)}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: CATEGORY_COLOR[cat] }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{pct.toFixed(1)}% do total</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
