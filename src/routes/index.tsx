import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-shell flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-pulse rounded-full brand-gradient" />
      </div>
    );
  }
  return <Navigate to={user ? "/app" : "/login"} replace />;
}
