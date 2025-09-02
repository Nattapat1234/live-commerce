import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProductCreateDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md rounded-xl bg-white shadow-xl border border-gray-200"
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-blue-600">
            เพิ่มสินค้าใหม่
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* SKU */}
          <div className="space-y-1">
            <Label htmlFor="sku" className="text-gray-700">
              SKU
            </Label>
            <Input
              id="sku"
              value={form.sku}
              onChange={(e) => setForm((v) => ({ ...v, sku: e.target.value }))}
              placeholder="เช่น sk01"
              required
              autoFocus
              className="focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* ชื่อ */}
          <div className="space-y-1">
            <Label htmlFor="name" className="text-gray-700">
              ชื่อสินค้า
            </Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
              placeholder="เช่น เสื้อยืด"
              required
              className="focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* ราคา */}
          <div className="space-y-1">
            <Label htmlFor="price" className="text-gray-700">
              ราคา (สตางค์)
            </Label>
            <Input
              id="price"
              type="number"
              inputMode="numeric"
              min={0}
              step={100}
              value={form.price_cents}
              onChange={(e) =>
                setForm((v) => ({ ...v, price_cents: e.target.value }))
              }
              placeholder="19900 = 199.00 บาท"
              className="focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* สต็อก */}
          <div className="space-y-1">
            <Label htmlFor="stock" className="text-gray-700">
              สต็อกรวมเริ่มต้น
            </Label>
            <Input
              id="stock"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={form.stock_total}
              onChange={(e) =>
                setForm((v) => ({ ...v, stock_total: e.target.value }))
              }
              placeholder="เช่น 10"
              className="focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-24 border-red-500 text-red-500 hover:bg-red-50"
          >
            ยกเลิก
          </Button>
          <Button
            onClick={onSubmit}
            className="w-24 bg-blue-600 hover:bg-blue-700 text-white"
          >
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
