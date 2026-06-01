import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidCPF, maskCPF, maskPhone, unmaskCPF } from "@/lib/cpf";
import { parseMoneyInput } from "@/lib/money";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Bem-vindo · Saldo" }] }),
  component: Onboarding,
});

function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [birth, setBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [alertStr, setAlertStr] = useState("300,00");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!fullName.trim()) return toast.error("Informe seu nome completo");
    if (cpf && !isValidCPF(cpf)) return toast.error("CPF inválido");
    setBusy(true);
    const { error } = await supabase.from("profiles").insert({
      user_id: user.id,
      full_name: fullName.trim(),
      cpf: cpf ? unmaskCPF(cpf) : null,
      birth_date: birth || null,
      phone: phone || null,
      alert_threshold: parseMoneyInput(alertStr),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Perfil criado ✓");
    navigate({ to: "/app", replace: true });
  };

  return (
    <div className="min-h-dvh px-5 pt-10">
      <header className="mb-6 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl brand-gradient text-primary-foreground">
          <UserPlus className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold">Bem-vindo!</h1>
          <p className="text-sm text-muted-foreground">Vamos criar seu perfil</p>
        </div>
      </header>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fn">Nome completo *</Label>
          <Input id="fn" required maxLength={120} value={fullName}
            onChange={(e) => setFullName(e.target.value)} className="h-12" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cpf">CPF</Label>
            <Input id="cpf" inputMode="numeric" value={cpf}
              onChange={(e) => setCpf(maskCPF(e.target.value))}
              placeholder="000.000.000-00" className="h-12" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="birth">Nascimento</Label>
            <Input id="birth" type="date" value={birth}
              onChange={(e) => setBirth(e.target.value)} className="h-12" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" inputMode="tel" value={phone}
            onChange={(e) => setPhone(maskPhone(e.target.value))}
            placeholder="(00) 00000-0000" className="h-12" />
        </div>

        <div className="space-y-1.5 rounded-2xl bg-surface-muted p-4 ring-1 ring-border">
          <Label htmlFor="alert">Alerta de saldo baixo (R$)</Label>
          <Input id="alert" inputMode="decimal" value={alertStr}
            onChange={(e) => setAlertStr(e.target.value)} className="h-12" />
          <p className="text-xs text-muted-foreground">
            Quando o saldo disponível ficar abaixo desse valor, ele fica vermelho na home.
          </p>
        </div>

        <Button type="submit" disabled={busy} className="h-14 w-full text-base font-bold">
          {busy ? "Salvando…" : "Continuar"}
        </Button>
      </form>
    </div>
  );
}
