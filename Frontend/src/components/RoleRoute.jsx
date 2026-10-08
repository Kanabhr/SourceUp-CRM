import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/Authcontext.jsx";
import { homeForRole } from "../utils/roles.js";

export default function RoleRoute({ roles }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return <Outlet />;
}
