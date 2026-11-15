import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle, Check, ChevronLeft, ChevronRight,
  Download, ExternalLink, FilePlus, FileText, Mail, Search, Trash2, X,
} from "lucide-react";
import { useAuth } from "../context/Authcontext";
import {
  createQuotation,
  deleteQuotation,
  downloadQuotationPdf,
  emailQuotationToClient,
  getQuotations,
  selectQuotation,
} from "../api/quotationsApi.js";
import { getLeads } from "../api/leadsApi.js";
import PortalDropdown from "../components/PortalDropdown.jsx";

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENCIES = ["INR", "CNY", "USD"];

const CURRENCY_COLORS = {
  INR: { bg: "rgb(251 146 60 / 0.12)", color: "#fb923c" },
  CNY: { bg: "rgb(239 68 68 / 0.12)",  color: "#f87171" },
  USD: { bg: "rgb(34 197 94 / 0.12)",  color: "#22c55e" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtPrice = (price, currency) => {
  if (price == null) return "—";
  const sym = currency === "INR" ? "₹" : currency === "CNY" ? "¥" : "$";
  return `${sym}${Number(price).toLocaleString("en-IN")}`;
};

function Badge({ label, scheme }) {
  const s = scheme || { bg: "rgb(255 255 255/0.06)", color: "var(--text-secondary)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 10px",
      borderRadius: 9999, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
      whiteSpace: "nowrap", background: s.bg, color: s.color,
    }}>
      {label}
    </span>
  );
}

const emptyForm = () => ({
  vendorName: "", product: "", price: "",
  currency: "INR", exchangeRate: "1", validity: "", terms: "", file: null,
});

const labelStyle = { fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-secondary)" };
const inputStyle = { height: 38, fontSize: 13 };

// ─── Add Quotation Form ───────────────────────────────────────────────────────

function AddQuotationForm({ leadId, onCreated, onCancel }) {
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "file") setForm((f) => ({ ...f, file: files?.[0] ?? null }));
    else setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vendorName.trim()) { setFormError("Vendor name is required"); return; }
    if (!form.product.trim())    { setFormError("Product is required"); return; }
    if (!form.price)             { setFormError("Price is required"); return; }
    setSubmitting(true);
    setFormError("");
    try {
      const fd = new FormData();
      fd.append("leadId",       leadId);
      fd.append("vendorName",   form.vendorName.trim());
      fd.append("product",      form.product.trim());
      fd.append("price",        form.price);
      fd.append("currency",     form.currency);
      fd.append("exchangeRate", form.exchangeRate || "1");
      if (form.validity)     fd.append("validity", form.validity);
      if (form.terms.trim()) fd.append("terms",    form.terms.trim());
      if (form.file)         fd.append("file",     form.file);
      await createQuotation(fd);
      onCreated();
    } catch (err) {
      setFormError(err?.response?.data?.message || "Could not create quotation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass r-lg"
      style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
      <h4 style={{ ...labelStyle, margin: 0 }}>New Quotation</h4>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {[
          { key: "vendorName", label: "Vendor Name *",   type: "text",   placeholder: "e.g. ABC Supplies" },
          { key: "product",    label: "Product *",       type: "text",   placeholder: "e.g. Custom packaging" },
          { key: "price",      label: "Price *",         type: "number", placeholder: "0.00", min: "0", step: "0.01" },
          { key: "exchangeRate", label: "Exchange Rate", type: "number", placeholder: "1",    min: "0", step: "0.0001" },
          { key: "validity",   label: "Valid Until",     type: "date" },
        ].map(({ key, label, ...props }) => (
          <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>{label}</label>
            <input className="input-glass" name={key} value={form[key]} onChange={handleChange} style={inputStyle} {...props} />
          </div>
        ))}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>Currency</label>
          <select className="input-glass" name="currency" value={form.currency} onChange={handleChange}
            style={{ ...inputStyle, cursor: "pointer" }}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={labelStyle}>Terms &amp; Conditions</label>
        <textarea className="input-glass" name="terms" value={form.terms} onChange={handleChange} rows={2}
          placeholder="Optional terms…"
          style={{ ...inputStyle, height: "auto", minHeight: 52, resize: "vertical", padding: "10px 12px", lineHeight: 1.5 }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={labelStyle}>Attachment (image or PDF)</label>
        <input ref={fileInputRef} className="input-glass" name="file" type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleChange}
          style={{ ...inputStyle, cursor: "pointer", padding: "8px 12px" }} />
      </div>

      {formError && (
        <div className="error-banner"><AlertCircle size={14} />{formError}</div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn-primary" disabled={submitting} style={{ height: 36, padding: "0 18px", fontSize: 13 }}>
          {submitting ? "Saving…" : "Save Quotation"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel} style={{ height: 36, padding: "0 14px", fontSize: 13 }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Quotations() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const canWrite = ["purchase", "manager", "superadmin"].includes(user?.role);

  // ── Leads for the filter picker ──────────────────────────────────────────
  const [leads, setLeads]         = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(true);

  useEffect(() => {
    getLeads({ limit: 200 }).then((res) => {
      setLeads(res.data?.data?.leads ?? []);
    }).catch(() => {}).finally(() => setLeadsLoading(false));
  }, []);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [selectedLeadId, setSelectedLeadId] = useState(searchParams.get("leadId") || "");
  const [search, setSearch]   = useState("");

  // ── Quotations list ───────────────────────────────────────────────────────
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  // ── Add form ──────────────────────────────────────────────────────────────
  const [showAddForm, setShowAddForm] = useState(false);
  const [actionBusy, setActionBusy]   = useState(false);
  const [successMsg, setSuccessMsg]   = useState("");

  // ── Fetch quotations ──────────────────────────────────────────────────────
  const fetchQuotations = useCallback(async (leadId) => {
    if (!leadId) { setQuotations([]); return; }
    setLoading(true);
    setError("");
    try {
      const res = await getQuotations(leadId);
      const raw = res.data?.data?.quotations ?? [];
      setQuotations([...raw].sort((a, b) => (a.price ?? 0) - (b.price ?? 0)));
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load quotations");
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch when lead selection changes
  useEffect(() => {
    setShowAddForm(false);
    fetchQuotations(selectedLeadId);
    if (selectedLeadId) {
      setSearchParams({ leadId: selectedLeadId }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [selectedLeadId, fetchQuotations, setSearchParams]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleSelect = async (id) => {
    setActionBusy(true);
    setError("");
    try {
      await selectQuotation(id);
      await fetchQuotations(selectedLeadId);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not select quotation");
    } finally {
      setActionBusy(false);
    }
  };

  const handleDelete = async (id) => {
    setActionBusy(true);
    setError("");
    try {
      await deleteQuotation(id);
      await fetchQuotations(selectedLeadId);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not delete quotation");
    } finally {
      setActionBusy(false);
    }
  };

  const handleDownloadPdf = async (id) => {
    setActionBusy(true);
    setError("");
    try {
      const res = await downloadQuotationPdf(id);
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quotation.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      let msg = "Could not generate PDF";
      const data = err?.response?.data;
      if (data instanceof Blob) {
        try { msg = JSON.parse(await data.text())?.message || msg; } catch { }
      } else if (err?.response?.data?.message) {
        msg = err.response.data.message;
      }
      setError(msg);
    } finally {
      setActionBusy(false);
    }
  };

  const handleEmailClient = async (id) => {
    setActionBusy(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await emailQuotationToClient(id);
      setSuccessMsg(res.data?.message || "Quotation emailed to client");
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not send email");
    } finally {
      setActionBusy(false);
    }
  };

  // ── Derived: filter by search text ───────────────────────────────────────
  const filtered = search.trim()
    ? quotations.filter((q) => {
        const q_ = search.toLowerCase();
        return (
          (q.vendorName || "").toLowerCase().includes(q_) ||
          (q.product    || "").toLowerCase().includes(q_) ||
          (q.quotationId || "").toLowerCase().includes(q_)
        );
      })
    : quotations;

  const selectedLead = leads.find((l) => l._id === selectedLeadId);

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 1100 }}>

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <FileText size={20} color="var(--accent)" />
            Quotations
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Compare vendor quotations for a lead and mark the best one.
          </p>
        </div>
        {canWrite && selectedLeadId && !showAddForm && (
          <button type="button" className="btn-primary" onClick={() => setShowAddForm(true)}
            style={{ height: 36, padding: "0 16px", fontSize: 12, gap: 6 }}>
            <FilePlus size={14} />
            Add Quotation
          </button>
        )}
      </div>

      {/* ── Lead filter ─────────────────────────────────────────────── */}
      <div className="glass r-lg" style={{ padding: "16px 20px", display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 260px", minWidth: 200 }}>
          <label style={labelStyle}>Lead</label>
          <PortalDropdown
            options={leads.map((l) => ({
              value: l._id,
              label: `${l.clientName || l.company || "—"} — ${l.leadId || l._id.slice(-6)}`,
            }))}
            value={selectedLeadId}
            onChange={setSelectedLeadId}
            placeholder={leadsLoading ? "Loading leads…" : "Select a lead to view quotations"}
          />
        </div>

        {selectedLeadId && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 220px", minWidth: 180 }}>
            <label style={labelStyle}>Search within lead</label>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
              <input className="input-glass" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Vendor, product, ID…" style={{ ...inputStyle, paddingLeft: 32 }} />
            </div>
          </div>
        )}

        {selectedLeadId && (
          <button type="button" className="btn-ghost"
            onClick={() => { setSelectedLeadId(""); setSearch(""); }}
            style={{ height: 36, padding: "0 14px", fontSize: 12, alignSelf: "flex-end" }}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* ── Lead context strip ──────────────────────────────────────── */}
      {selectedLead && (
        <div className="glass-subtle r-md" style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {selectedLead.clientName || selectedLead.company}
          </span>
          <Badge label={selectedLead.status}
            scheme={{ bg: "rgb(139 92 246 / 0.12)", color: "#8b5cf6" }} />
          {selectedLead.serviceType && (
            <Badge label={selectedLead.serviceType}
              scheme={{ bg: "rgb(45 212 191 / 0.1)", color: "#2dd4bf" }} />
          )}
          <button type="button" className="btn-ghost"
            onClick={() => navigate(`/leads/${selectedLead._id}`)}
            style={{ marginLeft: "auto", height: 30, padding: "0 12px", fontSize: 11, gap: 5 }}>
            <ExternalLink size={11} /> Open Lead
          </button>
        </div>
      )}

      {/* ── Empty state (no lead selected) ──────────────────────────── */}
      {!selectedLeadId && (
        <div className="glass r-lg" style={{ padding: "48px 24px", textAlign: "center" }}>
          <FileText size={36} color="var(--text-muted)" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
            Select a lead above to see its quotations.
          </p>
        </div>
      )}

      {/* ── Error banner ─────────────────────────────────────────────── */}
      {error && (
        <div className="error-banner"><AlertCircle size={14} />{error}</div>
      )}

      {successMsg && (
        <div className="glass-subtle r-md" style={{ padding: "10px 16px", color: "#22c55e", fontSize: 13, borderLeft: "3px solid #22c55e", display: "flex", alignItems: "center", gap: 8 }}>
          <Check size={14} /> {successMsg}
        </div>
      )}

      {/* ── Add form ─────────────────────────────────────────────────── */}
      {showAddForm && selectedLeadId && (
        <AddQuotationForm
          leadId={selectedLeadId}
          onCreated={async () => {
            setShowAddForm(false);
            await fetchQuotations(selectedLeadId);
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* ── Quotations list ──────────────────────────────────────────── */}
      {selectedLeadId && (
        <>
          {loading ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading quotations…</p>
          ) : filtered.length === 0 ? (
            <div className="glass r-lg" style={{ padding: "36px 24px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                {search ? "No quotations match your search." : "No quotations for this lead yet."}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Count header */}
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                {filtered.length} quotation{filtered.length !== 1 ? "s" : ""}, sorted by price ↑
              </p>

              {filtered.map((q) => {
                const vendorLabel = q.vendorName || q.vendorRef?.companyName || "Unknown vendor";
                const fileUrl = q.fileUrl ? q.fileUrl : null;

                return (
                  <div key={q._id} className="glass r-lg"
                    style={{
                      padding: "14px 18px",
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 14,
                      borderLeft: q.isSelected ? "3px solid #22c55e" : "3px solid transparent",
                    }}>

                    {/* Quotation ID */}
                    <div style={{ flex: "0 0 auto", minWidth: 120 }}>
                      <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "0 0 2px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        ID
                      </p>
                      <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-secondary)" }}>
                        {q.quotationId || q._id.slice(-8)}
                      </span>
                    </div>

                    {/* Vendor + Product */}
                    <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                          {vendorLabel}
                        </span>
                        {q.isSelected && (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "2px 8px", borderRadius: 9999, fontSize: 10,
                            fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
                            background: "rgb(34 197 94 / 0.15)", color: "#22c55e",
                          }}>
                            <Check size={10} strokeWidth={2.5} />
                            Selected
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0" }}>
                        {q.product}
                      </p>
                    </div>

                    {/* Price */}
                    <div style={{ flex: "0 0 auto", textAlign: "right" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                        {fmtPrice(q.price, q.currency)}
                      </span>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>
                        <Badge label={q.currency} scheme={CURRENCY_COLORS[q.currency]} />
                        {q.exchangeRate && q.exchangeRate !== 1 ? ` @ ${q.exchangeRate}` : ""}
                      </p>
                    </div>

                    {/* Validity */}
                    <div style={{ flex: "0 0 auto" }}>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 2px" }}>Valid until</p>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, fontWeight: 500 }}>
                        {fmtDate(q.validity)}
                      </p>
                    </div>

                    {/* File attachment link */}
                    {fileUrl && (
                      <a href={fileUrl} target="_blank" rel="noreferrer"
                        style={{
                          flex: "0 0 auto",
                          fontSize: 11, color: "var(--accent)",
                          display: "flex", alignItems: "center", gap: 4,
                          textDecoration: "none",
                        }}>
                        <FileText size={12} /> Attachment
                      </a>
                    )}

                    {/* Actions — PDF/Email for all roles; Select/Delete for canWrite */}
                    <div style={{ flex: "0 0 auto", display: "flex", gap: 6, marginLeft: "auto" }}>
                      <button type="button" className="btn-icon"
                        onClick={() => handleDownloadPdf(q._id)} disabled={actionBusy}
                        title="Download PDF"
                        style={{ width: 30, height: 30, color: "var(--accent)" }}>
                        <Download size={13} />
                      </button>
                      <button type="button" className="btn-ghost"
                        onClick={() => handleEmailClient(q._id)} disabled={actionBusy}
                        title="Email quotation to client"
                        style={{ height: 30, padding: "0 10px", fontSize: 11, gap: 4, color: "var(--accent)" }}>
                        <Mail size={12} /> Email
                      </button>
                      {canWrite && !q.isSelected && (
                        <button type="button" className="btn-ghost"
                          onClick={() => handleSelect(q._id)} disabled={actionBusy}
                          title="Mark as selected"
                          style={{
                            height: 30, padding: "0 12px", fontSize: 11, fontWeight: 600,
                            color: "#22c55e", borderColor: "rgb(34 197 94 / 0.4)",
                            background: "rgb(34 197 94 / 0.08)",
                          }}>
                          Select
                        </button>
                      )}
                      {canWrite && (
                        <button type="button" className="btn-icon"
                          onClick={() => handleDelete(q._id)} disabled={actionBusy}
                          title="Delete quotation"
                          style={{
                            width: 30, height: 30, color: "#ef4444",
                            borderColor: "rgb(239 68 68 / 0.3)",
                            background: "rgb(239 68 68 / 0.08)",
                          }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
