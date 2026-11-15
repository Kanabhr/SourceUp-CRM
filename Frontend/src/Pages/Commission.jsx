import { useEffect, useState } from "react";
import { Percent, Search } from "lucide-react";
import { useAuth } from "../context/Authcontext";
import { getCommissionReport } from "../api/reportsApi.js";
import { getUsers } from "../api/usersApi.js";
import PortalDropdown from "../components/PortalDropdown.jsx";

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const fmtCurrency = (n) =>
  typeof n === "number" ? `â‚¹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "â€”";

// â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function Commission() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ startDate: "", endDate: "", salesRep: "" });
  const [commissions, setCommissions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [salesReps, setSalesReps] = useState([]);

  useEffect(() => {
    if (!user || (user.role !== "manager" && user.role !== "superadmin")) return;
    getUsers()
      .then((res) => {
        const all = res.data?.data ?? [];
        setSalesReps(all.filter((u) => u.role === "sales"));
      })
      .catch(() => {}); // non-manager roles silently skip
  }, []);

  const setF = (key) => (val) => setFilters((f) => ({ ...f, [key]: val }));

  const fetch = () => {
    setLoading(true);
    setError(null);
    getCommissionReport(filters)
      .then((res) => setCommissions(res.data?.data?.commissions ?? []))
      .catch((err) => setError(err?.response?.data?.message ?? "Failed to fetch"))
      .finally(() => setLoading(false));
  };

  const totalPayable =
    commissions?.reduce((sum, c) => sum + (c.totalCommission ?? 0), 0) ?? 0;

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 900 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <Percent size={20} color="var(--accent)" />
          Commission Report
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          Per-rep commission breakdown, sorted by highest commission
        </p>
      </div>

      {/* Filters */}
      <div className="glass r-lg" style={{ padding: "16px 20px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px", minWidth: 120 }}>
          <label style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Start Date</label>
          <input
            type="date"
            className="input-glass"
            value={filters.startDate}
            onChange={(e) => setF("startDate")(e.target.value)}
            style={{ padding: "7px 10px", fontSize: 13 }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px", minWidth: 120 }}>
          <label style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>End Date</label>
          <input
            type="date"
            className="input-glass"
            value={filters.endDate}
            onChange={(e) => setF("endDate")(e.target.value)}
            style={{ padding: "7px 10px", fontSize: 13 }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 200px", minWidth: 160 }}>
          <label style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sales Rep</label>
          <PortalDropdown
            value={filters.salesRep}
            onChange={setF("salesRep")}
            options={[
              { value: "", label: "All sales reps" },
              ...salesReps.map((u) => ({ value: u._id, label: u.username })),
            ]}
            placeholder="All sales reps"
          />
        </div>
        <button
          className="btn-primary"
          onClick={fetch}
          disabled={loading}
          style={{ height: 36, alignSelf: "flex-end", display: "flex", alignItems: "center", gap: 6, paddingInline: 16 }}
        >
          <Search size={13} />
          {loading ? "Loadingâ€¦" : "Fetch"}
        </button>
      </div>

      {error && (
        <div className="glass r-md" style={{ padding: "12px 16px", color: "#f87171", fontSize: 13 }}>
          {error}
        </div>
      )}

      {commissions !== null && (
        <div className="glass r-lg" style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Results â€” {commissions.length} sales rep{commissions.length !== 1 ? "s" : ""}
          </h2>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["#", "Sales Rep", "Total Deals", "Total Revenue", "Total Commission"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "8px 12px",
                        color: "var(--text-muted)",
                        fontWeight: 600,
                        borderBottom: "1px solid var(--glass-border)",
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {commissions.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "16px 12px", color: "var(--text-muted)", textAlign: "center" }}>
                      No commission data found for the selected filters
                    </td>
                  </tr>
                ) : (
                  commissions.map((c, i) => (
                    <tr key={c.salesRepId ?? c.username} style={{ borderBottom: "1px solid var(--glass-border)" }}>
                      <td style={{ padding: "9px 12px", color: "var(--text-muted)", fontWeight: 600 }}>{i + 1}</td>
                      <td style={{ padding: "9px 12px", color: "var(--text-primary)", fontWeight: 600 }}>{c.username}</td>
                      <td style={{ padding: "9px 12px", color: "var(--text-secondary)" }}>{c.totalDeals}</td>
                      <td style={{ padding: "9px 12px", color: "var(--text-secondary)" }}>{fmtCurrency(c.totalRevenue)}</td>
                      <td style={{ padding: "9px 12px", color: "#8b5cf6", fontWeight: 700 }}>{fmtCurrency(c.totalCommission)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Total footer */}
          {commissions.length > 0 && (
            <div
              className="glass-subtle r-md"
              style={{
                padding: "12px 18px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid var(--glass-border)",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                Total Commission Payable
              </span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#8b5cf6" }}>
                {fmtCurrency(totalPayable)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

