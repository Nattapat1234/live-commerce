import { useEffect, useMemo, useState } from "react";
import { api } from "@/api/client.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";
import ProductToolbar from "@/features/products/ProductToolbar.jsx";
import ProductTable from "@/features/products/ProductTable.jsx";
import ProductCreateDialog from "@/features/products/dialogs/ProductCreateDialog.jsx";
import ProductEditDialog from "@/features/products/dialogs/ProductEditDialog.jsx";
import ProductRestockDialog from "@/features/products/dialogs/ProductRestockDialog.jsx";

function ProductsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  // dialogs
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openRestock, setOpenRestock] = useState(false);
  const [current, setCurrent] = useState(null);

  // forms
  const [createForm, setCreateForm] = useState({
    sku: "",
    name: "",
    price_cents: "",
    stock_total: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    price_cents: "",
    is_active: true,
  });
  const [restockAmount, setRestockAmount] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) => (r.sku || "").toLowerCase().includes(s) || (r.name || "").toLowerCase().includes(s),
    );
  }, [rows, q]);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getProducts();
      setRows(data);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  // create
  function handleOpenCreate() {
    setOpenCreate(true);
  }
  async function handleCreate() {
    try {
      const body = {
        sku: createForm.sku.trim(),
        name: createForm.name.trim(),
        price_cents: Number(createForm.price_cents),
        stock_total: Number(createForm.stock_total),
      };
      if (!body.sku || !body.name || !body.price_cents || !body.stock_total) {
        return alert("กรอกข้อมูลให้ครบ");
      }
      await api.createProduct(body);
      setOpenCreate(false);
      setCreateForm({ sku: "", name: "", price_cents: "", stock_total: "" });
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  // edit
  function handleOpenEdit(p) {
    setCurrent(p);
    setEditForm({ name: p.name, price_cents: p.price_cents, is_active: !!p.is_active });
    setOpenEdit(true);
  }
  async function handleEditSave() {
    try {
      await api.updateProduct(current.id, {
        name: editForm.name.trim(),
        price_cents: Number(editForm.price_cents),
        is_active: !!editForm.is_active,
      });
      setOpenEdit(false);
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  // restock
  function handleOpenRestock(p) {
    setCurrent(p);
    setRestockAmount("");
    setOpenRestock(true);
  }
  async function handleRestockSave() {
    try {
      const amt = Number(restockAmount);
      if (!Number.isInteger(amt) || amt <= 0) return alert("กรอกจำนวนเป็นจำนวนเต็ม > 0");
      await api.restockProduct(current.id, amt);
      setOpenRestock(false);
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  // delete
  async function handleDelete(p) {
    if (!confirm(`ลบสินค้า ${p.sku} - ${p.name} ?`)) return;
    try {
      await api.deleteProduct(p.id);
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Package className="w-5 h-5 text-brand" />
        <h1 className="text-2xl font-semibold text-brand">Products</h1>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">รายการสินค้า</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProductToolbar
            q={q}
            onQChange={setQ}
            loading={loading}
            onRefresh={load}
            onOpenCreate={handleOpenCreate}
          />
          <ProductTable
            items={filtered}
            onEdit={handleOpenEdit}
            onRestock={handleOpenRestock}
            onDelete={handleDelete}
          />
        </CardContent>
      </Card>

      {/* dialogs */}
      <ProductCreateDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        form={createForm}
        setForm={setCreateForm}
        onSubmit={handleCreate}
      />

      <ProductEditDialog
        open={openEdit}
        onOpenChange={setOpenEdit}
        product={current}
        form={editForm}
        setForm={setEditForm}
        onSubmit={handleEditSave}
      />

      <ProductRestockDialog
        open={openRestock}
        onOpenChange={setOpenRestock}
        product={current}
        amount={restockAmount}
        setAmount={setRestockAmount}
        onSubmit={handleRestockSave}
      />
    </div>
  );
}

export default ProductsPage;
