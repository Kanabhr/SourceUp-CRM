import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, DollarSign, Percent, Users } from "lucide-react";
import { getDashboard } from "../api/dashboardApi.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n) =>
  typeof n === "number"
    ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
    : "—";

const fmtCurrency = (n) =>
  typeof n === "number"
    ? `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
    : "—";

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, accent }) {
  return (
    <div
      className="glass r-lg"
      style={{
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        flex: "1 1 180px",
        minWidth: 160,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--r-md)",
            background: accent ? `${accent}22` : "var(--glass-bg-default)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={16} color={accent || "var(--accent)"} />
        </div>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </span>
      </div>
      <p style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
        {value}
      </p>
    </div>
  );
}

// ─── Lead Status Row ─────────────────────────────────────────────────────────

const STATUS_COLORS = {
  Open:           "#2dd4bf",
  "In Progress":  "#fbbf24",
  "Quotation Sent": "#8b5cf6",
  "Closed Won":   "#22c55e",
  "Closed Lost":  "#ef4444",
};

function LeadStatusRow({ status, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const color = STATUS_COLORS[status] || "var(--accent)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 110, fontSize: 13, color: "var(--text-secondary)", flexShrink: 0 }}>{status}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 9999, background: "rgb(255 255 255/0.06)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 9999, background: color, transition: "width 600ms ease" }} />
      </div>
      <span style={{ width: 32, textAlign: "right", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", flexShrink: 0 }}>{count}</span>
    </div>
  );
}

// ─── Monthly Bar ──────────────────────────────────────────────────────────────

function MonthlyBar({ month, revenue, maxRevenue }) {
  const pct = maxRevenue > 0 ? Math.round((revenue / maxRevenue) * 100) : 0;
  // Display month as short label e.g. "Jan 24"
  const [yr, mo] = month.split("-");
  const label = new Date(`${yr}-${mo}-01`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1, minWidth: 36 }}>
      <div style={{ width: "100%", height: 80, display: "flex", alignItems: "flex-end" }}>
        <div
          style={{
            width: "100%",
            height: `${pct}%`,
            minHeight: pct > 0 ? 4 : 0,
            background: "linear-gradient(180deg, var(--accent) 0%, rgb(45 212 191/0.4) 100%)",
            borderRadius: "4px 4px 0 0",
            transition: "height 600ms ease",
          }}
        />
      </div>
      <span style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDashboard()
      .then((res) => setData(res.data?.data ?? res.data))
      .catch((err) => setError(err?.response?.data?.message ?? "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 32, display: "flex", justifyContent: "center" }}>
        <span style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading dashboard…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass r-lg" style={{ margin: 24, padding: 24, color: "#f87171" }}>
        {error}
      </div>
    );
  }

  const deals = data?.deals ?? {};
  const leads = data?.leads ?? {};

  const monthlySales = deals.monthlySales ?? [];
  const maxRevenue = Math.max(...monthlySales.map((m) => m.revenue), 1);

  const leadStatusEntries = Object.entries(leads.leadsByStatus ?? {}).sort((a, b) => b[1] - a[1]);
  const totalLeads = leads.totalLeads ?? 0;

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 1100 }}>
      {/* Page header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Revenue, funnel, and activity overview</p>
      </div>

      {/* KPI cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <KpiCard icon={BarChart3}   label="Total Deals"      value={fmt(deals.totalDeals)}      accent="#2dd4bf" />
        <KpiCard icon={DollarSign}  label="Total Revenue"    value={fmtCurrency(deals.totalRevenue)}  accent="#22c55e" />
        <KpiCard icon={TrendingUp}  label="Avg Deal Value"   value={fmtCurrency(deals.avgDealValue)}  accent="#fbbf24" />
        <KpiCard icon={Percent}     label="Total Commission" value={fmtCurrency(deals.totalCommission)} accent="#8b5cf6" />
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {/* Lead stats */}
        <div className="glass r-lg" style={{ flex: "1 1 300px", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Users size={16} color="var(--accent)" />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
              Leads — <span style={{ color: "var(--accent)" }}>{totalLeads} total</span>
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {leadStatusEntries.length > 0 ? (
              leadStatusEntries.map(([status, count]) => (
                <LeadStatusRow key={status} status={status} count={count} total={totalLeads} />
              ))
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No leads yet</p>
            )}
          </div>
        </div>

        {/* Monthly Sales chart */}
        <div className="glass r-lg" style={{ flex: "2 1 400px", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BarChart3 size={16} color="var(--accent)" />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Monthly Sales (last 12 months)</h2>
          </div>
          {monthlySales.length > 0 ? (
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 100 }}>
              {monthlySales.map((m) => (
                <MonthlyBar key={m.month} month={m.month} revenue={m.revenue} maxRevenue={maxRevenue} />
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No sales data yet</p>
          )}
        </div>
      </div>

      {/* Deal stages table */}
      {deals.dealsByStatus && Object.keys(deals.dealsByStatus).length > 0 && (
        <div className="glass r-lg" style={{ padding: "20px 22px" }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 14px" }}>Deals by Stage</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Stage", "Count"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--glass-border)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(deals.dealsByStatus).map(([stage, count]) => (
                  <tr key={stage} style={{ borderBottom: "1px solid var(--glass-border)" }}>
                    <td style={{ padding: "9px 12px", color: "var(--text-secondary)" }}>{stage}</td>
                    <td style={{ padding: "9px 12px", fontWeight: 600, color: "var(--text-primary)" }}>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
