import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Download, FilePlus, Mail, Trash2 } from "lucide-react";
import {
  createQuotation,
  deleteQuotation,
  downloadQuotationPdf,
  emailQuotationToClient,
  getQuotations,
  selectQuotation,
} from "../api/quotationsApi.js";

// ──── Currency options ────────────────────────────────────────────────────────

const CURRENCIES = ["INR", "CNY", "USD"];

// ──── Helpers ────────────────────────────────────────────────────────────────

const fmtDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const fmtPrice = (price, currency) => {
  if (price == null) return "—";
  const sym = currency === "INR" ? "₹" : currency === "CNY" ? "¥" : "$";
  return `${sym}${Number(price).toLocaleString("en-IN")}`;
};

// ──── Empty add-form state ────────────────────────────────────────────────────

const emptyForm = () => ({
  vendorName: "",
  product: "",
  price: "",
  currency: "INR",
  exchangeRate: "1",
  validity: "",
  terms: "",
  file: null,
});

// ──── QuotationsPanel ─────────────────────────────────────────────────────────

/**
 * Self-contained panel for viewing and managing quotations on a lead.
 *
 * Props:
 *   - leadId:   string   (required) MongoDB _id of the lead
 *   - canWrite: boolean  purchase / manager / superadmin can write; sales is read-only
 */
export default function QuotationsPanel({ leadId, canWrite = false }) {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  // Add-form state
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState("");

  // Busy guard (select / delete)
  const [actionBusy, setActionBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const fileInputRef = useRef(null);

  // ── Fetch list ─────────────────────────────────────────────────────────────
  const fetchList = async () => {
    setError("");
    try {
      const res = await getQuotations(leadId);
      // Sort by price ascending
      const raw = res.data?.data?.quotations ?? [];
      const sorted = [...raw].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
      setQuotations(sorted);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load quotations");
    }
  };

  useEffect(() => {
    if (!leadId) return;
    setLoading(true);
    fetchList().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSelect = async (id) => {
    setActionBusy(true);
    setError("");
    try {
      await selectQuotation(id);
      await fetchList();
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
      await fetchList();
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
      a.download = "quotation.pdf";
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

  // ── Add form ───────────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm(emptyForm());
    setFormError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFormChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "file") {
      setForm((prev) => ({ ...prev, file: files?.[0] ?? null }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
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
      if (form.validity)  fd.append("validity", form.validity);
      if (form.terms.trim()) fd.append("terms", form.terms.trim());
      if (form.file)      fd.append("file", form.file);

      await createQuotation(fd);
      resetForm();
      setShowForm(false);
      await fetchList();
    } catch (err) {
      setFormError(err?.response?.data?.message || "Could not create quotation");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: "16px 0", color: "var(--text-muted)", fontSize: 13 }}>
        Loading quotations…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Error banner */}
      {error && (
        <div className="error-banner">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Success banner */}
      {successMsg && (
        <div className="glass-subtle r-md" style={{ padding: "8px 14px", color: "#22c55e", fontSize: 12, borderLeft: "3px solid #22c55e", display: "flex", alignItems: "center", gap: 6 }}>
          <Check size={12} /> {successMsg}
        </div>
      )}

      {/* Add button */}
      {canWrite && !showForm && (
        <div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => { resetForm(); setShowForm(true); }}
            style={{ height: 36, padding: "0 16px", fontSize: 12, gap: 6 }}
          >
            <FilePlus size={14} />
            Add Quotation
          </button>
        </div>
      )}

      {/* Inline add form */}
      {canWrite && showForm && (
        <form
          onSubmit={handleSubmit}
          className="glass r-lg"
          style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
        >
          <h4 style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--text-muted)", margin: 0,
          }}>
            New Quotation
          </h4>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {/* Vendor Name */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={labelStyle}>Vendor Name *</label>
              <input
                className="input-glass"
                name="vendorName"
                value={form.vendorName}
                onChange={handleFormChange}
                placeholder="e.g. ABC Supplies"
                style={inputStyle}
              />
            </div>

            {/* Product */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={labelStyle}>Product *</label>
              <input
                className="input-glass"
                name="product"
                value={form.product}
                onChange={handleFormChange}
                placeholder="e.g. Custom packaging"
                style={inputStyle}
              />
            </div>

            {/* Price */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={labelStyle}>Price *</label>
              <input
                className="input-glass"
                name="price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={handleFormChange}
                placeholder="0.00"
                style={inputStyle}
              />
            </div>

            {/* Currency */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={labelStyle}>Currency</label>
              <select
                className="input-glass"
                name="currency"
                value={form.currency}
                onChange={handleFormChange}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Exchange Rate */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={labelStyle}>Exchange Rate</label>
              <input
                className="input-glass"
                name="exchangeRate"
                type="number"
                min="0"
                step="0.0001"
                value={form.exchangeRate}
                onChange={handleFormChange}
                placeholder="1"
                style={inputStyle}
              />
            </div>

            {/* Validity */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={labelStyle}>Valid Until</label>
              <input
                className="input-glass"
                name="validity"
                type="date"
                value={form.validity}
                onChange={handleFormChange}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Terms */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Terms &amp; Conditions</label>
            <textarea
              className="input-glass"
              name="terms"
              value={form.terms}
              onChange={handleFormChange}
              rows={2}
              placeholder="Optional terms…"
              style={{ ...inputStyle, height: "auto", minHeight: 52, resize: "vertical",
                padding: "10px 12px", lineHeight: 1.5 }}
            />
          </div>

          {/* File */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Attachment (image or PDF)</label>
            <input
              ref={fileInputRef}
              className="input-glass"
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFormChange}
              style={{ ...inputStyle, cursor: "pointer", padding: "8px 12px" }}
            />
          </div>

          {formError && (
            <div className="error-banner">
              <AlertCircle size={14} />
              {formError}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
              style={{ height: 36, padding: "0 18px", fontSize: 13 }}
            >
              {submitting ? "Saving…" : "Save Quotation"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => { setShowForm(false); resetForm(); }}
              style={{ height: 36, padding: "0 14px", fontSize: 13 }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Quotations list */}
      {quotations.length === 0 && !showForm ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
          No quotations yet.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {quotations.map((q) => {
            const vendorLabel =
              q.vendorName ||
              q.vendorRef?.companyName ||
              "Unknown vendor";

            return (
              <div
                key={q._id}
                className="glass r-lg"
                style={{
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                  borderLeft: q.isSelected
                    ? "3px solid #22c55e"
                    : "3px solid transparent",
                }}
              >
                {/* Main info */}
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
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
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                    {fmtPrice(q.price, q.currency)}
                  </span>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "1px 0 0" }}>
                    {q.currency}
                    {q.exchangeRate && q.exchangeRate !== 1
                      ? ` @ ${q.exchangeRate}`
                      : ""}
                  </p>
                </div>

                {/* Validity */}
                <div style={{ flex: "0 0 auto" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Valid until</span>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "1px 0 0", fontWeight: 500 }}>
                    {fmtDate(q.validity)}
                  </p>
                </div>

                {/* Actions — PDF/Email for all; Select/Delete for canWrite */}
                <div style={{ flex: "0 0 auto", display: "flex", gap: 6, marginLeft: "auto" }}>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => handleDownloadPdf(q._id)}
                    disabled={actionBusy}
                    title="Download PDF"
                    style={{ width: 30, height: 30, color: "var(--accent)" }}
                  >
                    <Download size={13} />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => handleEmailClient(q._id)}
                    disabled={actionBusy}
                    title="Email quotation to client"
                    style={{ height: 30, padding: "0 10px", fontSize: 11, gap: 4, color: "var(--accent)" }}
                  >
                    <Mail size={12} /> Email
                  </button>
                  {canWrite && !q.isSelected && (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => handleSelect(q._id)}
                      disabled={actionBusy}
                      title="Select this quotation"
                      style={{
                        height: 30, padding: "0 12px", fontSize: 11, fontWeight: 600,
                        color: "#22c55e", borderColor: "rgb(34 197 94 / 0.4)",
                        background: "rgb(34 197 94 / 0.08)",
                      }}
                    >
                      Select
                    </button>
                  )}
                  {canWrite && (
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => handleDelete(q._id)}
                      disabled={actionBusy}
                      title="Delete quotation"
                      style={{
                        width: 30, height: 30,
                        color: "#ef4444",
                        borderColor: "rgb(239 68 68 / 0.3)",
                        background: "rgb(239 68 68 / 0.08)",
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ──── Style helpers ───────────────────────────────────────────────────────────

const labelStyle = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
};

const inputStyle = {
  height: 38,
  fontSize: 13,
};
