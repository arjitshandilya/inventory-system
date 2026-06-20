import { useEffect, useState } from "react";
import { customersApi, ApiError } from "../api/client";
import { PageHeader, Button, EmptyState, Spinner, Modal, ConfirmDialog } from "../components/ui";
import { DataTable } from "../components/DataTable";
import { Field, TextInput } from "../components/Field";
import { useToast } from "../components/Toast";

const emptyForm = { full_name: "", email: "", phone_number: "" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(form) {
  const errors = {};
  if (!form.full_name.trim()) errors.full_name = "Full name is required.";
  if (!form.email.trim()) {
    errors.email = "Email address is required.";
  } else if (!EMAIL_RE.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!form.phone_number.trim()) errors.phone_number = "Phone number is required.";
  return errors;
}

export default function CustomersPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function loadCustomers() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await customersApi.list();
      setCustomers(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
     
    loadCustomers();
  }, []);

  function openCreateModal() {
    setForm(emptyForm);
    setFormErrors({});
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone_number: form.phone_number.trim(),
    };

    setSaving(true);
    try {
      await customersApi.create(payload);
      toast.success(`Added "${payload.full_name}" as a customer.`);
      setModalOpen(false);
      await loadCustomers();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormErrors((prev) => ({ ...prev, email: err.message }));
      } else if (err instanceof ApiError && err.status === 422) {
        setFormErrors((prev) => ({ ...prev, email: "Enter a valid email address." }));
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
      await customersApi.remove(deleteTarget.id);
      toast.success(`Deleted "${deleteTarget.full_name}".`);
      setDeleteTarget(null);
      await loadCustomers();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete customer.");
    } finally {
      setDeleting(false);
    }
  }

  const columns = [
    { key: "full_name", header: "Name", render: (c) => <span style={{ fontWeight: 600 }}>{c.full_name}</span> },
    { key: "email", header: "Email", render: (c) => <span className="mono">{c.email}</span> },
    { key: "phone_number", header: "Phone", render: (c) => <span className="mono">{c.phone_number}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (c) => (
        <div className="table-actions">
          <Button variant="ghost" className="btn--small" onClick={() => setDeleteTarget(c)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Contacts"
        title="Customers"
        description="Everyone you sell to. Each customer needs a unique email."
        actions={<Button onClick={openCreateModal}>Add customer</Button>}
      />

      {loading ? (
        <Spinner label="Loading customers…" />
      ) : loadError ? (
        <EmptyState
          title="Couldn't load customers"
          description={loadError}
          action={<Button variant="secondary" onClick={loadCustomers}>Try again</Button>}
        />
      ) : customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add your first customer to start creating orders."
          action={<Button onClick={openCreateModal}>Add customer</Button>}
        />
      ) : (
        <DataTable columns={columns} rows={customers} />
      )}

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title="Add customer"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              Add customer
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <Field label="Full name" error={formErrors.full_name}>
            <TextInput
              error={formErrors.full_name}
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="e.g. Priya Sharma"
              autoFocus
            />
          </Field>
          <Field label="Email address" error={formErrors.email} hint="Must be unique across all customers.">
            <TextInput
              error={formErrors.email}
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="e.g. priya@example.com"
            />
          </Field>
          <Field label="Phone number" error={formErrors.phone_number}>
            <TextInput
              error={formErrors.phone_number}
              value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              placeholder="e.g. +91 98765 43210"
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete customer"
        message={deleteTarget ? `Delete "${deleteTarget.full_name}"? This can't be undone.` : ""}
      />
    </div>
  );
}
