import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatBRL } from "@/lib/money";
import { CATEGORY_COLOR } from "@/lib/categories";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Repeat, Trash2, Layers } from "lucide-react";
import type { FixedBill, Bill } from "@/lib/bills";

export const Route = createFileRoute("/_authenticated/fixed")({
  head: () => ({ meta: [{ title: "Custos · Saldo" }] }),
  component: CostsPage,
});

type InstallmentGroup = {
  group: string;
  name: string;
  category: string;
  amount: number;
  total: number;
  remaining: number;
};

function CostsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: fixed = [] } = useQuery({
    queryKey: ["fixed-bills", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fixed_bills").select("*").order("day_of_month");
      if (error) throw error;
      return (data ?? []) as FixedBill[];
    },
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["installment-groups", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<InstallmentGroup[]> => {
      const { data, error } = await supabase
        .from("bills").select("*")
        .not("installment_group", "is", null)
        .order("due_date", { ascending: true });
      if (error) throw error;
      const map = new Map<string, InstallmentGroup>();
      const today = new Date().toISOString().slice(0, 10);
      (data ?? []).forEach((b: Bill) => {
        const k = b.installment_group!;
        const g = map.get(k);
        if (!g) {
          map.set(k, {
            group: k, name: b.name, category: b.category, amount: Number(b.amount),
            total: b.installment_total ?? 0,
            remaining: b.status === "pending" && b.due_date >= today ? 1 : 0,
          });
        } else if (b.status === "pending" && b.due_date >= today) {
          g.remaining++;
        }
      });
      return Array.from(map.values()).filter((g) => g.remaining > 0);
    },
  });

  const toggle = async (f: FixedBill) => {
    const { error } = await supabase.from("fixed_bills").update({ active: !f.active }).eq("id", f.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["fixed-bills"] });
  };
  const removeFixed = async (id: string) => {
    if (!confirm("Excluir esta conta fixa? Os meses já gerados ficam.")) return;
    const { error } = await supabase.from("fixed_bills").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { qc.invalidateQueries({ queryKey: ["fixed-bills"] }); toast.success("Removida"); }
  };
  const removeGroup = async (group: string) => {
    if (!confirm("Excluir todas as parcelas restantes deste parcelamento?")) return;
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("bills").delete()
      .eq("installment_group", group).eq("status", "pending").gte("due_date", today);
    if (error) toast.error(error.message);
    else { qc.invalidateQueries(); toast.success("Parcelas removidas"); }
  };

  const empty = fixed.length === 0 && groups.length === 0;

  return (
    <div className="min-h-dvh">
      <header className="brand-gradient rounded-b-3xl px-6 pb-8 pt-12 text-primary-foreground">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <Repeat className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold">Custos</h1>
            <p className="text-sm text-primary-foreground/80">Fixos e parcelamentos ativos</p>
          </div>
        </div>
      </header>

      {empty ? (
        <section className="px-5 pt-6">
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <p className="font-semibold">Nenhum custo recorrente</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Em <strong>Nova conta</strong>, ative <strong>Conta fixa</strong> ou <strong>Parcelada</strong>.
            </p>
          </div>
        </section>
      ) : (
        <>
          {fixed.length > 0 && (
            <section className="px-5 pt-6">
              <h2 className="mb-3 font-display text-lg font-bold">Contas fixas</h2>
              <ul className="space-y-2.5">
                {fixed.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-border">
                    <span className="h-12 w-1 rounded-full" style={{ background: CATEGORY_COLOR[f.category] }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{f.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.category} · todo dia {f.day_of_month} · <strong>{formatBRL(f.amount)}</strong>
                      </p>
                    </div>
                    <Switch checked={f.active} onCheckedChange={() => toggle(f)} />
                    <Button size="icon" variant="ghost" onClick={() => removeFixed(f.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {groups.length > 0 && (
            <section className="px-5 pt-6">
              <h2 className="mb-3 font-display text-lg font-bold">Parcelamentos</h2>
              <ul className="space-y-2.5">
                {groups.map((g) => (
                  <li key={g.group} className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-border">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Layers className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{g.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {g.category} · faltam <strong>{g.remaining}</strong> de {g.total} · {formatBRL(g.amount)}/mês
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeGroup(g.group)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
