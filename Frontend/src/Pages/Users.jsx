import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { createUser, getUsers } from "../api/usersApi.js";
import { ValidEmail, ValidPassword, ValidUserName } from "../utils/Validators.js";
import PortalDropdown from "../components/PortalDropdown.jsx";

const ROLES = ["sales", "purchase", "manager", "superadmin"];

export default function Users() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("sales");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const loadUsers = async () => {
    const res = await getUsers();
    setUsers(res.data.data || []);
  };

  useEffect(() => {
    loadUsers().catch((err) => setError(err.response?.data?.message || "Failed to load users"));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!ValidUserName(username) || !ValidEmail(email) || !ValidPassword(password)) {
      setError("Username 5-16 chars, valid email, and a strong password are required.");
      return;
    }
    setLoading(true);
    try {
      await createUser({ username, email, password, role });
      setSuccess(`${username} created as ${role}`);
      setUsername("");
      setEmail("");
      setPassword("");
      setRole("sales");
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: "clamp(22px, 2.5vw, 32px)", fontWeight: 720, letterSpacing: "-0.025em", color: "var(--text-primary)", marginBottom: 8 }}>
        Users
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>Create accounts and assign roles.</p>

      <div className="glass r-lg" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Create user</h2>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", overflow: "visible" }}>
          <input className="input-glass" placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input className="input-glass" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input-glass" type="password" placeholder="Password1!" value={password} onChange={(e) => setPassword(e.target.value)} />
          <PortalDropdown value={role} onChange={setRole} options={ROLES} />
          <button type="submit" className="btn-primary" disabled={loading} style={{ gridColumn: "1 / -1" }}>
            {loading ? "Creating..." : "Create user"}
          </button>
        </form>
        {error && (
          <div className="error-banner" style={{ marginTop: 12 }}>
            <AlertCircle size={15} />
            {error}
          </div>
        )}
        {success && <p style={{ marginTop: 12, color: "var(--accent)", fontSize: 13 }}>{success}</p>}
      </div>

      <div className="glass r-lg" style={{ padding: 24, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-muted)" }}>
              <th style={{ padding: "8px 6px" }}>Username</th>
              <th style={{ padding: "8px 6px" }}>Email</th>
              <th style={{ padding: "8px 6px" }}>Role</th>
              <th style={{ padding: "8px 6px" }}>Active</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} style={{ borderTop: "1px solid var(--glass-border)" }}>
                <td style={{ padding: "10px 6px" }}>{u.username}</td>
                <td style={{ padding: "10px 6px" }}>{u.email}</td>
                <td style={{ padding: "10px 6px", textTransform: "capitalize" }}>{u.role}</td>
                <td style={{ padding: "10px 6px" }}>{u.isActive ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
