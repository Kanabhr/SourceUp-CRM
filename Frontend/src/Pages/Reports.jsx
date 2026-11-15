import { useEffect, useState } from "react";
import { BarChart3, Search } from "lucide-react";
import { getSalesReport, getLeadsReport } from "../api/reportsApi.js";
import { getUsers } from "../api/usersApi.js";
import PortalDropdown from "../components/PortalDropdown.jsx";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtCurrency = (n) =>
  typeof n === "number" ? `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN") : "—");

// ─── KPI summary strip ────────────────────────────────────────────────────────

function KpiStrip({ items }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
      {items.map(({ label, value }) => (
        <div
          key={label}
          className="glass-subtle r-md"
          style={{ padding: "12px 18px", flex: "1 1 120px", minWidth: 100 }}
        >
          <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>{label}</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterInput({ label, type = "text", value, onChange, placeholder }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px", minWidth: 120 }}>
      <label style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
      <input
        type={type}
        className="input-glass"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ padding: "7px 10px", fontSize: 13 }}
      />
    </div>
  );
}

// ─── Sales Report tab ─────────────────────────────────────────────────────────

function SalesReportTab() {
  const [filters, setFilters] = useState({ startDate: "", endDate: "", serviceType: "", salesRep: "" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [salesReps, setSalesReps] = useState([]);

  useEffect(() => {
    getUsers()
      .then((res) => {
        const all = res.data?.data ?? [];
        setSalesReps(all.filter((u) => u.role === "sales"));
      })
      .catch(() => {});
  }, []);

  const setF = (key) => (val) => setFilters((f) => ({ ...f, [key]: val }));

  const fetch = () => {
    setLoading(true);
    setError(null);
    getSalesReport(filters)
      .then((res) => setResult(res.data?.data ?? res.data))
      .catch((err) => setError(err?.response?.data?.message ?? "Failed to fetch"))
      .finally(() => setLoading(false));
  };

  const deals = result?.deals ?? [];
  const kpis = result?.kpis ?? {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <FilterInput label="Start Date" type="date" value={filters.startDate} onChange={setF("startDate")} />
        <FilterInput label="End Date"   type="date" value={filters.endDate}   onChange={setF("endDate")} />
        <FilterInput label="Service Type" value={filters.serviceType} onChange={setF("serviceType")} placeholder="e.g. Sourcing" />
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 160px", minWidth: 140 }}>
          <label style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sales Rep</label>
          <PortalDropdown
            value={filters.salesRep}
            onChange={setF("salesRep")}
            options={[{ value: "", label: "All reps" }, ...salesReps.map((u) => ({ value: u._id, label: u.username }))]}
            placeholder="All reps"
          />
        </div>
        <button
          className="btn-primary"
          onClick={fetch}
          disabled={loading}
          style={{ height: 36, alignSelf: "flex-end", display: "flex", alignItems: "center", gap: 6, paddingInline: 16 }}
        >
          <Search size={13} />
          {loading ? "Loading…" : "Fetch"}
        </button>
      </div>

      {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

      {result && (
        <>
          <KpiStrip items={[
            { label: "Total Deals",      value: kpis.totalDeals ?? 0 },
            { label: "Total Revenue",    value: fmtCurrency(kpis.totalRevenue) },
            { label: "Avg Deal Value",   value: fmtCurrency(kpis.avgDealValue) },
            { label: "Total Commission", value: fmtCurrency(kpis.totalCommission) },
          ]} />

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Deal ID", "Sales Rep", "Price/Unit", "Qty", "Revenue", "Commission", "Date"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--glass-border)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deals.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "16px 12px", color: "var(--text-muted)", textAlign: "center" }}>No deals found</td>
                  </tr>
                ) : (
                  deals.map((d) => {
                    const revenue = (d.sellingPricePerUnit ?? 0) * (d.qty ?? 0);
                    const commission = revenue * ((d.commissionPct ?? 0) / 100);
                    const repName = typeof d.salesRep === "object" ? d.salesRep?.username : (d.salesRep ?? "—");
                    return (
                      <tr key={d._id ?? d.dealId} style={{ borderBottom: "1px solid var(--glass-border)" }}>
                        <td style={{ padding: "9px 12px", color: "var(--text-secondary)", fontFamily: "monospace" }}>{d.dealId}</td>
                        <td style={{ padding: "9px 12px", color: "var(--text-secondary)" }}>{repName}</td>
                        <td style={{ padding: "9px 12px", color: "var(--text-secondary)" }}>{fmtCurrency(d.sellingPricePerUnit)}</td>
                        <td style={{ padding: "9px 12px", color: "var(--text-secondary)" }}>{d.qty}</td>
                        <td style={{ padding: "9px 12px", fontWeight: 600, color: "var(--text-primary)" }}>{fmtCurrency(revenue)}</td>
                        <td style={{ padding: "9px 12px", color: "#8b5cf6" }}>{fmtCurrency(commission)}</td>
                        <td style={{ padding: "9px 12px", color: "var(--text-muted)" }}>{fmtDate(d.orderConfirmDate)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Leads Report tab ─────────────────────────────────────────────────────────

function LeadsReportTab() {
  const [filters, setFilters] = useState({ startDate: "", endDate: "", status: "", serviceType: "" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const setF = (key) => (val) => setFilters((f) => ({ ...f, [key]: val }));

  const fetch = () => {
    setLoading(true);
    setError(null);
    getLeadsReport(filters)
      .then((res) => setResult(res.data?.data ?? res.data))
      .catch((err) => setError(err?.response?.data?.message ?? "Failed to fetch"))
      .finally(() => setLoading(false));
  };

  const leads = result?.leads ?? [];
  const stats = result?.stats ?? {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <FilterInput label="Start Date"   type="date" value={filters.startDate}   onChange={setF("startDate")} />
        <FilterInput label="End Date"     type="date" value={filters.endDate}     onChange={setF("endDate")} />
        <FilterInput label="Status"       value={filters.status}      onChange={setF("status")}      placeholder="e.g. Open" />
        <FilterInput label="Service Type" value={filters.serviceType} onChange={setF("serviceType")} placeholder="e.g. Sourcing" />
        <button
          className="btn-primary"
          onClick={fetch}
          disabled={loading}
          style={{ height: 36, alignSelf: "flex-end", display: "flex", alignItems: "center", gap: 6, paddingInline: 16 }}
        >
          <Search size={13} />
          {loading ? "Loading…" : "Fetch"}
        </button>
      </div>

      {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

      {result && (
        <>
          <KpiStrip items={[
            { label: "Total Leads", value: stats.totalLeads ?? 0 },
            ...Object.entries(stats.leadsByStatus ?? {}).map(([s, c]) => ({ label: s, value: c })),
          ]} />

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Lead ID", "Company", "Status", "Service Type", "Assigned To", "Created"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--glass-border)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "16px 12px", color: "var(--text-muted)", textAlign: "center" }}>No leads found</td>
                  </tr>
                ) : (
                  leads.map((l) => (
                    <tr key={l._id ?? l.leadId} style={{ borderBottom: "1px solid var(--glass-border)" }}>
                      <td style={{ padding: "9px 12px", color: "var(--text-secondary)", fontFamily: "monospace" }}>{l.leadId ?? l._id}</td>
                      <td style={{ padding: "9px 12px", color: "var(--text-secondary)" }}>{l.company ?? l.clientName ?? "—"}</td>
                      <td style={{ padding: "9px 12px", color: "var(--text-secondary)" }}>{l.status}</td>
                      <td style={{ padding: "9px 12px", color: "var(--text-muted)" }}>{l.serviceType ?? "—"}</td>
                      <td style={{ padding: "9px 12px", color: "var(--text-muted)" }}>{l.assignedTo?.username ?? "—"}</td>
                      <td style={{ padding: "9px 12px", color: "var(--text-muted)" }}>{fmtDate(l.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = ["Sales Report", "Leads Report"];

export default function Reports() {
  const [tab, setTab] = useState(0);

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 1200 }}>
      {/* Page header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <BarChart3 size={20} color="var(--accent)" />
          Reports
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Sales, leads, and commission analysis</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--glass-border)", paddingBottom: 0 }}>
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            style={{
              background: "none",
              border: "none",
              padding: "9px 18px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: tab === i ? 600 : 500,
              color: tab === i ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: tab === i ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
              transition: "color 150ms",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="glass r-lg" style={{ padding: "20px 22px" }}>
        {tab === 0 ? <SalesReportTab /> : <LeadsReportTab />}
      </div>
    </div>
  );
}
