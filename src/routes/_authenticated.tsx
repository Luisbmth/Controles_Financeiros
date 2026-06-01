import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { Home, Plus, Calendar, BarChart3, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSecurity, unlockSession, type SecurityRow } from "@/lib/security";
import { LockScreen } from "@/components/LockScreen";

export const Route = createFileRoute("/_authenticated")({
  component: AuthedLayout,
});

const tabs: Array<{ to: "/app" | "/calendar" | "/new" | "/fixed" | "/reports"; label: string; Icon: typeof Home; primary?: boolean }> = [
  { to: "/app", label: "Início", Icon: Home },
  { to: "/calendar", label: "Calendário", Icon: Calendar },
  { to: "/new", label: "Nova", Icon: Plus, primary: true },
  { to: "/fixed", label: "Custos", Icon: Repeat },
  { to: "/reports", label: "Relatórios", Icon: BarChart3 },
];

function AuthedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [sec, setSec] = useState<SecurityRow | null | undefined>(undefined);
  const [unlocked, setUnlocked] = useState(unlockSession.is());
  const { data: profile, isLoading: profileLoading } = useProfile();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  // Load security config
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getSecurity(user.id).then((s) => { if (!cancelled) setSec(s); });
    return () => { cancelled = true; };
  }, [user]);

  // No PIN configured yet → redirect to setup (except when already there)
  useEffect(() => {
    if (sec === null && !pathname.startsWith("/pin-setup")) {
      navigate({ to: "/pin-setup", replace: true });
    }
  }, [sec, pathname, navigate]);

  // PIN ok but no profile → onboarding
  useEffect(() => {
    if (sec && !profileLoading && profile === null && !pathname.startsWith("/onboarding")) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [sec, profile, profileLoading, pathname, navigate]);

  if (loading || !user || sec === undefined) {
    return (
      <div className="app-shell flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-pulse rounded-full brand-gradient" />
      </div>
    );
  }

  // Show lock screen if PIN exists and session not unlocked
  const onSetup = pathname.startsWith("/pin-setup");
  const onOnboarding = pathname.startsWith("/onboarding");
  const hideChrome = onSetup || onOnboarding;
  if (sec && !unlocked && !onSetup) {
    return <LockScreen sec={sec} onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className={cn("app-shell", !hideChrome && "pb-24")}>
      <Outlet />

      {!hideChrome && (
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="grid grid-cols-5">
          {tabs.map(({ to, label, Icon, primary }) => {
            const active = pathname === to;
            if (primary) {
              return (
                <Link
                  key={to} to={to}
                  className="flex items-center justify-center -mt-6"
                >
                  <span className="brand-gradient flex h-14 w-14 items-center justify-center rounded-2xl text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background">
                    <Icon className="h-7 w-7" strokeWidth={2.5} />
                  </span>
                </Link>
              );
            }
            return (
              <Link
                key={to} to={to}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
      )}


    </div>
  );
}
