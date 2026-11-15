import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Pencil, Plus, Power, Trash2, X } from "lucide-react";
import {
  createPrefix,
  deletePrefix,
  listPrefixes,
  togglePrefix,
  updatePrefix,
} from "../api/servicePrefixApi.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const SEEDED_CODES = ["SRC", "PKG", "WEB", "SMM", "LEG", "INV", "CON"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const labelStyle = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
};

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ active }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 10px",
        borderRadius: 9999,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        background: active ? "rgb(34 197 94 / 0.13)" : "rgb(239 68 68 / 0.1)",
        color: active ? "#22c55e" : "#ef4444",
      }}
    >
      {active ? <Check size={9} strokeWidth={2.5} /> : <X size={9} strokeWidth={2.5} />}
      {active ? "Active" : "Inactive"}
    </span>
  );
}

// ─── AddPrefixForm ────────────────────────────────────────────────────────────

function AddPrefixForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({ code: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const codeRef = useRef(null);

  useEffect(() => {
    codeRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code.trim()) { setError("Code is required"); return; }
    setBusy(true);
    setError("");
    try {
      await createPrefix({ code: form.code.trim().toUpperCase(), name: form.name.trim() || form.code.trim().toUpperCase() });
      onCreated();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not create prefix");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="glass r-lg"
      style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}
    >
      <h4 style={{ ...labelStyle, margin: 0 }}>New Prefix</h4>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "0 0 120px" }}>
          <label style={labelStyle}>Code *</label>
          <input
            ref={codeRef}
            className="input-glass"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            placeholder="e.g. MFG"
            maxLength={6}
            style={{ height: 36, fontSize: 13 }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 200px" }}>
          <label style={labelStyle}>Name</label>
          <input
            className="input-glass"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Manufacturing"
            style={{ height: 36, fontSize: 13 }}
          />
        </div>
      </div>
      {error && (
        <div className="error-banner" style={{ fontSize: 12 }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn-primary" disabled={busy} style={{ height: 34, padding: "0 16px", fontSize: 12 }}>
          {busy ? "Saving…" : "Create Prefix"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel} style={{ height: 34, padding: "0 14px", fontSize: 12 }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── EditNameCell ─────────────────────────────────────────────────────────────

function EditNameCell({ prefix, onSaved }) {
  const [name, setName] = useState(prefix.name || prefix.code);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await updatePrefix(prefix._id, { name: name.trim() });
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not update");
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input
        ref={inputRef}
        className="input-glass"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onSaved(); }}
        style={{ height: 30, fontSize: 13, flex: 1 }}
      />
      <button type="button" className="btn-icon" onClick={save} disabled={busy} title="Save" style={{ width: 28, height: 28, color: "#22c55e" }}>
        <Check size={12} />
      </button>
      <button type="button" className="btn-icon" onClick={onSaved} title="Cancel" style={{ width: 28, height: 28 }}>
        <X size={12} />
      </button>
      {error && <span style={{ fontSize: 11, color: "#ef4444" }}>{error}</span>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  const [prefixes, setPrefixes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const fetchPrefixes = async () => {
    setError("");
    try {
      const res = await listPrefixes();
      setPrefixes(res.data?.data?.prefixes ?? []);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load prefixes");
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchPrefixes().finally(() => setLoading(false));
  }, []);

  const handleToggle = async (id) => {
    setActionBusy(true);
    setError("");
    try {
      await togglePrefix(id);
      await fetchPrefixes();
    } catch (err) {
      setError(err?.response?.data?.message || "Toggle failed");
    } finally {
      setActionBusy(false);
    }
  };

  const handleDelete = async (id) => {
    setActionBusy(true);
    setError("");
    try {
      await deletePrefix(id);
      await fetchPrefixes();
    } catch (err) {
      setError(err?.response?.data?.message || "Delete failed");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 780 }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Service Prefixes
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Manage deal ID prefixes per service type. Default prefixes (SRC, PKG, WEB…) cannot be deleted.
          </p>
        </div>
        {!showAddForm && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowAddForm(true)}
            style={{ height: 36, padding: "0 16px", fontSize: 12, gap: 6 }}
          >
            <Plus size={13} />
            Add Prefix
          </button>
        )}
      </div>

      {/* Add form */}
      {showAddForm && (
        <AddPrefixForm
          onCreated={async () => {
            setShowAddForm(false);
            await fetchPrefixes();
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Error banner */}
      {error && (
        <div className="error-banner">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading…</p>
      ) : (
        <div className="glass r-lg" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Code", "Name", "Status", "Actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        color: "var(--text-muted)",
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        borderBottom: "1px solid var(--glass-border)",
                        background: "rgb(255 255 255 / 0.02)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prefixes.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "20px 16px", color: "var(--text-muted)", textAlign: "center" }}>
                      No prefixes found
                    </td>
                  </tr>
                ) : (
                  prefixes.map((p) => {
                    const isSeeded = SEEDED_CODES.includes(p.code);
                    return (
                      <tr key={p._id} style={{ borderBottom: "1px solid var(--glass-border)" }}>
                        {/* Code */}
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, color: "var(--text-primary)", fontSize: 14 }}>
                          {p.code}
                        </td>

                        {/* Name — inline edit */}
                        <td style={{ padding: "10px 16px", color: "var(--text-secondary)", minWidth: 180 }}>
                          {editingId === p._id ? (
                            <EditNameCell
                              prefix={p}
                              onSaved={async () => {
                                setEditingId(null);
                                await fetchPrefixes();
                              }}
                            />
                          ) : (
                            <span>{p.name || p.code}</span>
                          )}
                        </td>

                        {/* Status */}
                        <td style={{ padding: "12px 16px" }}>
                          <StatusBadge active={p.isActive} />
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "10px 16px" }}>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {/* Toggle active */}
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() => handleToggle(p._id)}
                              disabled={actionBusy}
                              title={p.isActive ? "Deactivate" : "Activate"}
                              style={{
                                width: 30,
                                height: 30,
                                color: p.isActive ? "#22c55e" : "var(--text-muted)",
                                borderColor: p.isActive ? "rgb(34 197 94 / 0.3)" : undefined,
                                background: p.isActive ? "rgb(34 197 94 / 0.08)" : undefined,
                              }}
                            >
                              <Power size={13} />
                            </button>

                            {/* Edit name */}
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() => setEditingId(editingId === p._id ? null : p._id)}
                              title="Edit name"
                              style={{ width: 30, height: 30 }}
                            >
                              <Pencil size={13} />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() => !isSeeded && handleDelete(p._id)}
                              disabled={isSeeded || actionBusy}
                              title={isSeeded ? "Default prefix — cannot be deleted" : "Delete prefix"}
                              style={{
                                width: 30,
                                height: 30,
                                color: isSeeded ? "var(--text-muted)" : "#ef4444",
                                borderColor: isSeeded ? undefined : "rgb(239 68 68 / 0.3)",
                                background: isSeeded ? undefined : "rgb(239 68 68 / 0.08)",
                                opacity: isSeeded ? 0.4 : 1,
                                cursor: isSeeded ? "not-allowed" : "pointer",
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
