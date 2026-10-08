import { createContext, useContext, useEffect, useState } from "react";
import { LoginUser, LogoutUser, getCurrentUser } from "../api/authapi.js";

export const AuthContext = createContext(null);

// ─── DEV BYPASS ──────────────────────────────────────────────────────────────
// Set to true to skip login and use a mock superadmin session.
// Flip back to false before production.
const DEV_BYPASS = false;
const DEV_USER = {
  _id: "000000000000000000000000",
  username: "devadmin",
  email: "dev@sourceup.local",
  role: "superadmin",
  isActive: true,
};
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user, setUser] = useState(DEV_BYPASS ? DEV_USER : null);
  const [loading, setLoading] = useState(!DEV_BYPASS);
  const [isWakingUp, setIsWakingUp] = useState(false);

  useEffect(() => {
    if (DEV_BYPASS) return; // skip API call in dev bypass mode

    const wakeTimer = setTimeout(() => {
      setIsWakingUp(true);
    }, 3000);

    getCurrentUser()
      .then((res) => setUser(res.data.data))
      .catch(() => setUser(null))
      .finally(() => {
        clearTimeout(wakeTimer);
        setIsWakingUp(false);
        setLoading(false);
      });

    return () => clearTimeout(wakeTimer);
  }, []);

  const login = async (data) => {
    const res = await LoginUser(data);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    try {
      await LogoutUser();
    } catch {
      // API call failed — still clear local user state so the UI resets correctly
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isWakingUp }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
