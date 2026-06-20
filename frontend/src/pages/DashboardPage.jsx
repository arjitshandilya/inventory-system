import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dashboardApi, ApiError } from "../api/client";
import { PageHeader, Badge, EmptyState, Spinner, Button } from "../components/ui";
import "../styles/dashboard.css";

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await dashboardApi.summary();
      setSummary(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount; load is also reused by the retry button
    load();
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="A snapshot of your catalog, customers, and order activity."
      />

      {loading ? (
        <Spinner label="Loading dashboard…" />
      ) : error ? (
        <EmptyState
          title="Couldn't load dashboard"
          description={error}
          action={<Button variant="secondary" onClick={load}>Try again</Button>}
        />
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label="Total products" value={summary.total_products} to="/products" />
            <StatCard label="Total customers" value={summary.total_customers} to="/customers" />
            <StatCard label="Total orders" value={summary.total_orders} to="/orders" />
            <StatCard
              label="Low stock items"
              value={summary.low_stock_products.length}
              to="/products"
              tone={summary.low_stock_products.length > 0 ? "warning" : "default"}
            />
          </div>

          <div className="dashboard-section">
            <h2>Low stock products</h2>
            {summary.low_stock_products.length === 0 ? (
              <EmptyState
                title="Stock levels look healthy"
                description="No products are currently running low."
              />
            ) : (
              <div className="surface low-stock-list">
                {summary.low_stock_products.map((p) => (
                  <div className="low-stock-row" key={p.id}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div className="mono" style={{ fontSize: 12, color: "var(--color-ink-faint)" }}>
                        {p.sku}
                      </div>
                    </div>
                    <Badge tone={p.quantity_in_stock === 0 ? "danger" : "warning"}>
                      {p.quantity_in_stock} in stock
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, to, tone = "default" }) {
  return (
    <Link to={to} className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__value mono">{value}</div>
      <div className="stat-card__label">{label}</div>
    </Link>
  );
}
