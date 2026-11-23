import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type AdminStats, type AdminUser } from "../lib/api";
import { useAuth } from "../lib/auth";

type Page = { items: AdminUser[]; total: number };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Never");

export default function Admin() {
  const { user: me } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    try {
      const [s, p] = await Promise.all([api.get<AdminStats>("/admin/stats"), api.get<Page>(`/admin/users?search=${encodeURIComponent(q)}&limit=100`)]);
      setStats(s);
      setPage(p);
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load admin data.");
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(search), 250); // debounce typing
    return () => clearTimeout(t);
  }, [search, load]);

  const patch = async (u: AdminUser, body: { role?: string; is_active?: boolean }, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusyId(u.id);
    try {
      const updated = await api.patch<AdminUser>(`/admin/users/${u.id}`, body);
      setPage((p) => p && { ...p, items: p.items.map((x) => (x.id === u.id ? updated : x)) });
      void load(search);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Update failed.");
    } finally {
      setBusyId(null);
    }
  };

  const tiles: [string, number | string, string][] = stats
    ? [
        ["Users", stats.total_users, `${stats.active_users} active`],
        ["New this week", stats.new_last_7_days, "signups"],
        ["Projects completed", stats.total_projects_completed, "across all learners"],
        ["AI calls today", stats.ai_calls_today, "shared Groq quota"],
      ]
    : [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Admin</h1>
          <p className="muted">Manage learners and roles.</p>
        </div>
        <input className="field !w-72" placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search users" />
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(tiles.length ? tiles : Array.from({ length: 4 }, (): [string, string, string] => ["", "", ""])).map(([label, value, sub], i) => (
          <div key={i} className="card">
            {label ? (
              <>
                <p className="muted text-sm">{label}</p>
                <p className="mt-1 text-3xl font-extrabold tabular-nums">{value}</p>
                <p className="muted text-xs">{sub}</p>
              </>
            ) : (
              <div className="h-[72px] animate-pulse rounded-lg bg-surface2" />
            )}
          </div>
        ))}
      </section>

      <section className="card mt-6 overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="muted bg-surface2 text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3 text-right">XP</th>
                <th className="px-4 py-3 text-right">Projects</th><th className="px-4 py-3">Last seen</th><th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {page?.items.map((u) => {
                const self = u.id === me?.id;
                return (
                  <tr key={u.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">{u.display_name.slice(0, 1).toUpperCase()}</span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{u.display_name}{self && <span className="chip ml-2">you</span>}</p>
                          <p className="muted truncate text-xs">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`chip ${u.role === "admin" ? "!bg-primary-soft !text-primary" : ""}`}>{u.role}</span>
                      {!u.is_active && <span className="chip ml-1 !bg-danger-soft !text-danger">disabled</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{u.xp}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{u.projects_completed}</td>
                    <td className="muted px-4 py-3">{fmt(u.last_login_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button className="btn btn-ghost !px-3 !py-1.5 !text-xs" disabled={self || busyId === u.id}
                          onClick={() => patch(u, { role: u.role === "admin" ? "user" : "admin" }, u.role === "admin" ? `Remove admin rights from ${u.display_name}?` : `Make ${u.display_name} an admin?`)}>
                          {u.role === "admin" ? "Make user" : "Make admin"}
                        </button>
                        <button className="btn btn-ghost !px-3 !py-1.5 !text-xs" disabled={self || busyId === u.id}
                          onClick={() => patch(u, { is_active: !u.is_active }, u.is_active ? `Disable ${u.display_name}? They'll be signed out immediately.` : undefined)}>
                          {u.is_active ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {page && page.items.length === 0 && <tr><td colSpan={6} className="muted px-4 py-10 text-center">No users match “{search}”.</td></tr>}
              {!page && <tr><td colSpan={6} className="px-4 py-10"><div className="h-6 animate-pulse rounded bg-surface2" /></td></tr>}
            </tbody>
          </table>
        </div>
        {page && <p className="muted border-t border-line px-4 py-3 text-xs">{page.items.length} of {page.total} users</p>}
      </section>
    </main>
  );
}
