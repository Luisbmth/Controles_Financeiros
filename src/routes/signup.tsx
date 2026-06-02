import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidCPF, maskCPF, unmaskCPF } from "@/lib/cpf";
import { UserPlus } from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Criar conta · Saldo" }] }),
  component: Signup,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Signup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/app", replace: true });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("Informe seu nome completo");
    if (!isValidCPF(cpf)) return toast.error("CPF inválido");
    if (!EMAIL_RE.test(email)) return toast.error("E-mail inválido");
    if (password.length < 6) return toast.error("A senha precisa ter ao menos 6 caracteres");
    if (password !== confirm) return toast.error("As senhas não coincidem");

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/app` },
      });
      if (error) throw error;
      const uid = data.user?.id;
      if (uid) {
        const { error: pErr } = await supabase.from("profiles").insert({
          user_id: uid,
          full_name: fullName.trim(),
          cpf: unmaskCPF(cpf),
          alert_threshold: 0,
        });
        if (pErr) console.error("profile insert", pErr);
      }
      toast.success("Conta criada! Bem-vindo.");
      // session is created automatically (auto-confirm enabled) → AuthProvider redirects
      if (!data.session) navigate({ to: "/login", replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao criar conta");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell flex min-h-dvh flex-col px-6 py-10">
      <div className="brand-gradient mx-auto flex h-16 w-16 items-center justify-center rounded-3xl shadow-lg shadow-primary/20">
        <UserPlus className="h-8 w-8 text-primary-foreground" />
      </div>
      <h1 className="mt-6 text-center font-display text-3xl font-bold">Criar conta</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">Preencha seus dados para começar</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fn">Nome completo</Label>
          <Input id="fn" required maxLength={120} value={fullName}
            onChange={(e) => setFullName(e.target.value)} className="h-12" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cpf">CPF</Label>
          <Input id="cpf" required inputMode="numeric" value={cpf}
            onChange={(e) => setCpf(maskCPF(e.target.value))}
            placeholder="000.000.000-00" className="h-12" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" required autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com" className="h-12" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw">Senha</Label>
          <Input id="pw" type="password" required minLength={6} maxLength={128}
            autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres" className="h-12" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw2">Confirmar senha</Label>
          <Input id="pw2" type="password" required minLength={6} maxLength={128}
            autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repita a senha" className="h-12" />
        </div>

        <Button type="submit" disabled={busy} className="h-12 w-full text-base font-semibold">
          {busy ? "Criando…" : "Criar conta"}
        </Button>
      </form>

      <Link to="/login" className="mt-6 text-center text-sm text-muted-foreground hover:text-foreground">
        Já tem conta? <span className="font-semibold text-primary">Entrar</span>
      </Link>
    </div>
  );
}
