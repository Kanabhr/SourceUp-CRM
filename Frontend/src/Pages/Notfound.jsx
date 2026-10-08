import { Link } from "react-router-dom";

export default function Notfound() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <div className="page-bg" aria-hidden="true" />
      <div className="glass-strong r-xl card-glass" style={{ textAlign: "center", zIndex: 1 }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Page not found</h1>
        <Link to="/login" style={{ color: "var(--accent)" }}>
          Back to login
        </Link>
      </div>
    </div>
  );
}
