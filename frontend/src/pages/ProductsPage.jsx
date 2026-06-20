import { useEffect, useState } from "react";
import { productsApi, ApiError } from "../api/client";
import { PageHeader, Button, Badge, EmptyState, Spinner, Modal, ConfirmDialog } from "../components/ui";
import { DataTable } from "../components/DataTable";
import { Field, TextInput } from "../components/Field";
import { useToast } from "../components/Toast";

const LOW_STOCK_THRESHOLD = 10;

const emptyForm = { name: "", sku: "", price: "", quantity_in_stock: "" };

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Product name is required.";
  if (!form.sku.trim()) errors.sku = "SKU / code is required.";

  const price = Number(form.price);
  if (form.price === "" || Number.isNaN(price) || price < 0) {
    errors.price = "Enter a valid price of 0 or more.";
  }

  const qty = Number(form.quantity_in_stock);
  if (form.quantity_in_stock === "" || !Number.isInteger(qty) || qty < 0) {
    errors.quantity_in_stock = "Enter a whole number of 0 or more.";
  }

  return errors;
}

export default function ProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function loadProducts() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await productsApi.list();
      setProducts(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
     
    loadProducts();
  }, []);

  function openCreateModal() {
    setEditingProduct(null);
    setForm(emptyForm);
    setFormErrors({});
    setModalOpen(true);
  }

  function openEditModal(product) {
    setEditingProduct(product);
    setForm({
      name: product.name,
      sku: product.sku,
      price: String(product.price),
      quantity_in_stock: String(product.quantity_in_stock),
    });
    setFormErrors({});
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      price: Number(form.price),
      quantity_in_stock: Number(form.quantity_in_stock),
    };

    setSaving(true);
    try {
      if (editingProduct) {
        await productsApi.update(editingProduct.id, payload);
        toast.success(`Updated "${payload.name}".`);
      } else {
        await productsApi.create(payload);
        toast.success(`Added "${payload.name}" to inventory.`);
      }
      setModalOpen(false);
      await loadProducts();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormErrors((prev) => ({ ...prev, sku: err.message }));
      } else {
        toast.error(err instanceof ApiError ? err.message : "Something went wrong.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await productsApi.remove(deleteTarget.id);
      toast.success(`Deleted "${deleteTarget.name}".`);
      setDeleteTarget(null);
      await loadProducts();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete product.");
    } finally {
      setDeleting(false);
    }
  }

  const columns = [
    {
      key: "name",
      header: "Product",
      render: (p) => (
        <div>
          <div style={{ fontWeight: 600 }}>{p.name}</div>
          <div className="mono" style={{ fontSize: 12, color: "var(--color-ink-faint)" }}>
            {p.sku}
          </div>
        </div>
      ),
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      render: (p) => <span className="mono">${p.price.toFixed(2)}</span>,
    },
    {
      key: "quantity_in_stock",
      header: "Stock",
      align: "right",
      render: (p) => (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
          <span className="mono">{p.quantity_in_stock}</span>
          {p.quantity_in_stock === 0 ? (
            <Badge tone="danger">Out</Badge>
          ) : p.quantity_in_stock <= LOW_STOCK_THRESHOLD ? (
            <Badge tone="warning">Low</Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (p) => (
        <div className="table-actions">
          <Button variant="ghost" className="btn--small" onClick={() => openEditModal(p)}>
            Edit
          </Button>
          <Button variant="ghost" className="btn--small" onClick={() => setDeleteTarget(p)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Manage the items you stock, their pricing, and how much is on hand."
        actions={<Button onClick={openCreateModal}>Add product</Button>}
      />

      {loading ? (
        <Spinner label="Loading products…" />
      ) : loadError ? (
        <EmptyState
          title="Couldn't load products"
          description={loadError}
          action={<Button variant="secondary" onClick={loadProducts}>Try again</Button>}
        />
      ) : products.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Add your first product to start tracking inventory."
          action={<Button onClick={openCreateModal}>Add product</Button>}
        />
      ) : (
        <DataTable columns={columns} rows={products} />
      )}

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingProduct ? "Edit product" : "Add product"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editingProduct ? "Save changes" : "Add product"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <Field label="Product name" error={formErrors.name}>
            <TextInput
              error={formErrors.name}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Aluminum Water Bottle"
              autoFocus
            />
          </Field>
          <Field label="SKU / code" error={formErrors.sku} hint="Must be unique across all products.">
            <TextInput
              error={formErrors.sku}
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              placeholder="e.g. WTR-BTL-001"
            />
          </Field>
          <Field label="Price (USD)" error={formErrors.price}>
            <TextInput
              error={formErrors.price}
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="0.00"
            />
          </Field>
          <Field label="Quantity in stock" error={formErrors.quantity_in_stock}>
            <TextInput
              error={formErrors.quantity_in_stock}
              type="number"
              step="1"
              min="0"
              value={form.quantity_in_stock}
              onChange={(e) => setForm({ ...form, quantity_in_stock: e.target.value })}
              placeholder="0"
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete product"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.name}" (${deleteTarget.sku})? This can't be undone.`
            : ""
        }
      />
    </div>
  );
}
