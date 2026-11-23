import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      nav("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <div className="animate-rise">
        <Logo size={40} />
        <h1 className="mt-6 text-3xl font-extrabold">Welcome back</h1>
        <p className="muted mt-1">Sign in to pick up where you left off.</p>
        <form onSubmit={submit} className="mt-6 grid gap-4">
          <label className="grid gap-1.5 text-sm font-semibold">Email
            <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">Password
            <div className="relative">
              <input className="field pr-16" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              <button type="button" onClick={() => setShow(!show)} className="muted absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold">{show ? "Hide" : "Show"}</button>
            </div>
          </label>
          {error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}
          <button className="btn btn-primary btn-lg" disabled={busy || !email || !password}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="muted mt-5 text-center text-sm">New here? <Link to="/welcome" className="font-semibold text-primary hover:underline">Create a free account</Link></p>
      </div>
    </main>
  );
}
