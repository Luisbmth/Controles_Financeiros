import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatBRL } from "@/lib/money";
import { CATEGORY_COLOR } from "@/lib/categories";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Repeat, Trash2 } from "lucide-react";
import type { FixedBill } from "@/lib/bills";

export const Route = createFileRoute("/_authenticated/fixed")({
  head: () => ({ meta: [{ title: "Contas fixas · Saldo" }] }),
  component: FixedPage,
});

function FixedPage() {
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

  const toggle = async (f: FixedBill) => {
    const { error } = await supabase.from("fixed_bills").update({ active: !f.active }).eq("id", f.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["fixed-bills"] });
  };
  const remove = async (id: string) => {
    if (!confirm("Excluir esta conta fixa? Os meses já gerados ficam.")) return;
    const { error } = await supabase.from("fixed_bills").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { qc.invalidateQueries({ queryKey: ["fixed-bills"] }); toast.success("Removida"); }
  };

  return (
    <div className="min-h-dvh">
      <header className="brand-gradient rounded-b-3xl px-6 pb-8 pt-12 text-primary-foreground">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <Repeat className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold">Contas fixas</h1>
            <p className="text-sm text-primary-foreground/80">Geradas todo mês automaticamente</p>
          </div>
        </div>
      </header>

      <section className="px-5 pt-6">
        {fixed.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <p className="font-semibold">Nenhuma conta fixa ainda</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ao criar uma nova conta, ative <strong>Conta fixa</strong> para repetir todo mês.
            </p>
          </div>
        ) : (
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
                <Button size="icon" variant="ghost" onClick={() => remove(f.id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
