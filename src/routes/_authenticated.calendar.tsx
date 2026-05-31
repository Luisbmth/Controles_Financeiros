import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMonthBills } from "@/lib/bills";
import { CATEGORY_COLOR } from "@/lib/categories";
import { formatBRL } from "@/lib/money";
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, getDay,
  isSameDay, parseISO, differenceInCalendarDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BillEditSheet } from "@/components/BillEditSheet";
import type { Bill } from "@/lib/bills";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendário · Saldo" }] }),
  component: CalendarPage,
});

function CalendarPage() {
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() + 1 });
  const { data: bills = [] } = useMonthBills(cursor.y, cursor.m);
  const [selected, setSelected] = useState<Date>(today);

  const monthStart = startOfMonth(new Date(cursor.y, cursor.m - 1));
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leading = getDay(monthStart);

  const byDay = useMemo(() => {
    const map = new Map<string, typeof bills>();
    for (const b of bills) {
      const k = b.due_date;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(b);
    }
    return map;
  }, [bills]);

  const dayBills = byDay.get(format(selected, "yyyy-MM-dd")) ?? [];

  return (
    <div className="min-h-dvh">
      <header className="brand-gradient rounded-b-3xl px-5 pb-6 pt-12 text-primary-foreground">
        <div className="flex items-center justify-between">
          <button onClick={() => setCursor((c) => c.m === 1 ? { y: c.y - 1, m: 12 } : { y: c.y, m: c.m - 1 })}
            className="rounded-full p-2 hover:bg-white/10">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-bold capitalize">
            {format(monthStart, "MMMM 'de' yyyy", { locale: ptBR })}
          </h1>
          <button onClick={() => setCursor((c) => c.m === 12 ? { y: c.y + 1, m: 1 } : { y: c.y, m: c.m + 1 })}
            className="rounded-full p-2 hover:bg-white/10">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="px-3 pt-5">
        <div className="grid grid-cols-7 gap-1 px-2 pb-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {["D","S","T","Q","Q","S","S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leading }, (_, i) => <div key={`p${i}`} />)}
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const items = byDay.get(key) ?? [];
            const isToday = isSameDay(d, today);
            const isSelected = isSameDay(d, selected);
            const hasOverdue = items.some((b) => b.status === "pending" && differenceInCalendarDays(parseISO(b.due_date), today) < 0);
            const hasPaid = items.length > 0 && items.every((b) => b.status === "paid");
            return (
              <button
                key={key}
                onClick={() => setSelected(d)}
                className={cn(
                  "relative aspect-square rounded-xl text-sm font-medium transition-all",
                  isSelected ? "bg-primary text-primary-foreground shadow-md" :
                  isToday ? "bg-accent/20 text-foreground" :
                  "hover:bg-muted"
                )}
              >
                {format(d, "d")}
                {items.length > 0 && (
                  <span className={cn(
                    "absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full",
                    isSelected ? "bg-primary-foreground" :
                    hasOverdue ? "bg-destructive" :
                    hasPaid ? "bg-success" : "bg-accent"
                  )} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <section className="px-5 pt-6">
        <h2 className="mb-3 font-display text-lg font-bold capitalize">
          {format(selected, "EEEE, d 'de' MMMM", { locale: ptBR })}
        </h2>
        {dayBills.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma conta neste dia.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {dayBills.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-border">
                <span className="h-10 w-1 rounded-full" style={{ background: CATEGORY_COLOR[b.category] }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.category} · {b.status === "paid" ? "Pago" : "Pendente"}
                  </p>
                </div>
                <p className="font-display font-bold tabular-nums">{formatBRL(b.amount)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
