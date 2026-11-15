import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, Check, ExternalLink, Pencil, Trash2,
} from "lucide-react";
import { useAuth } from "../context/Authcontext";
import { getPOById, updatePO, deletePO } from "../api/purchaseApi.js";
import PortalDropdown from "../components/PortalDropdown.jsx";

// ─── Constants (mirrors backend) ────────────────────────────────────────────

const PO_STATUSES = [
  "PO Raised", "In Production", "QC",
  "Dispatched", "Received", "Closed",
];

const PO_STATUS_TRANSITIONS = {
  "PO Raised": ["In Production"],
  "In Production": ["QC"],
  "QC": ["Dispatched"],
  "Dispatched": ["Received"],
  "Received": ["Closed"],
  "Closed": [],
};

const VENDOR_COUNTRIES = ["India", "China", "Other"];
const PO_CURRENCIES = ["INR", "CNY", "USD"];
const QC_STATUSES = ["Pending", "Passed", "Failed"];

const STATUS_COLORS = {
  "PO Raised": { bg: "rgb(139 92 246 / 0.12)", color: "#8b5cf6" },
  "In Production": { bg: "rgb(251 146 60 / 0.12)", color: "#fb923c" },
  "QC": { bg: "rgb(251 191 36 / 0.12)", color: "#fbbf24" },
  "Dispatched": { bg: "rgb(168 85 247 / 0.12)", color: "#a855f7" },
  "Received": { bg: "rgb(34 197 94 / 0.12)", color: "#22c55e" },
  "Closed": { bg: "rgb(100 116 139 / 0.12)", color: "#94a3b8" },
};

const QC_COLORS = {
  Pending: { bg: "rgb(251 191 36 / 0.12)", color: "#fbbf24" },
  Passed: { bg: "rgb(34 197 94 / 0.12)", color: "#22c55e" },
  Failed: { bg: "rgb(239 68 68 / 0.12)", color: "#ef4444" },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Status tracker strip (exact pattern as DealDetail / LeadDetail) ─────────

function StatusTracker({ current }) {
  const activeIdx = PO_STATUSES.indexOf(current);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, width: "100%", flexWrap: "nowrap", overflowX: "auto", paddingBottom: 4 }}>
      {PO_STATUSES.map((s, i) => {
        const stageIdx = PO_STATUSES.indexOf(s);
        const isDone = stageIdx <= activeIdx;
        const isActive = s === current;
        const isLast = i === PO_STATUSES.length - 1;
        const col = isActive ? STATUS_COLORS[s]?.color : isDone ? "#2dd4bf" : "var(--text-muted)";

        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: isLast ? "0 0 auto" : "1 1 auto" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `2px solid ${col}`,
                background: isDone ? `${col}22` : "transparent",
                transition: "all 250ms ease",
              }}>
                {isDone && !isActive
                  ? <Check size={11} strokeWidth={2.5} color={col} />
                  : <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: isActive ? col : "transparent"
                  }} />
                }
              </div>
              <span style={{
                fontSize: 9, fontWeight: isActive ? 700 : 500, color: col,
                whiteSpace: "nowrap", letterSpacing: "0.03em", textTransform: "uppercase"
              }}>
                {s}
              </span>
            </div>
            {!isLast && (
              <div style={{
                flex: 1, height: 2, marginBottom: 14, minWidth: 20,
                background: isDone && !isActive ? "#2dd4bf44" : "var(--glass-border)",
                transition: "background 250ms ease",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Editable field ─────────────────────────────────────────────────────────

function EditField({ label, value, onSave, type = "text", options, disabled }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const startEdit = () => { setDraft(value); setEditing(true); };
  const cancel = () => setEditing(false);

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
        <span style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
          textTransform: "uppercase", color: "var(--text-secondary)"
        }}>{label}</span>
        {options ? (
          <PortalDropdown value={draft} onChange={setDraft} options={options} />
        ) : (
          <input className="input-glass" type={type} value={draft ?? ""}
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
      <span style={{
        fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
        textTransform: "uppercase", color: "var(--text-secondary)"
      }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 26 }}>
        <span style={{ fontSize: 13, color: value != null && value !== "" ? "var(--text-primary)" : "var(--text-muted)" }}>
          {value != null && value !== "" ? String(value) : "—"}
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

// ─── Auto-calculated display field ──────────────────────────────────────────

function AutoField({ label, value, prefix = "" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{
        fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
        textTransform: "uppercase", color: "var(--text-secondary)"
      }}>
        {label} <span style={{ fontSize: 9, color: "var(--text-muted)", fontStyle: "italic" }}>auto</span>
      </span>
      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)", minHeight: 26, display: "flex", alignItems: "center" }}>
        {prefix}{value != null ? value : "—"}
      </span>
    </div>
  );
}

// ─── Delete Confirm Modal ───────────────────────────────────────────────────

function DeleteModal({ poId, onConfirm, onCancel, deleting }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 400, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16,
      background: "rgb(0 0 0/0.6)", backdropFilter: "blur(4px)",
    }}>
      <div className="glass-strong r-xl" style={{ width: "100%", maxWidth: 400, padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
          Delete Purchase Order?
        </h3>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
          This will permanently delete PO <strong style={{ color: "var(--text-primary)" }}>{poId}</strong>.
          This action cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn-ghost" onClick={onCancel} style={{ height: 36, padding: "0 16px", fontSize: 13 }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting}
            style={{
              height: 36, padding: "0 16px", fontSize: 13, borderRadius: 9999,
              border: "1px solid rgb(239 68 68/0.5)", background: "rgb(239 68 68/0.15)",
              color: "#ef4444", fontWeight: 600, cursor: "pointer",
            }}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main PurchaseDetail Component ──────────────────────────────────────────

export default function PurchaseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("details"); // details | cost | dates | tracking | history

  // Status advance
  const [nextStatus, setNextStatus] = useState("");
  const [statusRemark, setStatusRemark] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");

  // Delete
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canEdit = user?.role === "superadmin" || user?.role === "manager";
  const canDelete = user?.role === "superadmin";

  // ── Load PO ────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    getPOById(id)
      .then(res => setPo(res.data.data))
      .catch(err => setError(err.response?.data?.message || "Purchase order not found"))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Save single field ──────────────────────────────────────────────────────
  const handleSaveField = async (path, val) => {
    try {
      let updatePayload;
      if (path.includes(".")) {
        const [parent, child] = path.split(".");
        updatePayload = { [parent]: { ...(po[parent] || {}), [child]: val } };
      } else {
        updatePayload = { [path]: val };
      }

      const res = await updatePO(id, updatePayload);
      setPo(res.data.data);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update field");
    }
  };

  // ── Advance status ─────────────────────────────────────────────────────────
  const handleAdvanceStatus = async () => {
    if (!nextStatus) return;
    setStatusSaving(true);
    setStatusError("");
    try {
      const res = await updatePO(id, {
        status: nextStatus,
        statusRemark: statusRemark.trim(),
      });
      setPo(res.data.data);
      setNextStatus("");
      setStatusRemark("");
    } catch (err) {
      setStatusError(err.response?.data?.message || "Failed to advance status");
    } finally {
      setStatusSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePO(id);
      navigate("/purchase", { replace: true });
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete PO");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px 24px", color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>
        Loading purchase order details…
      </div>
    );
  }

  if (error || !po) {
    return (
      <div style={{ padding: "40px 24px" }}>
        <button onClick={() => navigate("/purchase")} className="btn-ghost"
          style={{ height: 34, padding: "0 14px", fontSize: 13, gap: 6, marginBottom: 16 }}>
          <ArrowLeft size={14} /> Back to POs
        </button>
        <div className="error-banner">
          <AlertCircle size={15} />{error || "PO not found"}
        </div>
      </div>
    );
  }

  const allowedNext = PO_STATUS_TRANSITIONS[po.status] || [];
  const isChina = po.vendorCountry === "China";

  // Calculations for live breakdown view
  const q = po.qty || 1;
  const baseCost = (po.unitCost || 0) * (po.exchangeRate || 1);
  const pkgCostPerUnit = (po.packagingCost || 0) / q;
  const chinaOverhead = isChina
    ? ((po.freight || 0) + (po.customsDuty || 0) + (po.clearingCharges || 0) + (po.insurance || 0)) / q
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/purchase")} className="btn-ghost"
            style={{ width: 34, height: 34, padding: 0, justifyContent: "center" }}
            title="Back to Purchase Orders">
            <ArrowLeft size={15} />
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
                {po.poId || "Purchase Order"}
              </h1>
              <Badge label={po.status} scheme={STATUS_COLORS[po.status]} />
              <Badge label={po.vendorCountry} />
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Vendor: {po.vendorName || "—"} · Product: {po.product || "—"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Linked Deal Pill */}
          {po.dealId && (
            <button
              onClick={() => navigate(`/deals/${po.dealId._id || po.dealId}`)}
              className="btn-ghost"
              style={{
                height: 34, padding: "0 12px", fontSize: 12, gap: 6,
                color: "var(--accent)", border: "1px solid rgb(45 212 191/0.2)",
                background: "rgb(45 212 191/0.06)",
              }}>
              <ExternalLink size={12} />
              Deal: {po.dealId.dealId || "View Deal"}
            </button>
          )}

          {canDelete && (
            <button onClick={() => setShowDelete(true)} className="btn-ghost"
              style={{ height: 34, padding: "0 12px", fontSize: 12, gap: 5, color: "#ef4444" }}
              title="Delete Purchase Order">
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Status Tracker Card */}
      <div className="glass r-lg" style={{ padding: "20px 24px" }}>
        <StatusTracker current={po.status} />

        {/* Status advance actions */}
        {canEdit && allowedNext.length > 0 && (
          <div style={{
            marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--glass-border)",
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
              Advance status to:
            </span>
            <div style={{ width: 160 }}>
              <PortalDropdown
                value={nextStatus}
                onChange={setNextStatus}
                options={allowedNext.map(s => ({ value: s, label: s }))}
                placeholder="Select next status"
              />
            </div>
            {nextStatus && (
              <>
                <input className="input-glass"
                  placeholder="Optional remark"
                  value={statusRemark}
                  onChange={e => setStatusRemark(e.target.value)}
                  style={{ height: 34, fontSize: 12, flex: "1 1 200px" }} />
                <button className="btn-primary"
                  onClick={handleAdvanceStatus}
                  disabled={statusSaving}
                  style={{ height: 34, padding: "0 16px", fontSize: 12 }}>
                  {statusSaving ? "Updating…" : "Confirm"}
                </button>
              </>
            )}
            {statusError && (
              <span style={{ fontSize: 12, color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}>
                <AlertCircle size={13} /> {statusError}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--glass-border)" }}>
        {[
          { key: "details", label: "Details & Vendor" },
          { key: "cost", label: "Cost Breakdown" },
          { key: "dates", label: "Dates & Schedule" },
          { key: "tracking", label: "QC & Logistics" },
          { key: "history", label: `History (${po.statusHistory?.length || 0})` },
        ].map(t => (
          <button key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: "10px 18px", fontSize: 13, fontWeight: 600,
              background: "transparent", border: "none", cursor: "pointer",
              color: activeTab === t.key ? "var(--accent)" : "var(--text-secondary)",
              borderBottom: activeTab === t.key ? "2px solid var(--accent)" : "2px solid transparent",
              transition: "all 150ms ease",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Details & Vendor */}
      {activeTab === "details" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          {/* Vendor Details */}
          <div className="glass r-lg" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
              Vendor Information
            </h3>
            {po.vendorRef && (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
                  textTransform: "uppercase", color: "var(--text-secondary)"
                }}>Vendor Master Link</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => navigate("/vendors")}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px",
                      borderRadius: 9999, background: "rgb(45 212 191/0.10)", color: "var(--accent)",
                      border: "1px solid rgb(45 212 191/0.2)", cursor: "pointer",
                      fontSize: 12, fontWeight: 600, fontFamily: "inherit", width: "fit-content"
                    }}>
                    {po.vendorRef.vendorId || po.vendorRef.companyName}
                  </button>
                  {po.vendorRef.category && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>({po.vendorRef.category})</span>
                  )}
                </div>
              </div>
            )}
            <EditField label="Vendor Name" value={po.vendorName} disabled={!canEdit}
              onSave={v => handleSaveField("vendorName", v)} />
            <EditField label="Vendor Country" value={po.vendorCountry} disabled={!canEdit}
              options={VENDOR_COUNTRIES.map(c => ({ value: c, label: c }))}
              onSave={v => handleSaveField("vendorCountry", v)} />
            <EditField label="Vendor Contact" value={po.vendorContact} disabled={!canEdit}
              onSave={v => handleSaveField("vendorContact", v)} />
            <EditField label="Vendor Payment Terms" value={po.vendorPaymentTerms} disabled={!canEdit}
              onSave={v => handleSaveField("vendorPaymentTerms", v)} />
          </div>

          {/* Product & Order Details */}
          <div className="glass r-lg" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
              Product & Specifications
            </h3>
            <EditField label="Product" value={po.product} disabled={!canEdit}
              onSave={v => handleSaveField("product", v)} />
            <EditField label="Specifications" value={po.specs} disabled={!canEdit}
              onSave={v => handleSaveField("specs", v)} />
            <EditField label="Quantity" value={po.qty} type="number" disabled={!canEdit}
              onSave={v => handleSaveField("qty", Number(v))} />
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
                textTransform: "uppercase", color: "var(--text-secondary)"
              }}>Assigned To</span>
              <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
                {po.assignedTo?.username || "—"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Cost Breakdown Panel */}
      {activeTab === "cost" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div className="glass r-lg" style={{ padding: "16px 20px" }}>
              <AutoField label="Landed Cost / Unit" value={`₹${Number(po.landedCostPerUnit || 0).toLocaleString("en-IN")}`} />
            </div>
            <div className="glass r-lg" style={{ padding: "16px 20px" }}>
              <AutoField label="Total Landed Cost" value={`₹${Number(po.totalLandedCost || 0).toLocaleString("en-IN")}`} />
            </div>
            <div className="glass r-lg" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
                  textTransform: "uppercase", color: "var(--text-secondary)"
                }}>Base Unit Cost</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", minHeight: 26, display: "flex", alignItems: "center" }}>
                  {po.currency} {po.unitCost || 0}
                </span>
              </div>
            </div>
            <div className="glass r-lg" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
                  textTransform: "uppercase", color: "var(--text-secondary)"
                }}>Exchange Rate</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", minHeight: 26, display: "flex", alignItems: "center" }}>
                  {po.exchangeRate || 1}
                </span>
              </div>
            </div>
          </div>

          {/* Editable Cost Inputs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            {/* Primary Costs */}
            <div className="glass r-lg" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
                Base Purchase Costs
              </h3>
              <EditField label="Unit Cost" value={po.unitCost} type="number" disabled={!canEdit}
                onSave={v => handleSaveField("unitCost", Number(v))} />
              <EditField label="Currency" value={po.currency} disabled={!canEdit}
                options={PO_CURRENCIES.map(c => ({ value: c, label: c }))}
                onSave={v => handleSaveField("currency", v)} />
              <EditField label="Exchange Rate" value={po.exchangeRate} type="number" disabled={!canEdit}
                onSave={v => handleSaveField("exchangeRate", Number(v))} />
              <EditField label="Packaging Cost Total (₹)" value={po.packagingCost} type="number" disabled={!canEdit}
                onSave={v => handleSaveField("packagingCost", Number(v))} />
            </div>

            {/* China Specific Costs */}
            <div className="glass r-lg" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
                  Import & China Logistics Costs
                </h3>
                {isChina ? (
                  <span style={{ fontSize: 11, color: "#fb923c", fontWeight: 600, background: "rgb(251 146 60/0.1)", padding: "2px 8px", borderRadius: 9999 }}>
                    China Sourced
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Applies only when Vendor Country is China
                  </span>
                )}
              </div>

              {isChina ? (
                <>
                  <EditField label="Freight (₹)" value={po.freight} type="number" disabled={!canEdit}
                    onSave={v => handleSaveField("freight", Number(v))} />
                  <EditField label="Customs Duty (₹)" value={po.customsDuty} type="number" disabled={!canEdit}
                    onSave={v => handleSaveField("customsDuty", Number(v))} />
                  <EditField label="Clearing Charges (₹)" value={po.clearingCharges} type="number" disabled={!canEdit}
                    onSave={v => handleSaveField("clearingCharges", Number(v))} />
                  <EditField label="Insurance (₹)" value={po.insurance} type="number" disabled={!canEdit}
                    onSave={v => handleSaveField("insurance", Number(v))} />
                </>
              ) : (
                <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  Vendor country is {po.vendorCountry}. Change country to China in Details tab to enable import cost fields.
                </div>
              )}
            </div>
          </div>

          {/* Formula Breakdown Details */}
          <div className="glass r-lg" style={{ padding: 20 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: 12 }}>
              Landed Cost Formula Breakdown
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, fontSize: 13 }}>
              <div>
                <span style={{ color: "var(--text-muted)", display: "block", fontSize: 11 }}>Base in INR:</span>
                <span style={{ fontWeight: 600 }}>₹{Math.round(baseCost * 100) / 100} / unit</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)", display: "block", fontSize: 11 }}>Packaging / Unit:</span>
                <span style={{ fontWeight: 600 }}>₹{Math.round(pkgCostPerUnit * 100) / 100} / unit</span>
              </div>
              {isChina && (
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block", fontSize: 11 }}>Import Overhead / Unit:</span>
                  <span style={{ fontWeight: 600, color: "#fb923c" }}>₹{Math.round(chinaOverhead * 100) / 100} / unit</span>
                </div>
              )}
              <div>
                <span style={{ color: "var(--text-muted)", display: "block", fontSize: 11 }}>Total Landed / Unit:</span>
                <span style={{ fontWeight: 700, color: "var(--accent)" }}>₹{po.landedCostPerUnit || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Dates & Schedule */}
      {activeTab === "dates" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          <div className="glass r-lg" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
              Production Schedule
            </h3>
            <EditField label="Production Start"
              value={po.productionStart ? po.productionStart.split("T")[0] : ""}
              type="date" disabled={!canEdit}
              onSave={v => handleSaveField("productionStart", v || null)} />
            <EditField label="Ready Date"
              value={po.readyDate ? po.readyDate.split("T")[0] : ""}
              type="date" disabled={!canEdit}
              onSave={v => handleSaveField("readyDate", v || null)} />
          </div>

          <div className="glass r-lg" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
              Dispatch & Delivery
            </h3>
            <EditField label="Dispatch Date"
              value={po.dispatchDate ? po.dispatchDate.split("T")[0] : ""}
              type="date" disabled={!canEdit}
              onSave={v => handleSaveField("dispatchDate", v || null)} />
            <EditField label="ETA India"
              value={po.etaIndia ? po.etaIndia.split("T")[0] : ""}
              type="date" disabled={!canEdit}
              onSave={v => handleSaveField("etaIndia", v || null)} />
            <EditField label="Received Date"
              value={po.receivedDate ? po.receivedDate.split("T")[0] : ""}
              type="date" disabled={!canEdit}
              onSave={v => handleSaveField("receivedDate", v || null)} />
          </div>
        </div>
      )}

      {/* Tab 4: QC & Logistics */}
      {activeTab === "tracking" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          {/* QC Section */}
          <div className="glass r-lg" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
                Quality Control (QC)
              </h3>
              <Badge label={po.qcStatus || "Pending"} scheme={QC_COLORS[po.qcStatus || "Pending"]} />
            </div>
            <EditField label="QC Status" value={po.qcStatus} disabled={!canEdit}
              options={QC_STATUSES.map(s => ({ value: s, label: s }))}
              onSave={v => handleSaveField("qcStatus", v)} />
            <EditField label="QC Remarks" value={po.qcRemarks} disabled={!canEdit}
              onSave={v => handleSaveField("qcRemarks", v)} />
          </div>

          {/* Logistics & Tracking */}
          <div className="glass r-lg" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
              Shipping & Tracking Documents
            </h3>
            <EditField label="Bill of Lading (BL No.)" value={po.blNo} disabled={!canEdit}
              onSave={v => handleSaveField("blNo", v)} />
            <EditField label="Tracking No." value={po.trackingNo} disabled={!canEdit}
              onSave={v => handleSaveField("trackingNo", v)} />
          </div>

          {/* Payment Section */}
          <div className="glass r-lg" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
              Vendor Payment Tracking
            </h3>
            <EditField label="Advance Paid (₹)" value={po.advancePaid?.amount} type="number" disabled={!canEdit}
              onSave={v => handleSaveField("advancePaid.amount", Number(v))} />
            <EditField label="Advance Paid Date"
              value={po.advancePaid?.date ? po.advancePaid.date.split("T")[0] : ""}
              type="date" disabled={!canEdit}
              onSave={v => handleSaveField("advancePaid.date", v || null)} />
            <EditField label="Balance Paid (₹)" value={po.balancePaid?.amount} type="number" disabled={!canEdit}
              onSave={v => handleSaveField("balancePaid.amount", Number(v))} />
            <EditField label="Balance Paid Date"
              value={po.balancePaid?.date ? po.balancePaid.date.split("T")[0] : ""}
              type="date" disabled={!canEdit}
              onSave={v => handleSaveField("balancePaid.date", v || null)} />
          </div>
        </div>
      )}

      {/* Tab 5: Status History */}
      {activeTab === "history" && (
        <div className="glass r-lg" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary)", marginBottom: 16 }}>
            Status Progression History
          </h3>
          {(!po.statusHistory || po.statusHistory.length === 0) ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No status history recorded yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {po.statusHistory.map((h, idx) => (
                <div key={idx} style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "10px 14px", borderRadius: 8, background: "var(--glass-bg-subtle)",
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                    background: STATUS_COLORS[h.status]?.color || "var(--accent)",
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>
                        {h.status}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        by {h.changedBy?.username || "System"}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        · {new Date(h.changedAt).toLocaleString("en-IN")}
                      </span>
                    </div>
                    {h.remark && (
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                        {h.remark}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete modal */}
      {showDelete && (
        <DeleteModal
          poId={po.poId || "this PO"}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
          deleting={deleting}
        />
      )}
    </div>
  );
}
