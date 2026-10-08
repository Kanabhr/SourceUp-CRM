import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, ChevronLeft, ChevronRight,
  Plus, Search, Upload, X, TriangleAlert,
} from "lucide-react";
import { useAuth } from "../context/Authcontext";
import { getLeads, createLead, getSalesUsers } from "../api/leadsApi.js";
import PortalDropdown from "../components/PortalDropdown.jsx";
import ImportLeadsModal from "../components/ImportLeadsModal.jsx";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUSES = ["Open", "In Progress", "Quotation Sent", "Closed Won", "Closed Lost"];
const SOURCES  = ["Website", "Phone", "Referral", "Other"];
const VERIFICATION = ["Unverified", "Verified", "Fraud"];

const STATUS_COLORS = {
  "Open":           { bg: "rgb(45 212 191 / 0.12)",  color: "#2dd4bf" },
  "In Progress":    { bg: "rgb(251 191 36 / 0.12)",  color: "#fbbf24" },
  "Quotation Sent": { bg: "rgb(139 92 246 / 0.12)",  color: "#8b5cf6" },
  "Closed Won":     { bg: "rgb(34 197 94 / 0.12)",   color: "#22c55e" },
  "Closed Lost":    { bg: "rgb(239 68 68 / 0.12)",   color: "#ef4444" },
};

const VERIFICATION_COLORS = {
  "Unverified": { bg: "rgb(255 255 255 / 0.06)", color: "var(--text-secondary)" },
  "Verified":   { bg: "rgb(34 197 94 / 0.12)",   color: "#22c55e" },
  "Fraud":      { bg: "rgb(239 68 68 / 0.12)",   color: "#ef4444" },
};

// ─── Small reusable components ───────────────────────────────────────────────

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

// ─── Add Lead Modal ───────────────────────────────────────────────────────────
function AddLeadModal({ onClose, onCreated, salesUsers, currentUser }) {
  const [form, setForm] = useState({
    clientName: "", company: "", contactPerson: "",
    email: "", phone: "", productNeeded: "",
    source: "Other", costPerLead: "",
    assignedTo: currentUser.role === "sales" ? currentUser._id : "",
    verificationStatus: "Unverified",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [warning, setWarning] = useState("");

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setV = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setWarning("");
    if (!form.clientName.trim()) { setError("Client name is required"); return; }
    if (!form.productNeeded.trim()) { setError("Product needed is required"); return; }
    if (!form.costPerLead || isNaN(Number(form.costPerLead)) || Number(form.costPerLead) <= 0) {
      setError("Cost per lead must be a positive number"); return;
    }
    setLoading(true);
    try {
      const res = await createLead(form);
      if (res.data.data.duplicateWarning) setWarning(res.data.data.duplicateWarning);
      onCreated(res.data.data.lead);
      if (!res.data.data.duplicateWarning) onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create lead");
    } finally {
      setLoading(false);
    }
  };

  // Close on backdrop click
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
        style={{ width: "100%", maxWidth: 560, maxHeight: "90dvh",
          overflowY: "auto", padding: 28 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Add Lead
          </h2>
          <button type="button" onClick={onClose} className="btn-icon" style={{ width: 32, height: 32 }}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Row 1 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Client Name *</label>
              <input className="input-glass" placeholder="Acme Corp" value={form.clientName} onChange={set("clientName")} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Company</label>
              <input className="input-glass" placeholder="Company Ltd." value={form.company} onChange={set("company")} />
            </div>
          </div>

          {/* Row 2 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Contact Person</label>
              <input className="input-glass" placeholder="John Doe" value={form.contactPerson} onChange={set("contactPerson")} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Product Needed *</label>
              <input className="input-glass" placeholder="e.g. Packaging boxes" value={form.productNeeded} onChange={set("productNeeded")} />
            </div>
          </div>

          {/* Row 3 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Email</label>
              <input className="input-glass" type="email" placeholder="client@email.com" value={form.email} onChange={set("email")} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Phone</label>
              <input className="input-glass" placeholder="+91 98765 43210" value={form.phone} onChange={set("phone")} />
            </div>
          </div>

          {/* Row 4 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Source</label>
              <PortalDropdown value={form.source} onChange={setV("source")} options={SOURCES} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Cost / Lead (₹) *</label>
              <input className="input-glass" type="number" min="0.01" step="0.01"
                placeholder="500" value={form.costPerLead} onChange={set("costPerLead")} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Verification</label>
              <PortalDropdown value={form.verificationStatus} onChange={setV("verificationStatus")} options={VERIFICATION} />
            </div>
          </div>

          {/* Assign to — superadmin/manager only */}
          {(currentUser.role === "superadmin" || currentUser.role === "manager") && salesUsers.length > 0 && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Assign To</label>
              <PortalDropdown
                value={form.assignedTo}
                onChange={setV("assignedTo")}
                options={salesUsers.map(u => ({ value: u._id, label: `${u.username} (${u.role})` }))}
                placeholder="Select salesperson"
              />
            </div>
          )}

          {warning && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px",
              borderRadius: "var(--r-md)", background: "rgb(251 191 36/0.10)",
              border: "1px solid rgb(251 191 36/0.28)", color: "#fbbf24", fontSize: 13 }}>
              <TriangleAlert size={15} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>{warning} Lead was still saved.</span>
              <button type="button" onClick={onClose}
                style={{ marginLeft: "auto", background: "none", border: "none",
                  color: "#fbbf24", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                Close
              </button>
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
              {loading ? "Saving…" : "Add Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Leads Page ──────────────────────────────────────────────────────────

export default function Leads() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [leads, setLeads]         = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [salesUsers, setSalesUsers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus]   = useState("");
  const [filterSource, setFilterSource]   = useState("");
  const [filterVerify, setFilterVerify]   = useState("");
  const [filterAssigned, setFilterAssigned] = useState("");
  const [page, setPage]               = useState(1);

  // Debounced search
  const searchTimer = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const fetchLeads = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await getLeads({
        page, limit: 20,
        search: debouncedSearch,
        status: filterStatus,
        source: filterSource,
        verificationStatus: filterVerify,
        assignedTo: filterAssigned,
      });
      setLeads(res.data.data.leads);
      setPagination(res.data.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterStatus, filterSource, filterVerify, filterAssigned]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Load sales users for assignee dropdown/filter (manager/superadmin only)
  useEffect(() => {
    if (user?.role === "superadmin" || user?.role === "manager") {
      getSalesUsers().then(setSalesUsers).catch(() => {});
    }
  }, [user]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, filterStatus, filterSource, filterVerify, filterAssigned]);

  const handleLeadCreated = (lead) => {
    setLeads(prev => [lead, ...prev]);
  };

  const clearFilters = () => {
    setSearch(""); setFilterStatus(""); setFilterSource("");
    setFilterVerify(""); setFilterAssigned(""); setPage(1);
  };

  const hasFilters = search || filterStatus || filterSource || filterVerify || filterAssigned;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "clamp(22px, 2.5vw, 32px)", fontWeight: 720,
            letterSpacing: "-0.025em", color: "var(--text-primary)", marginBottom: 4 }}>
            Leads
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            {pagination.total > 0 ? `${pagination.total} total lead${pagination.total !== 1 ? "s" : ""}` : "Track and manage sourcing leads."}
          </p>
        </div>
        {(user?.role === "sales" || user?.role === "superadmin") && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-ghost" onClick={() => setShowImport(true)}
              style={{ height: 40, padding: "0 16px", fontSize: 13, gap: 6 }}>
              <Upload size={14} />
              Import Excel
            </button>
            <button className="btn-primary" onClick={() => setShowModal(true)}
              style={{ height: 40, padding: "0 20px", fontSize: 13, gap: 6 }}>
              <Plus size={15} />
              Add Lead
            </button>
          </div>
        )}
      </div>

      {/* Filters bar */}
      <div className="glass r-lg" style={{ padding: "14px 16px", marginBottom: 16,
        display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
          <Search size={14} strokeWidth={1.75} style={{ position: "absolute", left: 13,
            top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input className="input-glass" placeholder="Search client, company, product…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36, height: 38, fontSize: 13 }} />
        </div>
        <PortalDropdown value={filterStatus} onChange={setFilterStatus}
          options={STATUSES} placeholder="All statuses" style={{ flex: "0 0 150px" }} />
        <PortalDropdown value={filterSource} onChange={setFilterSource}
          options={SOURCES} placeholder="All sources" style={{ flex: "0 0 130px" }} />
        <PortalDropdown value={filterVerify} onChange={setFilterVerify}
          options={VERIFICATION} placeholder="Verification" style={{ flex: "0 0 130px" }} />
        {(user?.role === "superadmin" || user?.role === "manager") && salesUsers.length > 0 && (
          <PortalDropdown
            value={filterAssigned}
            onChange={setFilterAssigned}
            options={salesUsers.map(u => ({ value: u._id, label: `${u.username} (${u.role})` }))}
            placeholder="All assignees"
            style={{ flex: "0 0 150px" }}
          />
        )}
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
              {["Client", "Product", "Source", "Assigned To", "Cost/Lead", "Status", "Verification", "Date"].map(h => (
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
                  Loading…
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "40px 14px", textAlign: "center",
                  color: "var(--text-muted)", fontSize: 13 }}>
                  {hasFilters ? "No leads match your filters." : "No leads yet. Add your first lead."}
                </td>
              </tr>
            ) : (
              leads.map(lead => (
                <tr key={lead._id}
                  onClick={() => navigate(`/leads/${lead._id}`)}
                  style={{ borderTop: "1px solid var(--glass-border)", cursor: "pointer",
                    transition: "background 120ms ease" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--glass-bg-subtle)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{lead.clientName}</span>
                    {lead.company && (
                      <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                        {lead.company}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "11px 14px", color: "var(--text-secondary)", maxWidth: 160,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {lead.productNeeded}
                  </td>
                  <td style={{ padding: "11px 14px", color: "var(--text-secondary)" }}>{lead.source}</td>
                  <td style={{ padding: "11px 14px", color: "var(--text-secondary)" }}>
                    {lead.assignedTo?.username || "—"}
                  </td>
                  <td style={{ padding: "11px 14px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    ₹{Number(lead.costPerLead).toLocaleString("en-IN")}
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <Badge label={lead.status} scheme={STATUS_COLORS[lead.status]} />
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <Badge label={lead.verificationStatus} scheme={VERIFICATION_COLORS[lead.verificationStatus]} />
                  </td>
                  <td style={{ padding: "11px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {new Date(lead.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
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
            Page {pagination.page} of {pagination.pages} · {pagination.total} leads
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

      {/* Add Lead modal */}
      {showModal && (
        <AddLeadModal
          onClose={() => setShowModal(false)}
          onCreated={handleLeadCreated}
          salesUsers={salesUsers}
          currentUser={user}
        />
      )}

      {/* Import from Excel modal */}
      {showImport && (
        <ImportLeadsModal
          onClose={() => setShowImport(false)}
          onImported={(count) => {
            setShowImport(false);
            if (count > 0) fetchLeads();
          }}
        />
      )}
    </div>
  );
}
