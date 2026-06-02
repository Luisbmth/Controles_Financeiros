import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { loginAttempts } from "@/lib/security";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar · Saldo" }] }),
  component: Login,
});

function fmt(ms: number) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${(s % 60).toString().padStart(2, "0")}s`;
}

function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockedFor, setLockedFor] = useState(0);

  useEffect(() => {
    if (user) navigate({ to: "/app", replace: true });
  }, [user, navigate]);

  useEffect(() => {
    const tick = () => {
      if (!email) { setLockedFor(0); return; }
      const s = loginAttempts.get(email);
      const left = s.lockedUntil - Date.now();
      setLockedFor(left > 0 ? left : 0);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [email]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockedFor > 0) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const s = loginAttempts.fail(email);
        if (s.lockedUntil > 0) {
          toast.error(`Muitas tentativas. Tente em ${fmt(s.lockedUntil - Date.now())}.`);
        } else {
          toast.error(error.message);
        }
      } else {
        loginAttempts.reset(email);
      }
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || lockedFor > 0;

  return (
    <div className="app-shell flex min-h-dvh flex-col px-6 py-10">
      <div className="brand-gradient mx-auto flex h-16 w-16 items-center justify-center rounded-3xl shadow-lg shadow-primary/20">
        <Wallet className="h-8 w-8 text-primary-foreground" />
      </div>
      <h1 className="mt-6 text-center font-display text-3xl font-bold">Saldo</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">Entre para continuar</p>

      <form onSubmit={submit} className="mt-10 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" required autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com" className="h-12" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" required minLength={6} maxLength={128}
            autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" className="h-12" />
        </div>
        {lockedFor > 0 && (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
            Aguarde {fmt(lockedFor)} para tentar novamente
          </div>
        )}
        <Button type="submit" disabled={disabled} className="h-12 w-full text-base font-semibold">
          {busy ? "Aguarde…" : lockedFor > 0 ? `Bloqueado (${fmt(lockedFor)})` : "Entrar"}
        </Button>
      </form>

      <Link
        to="/signup"
        className="mt-4 flex h-12 w-full items-center justify-center rounded-md border border-border text-base font-semibold hover:bg-surface"
      >
        Criar conta
      </Link>

      <Link to="/" className="mt-auto pt-6 text-center text-xs text-muted-foreground">
        Voltar
      </Link>
    </div>
  );
}
