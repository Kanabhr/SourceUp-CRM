import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, ChevronLeft, ChevronRight,
  Plus, Search, X,
} from "lucide-react";
import { useAuth } from "../context/Authcontext";
import { getPOs, createPO } from "../api/purchaseApi.js";
import { getDeals } from "../api/dealsApi.js";
import { getVendors, createVendor } from "../api/vendorApi.js";
import PortalDropdown from "../components/PortalDropdown.jsx";

// ─── Constants (mirrors backend) ────────────────────────────────────────────

const PO_STATUSES = [
  "PO Raised", "In Production", "QC",
  "Dispatched", "Received", "Closed",
];

const VENDOR_COUNTRIES = ["India", "China", "Other"];
const PO_CURRENCIES = ["INR", "CNY", "USD"];

const STATUS_COLORS = {
  "PO Raised": { bg: "rgb(139 92 246 / 0.12)", color: "#8b5cf6" },
  "In Production": { bg: "rgb(251 146 60 / 0.12)", color: "#fb923c" },
  "QC": { bg: "rgb(251 191 36 / 0.12)", color: "#fbbf24" },
  "Dispatched": { bg: "rgb(168 85 247 / 0.12)", color: "#a855f7" },
  "Received": { bg: "rgb(34 197 94 / 0.12)", color: "#22c55e" },
  "Closed": { bg: "rgb(100 116 139 / 0.12)", color: "#94a3b8" },
};

// ─── Small reusable components ──────────────────────────────────────────────

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

// ─── Add PO Modal ───────────────────────────────────────────────────────────

function AddPOModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    dealId: "", vendorRef: "", vendorName: "", vendorCountry: "India", vendorContact: "",
    product: "", specs: "",
    qty: "", unitCost: "", currency: "INR", exchangeRate: "1",
    packagingCost: "0",
    freight: "0", customsDuty: "0", clearingCharges: "0", insurance: "0",
  });
  const [dealsList, setDealsList] = useState([]);
  const [vendorsList, setVendorsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dealsLoading, setDealsLoading] = useState(true);
  const [vendorsLoading, setVendorsLoading] = useState(true);

  // Quick-Add Vendor state
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickCompanyName, setQuickCompanyName] = useState("");
  const [quickCountry, setQuickCountry] = useState("India");
  const [quickCategory, setQuickCategory] = useState("Packaging");
  const [quickSaving, setQuickSaving] = useState(false);

  // Load deals & vendors for dropdowns
  useEffect(() => {
    getDeals({ limit: 100 })
      .then(res => {
        const list = res.data.data.deals.map(d => ({
          value: d._id,
          label: `${d.dealId || ""} — ${d.customerName}`,
        }));
        setDealsList(list);
      })
      .catch(() => { })
      .finally(() => setDealsLoading(false));

    getVendors({ status: "Active", limit: 100 })
      .then(res => {
        const vList = (res.data.data.vendors || []).map(v => ({
          value: v._id,
          label: `${v.vendorId} — ${v.companyName} (${v.country})`,
          raw: v,
        }));
        setVendorsList(vList);
      })
      .catch(() => { })
      .finally(() => setVendorsLoading(false));
  }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setV = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const handleSelectVendor = (vendorId) => {
    if (!vendorId) {
      setForm(f => ({ ...f, vendorRef: "", vendorName: "", vendorContact: "" }));
      return;
    }
    const found = vendorsList.find(item => item.value === vendorId);
    if (found && found.raw) {
      const v = found.raw;
      setForm(f => ({
        ...f,
        vendorRef: v._id,
        vendorName: v.companyName,
        vendorCountry: v.country || "India",
        vendorContact: v.phone || v.contactPerson || "",
        currency: v.country === "China" ? "USD" : "INR",
        exchangeRate: v.country === "China" ? "86" : "1",
      }));
    }
  };

  const handleQuickAddVendor = async (e) => {
    e.preventDefault();
    if (!quickCompanyName.trim()) return;
    setQuickSaving(true);
    try {
      const res = await createVendor({
        companyName: quickCompanyName.trim(),
        country: quickCountry,
        category: quickCategory,
      });
      const newV = res.data.data;
      const newOption = {
        value: newV._id,
        label: `${newV.vendorId} — ${newV.companyName} (${newV.country})`,
        raw: newV,
      };
      setVendorsList(prev => [newOption, ...prev]);
      handleSelectVendor(newV._id);
      setShowQuickAdd(false);
      setQuickCompanyName("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to quick-add vendor");
    } finally {
      setQuickSaving(false);
    }
  };

  // Live landed cost calculation
  const q = Number(form.qty) || 1;
  const baseCost = (Number(form.unitCost) || 0) * (Number(form.exchangeRate) || 1);
  const pkgPerUnit = (Number(form.packagingCost) || 0) / q;
  const chinaCosts = form.vendorCountry === "China"
    ? ((Number(form.freight) || 0) + (Number(form.customsDuty) || 0) +
      (Number(form.clearingCharges) || 0) + (Number(form.insurance) || 0)) / q
    : 0;
  const landedCostPerUnit = Math.round((baseCost + pkgPerUnit + chinaCosts) * 100) / 100;
  const totalLandedCost = Math.round(landedCostPerUnit * (Number(form.qty) || 0) * 100) / 100;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.dealId) { setError("Please select a deal"); return; }
    if (!form.vendorName.trim()) { setError("Vendor name is required"); return; }
    setLoading(true);
    try {
      const res = await createPO({
        dealId: form.dealId,
        vendorRef: form.vendorRef || null,
        vendorName: form.vendorName,
        vendorCountry: form.vendorCountry,
        vendorContact: form.vendorContact,
        product: form.product,
        specs: form.specs,
        qty: Number(form.qty) || 0,
        unitCost: Number(form.unitCost) || 0,
        currency: form.currency,
        exchangeRate: Number(form.exchangeRate) || 1,
        packagingCost: Number(form.packagingCost) || 0,
        freight: Number(form.freight) || 0,
        customsDuty: Number(form.customsDuty) || 0,
        clearingCharges: Number(form.clearingCharges) || 0,
        insurance: Number(form.insurance) || 0,
      });
      onCreated(res.data.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create PO");
    } finally {
      setLoading(false);
    }
  };

  const backdropRef = useRef(null);
  const handleBackdrop = (e) => { if (e.target === backdropRef.current) onClose(); };

  const fieldStyle = { display: "flex", flexDirection: "column", gap: 5 };
  const labelStyle = {
    fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
    textTransform: "uppercase", color: "var(--text-secondary)"
  };

  return (
    <div ref={backdropRef} onClick={handleBackdrop}
      style={{
        position: "fixed", inset: 0, zIndex: 300, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 16,
        background: "rgb(0 0 0/0.6)", backdropFilter: "blur(4px)"
      }}>
      <div className="glass-strong r-xl"
        style={{
          width: "100%", maxWidth: 600, maxHeight: "90dvh",
          overflowY: "auto", padding: 28
        }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Add Purchase Order
          </h2>
          <button type="button" onClick={onClose} className="btn-icon" style={{ width: 32, height: 32 }}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Deal select */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Link to Deal *</label>
            {dealsLoading ? (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading deals…</span>
            ) : (
              <PortalDropdown value={form.dealId} onChange={setV("dealId")}
                options={dealsList} placeholder="Select a deal" />
            )}
          </div>

          {/* Vendor selection from Vendor Master / Quick-Add */}
          <div style={fieldStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={labelStyle}>Select from Vendor Master</label>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowQuickAdd(!showQuickAdd)}
                style={{ height: 24, padding: "0 8px", fontSize: 11, color: "var(--accent)" }}>
                {showQuickAdd ? "Hide Quick-Add" : "+ Quick-Add Vendor"}
              </button>
            </div>
            {vendorsLoading ? (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading vendors…</span>
            ) : (
              <PortalDropdown
                value={form.vendorRef}
                onChange={handleSelectVendor}
                options={[
                  { value: "", label: "-- Custom / Unregistered Vendor --" },
                  ...vendorsList,
                ]}
                placeholder="Choose registered vendor"
              />
            )}
          </div>

          {/* Quick-add inline box */}
          {showQuickAdd && (
            <div style={{
              padding: 12, borderRadius: 8, background: "var(--glass-bg-subtle)",
              border: "1px solid var(--glass-border)", display: "flex", flexDirection: "column", gap: 10,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase" }}>
                Quick-Add to Vendor Master
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
                <input
                  className="input-glass"
                  placeholder="Company name"
                  value={quickCompanyName}
                  onChange={(e) => setQuickCompanyName(e.target.value)}
                  style={{ height: 34, fontSize: 12 }}
                />
                <PortalDropdown
                  value={quickCountry}
                  onChange={setQuickCountry}
                  options={VENDOR_COUNTRIES.map(c => ({ value: c, label: c }))}
                />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleQuickAddVendor}
                  disabled={quickSaving || !quickCompanyName.trim()}
                  style={{ height: 34, padding: "0 12px", fontSize: 12 }}>
                  {quickSaving ? "Saving…" : "Save & Select"}
                </button>
              </div>
            </div>
          )}

          {/* Vendor info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Vendor Name *</label>
              <input className="input-glass" placeholder="Vendor Ltd." value={form.vendorName} onChange={set("vendorName")} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Vendor Country</label>
              <PortalDropdown value={form.vendorCountry} onChange={setV("vendorCountry")} options={VENDOR_COUNTRIES} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Product</label>
              <input className="input-glass" placeholder="Product name" value={form.product} onChange={set("product")} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Specs</label>
              <input className="input-glass" placeholder="Specifications" value={form.specs} onChange={set("specs")} />
            </div>
          </div>

          {/* Pricing */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Qty</label>
              <input className="input-glass" type="number" min="0" value={form.qty} onChange={set("qty")} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Unit Cost</label>
              <input className="input-glass" type="number" min="0" step="0.01" value={form.unitCost} onChange={set("unitCost")} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Currency</label>
              <PortalDropdown value={form.currency} onChange={setV("currency")} options={PO_CURRENCIES} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Exchange Rate</label>
              <input className="input-glass" type="number" min="0" step="0.01" value={form.exchangeRate} onChange={set("exchangeRate")} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Packaging Cost</label>
              <input className="input-glass" type="number" min="0" step="0.01" value={form.packagingCost} onChange={set("packagingCost")} />
            </div>
          </div>

          {/* China-specific costs — only when vendorCountry === "China" */}
          {form.vendorCountry === "China" && (
            <>
              <div style={{
                padding: "8px 12px", borderRadius: "var(--r-md)",
                background: "rgb(251 191 36/0.06)", border: "1px solid rgb(251 191 36/0.15)",
                fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
                textTransform: "uppercase", color: "#fbbf24"
              }}>
                China Import Costs
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Freight</label>
                  <input className="input-glass" type="number" min="0" step="0.01" value={form.freight} onChange={set("freight")} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Customs Duty</label>
                  <input className="input-glass" type="number" min="0" step="0.01" value={form.customsDuty} onChange={set("customsDuty")} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Clearing Charges</label>
                  <input className="input-glass" type="number" min="0" step="0.01" value={form.clearingCharges} onChange={set("clearingCharges")} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Insurance</label>
                  <input className="input-glass" type="number" min="0" step="0.01" value={form.insurance} onChange={set("insurance")} />
                </div>
              </div>
            </>
          )}

          {/* Auto-calculated landed cost preview */}
          {(Number(form.unitCost) > 0 && Number(form.qty) > 0) && (
            <div style={{
              display: "flex", alignItems: "center", gap: 14, padding: "10px 14px",
              borderRadius: "var(--r-md)", background: "rgb(45 212 191/0.06)",
              border: "1px solid rgb(45 212 191/0.15)"
            }}>
              <div>
                <span style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: "0.05em",
                  textTransform: "uppercase", color: "var(--text-muted)"
                }}>Landed / Unit </span>
                <span style={{ fontSize: 9, color: "var(--text-muted)", fontStyle: "italic" }}>auto</span>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>
                  ₹{landedCostPerUnit.toLocaleString("en-IN")}
                </div>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <span style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: "0.05em",
                  textTransform: "uppercase", color: "var(--text-muted)"
                }}>Total Landed </span>
                <span style={{ fontSize: 9, color: "var(--text-muted)", fontStyle: "italic" }}>auto</span>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>
                  ₹{totalLandedCost.toLocaleString("en-IN")}
                </div>
              </div>
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
              {loading ? "Saving…" : "Add PO"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Purchase Page ─────────────────────────────────────────────────────

export default function Purchase() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pos, setPOs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [page, setPage] = useState(1);

  // Debounced search
  const searchTimer = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const fetchPOs = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await getPOs({
        page, limit: 20,
        search: debouncedSearch,
        status: filterStatus,
        vendorCountry: filterCountry,
      });
      setPOs(res.data.data.purchases);
      setPagination(res.data.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterStatus, filterCountry]);

  useEffect(() => { fetchPOs(); }, [fetchPOs]);
  useEffect(() => { setPage(1); }, [debouncedSearch, filterStatus, filterCountry]);

  const handlePOCreated = () => {
    fetchPOs();
  };

  const clearFilters = () => {
    setSearch(""); setFilterStatus(""); setFilterCountry(""); setPage(1);
  };

  const hasFilters = search || filterStatus || filterCountry;
  const canCreate = user?.role === "superadmin" || user?.role === "manager";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12, marginBottom: 24
      }}>
        <div>
          <h1 style={{
            fontSize: "clamp(22px, 2.5vw, 32px)", fontWeight: 720,
            letterSpacing: "-0.025em", color: "var(--text-primary)", marginBottom: 4
          }}>
            Purchase Orders
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            {pagination.total > 0 ? `${pagination.total} total PO${pagination.total !== 1 ? "s" : ""}` : "Manage purchase orders linked to deals."}
          </p>
        </div>
        {canCreate && (
          <button className="btn-primary" onClick={() => setShowModal(true)}
            style={{ height: 40, padding: "0 20px", fontSize: 13, gap: 6 }}>
            <Plus size={15} />
            Add PO
          </button>
        )}
      </div>

      {/* Filters bar */}
      <div className="glass r-lg" style={{
        padding: "14px 16px", marginBottom: 16,
        display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center"
      }}>
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
          <Search size={14} strokeWidth={1.75} style={{
            position: "absolute", left: 13,
            top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none"
          }} />
          <input className="input-glass" placeholder="Search PO ID, vendor, product…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36, height: 38, fontSize: 13 }} />
        </div>
        <PortalDropdown value={filterStatus} onChange={setFilterStatus}
          options={PO_STATUSES} placeholder="All statuses" style={{ flex: "0 0 160px" }} />
        <PortalDropdown value={filterCountry} onChange={setFilterCountry}
          options={VENDOR_COUNTRIES} placeholder="All countries" style={{ flex: "0 0 140px" }} />
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
              {["PO ID", "Vendor", "Country", "Product", "Landed Cost", "Status", "Linked Deal", "Created"].map(h => (
                <th key={h} style={{
                  padding: "10px 14px", fontWeight: 600, fontSize: 11,
                  letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap"
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{
                  padding: "40px 14px", textAlign: "center",
                  color: "var(--text-muted)", fontSize: 13
                }}>
                  Loading…
                </td>
              </tr>
            ) : pos.length === 0 ? (
              <tr>
                <td colSpan={8} style={{
                  padding: "40px 14px", textAlign: "center",
                  color: "var(--text-muted)", fontSize: 13
                }}>
                  {hasFilters ? "No POs match your filters." : "No purchase orders yet."}
                </td>
              </tr>
            ) : (
              pos.map(po => (
                <tr key={po._id}
                  onClick={() => navigate(`/purchase/${po._id}`)}
                  style={{
                    borderTop: "1px solid var(--glass-border)", cursor: "pointer",
                    transition: "background 120ms ease"
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--glass-bg-subtle)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{ fontWeight: 600, color: "var(--accent)", fontSize: 12, letterSpacing: "0.03em" }}>
                      {po.poId || "—"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{po.vendorName || "—"}</span>
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <Badge label={po.vendorCountry} />
                  </td>
                  <td style={{
                    padding: "11px 14px", color: "var(--text-secondary)", maxWidth: 160,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                  }}>
                    {po.product || "—"}
                  </td>
                  <td style={{ padding: "11px 14px", color: "var(--accent)", fontWeight: 600, whiteSpace: "nowrap" }}>
                    ₹{Number(po.totalLandedCost || 0).toLocaleString("en-IN")}
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <Badge label={po.status} scheme={STATUS_COLORS[po.status]} />
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    {po.dealId ? (
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: "var(--accent)",
                        padding: "2px 8px", borderRadius: 9999, background: "rgb(45 212 191/0.08)"
                      }}>
                        {po.dealId.dealId || "—"}
                      </span>
                    ) : "—"}
                  </td>
                  <td style={{ padding: "11px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {new Date(po.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: 16, flexWrap: "wrap", gap: 10
        }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Page {pagination.page} of {pagination.pages} · {pagination.total} POs
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

      {/* Add PO modal */}
      {showModal && (
        <AddPOModal
          onClose={() => setShowModal(false)}
          onCreated={handlePOCreated}
        />
      )}
    </div>
  );
}
