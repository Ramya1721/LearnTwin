import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { LoadingBlock } from "./ui";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, onboarded } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-graphite-950 flex items-center justify-center">
        <LoadingBlock />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!onboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}
