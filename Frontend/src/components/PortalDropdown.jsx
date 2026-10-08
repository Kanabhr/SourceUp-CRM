import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

function normalise(options) {
  return options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
}

function DropdownPanel({ triggerRef, onClose, children }) {
  const panelRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, minWidth: 0, ready: false });

  const reposition = () => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const panelH = panelRef.current ? panelRef.current.offsetHeight : 220;
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow >= panelH + 8 ? r.bottom + 4 : r.top - panelH - 4;
    const left = r.left;
    const minWidth = r.width;
    setPos((prev) => {
      if (prev.ready && prev.top === top && prev.left === left && prev.minWidth === minWidth) {
        return prev;
      }
      return { top, left, minWidth, ready: true };
    });
  };

  useEffect(() => {
    reposition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onDown = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose, triggerRef]);

  useEffect(() => {
    window.addEventListener("scroll", reposition, { passive: true, capture: true });
    window.addEventListener("resize", reposition, { passive: true });
    return () => {
      window.removeEventListener("scroll", reposition, { capture: true });
      window.removeEventListener("resize", reposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        minWidth: pos.minWidth,
        width: "max-content",
        zIndex: 9999,
        padding: 4,
        borderRadius: "var(--r-md)",
        border: "1px solid var(--glass-border-hi)",
        background: "var(--bg-elevated)",
        boxShadow: "0 8px 32px rgb(0 0 0 / 0.72), 0 2px 8px rgb(0 0 0 / 0.48)",
        display: "flex",
        flexDirection: "column",
        gap: 1,
        opacity: pos.ready ? 1 : 0,
        pointerEvents: pos.ready ? "auto" : "none",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

function OptionBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "8px 12px",
        border: "none",
        borderRadius: "var(--r-sm)",
        fontFamily: "inherit",
        fontSize: 13,
        cursor: "pointer",
        background: active ? "rgb(45 212 191 / 0.12)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-primary)",
        transition: "background 120ms ease",
        whiteSpace: "nowrap",
        textTransform: "capitalize",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgb(255 255 255 / 0.06)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

export default function PortalDropdown({
  value,
  onChange,
  options = [],
  placeholder,
  style,
  triggerStyle,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const normalised = normalise(options);
  const selected = normalised.find((o) => o.value === value);

  const close = () => setOpen(false);
  const select = (v) => { onChange(v); close(); };

  const displayLabel = selected ? selected.label : (placeholder || "Select");

  return (
    <div style={{ position: "relative", ...style }}>
      <button
        ref={triggerRef}
        type="button"
        className="input-glass"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          cursor: disabled ? "not-allowed" : "pointer",
          paddingRight: 10,
          textAlign: "left",
          color: selected ? "var(--text-primary)" : "var(--text-muted)",
          opacity: disabled ? 0.5 : 1,
          textTransform: "capitalize",
          ...triggerStyle,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: "capitalize" }}>
          {displayLabel}
        </span>
        <ChevronDown
          size={13}
          strokeWidth={1.75}
          style={{
            flexShrink: 0,
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 150ms ease",
          }}
        />
      </button>

      {open && (
        <DropdownPanel triggerRef={triggerRef} onClose={close}>
          {placeholder && (
            <OptionBtn active={false} onClick={() => select("")}>
              <span style={{ color: "var(--text-muted)" }}>{placeholder}</span>
            </OptionBtn>
          )}
          {normalised.map((o) => (
            <OptionBtn key={o.value} active={value === o.value} onClick={() => select(o.value)}>
              {o.label}
            </OptionBtn>
          ))}
        </DropdownPanel>
      )}
    </div>
  );
}
