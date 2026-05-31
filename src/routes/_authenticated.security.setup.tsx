import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Delete, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  setupPin, getSecurity,
  platformAuthenticatorAvailable, registerBiometric,
  unlockSession,
} from "@/lib/security";

export const Route = createFileRoute("/_authenticated/security/setup")({
  head: () => ({ meta: [{ title: "Configurar PIN · Saldo" }] }),
  component: SetupPage,
});

function SetupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"new" | "confirm" | "bio">("new");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [first, setFirst] = useState("");
  const [bioSupported, setBioSupported] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { platformAuthenticatorAvailable().then(setBioSupported); }, []);

  if (!user) return null;

  const current = step === "new" ? pin : confirm;
  const setCurrent = step === "new" ? setPin : setConfirm;

  const press = (d: string) => {
    if (current.length >= 6) return;
    setCurrent(current + d);
  };
  const back = () => setCurrent(current.slice(0, -1));

  const next = async () => {
    if (step === "new") {
      if (pin.length < 4) return toast.error("Use pelo menos 4 dígitos");
      setFirst(pin);
      setPin("");
      setStep("confirm");
      return;
    }
    if (step === "confirm") {
      if (confirm !== first) {
        toast.error("Os PINs não coincidem");
        setConfirm("");
        return;
      }
      setBusy(true);
      try {
        await setupPin(user.id, first);
        unlockSession.set();
        toast.success("PIN salvo");
        if (bioSupported) setStep("bio");
        else navigate({ to: "/app" });
      } catch (e: any) {
        toast.error(e?.message ?? "Erro ao salvar PIN");
      } finally { setBusy(false); }
      return;
    }
  };

  const enableBio = async () => {
    setBusy(true);
    try {
      await registerBiometric(user.id, user.email ?? "user");
      const s = await getSecurity(user.id);
      if (!s) throw new Error("Falha ao salvar");
      toast.success("Biometria ativada");
      navigate({ to: "/app" });
    } catch (e: any) {
      if (e?.name === "NotAllowedError") {
        toast.message("Biometria cancelada");
      } else {
        toast.error(e?.message ?? "Falha ao registrar biometria");
      }
    } finally { setBusy(false); }
  };

  if (step === "bio") {
    return (
      <div className="px-5 pt-8 text-center">
        <div className="brand-gradient mx-auto flex h-16 w-16 items-center justify-center rounded-3xl">
          <KeyRound className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-bold">Ativar biometria?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use Face ID, Touch ID ou impressão digital para desbloquear sem digitar o PIN.
        </p>
        <div className="mt-8 space-y-2">
          <Button onClick={enableBio} disabled={busy} className="h-12 w-full">
            Ativar agora
          </Button>
          <Button variant="ghost" onClick={() => navigate({ to: "/app" })} className="h-12 w-full">
            Agora não
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell flex min-h-dvh flex-col items-center justify-between px-6 py-8">
      <div className="w-full">
        <button onClick={() => step === "confirm" ? (setStep("new"), setConfirm(""), setPin(first)) : navigate({ to: "/app" })}
          className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface">
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      <div className="text-center">
        <h1 className="font-display text-2xl font-bold">
          {step === "new" ? "Crie seu PIN" : "Confirme o PIN"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {step === "new" ? "4 a 6 dígitos" : "Digite o mesmo PIN novamente"}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i}
            className={`h-3 w-3 rounded-full transition-all ${
              i < current.length ? "bg-primary scale-110" : "bg-muted"
            }`}
          />
        ))}
      </div>

      <div className="grid w-full max-w-[300px] grid-cols-3 gap-3">
        {["1","2","3","4","5","6","7","8","9"].map((d) => (
          <button key={d} onClick={() => press(d)}
            className="h-16 rounded-2xl bg-surface text-2xl font-semibold transition active:scale-95"
          >{d}</button>
        ))}
        <div />
        <button onClick={() => press("0")}
          className="h-16 rounded-2xl bg-surface text-2xl font-semibold transition active:scale-95"
        >0</button>
        <button onClick={back} disabled={!current}
          className="flex h-16 items-center justify-center rounded-2xl bg-surface transition active:scale-95 disabled:opacity-40"
        ><Delete className="h-6 w-6" /></button>
      </div>

      <Button onClick={next} disabled={current.length < 4 || busy} className="h-12 w-full max-w-[300px]">
        {step === "new" ? "Continuar" : "Salvar"}
      </Button>
    </div>
  );
}
