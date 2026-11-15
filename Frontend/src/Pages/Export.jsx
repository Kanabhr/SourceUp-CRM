import { useState } from "react";
import { Download } from "lucide-react";
import { exportData } from "../api/exportApi.js";

// ─── Options ─────────────────────────────────────────────────────────────────

const ENTITIES = [
  { value: "leads", label: "Leads" },
  { value: "deals", label: "Deals" },
  { value: "vendors", label: "Vendors" },
  { value: "quotations", label: "Quotations" },
  { value: "purchases", label: "Purchase Orders" },
];

const FORMATS = [
  { value: "csv", label: "CSV" },
  { value: "json", label: "JSON" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SelectField({ label, value, onChange, options }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 160px", minWidth: 140 }}>
      <label style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      <select
        className="input-glass"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: "7px 10px", fontSize: 13 }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function DateField({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 160px", minWidth: 140 }}>
      <label style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      <input
        type="date"
        className="input-glass"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: "7px 10px", fontSize: 13 }}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Export() {
  const [entity, setEntity] = useState("leads");
  const [format, setFormat] = useState("csv");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleExport = async () => {
    setLoading(true);
    setSuccess(false);
    setError(null);

    try {
      const res = await exportData(
        entity,
        format,
        startDate || undefined,
        endDate || undefined,
      );

      // Programmatically trigger browser download from the blob response
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export-${entity}-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);

      setSuccess(true);
    } catch (err) {
      // Blob responses wrap error JSON — try to parse it
      let msg = "Export failed. Please try again.";
      const data = err?.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const parsed = JSON.parse(text);
          msg = parsed?.message ?? msg;
        } catch {
          // ignore parse failure — keep default message
        }
      } else if (err?.response?.data?.message) {
        msg = err.response.data.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 680 }}>
      {/* Page header */}
      <div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Download size={20} color="var(--accent)" />
          Data Export
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          Download CRM data as CSV or JSON. Superadmin only.
        </p>
      </div>

      {/* Export form */}
      <div className="glass r-lg" style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          <SelectField label="Entity" value={entity} onChange={setEntity} options={ENTITIES} />
          <SelectField label="Format" value={format} onChange={setFormat} options={FORMATS} />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          <DateField label="Start Date (optional)" value={startDate} onChange={setStartDate} />
          <DateField label="End Date (optional)"   value={endDate}   onChange={setEndDate}   />
        </div>

        {/* Feedback */}
        {error && (
          <div
            className="glass-subtle r-md"
            style={{ padding: "10px 14px", color: "#f87171", fontSize: 13, borderLeft: "3px solid #f87171" }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            className="glass-subtle r-md"
            style={{ padding: "10px 14px", color: "var(--accent)", fontSize: 13, borderLeft: "3px solid var(--accent)" }}
          >
            Download started — check your downloads folder.
          </div>
        )}

        <div>
          <button
            className="btn-primary"
            onClick={handleExport}
            disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 8, paddingInline: 22, height: 40 }}
          >
            <Download size={14} />
            {loading ? "Preparing download…" : `Export ${ENTITIES.find((e) => e.value === entity)?.label} as ${format.toUpperCase()}`}
          </button>
        </div>
      </div>

      {/* Info panel */}
      <div className="glass-subtle r-md" style={{ padding: "14px 18px" }}>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Exported fields
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.8 }}>
          <li><strong>Leads:</strong> leadId, clientName, company, status, serviceType, source, assignedTo, expectedOrderValue, createdAt</li>
          <li><strong>Deals:</strong> dealId, leadId, salesRep, sellingPricePerUnit, qty, commissionPct, orderConfirmDate</li>
          <li><strong>Vendors:</strong> vendorId, companyName, contactPerson, email, phone, createdAt</li>
          <li><strong>Quotations:</strong> quotationId, leadId, vendorName, product, price, currency, exchangeRate, validity, isSelected, createdAt</li>
          <li><strong>Purchase Orders:</strong> poId, dealId, vendorName, vendorCountry, product, qty, unitCost, currency, totalLandedCost, status, createdAt</li>
        </ul>
      </div>
    </div>
  );
}
