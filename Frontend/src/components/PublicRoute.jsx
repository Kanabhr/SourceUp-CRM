import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/Authcontext.jsx";
import { homeForRole } from "../utils/roles.js";
import "../styles/glass.css";
import "@fontsource-variable/geist";

export default function PublicRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-deep)",
        }}
        aria-label="Loading"
        role="status"
      >
        <div className="page-bg" aria-hidden="true" />
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "3px solid rgb(255 255 255 / 0.10)",
            borderTopColor: "var(--accent)",
            animation: "spin 0.75s linear infinite",
          }}
          aria-hidden="true"
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (user) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return <Outlet />;
}
