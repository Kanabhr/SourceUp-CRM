import { useRef, useState } from "react";
import { AlertCircle, ImagePlus, X } from "lucide-react";

/**
 * Reference photos for a lead (R1).
 *
 * The backend stores uploaded images under public/uploads/leads and serves
 * them via express.static("public"), so each stored filename resolves to the
 * URL `/uploads/leads/<filename>`. (In dev this path is proxied to the backend
 * — see the `server.proxy` block in vite.config.js.)
 *
 * Props:
 *   - photos:   string[]  stored filenames already on the lead
 *   - canEdit:  boolean   whether to show upload + remove controls
 *   - onUpload: (file: File) => Promise<void>  called with the picked file
 *   - onRemove: (index: number) => Promise<void>  called with the array index
 *
 * Upload/removal lifecycle (busy state, error surfacing) is handled here so the
 * parent only has to provide the two API calls + a refresh.
 */
const photoUrl = (filename) =>
  `/uploads/leads/${encodeURIComponent(filename)}`;

export default function PhotoUpload({
  photos = [],
  canEdit = false,
  onUpload,
  onRemove,
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = "";
  };

  const handlePick = () => {
    setError("");
    inputRef.current?.click();
  };

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    resetInput();
    if (!file || !onUpload) return;
    setError("");
    setBusy(true);
    try {
      await onUpload(file);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not upload photo");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (index) => {
    if (!onRemove) return;
    setError("");
    setBusy(true);
    try {
      await onRemove(index);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not remove photo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {photos.map((filename, index) => (
          <div
            key={`${filename}-${index}`}
            style={{
              position: "relative",
              width: 96,
              height: 96,
              borderRadius: "var(--r-md)",
              overflow: "hidden",
              border: "1px solid var(--glass-border)",
              background: "var(--glass-bg-subtle)",
            }}
          >
            <img
              src={photoUrl(filename)}
              alt={`Reference ${index + 1}`}
              loading="lazy"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
              onError={(e) => {
                e.currentTarget.style.opacity = "0.25";
              }}
            />
            {canEdit && (
              <button
                type="button"
                onClick={() => handleRemove(index)}
                disabled={busy}
                title="Remove photo"
                className="btn-icon"
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  width: 22,
                  height: 22,
                  background: "rgb(0 0 0 / 0.55)",
                  borderColor: "rgb(239 68 68 / 0.4)",
                  color: "#ef4444",
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}

        {canEdit && (
          <button
            type="button"
            onClick={handlePick}
            disabled={busy}
            className="input-glass"
            style={{
              width: 96,
              height: 96,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              cursor: "pointer",
              borderStyle: "dashed",
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
            <ImagePlus size={18} />
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              {busy ? "…" : "Add Photo"}
            </span>
          </button>
        )}
      </div>

      {/* Hidden file input — triggered by the "Add Photo" tile above */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        style={{ display: "none" }}
      />

      {!canEdit && photos.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
          No reference photos.
        </p>
      )}

      {error && (
        <div className="error-banner">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
    </div>
  );
}
