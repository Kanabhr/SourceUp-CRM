import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, ChevronLeft, ChevronRight,
  Edit2, Eye, Plus, Search, Star, Trash2, X,
} from "lucide-react";
import { useAuth } from "../context/Authcontext";
import {
  getVendors,
  createVendor,
  updateVendor,
  deleteVendor,
} from "../api/vendorApi.js";
import PortalDropdown from "../components/PortalDropdown.jsx";

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const VENDOR_CATEGORIES = [
  "Packaging",
  "Electronics",
  "Apparel",
  "Plastics",
  "Metals",
  "Other",
];

const VENDOR_COUNTRIES = ["India", "China", "Other"];
const VENDOR_STATUSES = ["Active", "Inactive"];

const COUNTRY_COLORS = {
  India: { bg: "rgb(251 146 60 / 0.12)", color: "#fb923c" },
  China: { bg: "rgb(239 68 68 / 0.12)", color: "#f87171" },
  Other: { bg: "rgb(148 163 184 / 0.12)", color: "#94a3b8" },
};

const CATEGORY_COLORS = {
  Packaging: { bg: "rgb(168 85 247 / 0.12)", color: "#c084fc" },
  Electronics: { bg: "rgb(59 130 246 / 0.12)", color: "#60a5fa" },
  Apparel: { bg: "rgb(236 72 153 / 0.12)", color: "#f472b6" },
  Plastics: { bg: "rgb(20 184 166 / 0.12)", color: "#2dd4bf" },
  Metals: { bg: "rgb(245 158 11 / 0.12)", color: "#fbbf24" },
  Other: { bg: "rgb(100 116 139 / 0.12)", color: "#94a3b8" },
};

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Badge({ label, scheme }) {
  const s = scheme || { bg: "rgb(255 255 255/0.06)", color: "var(--text-secondary)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 9px", borderRadius: 9999,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
      whiteSpace: "nowrap", background: s.bg, color: s.color,
    }}>
      {label}
    </span>
  );
}

function StarRating({ rating }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={13}
          style={{
            fill: s <= rating ? "#fbbf24" : "none",
            color: s <= rating ? "#fbbf24" : "var(--text-muted)",
          }}
        />
      ))}
      <span style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", marginLeft: 4 }}>
        {rating}.0
      </span>
    </div>
  );
}

// â”€â”€â”€ Modal Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const fieldStyle = { display: "flex", flexDirection: "column", gap: 5 };
const labelStyle = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
};

// â”€â”€â”€ Add / Edit Vendor Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function VendorFormModal({ vendor = null, onClose, onSaved }) {
  const isEdit = Boolean(vendor);
  const [form, setForm] = useState({
    companyName: vendor?.companyName || "",
    contactPerson: vendor?.contactPerson || "",
    phone: vendor?.phone || "",
    email: vendor?.email || "",
    country: vendor?.country || "India",
    city: vendor?.city || "",
    factoryAddress: vendor?.factoryAddress || "",
    category: vendor?.category || "Packaging",
    products: Array.isArray(vendor?.products) ? vendor.products.join(", ") : (vendor?.products || ""),
    paymentTerms: vendor?.paymentTerms || "",
    rating: String(vendor?.rating || 3),
    remarks: vendor?.remarks || "",
    status: vendor?.status || "Active",
    bankBeneficiary: vendor?.bankDetails?.beneficiaryName || "",
    bankName: vendor?.bankDetails?.bankName || "",
    bankAccountNo: vendor?.bankDetails?.accountNo || "",
    bankIfscOrSwift: vendor?.bankDetails?.ifscOrSwift || "",
    bankBranch: vendor?.bankDetails?.branch || "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const backdropRef = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setV = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.companyName.trim()) {
      setError("Company name is required");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        companyName: form.companyName.trim(),
        contactPerson: form.contactPerson.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        country: form.country,
        city: form.city.trim(),
        factoryAddress: form.factoryAddress.trim(),
        category: form.category,
        products: form.products.split(",").map((p) => p.trim()).filter(Boolean),
        paymentTerms: form.paymentTerms.trim(),
        rating: Number(form.rating) || 3,
        remarks: form.remarks.trim(),
        status: form.status,
        bankDetails: {
          beneficiaryName: form.bankBeneficiary.trim(),
          bankName: form.bankName.trim(),
          accountNo: form.bankAccountNo.trim(),
          ifscOrSwift: form.bankIfscOrSwift.trim(),
          branch: form.bankBranch.trim(),
        },
      };

      let res;
      if (isEdit) {
        res = await updateVendor(vendor._id, payload);
      } else {
        res = await createVendor(payload);
      }
      onSaved(res.data.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || `Could not ${isEdit ? "update" : "create"} vendor`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={backdropRef}
      onClick={(e) => e.target === backdropRef.current && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="glass-bright r-lg"
        style={{
          width: "100%", maxWidth: 640, maxHeight: "90vh",
          display: "flex", flexDirection: "column",
          border: "1px solid var(--glass-border)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid var(--glass-border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
              {isEdit ? `Edit Vendor (${vendor.vendorId || vendor.companyName})` : "Add New Vendor"}
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              {isEdit ? "Update vendor details and payment info." : "Create a record in Vendor Master for procurement."}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--text-secondary)", padding: 4, display: "flex",
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
              borderRadius: 8, background: "rgb(239 68 68 / 0.12)", border: "1px solid rgb(239 68 68 / 0.25)",
              color: "#f87171", fontSize: 13,
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Section: Basic info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Company Name *</label>
              <input
                className="input-glass"
                placeholder="e.g. Zhejiang Apex Packaging Ltd."
                value={form.companyName}
                onChange={set("companyName")}
                required
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Contact Person</label>
              <input
                className="input-glass"
                placeholder="e.g. Mr. Wei Zhang / Rajesh Gupta"
                value={form.contactPerson}
                onChange={set("contactPerson")}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Phone / WeChat / WhatsApp</label>
              <input
                className="input-glass"
                placeholder="+86 138-0000 / +91 98765"
                value={form.phone}
                onChange={set("phone")}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                className="input-glass"
                placeholder="sales@vendor.com"
                value={form.email}
                onChange={set("email")}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Country</label>
              <PortalDropdown
                value={form.country}
                options={VENDOR_COUNTRIES.map((c) => ({ value: c, label: c }))}
                onChange={setV("country")}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>City</label>
              <input
                className="input-glass"
                placeholder="Ningbo, Yiwu, Mumbai..."
                value={form.city}
                onChange={set("city")}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Category</label>
              <PortalDropdown
                value={form.category}
                options={VENDOR_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
                onChange={setV("category")}
              />
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Factory / Office Address</label>
            <textarea
              className="input-glass"
              rows={2}
              placeholder="No. 128 Industrial Park, District, Province..."
              value={form.factoryAddress}
              onChange={set("factoryAddress")}
              style={{ resize: "vertical" }}
            />
          </div>

          {/* Section: Products & Terms */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Products Manufactured / Supplied (Comma separated)</label>
            <input
              className="input-glass"
              placeholder="Rigid Boxes, Corrugated Cartons, Custom Pouches"
              value={form.products}
              onChange={set("products")}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Payment Terms Accepted</label>
              <input
                className="input-glass"
                placeholder="30% Advance, 70% before dispatch"
                value={form.paymentTerms}
                onChange={set("paymentTerms")}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Vendor Rating</label>
              <PortalDropdown
                value={form.rating}
                options={[
                  { value: "5", label: "â˜…â˜…â˜…â˜…â˜… (5 Stars - Excellent)" },
                  { value: "4", label: "â˜…â˜…â˜…â˜…â˜† (4 Stars - Good)" },
                  { value: "3", label: "â˜…â˜…â˜…â˜†â˜† (3 Stars - Average)" },
                  { value: "2", label: "â˜…â˜…â˜†â˜†â˜† (2 Stars - Low)" },
                  { value: "1", label: "â˜…â˜†â˜†â˜†â˜† (1 Star - Poor)" },
                ]}
                onChange={setV("rating")}
              />
            </div>
          </div>

          {/* Section: Bank Details */}
          <div style={{
            padding: 14, borderRadius: 10,
            background: "var(--glass-bg-subtle)", border: "1px solid var(--glass-border)",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Bank & Beneficiary Details
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Beneficiary Name</label>
                <input
                  className="input-glass"
                  placeholder="Beneficiary Account Name"
                  value={form.bankBeneficiary}
                  onChange={set("bankBeneficiary")}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Bank Name</label>
                <input
                  className="input-glass"
                  placeholder="Bank of China / HDFC Bank"
                  value={form.bankName}
                  onChange={set("bankName")}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Account / IBAN No.</label>
                <input
                  className="input-glass"
                  placeholder="Account number"
                  value={form.bankAccountNo}
                  onChange={set("bankAccountNo")}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>IFSC / SWIFT Code</label>
                <input
                  className="input-glass"
                  placeholder="SWIFT or IFSC code"
                  value={form.bankIfscOrSwift}
                  onChange={set("bankIfscOrSwift")}
                />
              </div>
            </div>
          </div>

          {/* Section: Status & Remarks */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Status</label>
              <PortalDropdown
                value={form.status}
                options={VENDOR_STATUSES.map((s) => ({ value: s, label: s }))}
                onChange={setV("status")}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Remarks / Past Performance</label>
              <input
                className="input-glass"
                placeholder="Reliable lead times, good packaging quality..."
                value={form.remarks}
                onChange={set("remarks")}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{
            display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8,
            paddingTop: 14, borderTop: "1px solid var(--glass-border)",
          }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={onClose}
              disabled={loading}
              style={{ height: 38, padding: "0 18px", fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ height: 38, padding: "0 22px", fontSize: 13 }}
            >
              {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Vendor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// â”€â”€â”€ View Vendor Drawer / Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function VendorViewModal({ vendor, onClose, onEdit, canEdit }) {
  const backdropRef = useRef(null);
  const navigate = useNavigate();

  return (
    <div
      ref={backdropRef}
      onClick={(e) => e.target === backdropRef.current && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="glass-bright r-lg"
        style={{
          width: "100%", maxWidth: 580, maxHeight: "90vh",
          display: "flex", flexDirection: "column",
          border: "1px solid var(--glass-border)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid var(--glass-border)",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>
                {vendor.vendorId}
              </span>
              <Badge label={vendor.status} scheme={vendor.status === "Active" ? { bg: "rgb(34 197 94/0.12)", color: "#22c55e" } : { bg: "rgb(148 163 184/0.12)", color: "#94a3b8" }} />
              <Badge label={vendor.country} scheme={COUNTRY_COLORS[vendor.country]} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 720, color: "var(--text-primary)" }}>
              {vendor.companyName}
            </h2>
            <div style={{ marginTop: 4 }}>
              <StarRating rating={vendor.rating || 3} />
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--text-secondary)", padding: 4, display: "flex",
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Contact & Location */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <span style={labelStyle}>Contact Person</span>
              <p style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2 }}>{vendor.contactPerson || "â€”"}</p>
            </div>
            <div>
              <span style={labelStyle}>Phone / WeChat / WhatsApp</span>
              <p style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2 }}>{vendor.phone || "â€”"}</p>
            </div>
            <div>
              <span style={labelStyle}>Email</span>
              <p style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2 }}>{vendor.email || "â€”"}</p>
            </div>
            <div>
              <span style={labelStyle}>Category</span>
              <div style={{ marginTop: 2 }}>
                <Badge label={vendor.category} scheme={CATEGORY_COLORS[vendor.category]} />
              </div>
            </div>
          </div>

          {vendor.factoryAddress && (
            <div>
              <span style={labelStyle}>Factory / Office Address</span>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                {vendor.city ? `${vendor.city}, ` : ""}{vendor.factoryAddress}
              </p>
            </div>
          )}

          {/* Products */}
          <div>
            <span style={labelStyle}>Products Manufactured / Supplied</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {vendor.products && vendor.products.length > 0 ? (
                vendor.products.map((p, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 12,
                      background: "var(--glass-bg-subtle)", border: "1px solid var(--glass-border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {p}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>None specified</span>
              )}
            </div>
          </div>

          {/* Payment Terms */}
          <div>
            <span style={labelStyle}>Payment Terms Accepted</span>
            <p style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2 }}>{vendor.paymentTerms || "Standard terms"}</p>
          </div>

          {/* Bank details card */}
          {vendor.bankDetails && (vendor.bankDetails.bankName || vendor.bankDetails.accountNo) && (
            <div style={{
              padding: 14, borderRadius: 10,
              background: "var(--glass-bg-subtle)", border: "1px solid var(--glass-border)",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Bank & Remittance Info
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                <div><span style={{ color: "var(--text-muted)" }}>Beneficiary:</span> {vendor.bankDetails.beneficiaryName || "â€”"}</div>
                <div><span style={{ color: "var(--text-muted)" }}>Bank:</span> {vendor.bankDetails.bankName || "â€”"}</div>
                <div><span style={{ color: "var(--text-muted)" }}>Account/IBAN:</span> {vendor.bankDetails.accountNo || "â€”"}</div>
                <div><span style={{ color: "var(--text-muted)" }}>IFSC / SWIFT:</span> {vendor.bankDetails.ifscOrSwift || "â€”"}</div>
              </div>
            </div>
          )}

          {/* Remarks */}
          {vendor.remarks && (
            <div>
              <span style={labelStyle}>Past Performance / Remarks</span>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2, fontStyle: "italic" }}>
                "{vendor.remarks}"
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px", borderTop: "1px solid var(--glass-border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate("/purchase")}
            style={{ height: 36, padding: "0 16px", fontSize: 12, gap: 6 }}
          >
            + Raise PO with this Vendor
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {canEdit && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => { onClose(); onEdit(vendor); }}
                style={{ height: 36, padding: "0 16px", fontSize: 12, gap: 6 }}
              >
                <Edit2 size={14} />
                Edit Vendor
              </button>
            )}
            <button
              type="button"
              className="btn-ghost"
              onClick={onClose}
              style={{ height: 36, padding: "0 16px", fontSize: 12 }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Main Vendors Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function Vendors() {
  const { user } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRating, setFilterRating] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [viewingVendor, setViewingVendor] = useState(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Load vendors
  const fetchVendors = useCallback((page = 1) => {
    setLoading(true);
    setError("");
    getVendors({
      page,
      limit: 20,
      search: debouncedSearch,
      country: filterCountry,
      category: filterCategory,
      status: filterStatus,
      rating: filterRating,
    })
      .then((res) => {
        setVendors(res.data.data.vendors);
        setPagination(res.data.data.pagination);
      })
      .catch((err) => setError(err.response?.data?.message || "Failed to load vendors"))
      .finally(() => setLoading(false));
  }, [debouncedSearch, filterCountry, filterCategory, filterStatus, filterRating]);

  useEffect(() => {
    fetchVendors(1);
  }, [fetchVendors]);

  // Permissions
  const canCreate = user?.role === "sales" || user?.role === "manager" || user?.role === "superadmin" || user?.role === "purchase";
  const canEdit = user?.role === "manager" || user?.role === "superadmin";
  const canDelete = user?.role === "superadmin";

  const handleDelete = async (vendor) => {
    if (!window.confirm(`Are you sure you want to delete vendor "${vendor.companyName}"?`)) return;
    try {
      await deleteVendor(vendor._id);
      fetchVendors(pagination.page);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete vendor");
    }
  };

  // KPI Calculations
  const totalCount = pagination.total || 0;
  const activeCount = vendors.filter((v) => v.status === "Active").length;
  const chinaCount = vendors.filter((v) => v.country === "China").length;
  const indiaCount = vendors.filter((v) => v.country === "India").length;

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      {/* Page Header */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "flex-start",
        justifyContent: "space-between", gap: 16, marginBottom: 24,
      }}>
        <div>
          <h1 style={{
            fontSize: "clamp(22px, 2.5vw, 32px)", fontWeight: 720,
            letterSpacing: "-0.025em", color: "var(--text-primary)", marginBottom: 4,
          }}>
            Vendor Master
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Directory of verified manufacturers, packaging vendors, and suppliers across India & China.
          </p>
        </div>

        {canCreate && (
          <button
            className="btn-primary"
            onClick={() => setShowAddModal(true)}
            style={{ height: 40, padding: "0 20px", fontSize: 13, gap: 6 }}
          >
            <Plus size={15} />
            Add Vendor
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 14, marginBottom: 20,
      }}>
        <div className="glass r-lg" style={{ padding: "16px 20px" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>Total Vendors</span>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>{totalCount}</div>
        </div>
        <div className="glass r-lg" style={{ padding: "16px 20px" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>Active Suppliers</span>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#22c55e", marginTop: 4 }}>{activeCount}</div>
        </div>
        <div className="glass r-lg" style={{ padding: "16px 20px" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>India Vendors</span>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#fb923c", marginTop: 4 }}>{indiaCount}</div>
        </div>
        <div className="glass r-lg" style={{ padding: "16px 20px" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>China Factories</span>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#f87171", marginTop: 4 }}>{chinaCount}</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="glass r-lg" style={{
        padding: "14px 16px", marginBottom: 16,
        display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
      }}>
        {/* Search */}
        <div style={{ position: "relative", minWidth: 240, flex: "1 1 240px" }}>
          <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            className="input-glass"
            placeholder="Search company, contact, city, products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 32, height: 36, fontSize: 13 }}
          />
        </div>

        {/* Country */}
        <div style={{ minWidth: 130 }}>
          <PortalDropdown
            value={filterCountry}
            options={[
              { value: "", label: "All Countries" },
              ...VENDOR_COUNTRIES.map((c) => ({ value: c, label: c })),
            ]}
            onChange={setFilterCountry}
          />
        </div>

        {/* Category */}
        <div style={{ minWidth: 140 }}>
          <PortalDropdown
            value={filterCategory}
            options={[
              { value: "", label: "All Categories" },
              ...VENDOR_CATEGORIES.map((cat) => ({ value: cat, label: cat })),
            ]}
            onChange={setFilterCategory}
          />
        </div>

        {/* Status */}
        <div style={{ minWidth: 120 }}>
          <PortalDropdown
            value={filterStatus}
            options={[
              { value: "", label: "All Status" },
              ...VENDOR_STATUSES.map((s) => ({ value: s, label: s })),
            ]}
            onChange={setFilterStatus}
          />
        </div>

        {/* Rating */}
        <div style={{ minWidth: 130 }}>
          <PortalDropdown
            value={filterRating}
            options={[
              { value: "", label: "Any Rating" },
              { value: "4", label: "â˜… 4 Stars & Up" },
              { value: "3", label: "â˜… 3 Stars & Up" },
              { value: "5", label: "â˜… 5 Stars Only" },
            ]}
            onChange={setFilterRating}
          />
        </div>

        {/* Reset */}
        {(filterCountry || filterCategory || filterStatus || filterRating || search) && (
          <button
            className="btn-ghost"
            onClick={() => {
              setFilterCountry("");
              setFilterCategory("");
              setFilterStatus("");
              setFilterRating("");
              setSearch("");
            }}
            style={{ height: 36, padding: "0 12px", fontSize: 12 }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
          borderRadius: 8, background: "rgb(239 68 68 / 0.12)", border: "1px solid rgb(239 68 68 / 0.25)",
          color: "#f87171", fontSize: 13, marginBottom: 16,
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="glass r-lg" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
            <thead>
              <tr style={{
                borderBottom: "1px solid var(--glass-border)",
                background: "rgba(255,255,255,0.02)",
              }}>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-secondary)", fontSize: 11, textTransform: "uppercase" }}>Vendor ID</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-secondary)", fontSize: 11, textTransform: "uppercase" }}>Company & Country</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-secondary)", fontSize: 11, textTransform: "uppercase" }}>Category</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-secondary)", fontSize: 11, textTransform: "uppercase" }}>Products Supplied</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-secondary)", fontSize: 11, textTransform: "uppercase" }}>Contact Person</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-secondary)", fontSize: 11, textTransform: "uppercase" }}>Rating</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-secondary)", fontSize: 11, textTransform: "uppercase" }}>Status</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-secondary)", fontSize: 11, textTransform: "uppercase", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
                    Loading vendors...
                  </td>
                </tr>
              ) : vendors.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
                    No vendors found. Click "+ Add Vendor" to add your first supplier.
                  </td>
                </tr>
              ) : (
                vendors.map((vendor) => (
                  <tr
                    key={vendor._id}
                    style={{
                      borderBottom: "1px solid var(--glass-border)",
                      transition: "background 150ms ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--glass-bg-subtle)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "14px 16px", fontWeight: 700, color: "var(--accent)" }}>
                      {vendor.vendorId}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {vendor.companyName}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <Badge label={vendor.country} scheme={COUNTRY_COLORS[vendor.country]} />
                        {vendor.city && (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{vendor.city}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <Badge label={vendor.category} scheme={CATEGORY_COLORS[vendor.category]} />
                    </td>
                    <td style={{ padding: "14px 16px", maxWidth: 220 }}>
                      <span style={{
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        overflow: "hidden", color: "var(--text-secondary)", fontSize: 12,
                      }}>
                        {vendor.products && vendor.products.length > 0
                          ? vendor.products.join(", ")
                          : "â€”"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                        {vendor.contactPerson || "â€”"}
                      </div>
                      {vendor.phone && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          {vendor.phone}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <StarRating rating={vendor.rating || 3} />
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <Badge
                        label={vendor.status}
                        scheme={vendor.status === "Active"
                          ? { bg: "rgb(34 197 94/0.12)", color: "#22c55e" }
                          : { bg: "rgb(148 163 184/0.12)", color: "#94a3b8" }}
                      />
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <button
                          title="View Details"
                          className="btn-ghost"
                          onClick={() => setViewingVendor(vendor)}
                          style={{ padding: "6px 8px", height: "auto" }}
                        >
                          <Eye size={15} />
                        </button>
                        {canEdit && (
                          <button
                            title="Edit Vendor"
                            className="btn-ghost"
                            onClick={() => setEditingVendor(vendor)}
                            style={{ padding: "6px 8px", height: "auto" }}
                          >
                            <Edit2 size={15} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            title="Delete Vendor"
                            className="btn-ghost"
                            onClick={() => handleDelete(vendor)}
                            style={{ padding: "6px 8px", height: "auto", color: "#f87171" }}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {pagination.pages > 1 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderTop: "1px solid var(--glass-border)",
            fontSize: 12, color: "var(--text-secondary)",
          }}>
            <span>
              Page {pagination.page} of {pagination.pages} ({pagination.total} total vendors)
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="btn-ghost"
                disabled={pagination.page <= 1}
                onClick={() => fetchVendors(pagination.page - 1)}
                style={{ padding: "4px 8px", height: "auto" }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="btn-ghost"
                disabled={pagination.page >= pagination.pages}
                onClick={() => fetchVendors(pagination.page + 1)}
                style={{ padding: "4px 8px", height: "auto" }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <VendorFormModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => fetchVendors(1)}
        />
      )}

      {/* Edit Modal */}
      {editingVendor && (
        <VendorFormModal
          vendor={editingVendor}
          onClose={() => setEditingVendor(null)}
          onSaved={() => fetchVendors(pagination.page)}
        />
      )}

      {/* View Modal */}
      {viewingVendor && (
        <VendorViewModal
          vendor={viewingVendor}
          onClose={() => setViewingVendor(null)}
          onEdit={(v) => setEditingVendor(v)}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}

