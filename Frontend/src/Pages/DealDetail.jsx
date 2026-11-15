import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, Check, Download, Pencil, Trash2, X,
} from "lucide-react";
import { useAuth } from "../context/Authcontext";
import { getDealById, updateDeal, deleteDeal, downloadProformaPdf } from "../api/dealsApi.js";
import { getPOs } from "../api/purchaseApi.js";
import PortalDropdown from "../components/PortalDropdown.jsx";

// ─── Constants (mirrors backend) ────────────────────────────────────────────

const DEAL_STAGES = [
  "Quotation Sent", "Negotiation", "Sample",
  "Won", "Advance Received", "In Production",
  "Dispatched", "Delivered", "Closed", "Lost",
];

const DEAL_STAGE_TRANSITIONS = {
  "Quotation Sent": ["Negotiation", "Sample", "Won", "Lost"],
  "Negotiation": ["Sample", "Won", "Lost"],
  "Sample": ["Negotiation", "Won", "Lost"],
  "Won": ["Advance Received", "Lost"],
  "Advance Received": ["In Production", "Lost"],
  "In Production": ["Dispatched", "Lost"],
  "Dispatched": ["Delivered", "Lost"],
  "Delivered": ["Closed"],
  "Closed": [],
  "Lost": ["Quotation Sent", "Negotiation"],
};

const STAGE_COLORS = {
  "Quotation Sent": { bg: "rgb(139 92 246 / 0.12)", color: "#8b5cf6" },
  "Negotiation": { bg: "rgb(251 191 36 / 0.12)", color: "#fbbf24" },
  "Sample": { bg: "rgb(96 165 250 / 0.12)", color: "#60a5fa" },
  "Won": { bg: "rgb(34 197 94 / 0.12)", color: "#22c55e" },
  "Advance Received": { bg: "rgb(45 212 191 / 0.12)", color: "#2dd4bf" },
  "In Production": { bg: "rgb(251 146 60 / 0.12)", color: "#fb923c" },
  "Dispatched": { bg: "rgb(168 85 247 / 0.12)", color: "#a855f7" },
  "Delivered": { bg: "rgb(34 197 94 / 0.12)", color: "#22c55e" },
  "Closed": { bg: "rgb(100 116 139 / 0.12)", color: "#94a3b8" },
  "Lost": { bg: "rgb(239 68 68 / 0.12)", color: "#ef4444" },
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

// ─── Stage tracker strip (same pattern as LeadDetail StatusTracker) ──────────

function StageTracker({ current }) {
  const mainSteps = [
    "Quotation Sent", "Negotiation", "Sample", "Won",
    "Advance Received", "In Production", "Dispatched", "Delivered", "Closed",
  ];
  const activeIdx = DEAL_STAGES.indexOf(current);
  const isLost = current === "Lost";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, width: "100%", flexWrap: "nowrap", overflowX: "auto", paddingBottom: 4 }}>
      {mainSteps.map((s, i) => {
        const stageIdx = DEAL_STAGES.indexOf(s);
        const isDone = isLost ? false : stageIdx <= activeIdx;
        const isActive = s === current;
        const isLast = i === mainSteps.length - 1;
        const col = isActive ? STAGE_COLORS[s]?.color : isDone ? "#2dd4bf" : "var(--text-muted)";

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
                flex: 1, height: 2, marginBottom: 18,
                background: isDone && !isActive ? "#2dd4bf44" : "var(--glass-border)",
                transition: "background 250ms ease", minWidth: 10
              }} />
            )}
          </div>
        );
      })}
      {/* Lost pill */}
      {isLost && (
        <div style={{ marginLeft: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: `2px solid ${STAGE_COLORS.Lost.color}`,
            background: "rgb(239 68 68/0.15)"
          }}>
            <X size={11} strokeWidth={2.5} color={STAGE_COLORS.Lost.color} />
          </div>
          <span style={{
            fontSize: 9, fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.03em",
            textTransform: "uppercase", color: STAGE_COLORS.Lost.color
          }}>
            Lost
          </span>
        </div>
      )}
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
      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
        {prefix}{typeof value === "number" ? value.toLocaleString("en-IN") : value || "—"}
      </span>
    </div>
  );
}

// ─── Confirm delete modal ───────────────────────────────────────────────────

function ConfirmDelete({ name, onConfirm, onCancel, deleting }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 400, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16,
      background: "rgb(0 0 0/0.65)", backdropFilter: "blur(4px)"
    }}>
      <div className="glass-strong r-xl" style={{ width: "100%", maxWidth: 400, padding: 28 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: "var(--text-primary)" }}>
          Delete Deal?
        </h3>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24 }}>
          This will permanently delete <strong style={{ color: "var(--text-primary)" }}>{name}</strong> and all its history. This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn-ghost" onClick={onCancel}
            style={{ height: 38, padding: "0 18px", fontSize: 13 }}>Cancel</button>
          <button onClick={onConfirm} disabled={deleting}
            style={{
              height: 38, padding: "0 18px", fontSize: 13, borderRadius: 9999,
              border: "1px solid rgb(239 68 68/0.5)", background: "rgb(239 68 68/0.15)",
              color: "#ef4444", fontFamily: "inherit", fontWeight: 600, cursor: "pointer"
            }}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function DealDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("details"); // details | history
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Stage advance
  const [stageRemark, setStageRemark] = useState("");
  const [advancingTo, setAdvancingTo] = useState("");
  const [stageError, setStageError] = useState("");
  const [stageSaving, setStageSaving] = useState(false);

  const [linkedPOs, setLinkedPOs] = useState([]);
  const [poError, setPoError] = useState("");

  const canEdit = user?.role === "sales" || user?.role === "manager" || user?.role === "superadmin";
  const canDelete = user?.role === "superadmin";

  // ── Load deal & linked POs ────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    getDealById(id)
      .then(res => setDeal(res.data.data))
      .catch(err => setError(err.response?.data?.message || "Deal not found"))
      .finally(() => setLoading(false));
  }, [id]);

  // Load linked POs (only once the deal is available)
  useEffect(() => {
    if (!deal) return;
    setPoError("");
    getPOs({ dealId: id })
      .then(poRes => {
        if (poRes?.data?.data?.purchases) {
          setLinkedPOs(poRes.data.data.purchases);
        }
      })
      .catch(() => setPoError("Could not load linked POs"));
  }, [id, deal]);

  // ── Field update helper ────────────────────────────────────────────────────
  const patchField = async (patch) => {
    try {
      const res = await updateDeal(id, patch);
      setDeal(res.data.data);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update deal");
    }
  };

  // ── Stage advance ─────────────────────────────────────────────────────────
  const handleAdvanceStage = async () => {
    if (!advancingTo) return;
    setStageSaving(true); setStageError("");
    try {
      const res = await updateDeal(id, { stage: advancingTo, stageRemark });
      setDeal(res.data.data);
      setAdvancingTo(""); setStageRemark("");
    } catch (err) {
      setStageError(err.response?.data?.message || "Could not update stage");
    } finally {
      setStageSaving(false);
    }
  };

  // ── Commission toggle ────────────────────────────────────────────────────
  const handleToggleCommission = async () => {
    if (deal.commissionStatus === "Paid") return;
    try {
      const res = await updateDeal(id, { commissionStatus: "Paid" });
      setDeal(res.data.data);
    } catch (err) {
      setStageError(err.response?.data?.message || "Could not update commission");
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDeal(id);
      navigate("/deals");
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // ── Download Proforma Invoice PDF ────────────────────────────────────────
  const handleDownloadPI = async () => {
    try {
      const res = await downloadProformaPdf(id);
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PI-${deal.dealId || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent — blob errors are uncommon for PDF
    }
  };

  // ── States ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: 240, color: "var(--text-muted)", fontSize: 14
      }}>
        Loading…
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div>
        <button onClick={() => navigate("/deals")} className="btn-ghost"
          style={{ height: 36, padding: "0 16px", fontSize: 13, gap: 6, marginBottom: 24 }}>
          <ArrowLeft size={14} /> Back
        </button>
        <div className="error-banner"><AlertCircle size={15} />{error || "Deal not found"}</div>
      </div>
    );
  }

  const allowedNextStages = DEAL_STAGE_TRANSITIONS[deal.stage] || [];

  const sectionTitle = (text) => (
    <h3 style={{
      fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14
    }}>
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

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const fmtCurrency = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12, marginBottom: 24
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/deals")} className="btn-ghost"
            style={{ height: 34, padding: "0 14px", fontSize: 13, gap: 6 }}>
            <ArrowLeft size={14} /> Deals
          </button>
          <div>
            <h1 style={{
              fontSize: "clamp(18px, 2vw, 26px)", fontWeight: 720,
              letterSpacing: "-0.02em", color: "var(--text-primary)", lineHeight: 1.2
            }}>
              {deal.customerName || "Untitled Deal"}
            </h1>
            {deal.dealId && (
              <p style={{ fontSize: 11, color: "var(--accent)", marginTop: 2, fontWeight: 600, letterSpacing: "0.04em" }}>
                {deal.dealId}
              </p>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Badge label={deal.stage} scheme={STAGE_COLORS[deal.stage]} />
          <button onClick={handleDownloadPI} className="btn-ghost"
            title="Download Proforma Invoice" style={{
              height: 34, padding: "0 14px", fontSize: 12, gap: 6,
              color: "var(--accent)", borderColor: "rgb(45 212 191 / 0.3)"
            }}>
            <Download size={13} /> PI
          </button>
          {canDelete && (
            <button onClick={() => setShowDeleteConfirm(true)} className="btn-icon"
              title="Delete deal" style={{
                width: 34, height: 34, color: "#ef4444",
                borderColor: "rgb(239 68 68/0.3)", background: "rgb(239 68 68/0.08)"
              }}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Stage tracker */}
      <div className="glass r-lg" style={{ padding: "20px 24px", marginBottom: 20 }}>
        <StageTracker current={deal.stage} />

        {/* Advance stage */}
        {canEdit && allowedNextStages.length > 0 && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--glass-border)" }}>
            {sectionTitle("Advance Stage")}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
              <PortalDropdown
                value={advancingTo}
                onChange={setAdvancingTo}
                options={allowedNextStages}
                placeholder="Move to…"
                style={{ flex: "0 0 180px" }}
              />
              <input className="input-glass" placeholder="Optional remark…"
                value={stageRemark} onChange={e => setStageRemark(e.target.value)}
                style={{ flex: "1 1 200px", height: 48, fontSize: 13 }} />
              <button className="btn-primary" onClick={handleAdvanceStage}
                disabled={!advancingTo || stageSaving}
                style={{ height: 48, padding: "0 20px", fontSize: 13 }}>
                {stageSaving ? "Saving…" : "Update"}
              </button>
            </div>
            {stageError && (
              <div className="error-banner" style={{ marginTop: 10 }}>
                <AlertCircle size={14} />{stageError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--glass-border)", marginBottom: 16 }}>
        <button style={tabStyle("details")} onClick={() => setActiveTab("details")}>Details</button>
        <button style={tabStyle("history")} onClick={() => setActiveTab("history")}>
          History {deal.stageHistory?.length > 0 && `(${deal.stageHistory.length})`}
        </button>
      </div>

      {/* ── Details tab ────────────────────────────────────────────────── */}
      {activeTab === "details" && (
        <div style={{
          display: "grid", gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))"
        }}>

          {/* Pricing & Financials */}
          <div className="glass r-lg" style={{ padding: 20 }}>
            {sectionTitle("Pricing & Costs")}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <EditField label="Selling Price / Unit (₹)" value={deal.sellingPricePerUnit != null ? String(deal.sellingPricePerUnit) : ""}
                type="number" disabled={!canEdit} onSave={v => patchField({ sellingPricePerUnit: v })} />
              <EditField label="Quantity" value={deal.qty != null ? String(deal.qty) : ""}
                type="number" disabled={!canEdit} onSave={v => patchField({ qty: v })} />
              <AutoField label="Order Value" value={deal.orderValue} prefix="₹" />
              <EditField label="Buying Cost / Unit (₹)" value={deal.buyingCost != null ? String(deal.buyingCost) : ""}
                type="number" disabled={!canEdit} onSave={v => patchField({ buyingCost: v })} />
              <AutoField label="Landed Cost / Unit" value={deal.landedCost} prefix="₹" />
              <AutoField label="Gross Profit" value={deal.grossProfit} prefix="₹" />
              <AutoField label="GP %" value={deal.grossProfitPct != null ? `${deal.grossProfitPct}%` : "—"} />
            </div>
          </div>

          {/* Commission */}
          <div className="glass r-lg" style={{ padding: 20 }}>
            {sectionTitle("Commission")}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <EditField label="Commission %" value={deal.commissionPct != null ? String(deal.commissionPct) : ""}
                type="number" disabled={!canEdit} onSave={v => patchField({ commissionPct: v })} />
              <AutoField label="Commission Amount" value={deal.commissionAmount} prefix="₹" />
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
                  textTransform: "uppercase", color: "var(--text-secondary)"
                }}>Commission Status</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <EditField
                    label=""
                    value={deal.commissionStatus || "Pending"}
                    options={[{ value: "Pending", label: "Pending" }, { value: "Paid", label: "Paid" }]}
                    disabled={!canEdit}
                    onSave={v => patchField({ commissionStatus: v })}
                  />
                  {canEdit && deal.commissionStatus === "Pending" && (
                    <button className="btn-primary" onClick={handleToggleCommission}
                      style={{ height: 28, padding: "0 14px", fontSize: 11, gap: 4 }}>
                      Mark Paid
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Deal Info */}
          <div className="glass r-lg" style={{ padding: 20 }}>
            {sectionTitle("Deal Info")}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <EditField label="Customer Name" value={deal.customerName || ""} disabled={!canEdit}
                onSave={v => patchField({ customerName: v })} />
              <EditField label="Quotation No" value={deal.quotationNo || ""} disabled={!canEdit}
                onSave={v => patchField({ quotationNo: v })} />
              <EditField label="PI No" value={deal.piNo || ""} disabled={!canEdit}
                onSave={v => patchField({ piNo: v })} />
              <EditField label="Invoice No" value={deal.invoiceNo || ""} disabled={!canEdit}
                onSave={v => patchField({ invoiceNo: v })} />

              {/* Linked Lead chip */}
              {deal.leadId && (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
                    textTransform: "uppercase", color: "var(--text-secondary)"
                  }}>Linked Lead</span>
                  <button onClick={() => navigate(`/leads/${deal.leadId._id || deal.leadId}`)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px",
                      borderRadius: 9999, background: "rgb(45 212 191/0.10)", color: "var(--accent)",
                      border: "1px solid rgb(45 212 191/0.2)", cursor: "pointer",
                      fontSize: 12, fontWeight: 600, fontFamily: "inherit", width: "fit-content"
                    }}>
                    {deal.leadId?.leadId || deal.leadId?.clientName || "View Lead"}
                  </button>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
                  textTransform: "uppercase", color: "var(--text-secondary)"
                }}>Sales Rep</span>
                <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
                  {deal.salesRep?.username || "—"}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
                  textTransform: "uppercase", color: "var(--text-secondary)"
                }}>Created By</span>
                <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
                  {deal.createdBy?.username || "—"} · {fmtDate(deal.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="glass r-lg" style={{ padding: 20 }}>
            {sectionTitle("Dates")}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <EditField label="Quotation Date" value={deal.quotationDate ? new Date(deal.quotationDate).toISOString().slice(0, 10) : ""}
                type="date" disabled={!canEdit} onSave={v => patchField({ quotationDate: v })} />
              <EditField label="Order Confirm Date" value={deal.orderConfirmDate ? new Date(deal.orderConfirmDate).toISOString().slice(0, 10) : ""}
                type="date" disabled={!canEdit} onSave={v => patchField({ orderConfirmDate: v })} />
              <EditField label="Expected Delivery" value={deal.expectedDelivery ? new Date(deal.expectedDelivery).toISOString().slice(0, 10) : ""}
                type="date" disabled={!canEdit} onSave={v => patchField({ expectedDelivery: v })} />
              <EditField label="Actual Delivery" value={deal.actualDelivery ? new Date(deal.actualDelivery).toISOString().slice(0, 10) : ""}
                type="date" disabled={!canEdit} onSave={v => patchField({ actualDelivery: v })} />
            </div>
          </div>

          {/* Sample Tracking */}
          <div className="glass r-lg" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              {sectionTitle("Sample Tracking")}
              <Badge
                label={!deal.sample?.required ? "Not Required" : deal.sample?.approved ? "Approved" : deal.sample?.sentDate ? "Sent" : "Pending"}
                scheme={
                  !deal.sample?.required
                    ? { bg: "rgb(100 116 139/0.12)", color: "#94a3b8" }
                    : deal.sample?.approved
                      ? { bg: "rgb(34 197 94/0.12)", color: "#22c55e" }
                      : deal.sample?.sentDate
                        ? { bg: "rgb(96 165 250/0.12)", color: "#60a5fa" }
                        : { bg: "rgb(251 191 36/0.12)", color: "#fbbf24" }
                }
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <EditField
                label="Sample Required"
                value={deal.sample?.required ? "Yes" : "No"}
                options={[{ value: "Yes", label: "Yes" }, { value: "No", label: "No" }]}
                disabled={!canEdit}
                onSave={v => patchField({ sample: { ...(deal.sample || {}), required: v === "Yes" } })}
              />
              <EditField
                label="Sample Sent Date"
                value={deal.sample?.sentDate ? new Date(deal.sample.sentDate).toISOString().slice(0, 10) : ""}
                type="date"
                disabled={!canEdit || !deal.sample?.required}
                onSave={v => patchField({ sample: { ...(deal.sample || {}), sentDate: v || null } })}
              />
              <EditField
                label="Sample Approved"
                value={deal.sample?.approved ? "Yes" : "No"}
                options={[{ value: "Yes", label: "Yes" }, { value: "No", label: "No" }]}
                disabled={!canEdit || !deal.sample?.required}
                onSave={v => patchField({ sample: { ...(deal.sample || {}), approved: v === "Yes" } })}
              />
            </div>
          </div>

          {/* Payment Tracking (Advance 70% / Balance 30%) */}
          <div className="glass r-lg" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              {sectionTitle("Payment Tracking")}
              {(() => {
                const totalPaid = (deal.advance?.amount || 0) + (deal.balance?.amount || 0);
                const orderVal = deal.orderValue || 0;
                const isPaidFull = orderVal > 0 && totalPaid >= orderVal;
                const isPartial = totalPaid > 0 && !isPaidFull;
                return (
                  <Badge
                    label={isPaidFull ? "Paid in Full" : isPartial ? "Partially Paid" : "Unpaid"}
                    scheme={
                      isPaidFull
                        ? { bg: "rgb(34 197 94/0.12)", color: "#22c55e" }
                        : isPartial
                          ? { bg: "rgb(45 212 191/0.12)", color: "#2dd4bf" }
                          : { bg: "rgb(251 191 36/0.12)", color: "#fbbf24" }
                    }
                  />
                );
              })()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Advance 70% */}
              <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--glass-bg-subtle)", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                    Advance (70%)
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Target: ₹{Math.round((deal.orderValue || 0) * 0.7).toLocaleString("en-IN")}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => patchField({ advance: { ...(deal.advance || {}), amount: Math.round((deal.orderValue || 0) * 0.7) } })}
                        style={{
                          fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 9999,
                          border: "1px solid rgb(45 212 191/0.3)", background: "rgb(45 212 191/0.1)",
                          color: "var(--accent)", cursor: "pointer", fontFamily: "inherit",
                        }}>
                        Set 70%
                      </button>
                    )}
                  </div>
                </div>
                <EditField
                  label="Advance Amount (₹)"
                  value={deal.advance?.amount != null ? String(deal.advance.amount) : "0"}
                  type="number"
                  disabled={!canEdit}
                  onSave={v => patchField({ advance: { ...(deal.advance || {}), amount: Number(v) || 0 } })}
                />
                <EditField
                  label="Advance Received Date"
                  value={deal.advance?.receivedDate ? new Date(deal.advance.receivedDate).toISOString().slice(0, 10) : ""}
                  type="date"
                  disabled={!canEdit}
                  onSave={v => patchField({ advance: { ...(deal.advance || {}), receivedDate: v || null } })}
                />
              </div>

              {/* Balance 30% */}
              <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--glass-bg-subtle)", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                    Balance (30%)
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Target: ₹{Math.round((deal.orderValue || 0) * 0.3).toLocaleString("en-IN")}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => patchField({ balance: { ...(deal.balance || {}), amount: Math.round((deal.orderValue || 0) * 0.3) } })}
                        style={{
                          fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 9999,
                          border: "1px solid rgb(45 212 191/0.3)", background: "rgb(45 212 191/0.1)",
                          color: "var(--accent)", cursor: "pointer", fontFamily: "inherit",
                        }}>
                        Set 30%
                      </button>
                    )}
                  </div>
                </div>
                <EditField
                  label="Balance Amount (₹)"
                  value={deal.balance?.amount != null ? String(deal.balance.amount) : "0"}
                  type="number"
                  disabled={!canEdit}
                  onSave={v => patchField({ balance: { ...(deal.balance || {}), amount: Number(v) || 0 } })}
                />
                <EditField
                  label="Due Trigger"
                  value={deal.balance?.dueTrigger || ""}
                  options={[
                    { value: "Dispatch", label: "Dispatch (India / Domestic)" },
                    { value: "Reaching India", label: "Reaching India (China / Import)" },
                  ]}
                  disabled={!canEdit}
                  onSave={v => patchField({ balance: { ...(deal.balance || {}), dueTrigger: v } })}
                />
                <EditField
                  label="Balance Received Date"
                  value={deal.balance?.receivedDate ? new Date(deal.balance.receivedDate).toISOString().slice(0, 10) : ""}
                  type="date"
                  disabled={!canEdit}
                  onSave={v => patchField({ balance: { ...(deal.balance || {}), receivedDate: v || null } })}
                />
              </div>

              {/* Summary */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12, marginTop: 4 }}>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block", fontSize: 10, textTransform: "uppercase" }}>Total Received</span>
                  <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: 14 }}>
                    ₹{((deal.advance?.amount || 0) + (deal.balance?.amount || 0)).toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block", fontSize: 10, textTransform: "uppercase" }}>Pending Balance</span>
                  <span style={{ fontWeight: 700, color: (deal.orderValue || 0) - ((deal.advance?.amount || 0) + (deal.balance?.amount || 0)) > 0 ? "#fbbf24" : "#22c55e", fontSize: 14 }}>
                    ₹{Math.max(0, (deal.orderValue || 0) - ((deal.advance?.amount || 0) + (deal.balance?.amount || 0))).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Linked Purchase Orders (Procurement) */}
          <div className="glass r-lg" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              {sectionTitle("Procurement & Purchase Orders")}
              <Badge
                label={linkedPOs.length > 0 ? `${linkedPOs.length} PO Raised` : "No PO Raised"}
                scheme={
                  linkedPOs.length > 0
                    ? { bg: "rgb(34 197 94/0.12)", color: "#22c55e" }
                    : { bg: "rgb(251 191 36/0.12)", color: "#fbbf24" }
                }
              />
            </div>
            {poError && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
                marginBottom: 14, borderRadius: 8,
                background: "rgb(239 68 68 / 0.12)", border: "1px solid rgb(239 68 68 / 0.25)",
                color: "#f87171", fontSize: 13,
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                {poError}
              </div>
            )}
            {linkedPOs.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px 16px", borderRadius: 8, background: "var(--glass-bg-subtle)" }}>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  No Purchase Order linked yet. Landed cost will automatically update when a PO is created for this deal.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/purchase")}
                  className="btn-primary"
                  style={{ height: 32, padding: "0 14px", fontSize: 12, width: "fit-content", gap: 6 }}>
                  Go to Purchase
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {linkedPOs.map(po => (
                  <div
                    key={po._id}
                    onClick={() => navigate("/purchase")}
                    style={{
                      padding: "12px 14px", borderRadius: 8, background: "var(--glass-bg-subtle)",
                      border: "1px solid var(--glass-border)", cursor: "pointer",
                      display: "flex", flexDirection: "column", gap: 6, transition: "background 150ms ease",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--glass-bg)"}
                    onMouseLeave={e => e.currentTarget.style.background = "var(--glass-bg-subtle)"}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: 13 }}>
                        {po.poId}
                      </span>
                      <span style={{
                        display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 9999,
                        fontSize: 10, fontWeight: 600, background: "rgb(45 212 191/0.12)", color: "#2dd4bf",
                      }}>
                        {po.status}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)" }}>
                      <span>Vendor: {po.vendorName || "—"} ({po.vendorCountry || "India"})</span>
                      <span>Landed: ₹{Number(po.landedCostPerUnit || 0).toLocaleString("en-IN")}/u</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── History tab ────────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <div className="glass r-lg" style={{ padding: 20 }}>
          {sectionTitle("Stage History")}
          {deal.stageHistory?.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No stage changes recorded.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[...deal.stageHistory].reverse().map((entry, i) => (
                <div key={entry._id || i}
                  style={{
                    display: "flex", gap: 14, paddingBottom: 14,
                    borderLeft: "2px solid var(--glass-border)", paddingLeft: 16,
                    position: "relative", marginLeft: 6
                  }}>
                  <div style={{
                    position: "absolute", left: -6, top: 2,
                    width: 10, height: 10, borderRadius: "50%",
                    background: STAGE_COLORS[entry.stage]?.color || "var(--accent)",
                    border: "2px solid var(--bg-deep)"
                  }} />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <Badge label={entry.stage} scheme={STAGE_COLORS[entry.stage]} />
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
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <ConfirmDelete
          name={deal.customerName || deal.dealId}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          deleting={deleting}
        />
      )}
    </div>
  );
}
