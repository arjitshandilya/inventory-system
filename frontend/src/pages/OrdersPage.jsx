import { useEffect, useMemo, useState } from "react";
import { ordersApi, productsApi, customersApi, ApiError } from "../api/client";
import { PageHeader, Button, Badge, EmptyState, Spinner, Modal, ConfirmDialog } from "../components/ui";
import { DataTable } from "../components/DataTable";
import { Field } from "../components/Field";
import { useToast } from "../components/Toast";

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function OrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function loadOrders() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await ordersApi.list();
      setOrders(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount; loadOrders is also reused by the retry button and after mutations
    loadOrders();
  }, []);

  async function openCreateModal() {
    setCreateOpen(true);
    try {
      const [p, c] = await Promise.all([productsApi.list(), customersApi.list()]);
      setProducts(p);
      setCustomers(c);
    } catch {
      toast.error("Couldn't load products/customers for the order form.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await ordersApi.remove(deleteTarget.id);
      toast.success(`Order #${deleteTarget.id} cancelled and stock restored.`);
      setDeleteTarget(null);
      await loadOrders();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not cancel order.");
    } finally {
      setDeleting(false);
    }
  }

  const columns = [
    { key: "id", header: "Order", render: (o) => <span className="mono" style={{ fontWeight: 600 }}>#{o.id}</span> },
    { key: "customer_name", header: "Customer", render: (o) => o.customer_name || `Customer #${o.customer_id}` },
    {
      key: "items",
      header: "Items",
      render: (o) => `${o.items.reduce((sum, i) => sum + i.quantity, 0)} unit${o.items.length === 1 && o.items[0]?.quantity === 1 ? "" : "s"}`,
    },
    {
      key: "total_amount",
      header: "Total",
      align: "right",
      render: (o) => <span className="mono">${o.total_amount.toFixed(2)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (o) => <Badge tone="good">{o.status}</Badge>,
    },
    { key: "created_at", header: "Date", render: (o) => formatDate(o.created_at) },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (o) => (
        <div className="table-actions">
          <Button variant="ghost" className="btn--small" onClick={() => setDetailOrder(o)}>
            View
          </Button>
          <Button variant="ghost" className="btn--small" onClick={() => setDeleteTarget(o)}>
            Cancel
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Sales"
        title="Orders"
        description="Create orders against your catalog. Stock is reserved automatically."
        actions={<Button onClick={openCreateModal}>Create order</Button>}
      />

      {loading ? (
        <Spinner label="Loading orders…" />
      ) : loadError ? (
        <EmptyState
          title="Couldn't load orders"
          description={loadError}
          action={<Button variant="secondary" onClick={loadOrders}>Try again</Button>}
        />
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Create your first order once you have products and customers set up."
          action={<Button onClick={openCreateModal}>Create order</Button>}
        />
      ) : (
        <DataTable columns={columns} rows={orders} />
      )}

      {createOpen && (
        <CreateOrderModal
          products={products}
          customers={customers}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            loadOrders();
          }}
        />
      )}

      {detailOrder && (
        <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Cancel order"
        confirmLabel="Cancel order"
        message={
          deleteTarget
            ? `Cancel order #${deleteTarget.id}? Reserved stock will be returned to inventory.`
            : ""
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create order modal — multi-line item builder
// ---------------------------------------------------------------------------
function CreateOrderModal({ products, customers, onClose, onCreated }) {
  const toast = useToast();
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState([{ productId: "", quantity: "1" }]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const productMap = useMemo(() => new Map(products.map((p) => [String(p.id), p])), [products]);

  function updateLine(index, field, value) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, { productId: "", quantity: "1" }]);
  }

  function removeLine(index) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const estimatedTotal = lines.reduce((sum, line) => {
    const product = productMap.get(line.productId);
    const qty = Number(line.quantity);
    if (!product || !qty || qty < 0) return sum;
    return sum + product.price * qty;
  }, 0);

  function validate() {
    const errs = {};
    if (!customerId) errs.customer = "Select a customer.";

    const lineErrors = lines.map((line) => {
      const lineErr = {};
      if (!line.productId) lineErr.product = "Select a product.";
      const qty = Number(line.quantity);
      if (!line.quantity || !Number.isInteger(qty) || qty <= 0) {
        lineErr.quantity = "Enter a whole number greater than 0.";
      } else {
        const product = productMap.get(line.productId);
        if (product && qty > product.quantity_in_stock) {
          lineErr.quantity = `Only ${product.quantity_in_stock} in stock.`;
        }
      }
      return lineErr;
    });

    if (lineErrors.some((e) => Object.keys(e).length > 0)) {
      errs.lines = lineErrors;
    }

    // duplicate product check
    const seen = new Set();
    for (const line of lines) {
      if (line.productId && seen.has(line.productId)) {
        errs.duplicate = "Each product can only appear once per order — combine quantities instead.";
        break;
      }
      seen.add(line.productId);
    }

    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      await ordersApi.create({
        customer_id: Number(customerId),
        items: lines.map((line) => ({
          product_id: Number(line.productId),
          quantity: Number(line.quantity),
        })),
      });
      toast.success("Order created and stock updated.");
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create order.");
    } finally {
      setSaving(false);
    }
  }

  const noData = customers.length === 0 || products.length === 0;

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title="Create order"
      footer={
        !noData && (
          <>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              Create order — ${estimatedTotal.toFixed(2)}
            </Button>
          </>
        )
      }
    >
      {noData ? (
        <p>
          You need at least one customer and one product before you can create an order.
          Add them from the Customers and Products pages first.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <Field label="Customer" error={errors.customer}>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.email})
                </option>
              ))}
            </select>
          </Field>

          <div className="field">
            <label>Order items</label>
            {lines.map((line, index) => {
              const product = productMap.get(line.productId);
              const lineErr = errors.lines?.[index] || {};
              return (
                <div className="order-line" key={index}>
                  <select
                    value={line.productId}
                    onChange={(e) => updateLine(index, "productId", e.target.value)}
                    className={lineErr.product ? "has-error" : ""}
                  >
                    <option value="">Select product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ${p.price.toFixed(2)} ({p.quantity_in_stock} in stock)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={line.quantity}
                    onChange={(e) => updateLine(index, "quantity", e.target.value)}
                    className={lineErr.quantity ? "has-error" : ""}
                  />
                  <button
                    type="button"
                    className="order-line__remove"
                    onClick={() => removeLine(index)}
                    disabled={lines.length === 1}
                    aria-label="Remove item"
                  >
                    ×
                  </button>
                  {(lineErr.product || lineErr.quantity) && (
                    <div className="field__error order-line__error">
                      {lineErr.product || lineErr.quantity}
                    </div>
                  )}
                  {!lineErr.quantity && product && (
                    <div className="field__hint order-line__error">
                      Subtotal: ${(product.price * (Number(line.quantity) || 0)).toFixed(2)}
                    </div>
                  )}
                </div>
              );
            })}
            {errors.duplicate && <div className="field__error">{errors.duplicate}</div>}
            <Button variant="ghost" type="button" className="btn--small" onClick={addLine} style={{ marginTop: 8 }}>
              + Add another item
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Order detail modal
// ---------------------------------------------------------------------------
function OrderDetailModal({ order, onClose }) {
  return (
    <Modal open onClose={onClose} title={`Order #${order.id}`}>
      <div className="order-detail">
        <div className="order-detail__row">
          <span>Customer</span>
          <span>{order.customer_name || `Customer #${order.customer_id}`}</span>
        </div>
        <div className="order-detail__row">
          <span>Status</span>
          <Badge tone="good">{order.status}</Badge>
        </div>
        <div className="order-detail__row">
          <span>Date</span>
          <span>{formatDate(order.created_at)}</span>
        </div>

        <table className="order-detail__items">
          <thead>
            <tr>
              <th>Product</th>
              <th style={{ textAlign: "right" }}>Qty</th>
              <th style={{ textAlign: "right" }}>Unit price</th>
              <th style={{ textAlign: "right" }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>{item.product_name || `Product #${item.product_id}`}</td>
                <td className="mono" style={{ textAlign: "right" }}>{item.quantity}</td>
                <td className="mono" style={{ textAlign: "right" }}>${item.unit_price.toFixed(2)}</td>
                <td className="mono" style={{ textAlign: "right" }}>
                  ${(item.unit_price * item.quantity).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} style={{ textAlign: "right", fontWeight: 600 }}>
                Total
              </td>
              <td className="mono" style={{ textAlign: "right", fontWeight: 600 }}>
                ${order.total_amount.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Modal>
  );
}
