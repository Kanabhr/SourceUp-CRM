import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, Check,
  Clock, MessageSquarePlus, Pencil, Trash2, X,
} from "lucide-react";
import { useAuth } from "../context/Authcontext";
import {
  addNote, deleteLead, getLeadById,
  getLeadHistory, updateLead,
  uploadLeadPhoto, removeLeadPhoto,
} from "../api/leadsApi.js";
import PortalDropdown from "../components/PortalDropdown.jsx";
import PhotoUpload from "../components/PhotoUpload.jsx";
import QuotationsPanel from "../components/QuotationsPanel.jsx";

// ─── Constants (mirrors backend) ─────────────────────────────────────────────

const STATUSES = ["Open", "In Progress", "Quotation Sent", "Closed Won", "Closed Lost"];
const SOURCES  = ["Website", "Phone", "Referral", "Other"];
const VERIFICATION = ["Unverified", "Verified", "Fraud"];
const BUSINESS_TYPES = ["D2C", "E-com", "B2B", "Other"];
const SERVICE_TYPES = ["Sourcing", "Packaging", "Website & IT", "Social Media", "Legal", "Investment", "Consultancy"];
const SOURCING_ORIGINS = ["India", "China", "Either"];

const STATUS_TRANSITIONS = {
  "Open":           ["In Progress", "Closed Lost"],
  "In Progress":    ["Quotation Sent", "Closed Lost"],
  "Quotation Sent": ["Closed Won", "Closed Lost"],
  "Closed Won":     [],
  "Closed Lost":    [],
};

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Badge({ label, scheme }) {
  const s = scheme || { bg: "rgb(255 255 255/0.06)", color: "var(--text-secondary)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 10px",
      borderRadius: 9999, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
      textTransform: "capitalize", whiteSpace: "nowrap",
      background: s.bg, color: s.color,
    }}>
      {label}
    </span>
  );
}

// ─── Status tracker strip ─────────────────────────────────────────────────────

function StatusTracker({ current }) {
  const activeIdx = STATUSES.indexOf(current);
  const isClosed  = current === "Closed Won" || current === "Closed Lost";
  // For the linear tracker, show the main pipeline (exclude Closed Lost from step line)
  const steps = ["Open", "In Progress", "Quotation Sent", "Closed Won"];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, width: "100%", flexWrap: "nowrap" }}>
      {steps.map((s, i) => {
        const isDone    = isClosed ? s !== "Closed Lost" && STATUSES.indexOf(s) <= activeIdx
                                   : STATUSES.indexOf(s) <= activeIdx;
        const isActive  = s === current;
        const isLast    = i === steps.length - 1;
        const col       = isActive ? STATUS_COLORS[s]?.color : isDone ? "#2dd4bf" : "var(--text-muted)";

        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: isLast ? "0 0 auto" : "1 1 auto" }}>
            {/* Step dot */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `2px solid ${col}`,
                background: isDone ? `${col}22` : "transparent",
                transition: "all 250ms ease",
              }}>
                {isDone && !isActive
                  ? <Check size={13} strokeWidth={2.5} color={col} />
                  : <div style={{ width: 8, height: 8, borderRadius: "50%",
                      background: isActive ? col : "transparent" }} />
                }
              </div>
              <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, color: col,
                whiteSpace: "nowrap", letterSpacing: "0.03em", textTransform: "uppercase" }}>
                {s}
              </span>
            </div>
            {/* Connector line */}
            {!isLast && (
              <div style={{ flex: 1, height: 2, marginBottom: 18,
                background: isDone && !isActive ? "#2dd4bf44" : "var(--glass-border)",
                transition: "background 250ms ease", minWidth: 16 }} />
            )}
          </div>
        );
      })}
      {/* Closed Lost pill — shown separately */}
      {current === "Closed Lost" && (
        <div style={{ marginLeft: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: `2px solid ${STATUS_COLORS["Closed Lost"].color}`,
            background: "rgb(239 68 68/0.15)" }}>
            <X size={13} strokeWidth={2.5} color={STATUS_COLORS["Closed Lost"].color} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.03em",
            textTransform: "uppercase", color: STATUS_COLORS["Closed Lost"].color }}>
            Closed Lost
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Editable field ───────────────────────────────────────────────────────────

function EditField({ label, value, onSave, type = "text", options, disabled }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);
  const [saving, setSaving]   = useState(false);

  const startEdit = () => { setDraft(value); setEditing(true); };
  const cancel    = () => setEditing(false);

  const save = async () => {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
          textTransform: "uppercase", color: "var(--text-secondary)" }}>{label}</span>
        {options ? (
          <PortalDropdown value={draft} onChange={setDraft} options={options} />
        ) : (
          <input className="input-glass" type={type} value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
            autoFocus style={{ height: 38, fontSize: 13 }} />
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn-primary" onClick={save} disabled={saving}
            style={{ height: 30, padding: "0 14px", fontSize: 12 }}>
            {saving ? "…" : "Save"}
          </button>
          <button className="btn-ghost" onClick={cancel}
            style={{ height: 30, padding: "0 12px", fontSize: 12 }}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
        textTransform: "uppercase", color: "var(--text-secondary)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 26 }}>
        <span style={{ fontSize: 13, color: value ? "var(--text-primary)" : "var(--text-muted)" }}>
          {value || "—"}
        </span>
        {!disabled && (
          <button type="button" onClick={startEdit} className="btn-icon"
            style={{ width: 22, height: 22, opacity: 0.5 }}
            title={`Edit ${label}`}>
            <Pencil size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Confirm delete modal ─────────────────────────────────────────────────────

function ConfirmDelete({ clientName, onConfirm, onCancel, deleting }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16,
      background: "rgb(0 0 0/0.65)", backdropFilter: "blur(4px)" }}>
      <div className="glass-strong r-xl" style={{ width: "100%", maxWidth: 400, padding: 28 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: "var(--text-primary)" }}>
          Delete Lead?
        </h3>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24 }}>
          This will permanently delete <strong style={{ color: "var(--text-primary)" }}>{clientName}</strong> and all its notes and history. This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn-ghost" onClick={onCancel}
            style={{ height: 38, padding: "0 18px", fontSize: 13 }}>Cancel</button>
          <button onClick={onConfirm} disabled={deleting}
            style={{ height: 38, padding: "0 18px", fontSize: 13, borderRadius: 9999,
              border: "1px solid rgb(239 68 68/0.5)", background: "rgb(239 68 68/0.15)",
              color: "#ef4444", fontFamily: "inherit", fontWeight: 600, cursor: "pointer" }}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LeadDetail() {
  const { id }   = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [lead, setLead]         = useState(null);
  const [history, setHistory]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [activeTab, setActiveTab] = useState("details"); // details | notes | history
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [noteError, setNoteError]   = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Status advance
  const [statusRemark, setStatusRemark] = useState("");
  const [advancingTo, setAdvancingTo]   = useState("");
  const [statusError, setStatusError]   = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [lostReasonInput, setLostReasonInput] = useState("");

  const canEdit   = user?.role === "sales" || user?.role === "superadmin";
  const canDelete = user?.role === "superadmin";
  const canHistory = user?.role === "manager" || user?.role === "superadmin";
  // canWrite for quotations: purchase, manager, superadmin can add/select/delete
  const canWrite  = user?.role === "purchase" || user?.role === "manager" || user?.role === "superadmin";

  // ── Load lead ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    getLeadById(id)
      .then(res => setLead(res.data.data))
      .catch(err => setError(err.response?.data?.message || "Lead not found"))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Load history (lazy, only when tab opened) ──────────────────────────────
  useEffect(() => {
    if (activeTab === "history" && canHistory && !history) {
      getLeadHistory(id)
        .then(res => setHistory(res.data.data))
        .catch(() => setHistory({ statusHistory: [], auditLog: [] }));
    }
  }, [activeTab, id, canHistory, history]);

  // ── Field update helper ────────────────────────────────────────────────────
  const patchField = async (patch) => {
    const res = await updateLead(id, patch);
    setLead(res.data.data);
  };

  // ── Reference photos (R1) ──────────────────────────────────────────────────
  // Upload/remove then refresh the whole lead so photos + any server state
  // stay in sync with what's on disk.
  const refreshLead = async () => {
    const res = await getLeadById(id);
    setLead(res.data.data);
  };

  const handlePhotoUpload = async (file) => {
    await uploadLeadPhoto(id, file);
    await refreshLead();
  };

  const handlePhotoRemove = async (index) => {
    await removeLeadPhoto(id, index);
    await refreshLead();
  };

  // ── Status advance ─────────────────────────────────────────────────────────
  const handleAdvanceStatus = async () => {
    if (!advancingTo) return;
    setStatusSaving(true); setStatusError("");
    try {
      const payload = { status: advancingTo, statusRemark };
      if (advancingTo === "Closed Lost" && lostReasonInput.trim()) {
        payload.lostReason = lostReasonInput.trim();
      }
      const res = await updateLead(id, payload);
      setLead(res.data.data);
      setAdvancingTo(""); setStatusRemark(""); setLostReasonInput("");
      // Refresh history if open
      if (activeTab === "history") {
        const h = await getLeadHistory(id);
        setHistory(h.data.data);
      }
    } catch (err) {
      setStatusError(err.response?.data?.message || "Could not update status");
    } finally {
      setStatusSaving(false);
    }
  };

  // ── Add note ───────────────────────────────────────────────────────────────
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) { setNoteError("Note cannot be empty"); return; }
    setAddingNote(true); setNoteError("");
    try {
      const res = await addNote(id, noteText.trim());
      setLead(prev => ({ ...prev, notes: res.data.data }));
      setNoteText("");
    } catch (err) {
      setNoteError(err.response?.data?.message || "Could not add note");
    } finally {
      setAddingNote(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteLead(id);
      navigate("/leads");
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // ── States ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
        height: 240, color: "var(--text-muted)", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div>
        <button onClick={() => navigate("/leads")} className="btn-ghost"
          style={{ height: 36, padding: "0 16px", fontSize: 13, gap: 6, marginBottom: 24 }}>
          <ArrowLeft size={14} /> Back
        </button>
        <div className="error-banner"><AlertCircle size={15} />{error || "Lead not found"}</div>
      </div>
    );
  }

  const allowedNextStatuses = STATUS_TRANSITIONS[lead.status] || [];

  // ── Section helpers ────────────────────────────────────────────────────────
  const sectionTitle = (text) => (
    <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>
      {text}
    </h3>
  );

  const tabStyle = (t) => ({
    padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
    border: "none", background: "transparent", fontFamily: "inherit",
    borderBottom: activeTab === t ? "2px solid var(--accent)" : "2px solid transparent",
    color: activeTab === t ? "var(--accent)" : "var(--text-secondary)",
    transition: "color 150ms, border-color 150ms",
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/leads")} className="btn-ghost"
            style={{ height: 34, padding: "0 14px", fontSize: 13, gap: 6 }}>
            <ArrowLeft size={14} /> Leads
          </button>
          <div>
            <h1 style={{ fontSize: "clamp(18px, 2vw, 26px)", fontWeight: 720,
              letterSpacing: "-0.02em", color: "var(--text-primary)", lineHeight: 1.2 }}>
              {lead.clientName}
            </h1>
            {lead.company && (
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{lead.company}</p>
            )}
            {lead.leadId && (
              <p style={{ fontSize: 11, color: "var(--accent)", marginTop: 2, fontWeight: 600, letterSpacing: "0.04em" }}>{lead.leadId}</p>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Badge label={lead.status} scheme={STATUS_COLORS[lead.status]} />
          <Badge label={lead.verificationStatus} scheme={VERIFICATION_COLORS[lead.verificationStatus]} />
          {canDelete && (
            <button onClick={() => setShowDeleteConfirm(true)} className="btn-icon"
              title="Delete lead" style={{ width: 34, height: 34, color: "#ef4444",
                borderColor: "rgb(239 68 68/0.3)", background: "rgb(239 68 68/0.08)" }}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Status tracker */}
      <div className="glass r-lg" style={{ padding: "20px 24px", marginBottom: 20 }}>
        <StatusTracker current={lead.status} />

        {/* Advance status */}
        {canEdit && allowedNextStatuses.length > 0 && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--glass-border)" }}>
            {sectionTitle("Advance Status")}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
              <PortalDropdown
                value={advancingTo}
                onChange={setAdvancingTo}
                options={allowedNextStatuses}
                placeholder="Move to…"
                style={{ flex: "0 0 180px" }}
              />
              <input className="input-glass" placeholder="Optional remark…"
                value={statusRemark} onChange={e => setStatusRemark(e.target.value)}
                style={{ flex: "1 1 200px", height: 48, fontSize: 13 }} />
              <button className="btn-primary" onClick={handleAdvanceStatus}
                disabled={!advancingTo || statusSaving}
                style={{ height: 48, padding: "0 20px", fontSize: 13 }}>
                {statusSaving ? "Saving…" : "Update"}
              </button>
            </div>
            {advancingTo === "Closed Lost" && (
              <div style={{ marginTop: 10 }}>
                <input className="input-glass" placeholder="Lost reason (why was this lead lost?)"
                  value={lostReasonInput} onChange={e => setLostReasonInput(e.target.value)}
                  style={{ width: "100%", height: 42, fontSize: 13 }} />
              </div>
            )}
            {statusError && (
              <div className="error-banner" style={{ marginTop: 10 }}>
                <AlertCircle size={14} />{statusError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--glass-border)", marginBottom: 16 }}>
        <button style={tabStyle("details")} onClick={() => setActiveTab("details")}>Details</button>
        <button style={tabStyle("notes")} onClick={() => setActiveTab("notes")}>
          Notes {lead.notes?.length > 0 && `(${lead.notes.length})`}
        </button>
        {canHistory && (
          <button style={tabStyle("history")} onClick={() => setActiveTab("history")}>History</button>
        )}
      </div>

      {/* ── Details tab ───────────────────────────────────────────────────── */}
      {activeTab === "details" && (
        <div style={{ display: "grid", gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>

          {/* Contact info */}
          <div className="glass r-lg" style={{ padding: 20 }}>
            {sectionTitle("Contact")}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <EditField label="Client Name" value={lead.clientName} disabled={!canEdit}
                onSave={v => patchField({ clientName: v })} />
              <EditField label="Company" value={lead.company} disabled={!canEdit}
                onSave={v => patchField({ company: v })} />
              <EditField label="Contact Person" value={lead.contactPerson} disabled={!canEdit}
                onSave={v => patchField({ contactPerson: v })} />
              <EditField label="Email" value={lead.email} type="email" disabled={!canEdit}
                onSave={v => patchField({ email: v })} />
              <EditField label="Phone" value={lead.phone} disabled={!canEdit}
                onSave={v => patchField({ phone: v })} />
            </div>
          </div>

          {/* Lead info */}
          <div className="glass r-lg" style={{ padding: 20 }}>
            {sectionTitle("Lead Info")}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <EditField label="Product Needed" value={lead.productNeeded} disabled={!canEdit}
                onSave={v => patchField({ productNeeded: v })} />
              <EditField label="Source" value={lead.source} disabled={!canEdit}
                options={SOURCES} onSave={v => patchField({ source: v })} />
              <EditField label="Cost / Lead (₹)" value={String(lead.costPerLead)} type="number" disabled={!canEdit}
                onSave={v => patchField({ costPerLead: v })} />
              <EditField label="Date" value={lead.date ? new Date(lead.date).toISOString().slice(0, 10) : ""}
                type="date" disabled={!canEdit} onSave={v => patchField({ date: v })} />
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
                  textTransform: "uppercase", color: "var(--text-secondary)" }}>Assigned To</span>
                <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
                  {lead.assignedTo?.username || "—"}
                  {lead.assignedTo?.role && (
                    <span style={{ color: "var(--text-muted)", fontSize: 11, marginLeft: 6 }}>
                      ({lead.assignedTo.role})
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Verification */}
          <div className="glass r-lg" style={{ padding: 20 }}>
            {sectionTitle("Verification")}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <EditField label="Status" value={lead.verificationStatus} disabled={!canEdit}
                options={VERIFICATION} onSave={v => patchField({ verificationStatus: v })} />
              <EditField label="Remarks" value={lead.verificationRemarks} disabled={!canEdit}
                onSave={v => patchField({ verificationRemarks: v })} />
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
                  textTransform: "uppercase", color: "var(--text-secondary)" }}>Created By</span>
                <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
                  {lead.createdBy?.username || "—"}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
                  textTransform: "uppercase", color: "var(--text-secondary)" }}>Created At</span>
                <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
                  {new Date(lead.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Extended info — Sprint 2 */}
          <div className="glass r-lg" style={{ padding: 20 }}>
            {sectionTitle("Extended Info")}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <EditField label="Business Type" value={lead.businessType || ""} disabled={!canEdit}
                options={BUSINESS_TYPES} onSave={v => patchField({ businessType: v })} />
              <EditField label="Service Type" value={lead.serviceType || ""} disabled={!canEdit}
                options={SERVICE_TYPES} onSave={v => patchField({ serviceType: v })} />
              <EditField label="Sourcing Origin" value={lead.sourcingOrigin || ""} disabled={!canEdit}
                options={SOURCING_ORIGINS} onSave={v => patchField({ sourcingOrigin: v })} />
              <EditField label="GST No" value={lead.gstNo || ""} disabled={!canEdit}
                onSave={v => patchField({ gstNo: v })} />
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
                  textTransform: "uppercase", color: "var(--text-secondary)" }}>Expected Order Value</span>
                <span style={{ fontSize: 13, color: lead.expectedOrderValue ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {lead.expectedOrderValue != null ? `\u20b9${Number(lead.expectedOrderValue).toLocaleString("en-IN")}` : "\u2014"}
                  {lead.expectedOrderValue != null && lead.expectedOrderValue < 100000 && (
                    <span style={{ color: "#fbbf24", fontSize: 11, marginLeft: 8 }}>\u26a0 Below \u20b91L</span>
                  )}
                </span>
              </div>
              <EditField label="Expected Order Value (\u20b9)" value={lead.expectedOrderValue != null ? String(lead.expectedOrderValue) : ""}
                type="number" disabled={!canEdit} onSave={v => patchField({ expectedOrderValue: v })} />
              <EditField label="Remarks" value={lead.remarks || ""} disabled={!canEdit}
                onSave={v => patchField({ remarks: v })} />
              {lead.nextFollowUpDate && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px",
                  borderRadius: 9999, background: "rgb(139 92 246/0.12)", color: "#8b5cf6",
                  fontSize: 11, fontWeight: 600 }}>
                  Next Follow-Up: {new Date(lead.nextFollowUpDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
              )}
              <EditField label="Next Follow-Up" value={lead.nextFollowUpDate ? new Date(lead.nextFollowUpDate).toISOString().slice(0, 10) : ""}
                type="date" disabled={!canEdit} onSave={v => patchField({ nextFollowUpDate: v })} />
              <EditField label="Last Contact" value={lead.lastContactDate ? new Date(lead.lastContactDate).toISOString().slice(0, 10) : ""}
                type="date" disabled={!canEdit} onSave={v => patchField({ lastContactDate: v })} />
              {lead.status === "Closed Lost" && (
                <EditField label="Lost Reason" value={lead.lostReason || ""} disabled={!canEdit}
                  onSave={v => patchField({ lostReason: v })} />
              )}
            </div>
          </div>

          {/* Procurement — R1 enrichment fields */}
          <div className="glass r-lg" style={{ padding: 20 }}>
            {sectionTitle("Procurement")}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <EditField label="Packing Details" value={lead.packingDetails || ""} disabled={!canEdit}
                onSave={v => patchField({ packingDetails: v })} />
              <EditField label="MOQ / Qty" value={lead.moq != null ? String(lead.moq) : ""} type="number"
                disabled={!canEdit} onSave={v => patchField({ moq: v })} />
              <EditField label="CBP (₹)" value={lead.cbp != null ? String(lead.cbp) : ""} type="number"
                disabled={!canEdit} onSave={v => patchField({ cbp: v })} />
              <EditField label="Target Price (₹)" value={lead.targetPrice != null ? String(lead.targetPrice) : ""} type="number"
                disabled={!canEdit} onSave={v => patchField({ targetPrice: v })} />
            </div>
          </div>

          {/* Reference photos — R1 */}
          <div className="glass r-lg" style={{ padding: 20, gridColumn: "1 / -1" }}>
            {sectionTitle("Reference Photos")}
            <PhotoUpload
              photos={lead.photos || []}
              canEdit={canEdit}
              onUpload={handlePhotoUpload}
              onRemove={handlePhotoRemove}
            />
          </div>

          {/* Quotations — R3 */}
          <div className="glass r-lg" style={{ padding: 20, gridColumn: "1 / -1" }}>
            {sectionTitle("Quotations")}
            <QuotationsPanel leadId={id} canWrite={canWrite} />
          </div>
        </div>
      )}

      {/* ── Notes tab ─────────────────────────────────────────────────────── */}
      {activeTab === "notes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Add note form */}
          <div className="glass r-lg" style={{ padding: 20 }}>
            <form onSubmit={handleAddNote} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <textarea
                className="input-glass"
                placeholder="Add a note…"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                rows={2}
                style={{ flex: 1, height: "auto", minHeight: 52, resize: "vertical",
                  padding: "12px 14px", fontSize: 13, lineHeight: 1.5 }}
              />
              <button type="submit" className="btn-primary" disabled={addingNote}
                style={{ height: 52, padding: "0 18px", fontSize: 13, gap: 6, flexShrink: 0 }}>
                <MessageSquarePlus size={15} />
                {addingNote ? "…" : "Add"}
              </button>
            </form>
            {noteError && (
              <div className="error-banner" style={{ marginTop: 10 }}>
                <AlertCircle size={14} />{noteError}
              </div>
            )}
          </div>

          {/* Notes list */}
          {lead.notes?.length === 0 ? (
            <div className="glass r-lg" style={{ padding: 24, textAlign: "center",
              color: "var(--text-muted)", fontSize: 13 }}>
              No notes yet.
            </div>
          ) : (
            [...(lead.notes || [])].reverse().map(note => (
              <div key={note._id} className="glass r-lg" style={{ padding: "14px 18px" }}>
                <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6,
                  marginBottom: 8, whiteSpace: "pre-wrap" }}>
                  {note.text}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Clock size={11} strokeWidth={1.75} color="var(--text-muted)" />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {note.addedBy?.username || "Unknown"} ·{" "}
                    {new Date(note.addedAt).toLocaleString("en-IN", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── History tab ───────────────────────────────────────────────────── */}
      {activeTab === "history" && canHistory && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {!history ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Loading history…
            </div>
          ) : (
            <>
              {/* Status history */}
              <div className="glass r-lg" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>
                  Status History
                </h3>
                {history.statusHistory?.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No status changes recorded.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {[...history.statusHistory].reverse().map((entry, i) => (
                      <div key={entry._id || i}
                        style={{ display: "flex", gap: 14, paddingBottom: 14,
                          borderLeft: "2px solid var(--glass-border)", paddingLeft: 16,
                          position: "relative", marginLeft: 6 }}>
                        <div style={{ position: "absolute", left: -6, top: 2,
                          width: 10, height: 10, borderRadius: "50%",
                          background: STATUS_COLORS[entry.status]?.color || "var(--accent)",
                          border: "2px solid var(--bg-deep)" }} />
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                            <Badge label={entry.status} scheme={STATUS_COLORS[entry.status]} />
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              by {entry.changedBy?.username || "Unknown"}
                            </span>
                          </div>
                          {entry.remark && (
                            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 3 }}>
                              {entry.remark}
                            </p>
                          )}
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {new Date(entry.changedAt).toLocaleString("en-IN", {
                              day: "2-digit", month: "short", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Audit log */}
              <div className="glass r-lg" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>
                  Audit Log
                </h3>
                {history.auditLog?.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No audit entries.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {history.auditLog.map((entry, i) => (
                      <div key={entry._id || i}
                        style={{ display: "flex", alignItems: "flex-start", gap: 12,
                          padding: "10px 14px", borderRadius: "var(--r-md)",
                          background: "var(--glass-bg-subtle)", fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: "var(--accent)",
                          background: "rgb(45 212 191/0.10)", padding: "2px 8px",
                          borderRadius: 9999, whiteSpace: "nowrap" }}>
                          {entry.action}
                        </span>
                        <span style={{ color: "var(--text-secondary)", flex: 1 }}>
                          by <strong style={{ color: "var(--text-primary)" }}>
                            {entry.userId?.username || "Unknown"}
                          </strong>
                        </span>
                        <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {new Date(entry.timestamp).toLocaleString("en-IN", {
                            day: "2-digit", month: "short", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <ConfirmDelete
          clientName={lead.clientName}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          deleting={deleting}
        />
      )}
    </div>
  );
}
