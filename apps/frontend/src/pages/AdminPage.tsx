import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { adminApi } from '../services/api';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

// ─── Types ───

interface DashboardData {
  totalUsers: number;
  activeUsers30d: number;
  newSignups7d: number;
  mrr: number;
  planDistribution: { name: string; value: number }[];
  topFeatures: { name: string; uses: number }[];
  errorCount: number;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  plan: string;
  signupDate: string;
  status: string;
}

interface UserDetail extends AdminUser {
  lastLogin?: string;
  canvasCount?: number;
  transcriptCount?: number;
  authType?: string;
}

interface BillingData {
  mrr: number;
  arr: number;
  planBreakdown: { plan: string; count: number; revenue: number }[];
  churnRate: number;
  recentTransactions: { id: string; email: string; amount: number; date: string; type: string }[];
}

interface HealthData {
  status: 'healthy' | 'degraded' | 'down';
  uptime: string;
  dbResponseTime: number;
  memoryUsage: { used: number; total: number };
  version: string;
}

interface ActivityEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

interface FeatureEntry {
  name: string;
  totalUses: number;
  uniqueUsers: number;
  lastUsed: string;
}

type TabId = 'dashboard' | 'users' | 'billing' | 'health' | 'activity' | 'features';

const TABS: { id: TabId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'users', label: 'Users' },
  { id: 'billing', label: 'Billing' },
  { id: 'health', label: 'Health' },
  { id: 'activity', label: 'Activity' },
  { id: 'features', label: 'Features' },
];

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const AUTO_REFRESH_MS = 60_000;

// ─── Admin Key Gate ───

function AdminKeyGate({ onAuthenticated }: { onAuthenticated: (key: string) => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  // Check sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('admin-api-key');
    if (stored) {
      verifyKey(stored);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verifyKey = async (apiKey: string) => {
    setChecking(true);
    setError('');
    try {
      await adminApi.getHealth(apiKey);
      sessionStorage.setItem('admin-api-key', apiKey);
      onAuthenticated(apiKey);
    } catch {
      sessionStorage.removeItem('admin-api-key');
      setError('Access Denied — invalid admin key.');
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (key.trim()) verifyKey(key.trim());
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Admin Portal</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">Enter your admin API key to continue.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="Admin API Key"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none mb-3"
            autoFocus
          />
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button
            type="submit"
            disabled={checking || !key.trim()}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {checking ? 'Verifying...' : 'Access Admin Portal'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Stat Card ───

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Pagination ───

function Pagination({ page, totalPages, total, onPrev, onNext }: {
  page: number; totalPages: number; total: number; onPrev: () => void; onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-sm text-gray-500 dark:text-gray-400">
        Page {page} of {totalPages} ({total} total)
      </span>
      <div className="flex gap-2">
        <button onClick={onPrev} disabled={page <= 1}
          className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
          Prev
        </button>
        <button onClick={onNext} disabled={page >= totalPages}
          className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
          Next
        </button>
      </div>
    </div>
  );
}

// ─── Dashboard Tab ───

function DashboardTab({ adminKey }: { adminKey: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await adminApi.getDashboard(adminKey);
      setData(res.data.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [adminKey]);

  useEffect(() => { load(); const t = setInterval(load, AUTO_REFRESH_MS); return () => clearInterval(t); }, [load]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <ErrorMessage message="Failed to load dashboard data." />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={data.totalUsers.toLocaleString()} />
        <StatCard label="Active Users (30d)" value={data.activeUsers30d.toLocaleString()} />
        <StatCard label="New Signups (7d)" value={data.newSignups7d.toLocaleString()} />
        <StatCard label="MRR" value={`$${data.mrr.toLocaleString()}`}
          sub={data.errorCount > 0 ? `${data.errorCount} errors` : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Plan Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data.planDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%"
                outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {data.planDistribution.map((_entry, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Features */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Top Features</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.topFeatures}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="uses" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {data.errorCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full">
            {data.errorCount}
          </span>
          <span className="text-red-700 dark:text-red-300 text-sm">Recent errors detected. Check Health tab for details.</span>
        </div>
      )}
    </div>
  );
}

// ─── Users Tab ───

function UsersTab({ adminKey }: { adminKey: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [sortField, setSortField] = useState<'email' | 'name' | 'plan' | 'signupDate' | 'status'>('signupDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const perPage = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getUsers(adminKey, { page, perPage, search, sortField, sortDir });
      setUsers(res.data.data.users);
      setTotal(res.data.data.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [adminKey, page, search, sortField, sortDir]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); setUserDetail(null); return; }
    setExpandedId(id);
    try {
      const res = await adminApi.getUserDetail(adminKey, id);
      setUserDetail(res.data.data);
    } catch { setUserDetail(null); }
  };

  const SortArrow = ({ field }: { field: typeof sortField }) => (
    sortField === field ? <span className="ml-1">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span> : null
  );

  return (
    <div className="space-y-4">
      <input
        type="text" placeholder="Search by email or name..."
        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
      />

      {loading ? <LoadingSpinner /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                {(['email', 'name', 'plan', 'signupDate', 'status'] as const).map(f => (
                  <th key={f} onClick={() => handleSort(f)}
                    className="py-2 px-3 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none">
                    {f === 'signupDate' ? 'Signed Up' : f.charAt(0).toUpperCase() + f.slice(1)}
                    <SortArrow field={f} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <UserRow key={u.id} user={u} expanded={expandedId === u.id}
                  detail={expandedId === u.id ? userDetail : null}
                  onClick={() => toggleExpand(u.id)} />
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total}
        onPrev={() => setPage(p => Math.max(1, p - 1))}
        onNext={() => setPage(p => Math.min(totalPages, p + 1))} />
    </div>
  );
}

function UserRow({ user, expanded, detail, onClick }: {
  user: AdminUser; expanded: boolean; detail: UserDetail | null; onClick: () => void;
}) {
  const planBadge = (plan: string) => {
    const colors: Record<string, string> = {
      free: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      pro: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
      team: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    };
    return colors[plan.toLowerCase()] || colors.free;
  };

  return (
    <>
      <tr onClick={onClick}
        className="border-b border-gray-100 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        <td className="py-2 px-3 text-gray-900 dark:text-white">{user.email}</td>
        <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{user.name}</td>
        <td className="py-2 px-3">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${planBadge(user.plan)}`}>
            {user.plan}
          </span>
        </td>
        <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{new Date(user.signupDate).toLocaleDateString()}</td>
        <td className="py-2 px-3">
          <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${user.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="text-gray-600 dark:text-gray-400">{user.status}</span>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50 dark:bg-gray-800/30">
          <td colSpan={5} className="py-3 px-6">
            {detail ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div><span className="text-gray-500 dark:text-gray-400">Auth:</span> <span className="text-gray-900 dark:text-white">{detail.authType || 'N/A'}</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Last Login:</span> <span className="text-gray-900 dark:text-white">{detail.lastLogin ? new Date(detail.lastLogin).toLocaleString() : 'Never'}</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Canvases:</span> <span className="text-gray-900 dark:text-white">{detail.canvasCount ?? 0}</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Transcripts:</span> <span className="text-gray-900 dark:text-white">{detail.transcriptCount ?? 0}</span></div>
              </div>
            ) : (
              <span className="text-gray-400 text-sm">Loading details...</span>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Billing Tab ───

function BillingTab({ adminKey }: { adminKey: string }) {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await adminApi.getBilling(adminKey);
      setData(res.data.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [adminKey]);

  useEffect(() => { load(); const t = setInterval(load, AUTO_REFRESH_MS); return () => clearInterval(t); }, [load]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <ErrorMessage message="Failed to load billing data." />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="MRR" value={`$${data.mrr.toLocaleString()}`} />
        <StatCard label="ARR" value={`$${data.arr.toLocaleString()}`} />
        <StatCard label="Churn Rate" value={`${data.churnRate.toFixed(1)}%`}
          sub={data.churnRate > 5 ? 'Above target' : 'On track'} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Plan Breakdown</h3>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
              <th className="py-2 px-3 font-medium">Plan</th>
              <th className="py-2 px-3 font-medium">Users</th>
              <th className="py-2 px-3 font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.planBreakdown.map(p => (
              <tr key={p.plan} className="border-b border-gray-100 dark:border-gray-700/50">
                <td className="py-2 px-3 text-gray-900 dark:text-white font-medium">{p.plan}</td>
                <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{p.count}</td>
                <td className="py-2 px-3 text-gray-700 dark:text-gray-300">${p.revenue.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Recent Transactions</h3>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
              <th className="py-2 px-3 font-medium">Date</th>
              <th className="py-2 px-3 font-medium">Email</th>
              <th className="py-2 px-3 font-medium">Type</th>
              <th className="py-2 px-3 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.recentTransactions.map(tx => (
              <tr key={tx.id} className="border-b border-gray-100 dark:border-gray-700/50">
                <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{new Date(tx.date).toLocaleDateString()}</td>
                <td className="py-2 px-3 text-gray-900 dark:text-white">{tx.email}</td>
                <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{tx.type}</td>
                <td className="py-2 px-3 text-gray-700 dark:text-gray-300">${tx.amount.toFixed(2)}</td>
              </tr>
            ))}
            {data.recentTransactions.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-gray-400">No recent transactions.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Health Tab ───

function HealthTab({ adminKey }: { adminKey: string }) {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await adminApi.getHealth(adminKey);
      setData(res.data.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [adminKey]);

  useEffect(() => { load(); const t = setInterval(load, AUTO_REFRESH_MS); return () => clearInterval(t); }, [load]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <ErrorMessage message="Failed to load health data." />;

  const statusColor = { healthy: 'bg-green-500', degraded: 'bg-yellow-500', down: 'bg-red-500' }[data.status];
  const statusLabel = { healthy: 'Healthy', degraded: 'Degraded', down: 'Down' }[data.status];
  const memPct = data.memoryUsage.total > 0 ? ((data.memoryUsage.used / data.memoryUsage.total) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 flex items-center gap-4">
        <span className={`w-4 h-4 rounded-full ${statusColor}`} />
        <div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{statusLabel}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">System status</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Uptime" value={data.uptime} />
        <StatCard label="DB Response Time" value={`${data.dbResponseTime}ms`}
          sub={data.dbResponseTime > 200 ? 'Elevated' : 'Normal'} />
        <StatCard label="Memory Usage" value={`${memPct}%`}
          sub={`${(data.memoryUsage.used / 1024 / 1024).toFixed(0)} / ${(data.memoryUsage.total / 1024 / 1024).toFixed(0)} MB`} />
        <StatCard label="Version" value={data.version} />
      </div>
    </div>
  );
}

// ─── Activity Tab ───

function ActivityTab({ adminKey }: { adminKey: string }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const perPage = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getActivity(adminKey, { page, perPage, action: actionFilter || undefined });
      setEntries(res.data.data.entries);
      setTotal(res.data.data.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [adminKey, page, actionFilter]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // Derive unique action types from the first load
  const actionTypes = useMemo(() => {
    const set = new Set(entries.map(e => e.action));
    return Array.from(set).sort();
  }, [entries]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
          <option value="">All actions</option>
          {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                <th className="py-2 px-3 font-medium">Timestamp</th>
                <th className="py-2 px-3 font-medium">User</th>
                <th className="py-2 px-3 font-medium">Action</th>
                <th className="py-2 px-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="py-2 px-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</td>
                  <td className="py-2 px-3 text-gray-900 dark:text-white">{e.user}</td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
                      {e.action}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">{e.details}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400">No activity logged.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total}
        onPrev={() => setPage(p => Math.max(1, p - 1))}
        onNext={() => setPage(p => Math.min(totalPages, p + 1))} />
    </div>
  );
}

// ─── Features Tab ───

function FeaturesTab({ adminKey }: { adminKey: string }) {
  const [features, setFeatures] = useState<FeatureEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await adminApi.getFeatures(adminKey);
      setFeatures(res.data.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [adminKey]);

  useEffect(() => { load(); const t = setInterval(load, AUTO_REFRESH_MS); return () => clearInterval(t); }, [load]);

  if (loading) return <LoadingSpinner />;
  if (features.length === 0) return <ErrorMessage message="No feature usage data available." />;

  const chartData = [...features].sort((a, b) => b.totalUses - a.totalUses).slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Top Features</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="totalUses" fill="#6366f1" radius={[0, 4, 4, 0]} name="Total Uses" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Feature Usage</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                <th className="py-2 px-3 font-medium">Feature</th>
                <th className="py-2 px-3 font-medium">Total Uses</th>
                <th className="py-2 px-3 font-medium">Unique Users</th>
                <th className="py-2 px-3 font-medium">Last Used</th>
              </tr>
            </thead>
            <tbody>
              {features.map(f => (
                <tr key={f.name} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="py-2 px-3 text-gray-900 dark:text-white font-medium">{f.name}</td>
                  <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{f.totalUses.toLocaleString()}</td>
                  <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{f.uniqueUsers.toLocaleString()}</td>
                  <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{new Date(f.lastUsed).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Components ───

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-indigo-200 dark:border-indigo-800 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-gray-500 dark:text-gray-400">{message}</div>
  );
}

// ─── Main Admin Page ───

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  usePageMeta('Admin Portal — QualCanvas', 'QualCanvas administration dashboard.');

  if (!adminKey) {
    return <AdminKeyGate onAuthenticated={setAdminKey} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">QualCanvas Admin</h1>
          <button
            onClick={() => { sessionStorage.removeItem('admin-api-key'); setAdminKey(null); }}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex gap-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'dashboard' && <DashboardTab adminKey={adminKey} />}
        {activeTab === 'users' && <UsersTab adminKey={adminKey} />}
        {activeTab === 'billing' && <BillingTab adminKey={adminKey} />}
        {activeTab === 'health' && <HealthTab adminKey={adminKey} />}
        {activeTab === 'activity' && <ActivityTab adminKey={adminKey} />}
        {activeTab === 'features' && <FeaturesTab adminKey={adminKey} />}
      </main>
    </div>
  );
}
