import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, ChevronLeft, ChevronRight,
  Plus, Search, X,
} from "lucide-react";
import { useAuth } from "../context/Authcontext";
import { getDeals, createDeal } from "../api/dealsApi.js";
import { getLeads } from "../api/leadsApi.js";
import PortalDropdown from "../components/PortalDropdown.jsx";

// â”€â”€â”€ Constants (mirrors backend) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DEAL_STAGES = [
  "Quotation Sent", "Negotiation", "Sample",
  "Won", "Advance Received", "In Production",
  "Dispatched", "Delivered", "Closed", "Lost",
];

const STAGE_COLORS = {
  "Quotation Sent":   { bg: "rgb(139 92 246 / 0.12)", color: "#8b5cf6" },
  "Negotiation":      { bg: "rgb(251 191 36 / 0.12)", color: "#fbbf24" },
  "Sample":           { bg: "rgb(96 165 250 / 0.12)", color: "#60a5fa" },
  "Won":              { bg: "rgb(34 197 94 / 0.12)",  color: "#22c55e" },
  "Advance Received": { bg: "rgb(45 212 191 / 0.12)", color: "#2dd4bf" },
  "In Production":    { bg: "rgb(251 146 60 / 0.12)", color: "#fb923c" },
  "Dispatched":       { bg: "rgb(168 85 247 / 0.12)", color: "#a855f7" },
  "Delivered":        { bg: "rgb(34 197 94 / 0.12)",  color: "#22c55e" },
  "Closed":           { bg: "rgb(100 116 139 / 0.12)",color: "#94a3b8" },
  "Lost":             { bg: "rgb(239 68 68 / 0.12)",  color: "#ef4444" },
};

const COMMISSION_COLORS = {
  Pending: { bg: "rgb(251 191 36 / 0.12)", color: "#fbbf24" },
  Paid:    { bg: "rgb(34 197 94 / 0.12)",  color: "#22c55e" },
};

// â”€â”€â”€ Small reusable components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Badge({ label, scheme }) {
  const s = scheme || { bg: "rgb(255 255 255/0.06)", color: "var(--text-secondary)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: 9999,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
      textTransform: "capitalize", whiteSpace: "nowrap",
      background: s.bg, color: s.color,
    }}>
      {label}
    </span>
  );
}

// â”€â”€â”€ Add Deal Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AddDealModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    leadId: "", customerName: "",
    quotationNo: "", quotationDate: "", piNo: "",
    sellingPricePerUnit: "", qty: "",
    commissionPct: "20",
    sampleRequired: "No",
    advanceAmount: "",
    balanceDueTrigger: "Dispatch",
  });
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadSearch, setLeadSearch] = useState("");
  const [debouncedLeadSearch, setDebouncedLeadSearch] = useState("");
  const leadSearchTimer = useRef(null);

  // Load leads for the dropdown
  useEffect(() => {
    getLeads({ search: debouncedLeadSearch, limit: 200 })
      .then(res => {
        const leadList = res.data.data.leads.map(l => ({
          value: l._id,
          label: `${l.leadId || ""} â€” ${l.clientName}`,
          clientName: l.clientName,
        }));
        setLeads(leadList);
      })
      .catch(() => {})
      .finally(() => setLeadsLoading(false));
  }, [debouncedLeadSearch]);

  // Debounce the lead search input
  useEffect(() => {
    clearTimeout(leadSearchTimer.current);
    leadSearchTimer.current = setTimeout(() => setDebouncedLeadSearch(leadSearch), 350);
    return () => clearTimeout(leadSearchTimer.current);
  }, [leadSearch]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setV = (k) => (v) => {
    setForm(f => ({ ...f, [k]: v }));
    // Auto-fill customer name from selected lead
    if (k === "leadId") {
      const selected = leads.find(l => l.value === v);
      if (selected) setForm(f => ({ ...f, leadId: v, customerName: selected.clientName }));
    }
  };

  // Live calculation
  const orderValue = (Number(form.sellingPricePerUnit) || 0) * (Number(form.qty) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.leadId) { setError("Please select a lead"); return; }
    setLoading(true);
    try {
      const res = await createDeal({
        leadId: form.leadId,
        customerName: form.customerName,
        quotationNo: form.quotationNo,
        quotationDate: form.quotationDate || null,
        piNo: form.piNo,
        sellingPricePerUnit: Number(form.sellingPricePerUnit) || 0,
        qty: Number(form.qty) || 0,
        commissionPct: Number(form.commissionPct) || 20,
        sample: { required: form.sampleRequired === "Yes" },
        advance: { amount: Number(form.advanceAmount) || 0 },
        balance: { dueTrigger: form.balanceDueTrigger || "" },
      });
      onCreated(res.data.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create deal");
    } finally {
      setLoading(false);
    }
  };

  const backdropRef = useRef(null);
  const handleBackdrop = (e) => { if (e.target === backdropRef.current) onClose(); };

  const fieldStyle = { display: "flex", flexDirection: "column", gap: 5 };
  const labelStyle = { fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
    textTransform: "uppercase", color: "var(--text-secondary)" };

  return (
    <div ref={backdropRef} onClick={handleBackdrop}
      style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 16,
        background: "rgb(0 0 0/0.6)", backdropFilter: "blur(4px)" }}>
      <div className="glass-strong r-xl"
        style={{ width: "100%", maxWidth: 520, maxHeight: "90dvh",
          overflowY: "auto", padding: 28 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Add Deal
          </h2>
          <button type="button" onClick={onClose} className="btn-icon" style={{ width: 32, height: 32 }}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Lead select */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Link to Lead *</label>
            <div style={{ position: "relative", marginBottom: 8 }}>
              <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
              <input
                className="input-glass"
                placeholder="Search leads"
                value={leadSearch}
                onChange={e => setLeadSearch(e.target.value)}
                style={{ paddingLeft: 32, height: 38, fontSize: 13, width: "100%" }}
              />
            </div>
            {leadsLoading ? (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading leadsâ€¦</span>
            ) : leads.length === 0 ? (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No leads found</span>
            ) : (
              <PortalDropdown value={form.leadId} onChange={setV("leadId")}
                options={leads} placeholder="Select a lead" />
            )}
          </div>

          {/* Customer name (auto-filled) */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Customer Name</label>
            <input className="input-glass" placeholder="Auto-filled from lead"
              value={form.customerName} onChange={set("customerName")} />
          </div>

          {/* Quotation & PI */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Quotation No.</label>
              <input className="input-glass" placeholder="Q-001" value={form.quotationNo} onChange={set("quotationNo")} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Quotation Date</label>
              <input className="input-glass" type="date" value={form.quotationDate} onChange={set("quotationDate")} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>PI No.</label>
              <input className="input-glass" placeholder="PI-001" value={form.piNo} onChange={set("piNo")} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Commission %</label>
              <input className="input-glass" type="number" min="0" max="100" step="1"
                placeholder="20" value={form.commissionPct} onChange={set("commissionPct")} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Selling Price / Unit (â‚¹)</label>
              <input className="input-glass" type="number" min="0" step="0.01"
                placeholder="500" value={form.sellingPricePerUnit} onChange={set("sellingPricePerUnit")} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Quantity</label>
              <input className="input-glass" type="number" min="0" step="1"
                placeholder="1000" value={form.qty} onChange={set("qty")} />
            </div>
          </div>

          {/* Sample & Payment Setup */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Sample Required?</label>
              <PortalDropdown
                value={form.sampleRequired}
                onChange={setV("sampleRequired")}
                options={[{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }]}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Balance Due Trigger</label>
              <PortalDropdown
                value={form.balanceDueTrigger}
                onChange={setV("balanceDueTrigger")}
                options={[
                  { value: "Dispatch", label: "Dispatch (India)" },
                  { value: "Reaching India", label: "Reaching India (China)" },
                ]}
              />
            </div>
          </div>

          {/* Advance 70% input */}
          <div style={fieldStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={labelStyle}>Advance Amount (â‚¹)</label>
              {orderValue > 0 && (
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, advanceAmount: String(Math.round(orderValue * 0.7)) }))}
                  style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 9999,
                    border: "1px solid rgb(45 212 191/0.3)", background: "rgb(45 212 191/0.1)",
                    color: "var(--accent)", cursor: "pointer", fontFamily: "inherit",
                  }}>
                  Auto 70%: â‚¹{Math.round(orderValue * 0.7).toLocaleString("en-IN")}
                </button>
              )}
            </div>
            <input className="input-glass" type="number" min="0" placeholder="e.g. 70000"
              value={form.advanceAmount} onChange={set("advanceAmount")} />
          </div>

          {/* Auto-calculated preview */}
          {orderValue > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
              borderRadius: "var(--r-md)", background: "rgb(45 212 191/0.06)",
              border: "1px solid rgb(45 212 191/0.15)" }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
                textTransform: "uppercase", color: "var(--text-muted)" }}>Order Value</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>
                â‚¹{orderValue.toLocaleString("en-IN")}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>auto</span>
            </div>
          )}

          {error && (
            <div className="error-banner">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" className="btn-ghost" onClick={onClose}
              style={{ height: 40, padding: "0 20px", fontSize: 13 }}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}
              style={{ height: 40, padding: "0 24px", fontSize: 13 }}>
              {loading ? "Savingâ€¦" : "Add Deal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// â”€â”€â”€ Main Deals Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function Deals() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [deals, setDeals]         = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch]           = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [page, setPage]               = useState(1);

  // Debounced search
  const searchTimer = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const fetchDeals = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await getDeals({
        page, limit: 20,
        search: debouncedSearch,
        stage: filterStage,
      });
      setDeals(res.data.data.deals);
      setPagination(res.data.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load deals");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterStage]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, filterStage]);

  const handleDealCreated = () => {
    fetchDeals();
  };

  const clearFilters = () => {
    setSearch(""); setFilterStage(""); setPage(1);
  };

  const hasFilters = search || filterStage;

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px, 2.5vw, 32px)", fontWeight: 720,
            letterSpacing: "-0.025em", color: "var(--text-primary)", marginBottom: 4 }}>
            Deals
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            {pagination.total > 0 ? `${pagination.total} total deal${pagination.total !== 1 ? "s" : ""}` : "Track and manage deals linked to leads."}
          </p>
        </div>
        {(user?.role === "sales" || user?.role === "manager" || user?.role === "superadmin") && (
          <button className="btn-primary" onClick={() => setShowModal(true)}
            style={{ height: 40, padding: "0 20px", fontSize: 13, gap: 6 }}>
            <Plus size={15} />
            Add Deal
          </button>
        )}
      </div>

      {/* Filters bar */}
      <div className="glass r-lg" style={{ padding: "14px 16px", marginBottom: 16,
        display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
          <Search size={14} strokeWidth={1.75} style={{ position: "absolute", left: 13,
            top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input className="input-glass" placeholder="Search deal ID, customerâ€¦"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36, height: 38, fontSize: 13 }} />
        </div>
        <PortalDropdown value={filterStage} onChange={setFilterStage}
          options={DEAL_STAGES} placeholder="All stages" style={{ flex: "0 0 170px" }} />
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="btn-ghost"
            style={{ height: 38, padding: "0 14px", fontSize: 12, gap: 5, flexShrink: 0 }}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="error-banner" style={{ marginBottom: 16 }}>
          <AlertCircle size={15} />{error}
        </div>
      )}

      {/* Table */}
      <div className="glass r-lg" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", textAlign: "left", borderBottom: "1px solid var(--glass-border)" }}>
              {["Deal ID", "Customer", "Stage", "Order Value", "GP %", "Commission", "Status", "Created"].map(h => (
                <th key={h} style={{ padding: "10px 14px", fontWeight: 600, fontSize: 11,
                  letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: "40px 14px", textAlign: "center",
                  color: "var(--text-muted)", fontSize: 13 }}>
                  Loadingâ€¦
                </td>
              </tr>
            ) : deals.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "40px 14px", textAlign: "center",
                  color: "var(--text-muted)", fontSize: 13 }}>
                  {hasFilters ? "No deals match your filters." : "No deals yet. Create your first deal."}
                </td>
              </tr>
            ) : (
              deals.map(deal => (
                <tr key={deal._id}
                  onClick={() => navigate(`/deals/${deal._id}`)}
                  style={{ borderTop: "1px solid var(--glass-border)", cursor: "pointer",
                    transition: "background 120ms ease" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--glass-bg-subtle)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{ fontWeight: 600, color: "var(--accent)", fontSize: 12, letterSpacing: "0.03em" }}>
                      {deal.dealId || "â€”"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{deal.customerName || "â€”"}</span>
                    {deal.leadId?.clientName && deal.customerName !== deal.leadId.clientName && (
                      <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                        Lead: {deal.leadId.clientName}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <Badge label={deal.stage} scheme={STAGE_COLORS[deal.stage]} />
                  </td>
                  <td style={{ padding: "11px 14px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    â‚¹{Number(deal.orderValue || 0).toLocaleString("en-IN")}
                  </td>
                  <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                    <span style={{ color: deal.grossProfitPct > 0 ? "#22c55e" : deal.grossProfitPct < 0 ? "#ef4444" : "var(--text-muted)",
                      fontWeight: 600 }}>
                      {deal.grossProfitPct != null ? `${deal.grossProfitPct}%` : "â€”"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 14px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    â‚¹{Number(deal.commissionAmount || 0).toLocaleString("en-IN")}
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <Badge label={deal.commissionStatus} scheme={COMMISSION_COLORS[deal.commissionStatus]} />
                  </td>
                  <td style={{ padding: "11px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {new Date(deal.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: 16, flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Page {pagination.page} of {pagination.pages} Â· {pagination.total} deals
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-ghost" disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              style={{ height: 34, padding: "0 14px", fontSize: 13, gap: 4 }}>
              <ChevronLeft size={14} /> Prev
            </button>
            <button className="btn-ghost" disabled={page >= pagination.pages}
              onClick={() => setPage(p => p + 1)}
              style={{ height: 34, padding: "0 14px", fontSize: 13, gap: 4 }}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Add Deal modal */}
      {showModal && (
        <AddDealModal
          onClose={() => setShowModal(false)}
          onCreated={handleDealCreated}
          currentUser={user}
        />
      )}
    </div>
  );
}

