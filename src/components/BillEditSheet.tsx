import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Bill } from "@/lib/bills";
import { CATEGORIES } from "@/lib/categories";
import { parseMoneyInput } from "@/lib/money";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCustomCategories } from "@/lib/profile";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Save } from "lucide-react";

export function BillEditSheet({
  bill, open, onOpenChange,
}: {
  bill: Bill | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: customCats = [] } = useCustomCategories();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Outros");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!bill) return;
    setName(bill.name);
    setAmount(String(bill.amount).replace(".", ","));
    setCategory(bill.category);
    setDueDate(bill.due_date);
    setNotes(bill.notes ?? "");
  }, [bill]);

  if (!bill) return null;

  const save = async () => {
    const value = parseMoneyInput(amount);
    if (!name.trim() || value <= 0) {
      toast.error("Preencha nome e valor");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("bills").update({
      name: name.trim(),
      amount: value,
      category,
      due_date: dueDate,
      notes: notes.trim() || null,
    }).eq("id", bill.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["bills"] });
    toast.success("Conta atualizada ✓");
    onOpenChange(false);
  };

  const remove = async (scope: "one" | "group") => {
    setBusy(true);
    let q = supabase.from("bills").delete();
    if (scope === "group" && bill.installment_group) {
      q = q.eq("installment_group", bill.installment_group);
    } else {
      q = q.eq("id", bill.id);
    }
    const { error } = await q;
    setBusy(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["bills"] });
    toast.success("Removida");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl">Editar conta</SheetTitle>
          <SheetDescription>Altere os dados ou remova esta conta.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="e-name">Nome</Label>
            <Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="e-amount">Valor</Label>
              <Input id="e-amount" inputMode="decimal" value={amount}
                onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-due">Vencimento</Label>
              <Input id="e-due" type="date" value={dueDate}
                onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
                {customCats.filter((c) => !CATEGORIES.includes(c as any)).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="e-notes">Observações</Label>
            <Textarea id="e-notes" rows={2} value={notes}
              onChange={(e) => setNotes(e.target.value)} />
          </div>

          {bill.installment_total && (
            <p className="rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
              Parcela {bill.installment_number}/{bill.installment_total}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={save} disabled={busy} className="h-12 flex-1">
              <Save className="mr-2 h-4 w-4" /> Salvar
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={busy} className="h-12 px-4">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {bill.installment_group
                      ? "Esta conta faz parte de um parcelamento. Você pode excluir só esta parcela ou todas."
                      : "Esta ação não pode ser desfeita."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  {bill.installment_group && (
                    <AlertDialogAction onClick={() => remove("group")}>
                      Excluir todas as parcelas
                    </AlertDialogAction>
                  )}
                  <AlertDialogAction onClick={() => remove("one")}>
                    {bill.installment_group ? "Excluir só esta" : "Excluir"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
