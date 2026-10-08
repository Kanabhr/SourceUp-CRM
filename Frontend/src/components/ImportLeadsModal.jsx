/**
 * ImportLeadsModal
 *
 * Two-step flow mirroring BMS pattern:
 *   Step 1 — File picker → upload → AI preview table
 *   Step 2 — User reviews rows, unchecks duplicates/junk → confirms import
 */

import { useRef, useState } from "react";
import {
  AlertCircle, Check, FileSpreadsheet,
  Loader, Upload, X,
} from "lucide-react";
import { importLeadsConfirm, importLeadsPreview } from "../api/leadsApi.js";

// ─── Verification badge colours (matches Leads page) ─────────────────────────
const V_COLORS = {
  Verified:   { bg: "rgb(34 197 94 / 0.12)",   color: "#22c55e" },
  Fraud:      { bg: "rgb(239 68 68 / 0.12)",   color: "#ef4444" },
  Unverified: { bg: "rgb(255 255 255 / 0.06)", color: "var(--text-secondary)" },
};

function VBadge({ status }) {
  const s = V_COLORS[status] || V_COLORS.Unverified;
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 9999, fontSize: 11,
      fontWeight: 600, whiteSpace: "nowrap",
      background: s.bg, color: s.color,
    }}>
      {status}
    </span>
  );
}

// ─── Step 1 — File drop / pick ────────────────────────────────────────────────
function FilePicker({ onFile, loading }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handle = (file) => {
    if (!file) return;
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      alert("Only .xlsx files are supported.");
      return;
    }
    onFile(file);
  };

  return (
    <div
      onClick={() => !loading && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handle(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${dragOver ? "var(--accent)" : "var(--glass-border-hi)"}`,
        borderRadius: "var(--r-lg)",
        padding: "48px 24px",
        textAlign: "center",
        cursor: loading ? "not-allowed" : "pointer",
        background: dragOver ? "rgb(45 212 191 / 0.05)" : "transparent",
        transition: "border-color 150ms, background 150ms",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={(e) => handle(e.target.files[0])}
      />
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <Loader size={32} color="var(--accent)" style={{ animation: "spin 1s linear infinite" }} />
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Parsing & running AI verification…
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>This may take a few seconds</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "var(--r-md)",
            background: "var(--accent-dim)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            <FileSpreadsheet size={26} color="var(--accent)" strokeWidth={1.5} />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
              Drop your Excel file here
            </p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              or click to browse — .xlsx only, max 200 rows
            </p>
          </div>
          <div style={{
            marginTop: 8, padding: "8px 20px", borderRadius: 9999,
            border: "1px solid var(--glass-border-hi)", fontSize: 13,
            color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6,
          }}>
            <Upload size={13} /> Select file
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 2 — Preview table ───────────────────────────────────────────────────
function PreviewTable({ rows, selected, onToggle, onToggleAll }) {
  const allSelected = rows.every((_, i) => selected.has(i));

  return (
    <div style={{ overflowX: "auto", maxHeight: "45vh", overflowY: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead style={{ position: "sticky", top: 0, background: "var(--bg-elevated)", zIndex: 1 }}>
          <tr style={{ color: "var(--text-muted)", textAlign: "left",
            borderBottom: "1px solid var(--glass-border)" }}>
            <th style={{ padding: "8px 10px" }}>
              <input type="checkbox" checked={allSelected}
                onChange={() => onToggleAll(!allSelected)}
                style={{ cursor: "pointer" }} />
            </th>
            {["Company", "Contact", "Designation", "Phone", "Email", "Location", "Web/Instagram", "AI Verdict"].map(h => (
              <th key={h} style={{ padding: "8px 10px", fontWeight: 600,
                fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase",
                whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isChecked = selected.has(i);
            const isDup = row.isDuplicate;
            return (
              <tr key={i}
                style={{
                  borderTop: "1px solid var(--glass-border)",
                  opacity: !isChecked || isDup ? 0.45 : 1,
                  background: isDup ? "rgb(239 68 68 / 0.04)" : "transparent",
                  transition: "opacity 120ms",
                }}>
                <td style={{ padding: "8px 10px" }}>
                  <input type="checkbox"
                    checked={isChecked && !isDup}
                    disabled={isDup}
                    onChange={() => !isDup && onToggle(i)}
                    style={{ cursor: isDup ? "not-allowed" : "pointer" }} />
                </td>
                <td style={{ padding: "8px 10px", fontWeight: 600,
                  color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                  {row.company || "—"}
                </td>
                <td style={{ padding: "8px 10px", color: "var(--text-secondary)",
                  whiteSpace: "nowrap" }}>
                  {row.contactPerson || "—"}
                </td>
                <td style={{ padding: "8px 10px", color: "var(--text-muted)",
                  whiteSpace: "nowrap" }}>
                  {row.designation || "—"}
                </td>
                <td style={{ padding: "8px 10px", color: "var(--text-secondary)",
                  whiteSpace: "nowrap" }}>
                  {row.phone || "—"}
                </td>
                <td style={{ padding: "8px 10px", color: "var(--text-secondary)" }}>
                  {row.email || "—"}
                </td>
                <td style={{ padding: "8px 10px", color: "var(--text-muted)",
                  whiteSpace: "nowrap" }}>
                  {row.location || "—"}
                </td>
                <td style={{ padding: "8px 10px", color: "var(--text-secondary)",
                  maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis",
                  whiteSpace: "nowrap" }}>
                  {row.websiteUrl || "—"}
                </td>
                <td style={{ padding: "8px 10px" }}>
                  {isDup
                    ? <span style={{ fontSize: 11, color: "#ef4444" }}>Duplicate</span>
                    : <VBadge status={row.verificationStatus || "Unverified"} />
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export default function ImportLeadsModal({ onClose, onImported }) {
  const [step, setStep]         = useState("pick");   // pick | preview | done
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview]   = useState(null);     // { total, duplicates, aiVerified, preview[] }
  const [selected, setSelected] = useState(new Set());
  const [confirming, setConfirming] = useState(false);
  const [result, setResult]     = useState(null);     // { inserted, skipped }
  const [error, setError]       = useState("");

  // Backdrop close
  const backdropRef = useRef(null);
  const handleBackdrop = (e) => {
    if (e.target === backdropRef.current && step !== "done") onClose();
  };

  // ── Step 1: upload & preview ───────────────────────────────────────────────
  const handleFile = async (file) => {
    setError("");
    setUploading(true);
    try {
      const res = await importLeadsPreview(file);
      const data = res.data.data;
      setPreview(data);

      // Pre-select all non-duplicate rows
      const initial = new Set(
        data.preview
          .map((_, i) => i)
          .filter((i) => !data.preview[i].isDuplicate),
      );
      setSelected(initial);
      setStep("preview");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to process file");
    } finally {
      setUploading(false);
    }
  };

  // ── Step 2: confirm import ─────────────────────────────────────────────────
  const handleConfirm = async () => {
    setError("");
    setConfirming(true);
    try {
      const rowsToImport = preview.preview
        .filter((_, i) => selected.has(i) && !preview.preview[i].isDuplicate);

      const res = await importLeadsConfirm(rowsToImport);
      setResult(res.data.data);
      setStep("done");
      onImported(res.data.data.inserted);
    } catch (err) {
      setError(err.response?.data?.message || "Import failed");
    } finally {
      setConfirming(false);
    }
  };

  const toggleRow = (i) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const toggleAll = (checked) => {
    if (checked) {
      setSelected(
        new Set(
          preview.preview
            .map((_, i) => i)
            .filter((i) => !preview.preview[i].isDuplicate),
        ),
      );
    } else {
      setSelected(new Set());
    }
  };

  const selectedCount = preview
    ? [...selected].filter((i) => !preview.preview[i]?.isDuplicate).length
    : 0;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, background: "rgb(0 0 0 / 0.65)", backdropFilter: "blur(4px)",
      }}
    >
      <div
        className="glass-strong r-xl"
        style={{
          width: "100%",
          maxWidth: step === "preview" ? 900 : 520,
          maxHeight: "92dvh",
          display: "flex", flexDirection: "column",
          padding: 28, gap: 20,
          transition: "max-width 300ms ease",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center",
          justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700,
              letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
              {step === "pick" && "Import Leads from Excel"}
              {step === "preview" && "Review Import"}
              {step === "done" && "Import Complete"}
            </h2>
            {step === "preview" && (
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 3 }}>
                {preview.total} rows found · {preview.duplicates} duplicates ·{" "}
                {preview.aiVerified} AI-verified
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="btn-icon"
            style={{ width: 32, height: 32, flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>

        {/* ── Step: pick ──────────────────────────────────────────────────── */}
        {step === "pick" && (
          <FilePicker onFile={handleFile} loading={uploading} />
        )}

        {/* ── Step: preview ───────────────────────────────────────────────── */}
        {step === "preview" && preview && (
          <>
            {/* AI verdict legend */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>
              {["Verified", "Unverified", "Fraud"].map((v) => (
                <div key={v} style={{ display: "flex", alignItems: "center", gap: 5,
                  fontSize: 12, color: "var(--text-muted)" }}>
                  <VBadge status={v} />
                  <span>{v === "Verified" ? "— looks legitimate" :
                    v === "Fraud" ? "— flagged, review before import" :
                    "— no web handle to verify"}</span>
                </div>
              ))}
              <div style={{ fontSize: 12, color: "#ef4444", marginLeft: "auto" }}>
                Greyed rows = duplicates (auto-excluded)
              </div>
            </div>

            <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
              <PreviewTable
                rows={preview.preview}
                selected={selected}
                onToggle={toggleRow}
                onToggleAll={toggleAll}
              />
            </div>
          </>
        )}

        {/* ── Step: done ──────────────────────────────────────────────────── */}
        {step === "done" && result && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%", margin: "0 auto 20px",
              background: "rgb(34 197 94 / 0.12)",
              border: "2px solid rgb(34 197 94 / 0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Check size={28} color="#22c55e" strokeWidth={2.5} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)",
              marginBottom: 8 }}>
              {result.inserted} lead{result.inserted !== 1 ? "s" : ""} imported
            </h3>
            {result.skipped > 0 && (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {result.skipped} row{result.skipped !== 1 ? "s" : ""} skipped (duplicates)
              </p>
            )}
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>
              All imported leads are set to <strong>Open</strong> status and assigned to you.
              Update product details and cost-per-lead on each lead as needed.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="error-banner" style={{ flexShrink: 0 }}>
            <AlertCircle size={15} />{error}
          </div>
        )}

        {/* Footer actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end",
          flexShrink: 0, borderTop: "1px solid var(--glass-border)", paddingTop: 16 }}>
          {step === "pick" && (
            <button type="button" className="btn-ghost" onClick={onClose}
              style={{ height: 40, padding: "0 20px", fontSize: 13 }}>
              Cancel
            </button>
          )}
          {step === "preview" && (
            <>
              <button type="button" className="btn-ghost"
                onClick={() => { setStep("pick"); setPreview(null); setError(""); }}
                style={{ height: 40, padding: "0 20px", fontSize: 13 }}>
                ← Back
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={selectedCount === 0 || confirming}
                onClick={handleConfirm}
                style={{ height: 40, padding: "0 24px", fontSize: 13, gap: 6 }}
              >
                {confirming
                  ? "Importing…"
                  : `Import ${selectedCount} lead${selectedCount !== 1 ? "s" : ""}`}
              </button>
            </>
          )}
          {step === "done" && (
            <button type="button" className="btn-primary" onClick={onClose}
              style={{ height: 40, padding: "0 24px", fontSize: 13 }}>
              Done
            </button>
          )}
        </div>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
