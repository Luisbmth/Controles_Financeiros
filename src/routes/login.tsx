import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar · Saldo" }] }),
  component: Login,
});

function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/app", replace: true });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/app` },
        });
        if (error) throw error;
        toast.success("Conta criada! Você já está logado.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao entrar");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/app" });
    if (r.error) {
      toast.error(r.error.message ?? "Falha no Google");
      setBusy(false);
    }
  };

  return (
    <div className="app-shell flex min-h-dvh flex-col px-6 py-10">
      <div className="brand-gradient mx-auto flex h-16 w-16 items-center justify-center rounded-3xl shadow-lg shadow-primary/20">
        <Wallet className="h-8 w-8 text-primary-foreground" />
      </div>
      <h1 className="mt-6 text-center font-display text-3xl font-bold">Saldo</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        {mode === "signin" ? "Entre para continuar" : "Crie sua conta em segundos"}
      </p>

      <form onSubmit={submit} className="mt-10 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email" type="email" required autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com" className="h-12"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password" type="password" required minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" className="h-12"
          />
        </div>
        <Button type="submit" disabled={busy} className="h-12 w-full text-base font-semibold">
          {busy ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" className="h-12 w-full" onClick={google} disabled={busy}>
        <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.6 14.7 2.7 12 2.7c-5.1 0-9.3 4.2-9.3 9.3s4.2 9.3 9.3 9.3c5.4 0 8.9-3.8 8.9-9.1 0-.6-.1-1.1-.2-1.6H12z"/></svg>
        Continuar com Google
      </Button>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-8 text-center text-sm text-muted-foreground hover:text-foreground"
      >
        {mode === "signin" ? (
          <>Não tem conta? <span className="font-semibold text-primary">Cadastre-se</span></>
        ) : (
          <>Já tem conta? <span className="font-semibold text-primary">Entrar</span></>
        )}
      </button>

      <Link to="/" className="mt-auto pt-6 text-center text-xs text-muted-foreground">
        Voltar
      </Link>
    </div>
  );
}
