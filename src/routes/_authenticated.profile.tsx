import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskCPF, maskPhone, unmaskCPF, isValidCPF } from "@/lib/cpf";
import { parseMoneyInput, formatBRL } from "@/lib/money";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Shield, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Perfil · Saldo" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [birth, setBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [alertStr, setAlertStr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name);
    setCpf(profile.cpf ? maskCPF(profile.cpf) : "");
    setBirth(profile.birth_date ?? "");
    setPhone(profile.phone ? maskPhone(profile.phone) : "");
    setAlertStr(String(profile.alert_threshold).replace(".", ","));
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (cpf && !isValidCPF(cpf)) return toast.error("CPF inválido");
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      full_name: fullName.trim(),
      cpf: cpf ? unmaskCPF(cpf) : null,
      birth_date: birth || null,
      phone: phone || null,
      alert_threshold: parseMoneyInput(alertStr),
    }).eq("user_id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Perfil atualizado ✓");
  };

  return (
    <div className="min-h-dvh">
      <header className="flex items-center gap-3 px-5 pb-4 pt-10">
        <button onClick={() => navigate({ to: "/app" })} className="rounded-full p-2 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-2xl font-bold">Perfil</h1>
      </header>

      <form onSubmit={save} className="space-y-4 px-5">
        <div className="space-y-1.5">
          <Label>E-mail</Label>
          <Input value={user?.email ?? ""} disabled className="h-12" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fn">Nome completo</Label>
          <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-12" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cpf">CPF</Label>
            <Input id="cpf" inputMode="numeric" value={cpf}
              onChange={(e) => setCpf(maskCPF(e.target.value))} className="h-12" />
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
            onChange={(e) => setPhone(maskPhone(e.target.value))} className="h-12" />
        </div>

        <div className="space-y-1.5 rounded-2xl bg-surface-muted p-4 ring-1 ring-border">
          <Label htmlFor="alert">Alerta de saldo baixo</Label>
          <Input id="alert" inputMode="decimal" value={alertStr}
            onChange={(e) => setAlertStr(e.target.value)} className="h-12" />
          <p className="text-xs text-muted-foreground">
            Saldo abaixo de <strong>{formatBRL(parseMoneyInput(alertStr))}</strong> aparece em vermelho.
          </p>
        </div>

        <Button type="submit" disabled={busy} className="h-12 w-full">
          {busy ? "Salvando…" : "Salvar alterações"}
        </Button>
      </form>

      <section className="space-y-2 px-5 pt-6">
        <Link to="/profile/import"
          className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-border">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Download className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="font-semibold">Importar histórico (CSV)</p>
            <p className="text-xs text-muted-foreground">Traga seus dados do Excel</p>
          </div>
        </Link>


        <button
          onClick={() => supabase.auth.signOut()}
          className="flex w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left shadow-sm ring-1 ring-border"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <LogOut className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="font-semibold">Sair</p>
            <p className="text-xs text-muted-foreground">Encerrar sessão</p>
          </div>
        </button>
      </section>
    </div>
  );
}
