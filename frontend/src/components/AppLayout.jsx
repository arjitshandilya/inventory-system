import { NavLink, Outlet } from "react-router-dom";
import "../styles/layout.css";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", end: true, glyph: "01" },
  { to: "/products", label: "Products", glyph: "02" },
  { to: "/customers", label: "Customers", glyph: "03" },
  { to: "/orders", label: "Orders", glyph: "04" },
];

export default function AppLayout() {
  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <div className="shell__brand">
          <span className="shell__brand-mark">SR</span>
          <div>
            <div className="shell__brand-name">Stockroom</div>
            <div className="shell__brand-sub">Inventory &amp; Orders</div>
          </div>
        </div>

        <nav className="shell__nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                "shell__nav-link" + (isActive ? " shell__nav-link--active" : "")
              }
            >
              <span className="shell__nav-glyph mono">{item.glyph}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="shell__footer">
          <span className="mono">v1.0.0</span>
        </div>
      </aside>

      <div className="shell__main">
        <Outlet />
      </div>
    </div>
  );
}
