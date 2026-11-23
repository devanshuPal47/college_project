import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { CountUp, useMotionPreference } from "./components/fx";
import { Logo } from "./components/Logo";
import { useAuth } from "./lib/auth";
import { FullScreenLoader, ProgressProvider, levelOf, useProgress } from "./lib/progress";
import Admin from "./pages/Admin";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Plan from "./pages/Plan";
import Portfolio from "./pages/Portfolio";
import Roadmap from "./pages/Roadmap";
import Workspace from "./pages/Workspace";

export default function App() {
  const { status, user } = useAuth();
  useMotionPreference(); // applies the saved reduce-motion setting on every screen
  if (status === "loading") return <FullScreenLoader label="Loading…" />;

  if (status === "anon") {
    return (
      <Routes>
        <Route path="/welcome" element={<Onboarding mode="anon" />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
    );
  }
  return (
    <ProgressProvider key={user!.id}>
      <AuthedApp />
    </ProgressProvider>
  );
}

function AuthedApp() {
  const { s } = useProgress();
  const { isAdmin } = useAuth();
  const loc = useLocation();

  // signed in but never set up a profile (e.g. the bootstrap admin): run setup once
  if (!s.onboarded) return <Onboarding mode="existing" />;
  const bare = loc.pathname === "/plan";

  return (
    <>
      {!bare && <TopBar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/plan" element={<Plan />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/project/:id" element={<Workspace />} />
        <Route path="/admin" element={isAdmin ? <Admin /> : <Navigate to="/" replace />} />
        <Route path="/welcome" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function TopBar() {
  const { s, sync, dailyMinutes } = useProgress();
  const { user, isAdmin, logout } = useAuth();
  const [reduced, setReduced] = useMotionPreference();
  const goal = s.profile?.dailyMinutes ?? 20;
  const into = s.xp % 100;
  const dailyPct = Math.min(100, Math.round((dailyMinutes / goal) * 100));

  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-2.5 py-1.5 text-sm font-semibold transition sm:px-3 ${isActive ? "bg-primary-soft text-primary" : "muted hover:text-fg"}`;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-[var(--glass)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 sm:gap-4 sm:px-4">
        <NavLink to="/" aria-label="LearnLoop home" className="shrink-0">
          <span className="sm:hidden"><Logo withName={false} /></span>
          <span className="hidden sm:inline"><Logo /></span>
        </NavLink>
        <nav className="flex gap-0.5" aria-label="Main">
          <NavLink to="/" end className={link}>Home</NavLink>
          <NavLink to="/roadmap" className={link}>Roadmap</NavLink>
          <NavLink to="/portfolio" className={link}>Portfolio</NavLink>
          {isAdmin && <NavLink to="/admin" className={link}>Admin</NavLink>}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3 text-sm sm:gap-4">
          <span className="font-semibold" title={`${s.streak}-day streak · ${s.freezes} freeze day${s.freezes === 1 ? "" : "s"} saved`}>
            <span aria-hidden>🔥</span> <CountUp value={s.streak} />
          </span>
          <div className="hidden items-center gap-2 md:flex" title={`Daily goal: ${dailyMinutes}/${goal} min`}>
            <svg width="22" height="22" viewBox="0 0 22 22" aria-label={`Daily goal ${dailyPct}%`}>
              <circle cx="11" cy="11" r="9" fill="none" stroke="var(--line)" strokeWidth="3" />
              <circle cx="11" cy="11" r="9" fill="none" stroke="var(--success)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(dailyPct / 100) * 56.5} 56.5`} transform="rotate(-90 11 11)" />
            </svg>
          </div>
          <div className="hidden items-center gap-2 sm:flex" title={`${into}/100 XP to next level`}>
            <span className="font-semibold">Lv <CountUp value={levelOf(s.xp)} /></span>
            <div className="bar !h-2 w-20"><span style={{ width: `${into}%` }} /></div>
          </div>
          <span className="hidden h-2 w-2 rounded-full sm:block" title={sync === "saved" ? "All changes saved" : sync === "saving" ? "Saving…" : "Couldn't save. Will retry."}
            style={{ background: sync === "saved" ? "var(--success)" : sync === "saving" ? "var(--accent)" : "var(--danger)" }} />
          <details className="relative">
            <summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary" aria-label="Account menu">
              {user?.display_name.slice(0, 1).toUpperCase()}
            </summary>
            <div className="card absolute right-0 mt-2 w-60 !p-3">
              <p className="truncate font-semibold">{user?.display_name}</p>
              <p className="muted truncate text-xs">{user?.email}</p>
              <span className={`chip mt-2 ${isAdmin ? "!bg-primary-soft !text-primary" : ""}`}>{user?.role}</span>
              <label className="mt-3 flex cursor-pointer items-center justify-between text-sm">
                <span>Reduce motion</span>
                <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              </label>
              <button className="btn btn-ghost mt-3 w-full !py-1.5" onClick={() => void logout()}>Sign out</button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
