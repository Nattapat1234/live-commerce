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

export default function ProductEditDialog({
  open,
  onOpenChange,
  product,
  form,
  setForm,
  onSubmit,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-xl bg-white shadow-xl border border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-blue-600">
            แก้ไขสินค้า: {product?.sku}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ชื่อ */}
          <div className="space-y-1">
            <Label htmlFor="edit-name" className="text-gray-700">
              ชื่อสินค้า
            </Label>
            <Input
              id="edit-name"
              value={form.name}
              onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
              className="focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* ราคา */}
          <div className="space-y-1">
            <Label htmlFor="edit-price" className="text-gray-700">
              ราคา (สตางค์)
            </Label>
            <Input
              id="edit-price"
              type="number"
              inputMode="numeric"
              min={0}
              step={100}
              value={form.price_cents}
              onChange={(e) =>
                setForm((v) => ({ ...v, price_cents: e.target.value }))
              }
              className="focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Active */}
          <div className="space-y-1">
            <Label className="flex items-center gap-2 text-gray-700">
              <input
                type="checkbox"
                checked={!!form.is_active}
                onChange={(e) =>
                  setForm((v) => ({ ...v, is_active: e.target.checked }))
                }
                className="h-4 w-4 accent-blue-600"
              />
              <span>Active</span>
            </Label>
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
