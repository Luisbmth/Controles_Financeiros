import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Fingerprint, KeyRound, Shield, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  getSecurity, type SecurityRow,
  platformAuthenticatorAvailable,
  registerBiometric, disableBiometric,
  unlockSession,
} from "@/lib/security";

export const Route = createFileRoute("/_authenticated/security")({
  head: () => ({ meta: [{ title: "Segurança · Saldo" }] }),
  component: SecurityPage,
});

function SecurityPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sec, setSec] = useState<SecurityRow | null>(null);
  const [bioSupported, setBioSupported] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    getSecurity(user.id).then(setSec);
    platformAuthenticatorAvailable().then(setBioSupported);
  }, [user]);

  if (!user) return null;
  if (!sec) {
    // No PIN yet — redirect to setup
    return (
      <div className="px-5 pt-8">
        <p className="text-sm text-muted-foreground">Você ainda não configurou um PIN.</p>
        <Button asChild className="mt-4"><Link to="/security/setup">Configurar agora</Link></Button>
      </div>
    );
  }

  const toggleBio = async (checked: boolean) => {
    if (!sec) return;
    setBusy(true);
    try {
      if (checked) {
        await registerBiometric(user.id, user.email ?? "user");
        toast.success("Biometria ativada");
      } else {
        await disableBiometric(user.id);
        toast.success("Biometria desativada");
      }
      const s = await getSecurity(user.id);
      setSec(s);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao alterar biometria");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    unlockSession.clear();
    await supabase.auth.signOut();
  };

  return (
    <div className="px-5 pt-6">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => navigate({ to: "/app" })}
          className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-xl font-bold">Segurança</h1>
      </div>

      <div className="rounded-2xl bg-surface p-4">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Bloqueio do app</p>
            <p className="text-xs text-muted-foreground">PIN é solicitado ao abrir</p>
          </div>
        </div>
      </div>

      <Link to="/security/setup"
        className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-surface p-4 active:scale-[0.99]">
        <KeyRound className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold">Alterar PIN</p>
          <p className="text-xs text-muted-foreground">Trocar o código numérico</p>
        </div>
        <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
      </Link>

      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-surface p-4">
        <Fingerprint className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Biometria</p>
          <p className="text-xs text-muted-foreground">
            {bioSupported ? "Face/Touch ID neste dispositivo" : "Não disponível neste dispositivo"}
          </p>
        </div>
        <Switch
          checked={sec.biometric_enabled}
          disabled={!bioSupported || busy}
          onCheckedChange={toggleBio}
        />
      </div>

      <button onClick={signOut}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 p-3 text-sm font-semibold text-destructive">
        <LogOut className="h-4 w-4" /> Sair da conta
      </button>
    </div>
  );
}
