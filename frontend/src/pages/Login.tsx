import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("alex@learntwin.dev");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Login failed. Check your credentials.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to continue where your twin left off.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" type="email" value={email} onChange={setEmail} />
        <Field label="Password" type="password" value={password} onChange={setPassword} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>
      <p className="text-xs text-mist-400 mt-4 font-mono">Demo account prefilled — alex@learntwin.dev / demo1234</p>
      <p className="text-sm text-mist-400 mt-6">
        No account?{" "}
        <Link to="/signup" className="text-signal hover:underline">
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-graphite-950 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-8 h-8 rounded-lg bg-signal/15 border border-signal-dim/40 flex items-center justify-center">
            <span className="font-display font-bold text-signal text-sm">Lt</span>
          </div>
          <span className="font-display font-bold text-mist-50 tracking-tight">LearnTwin</span>
        </Link>
        <div className="bg-graphite-800/60 border border-graphite-600 rounded-xl p-7 shadow-panel">
          <h1 className="font-display text-xl font-bold text-mist-50 mb-1">{title}</h1>
          <p className="text-sm text-mist-400 mb-6">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-mist-300 mb-1.5 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full bg-graphite-900 border border-graphite-600 rounded-lg px-3 py-2.5 text-sm text-mist-50 placeholder:text-mist-500 focus:border-signal-dim outline-none transition-colors"
      />
    </label>
  );
}
