import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { Mail, User, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from "lucide-react";
import { ValidEmail, ValidPassword, ValidUserName } from "../utils/Validators";
import { registerUser } from "../api/authapi";
import "../styles/glass.css";
import "@fontsource-variable/geist";

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const reduce = useReducedMotion();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !username || !password) {
      setError("Please fill in all fields");
      return;
    }
    if (!ValidEmail(email)) {
      setError("Enter a valid email address");
      return;
    }
    if (!ValidUserName(username)) {
      setError("Username must be 5-16 characters");
      return;
    }
    if (!ValidPassword(password)) {
      setError("Password needs 8+ characters, uppercase, number, and special character (@$!%*?&)");
      return;
    }
    setLoading(true);
    try {
      await registerUser({ username, email, password });
      navigate("/login");
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || "Registration failed";
      // 403 = a superadmin already exists — send them to login
      if (status === 403) {
        setError("A SuperAdmin already exists. Redirecting to login…");
        setTimeout(() => navigate("/login"), 2000);
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "relative", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <div className="page-bg" aria-hidden="true" />
      <nav className="nav-glass" role="navigation" aria-label="Main navigation">
        <Link to="/login" className="nav-logo">
          <div className="nav-logo-mark" aria-hidden="true">
            S
          </div>
          SourceUp
        </Link>
        <div className="nav-actions">
          <Link to="/login" className="btn-ghost" style={{ height: 36, padding: "0 18px", fontSize: 13 }}>
            Sign in
          </Link>
        </div>
      </nav>
      <main
        role="main"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "clamp(80px, 12vh, 120px) 24px 48px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <motion.div
          {...(reduce
            ? {}
            : {
                initial: { opacity: 0, y: 28, scale: 0.97 },
                animate: { opacity: 1, y: 0, scale: 1 },
                transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
              })}
          style={{ width: "100%", maxWidth: 420 }}
        >
          <div className="glass-strong r-xl card-glass">
            <div style={{ marginBottom: 28, textAlign: "center" }}>
              <h1 style={{ fontSize: 22, fontWeight: 720, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: 6 }}>
                Create SuperAdmin
              </h1>
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>One-time setup. Additional users are created in Users.</p>
            </div>
            <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="field">
                <label htmlFor="username" className="field-label">
                  Username
                </label>
                <div className="input-wrapper">
                  <span className="input-icon" aria-hidden="true">
                    <User size={16} strokeWidth={1.75} />
                  </span>
                  <input
                    id="username"
                    className="input-glass"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="email" className="field-label">
                  Email
                </label>
                <div className="input-wrapper">
                  <span className="input-icon" aria-hidden="true">
                    <Mail size={16} strokeWidth={1.75} />
                  </span>
                  <input
                    id="email"
                    type="email"
                    className="input-glass"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="password" className="field-label">
                  Password
                </label>
                <div className="input-wrapper">
                  <span className="input-icon" aria-hidden="true">
                    <Lock size={16} strokeWidth={1.75} />
                  </span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="input-glass"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    style={{ paddingRight: 48 }}
                  />
                  <button type="button" className="input-toggle" onClick={() => setShowPassword((v) => !v)}>
                    {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="error-banner" role="alert">
                  <AlertCircle size={15} />
                  {error}
                </div>
              )}
              <button type="submit" className="btn-primary full" disabled={loading}>
                {loading ? "Creating..." : (
                  <>
                    Create account
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
