import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import "../styles/glass.css";
import "@fontsource-variable/geist";

export default function AppLayout() {
  return (
    <div style={{ position: "relative", minHeight: "100dvh", display: "flex", overflowX: "hidden" }}>
      <div className="page-bg" aria-hidden="true" />
      <Sidebar />
      <main
        role="main"
        className="app-main"
        style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1, padding: "32px 32px 64px" }}
      >
        <Outlet />
      </main>
    </div>
  );
}
