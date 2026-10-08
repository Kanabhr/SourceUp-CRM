import { BrowserRouter as Router, Navigate, Routes, Route } from "react-router-dom";
import Login from "./Pages/Login";
import Register from "./Pages/Register";
import Dashboard from "./Pages/Dashboard";
import Leads from "./Pages/Leads";
import LeadDetail from "./Pages/LeadDetail";
import Deals from "./Pages/Deals";
import Commission from "./Pages/Commission";
import Purchase from "./Pages/Purchase";
import Vendors from "./Pages/Vendors";
import Quotations from "./Pages/Quotations";
import Reports from "./Pages/Reports";
import Users from "./Pages/Users";
import Settings from "./Pages/Settings";
import Notfound from "./Pages/Notfound";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import RoleRoute from "./components/RoleRoute";
import AppLayout from "./components/AppLayout";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route element={<PublicRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route element={<RoleRoute roles={["superadmin", "manager"]} />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/reports" element={<Reports />} />
            </Route>
            <Route element={<RoleRoute roles={["superadmin", "manager", "sales"]} />}>
              <Route path="/leads" element={<Leads />} />
              <Route path="/leads/:id" element={<LeadDetail />} />
              <Route path="/deals" element={<Deals />} />
              <Route path="/commission" element={<Commission />} />
            </Route>
            <Route element={<RoleRoute roles={["superadmin", "manager", "purchase"]} />}>
              <Route path="/purchase" element={<Purchase />} />
              <Route path="/vendors" element={<Vendors />} />
              <Route path="/quotations" element={<Quotations />} />
            </Route>
            <Route element={<RoleRoute roles={["superadmin"]} />}>
              <Route path="/users" element={<Users />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Notfound />} />
      </Routes>
    </Router>
  );
}

export default App;
