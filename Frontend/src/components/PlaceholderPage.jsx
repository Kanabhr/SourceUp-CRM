import { useAuth } from "../context/Authcontext";

export default function PlaceholderPage({ title, description }) {
  const { user } = useAuth();
  return (
    <div>
      <h1 style={{ fontSize: "clamp(22px, 2.5vw, 32px)", fontWeight: 720, letterSpacing: "-0.025em", color: "var(--text-primary)", marginBottom: 8 }}>
        {title}
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>{description}</p>
      <div className="glass r-lg" style={{ padding: 24 }}>
        <p style={{ fontSize: 14, color: "var(--text-primary)" }}>
          Signed in as <strong>{user?.username}</strong> ({user?.role})
        </p>
      </div>
    </div>
  );
}
