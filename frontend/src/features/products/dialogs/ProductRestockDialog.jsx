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

export default function ProductRestockDialog({
  open,
  onOpenChange,
  product,
  amount,
  setAmount,
  onSubmit,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-xl bg-white shadow-xl border border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-blue-600">
            Restock: {product?.sku} — {product?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* จำนวน */}
          <div className="space-y-1">
            <Label htmlFor="restock-amount" className="text-gray-700">
              จำนวนที่เติม
            </Label>
            <Input
              id="restock-amount"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="เช่น 5"
              className="focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="text-sm text-muted-foreground">
            * ระบบจะเพิ่มทั้ง <b>stock_total</b> และ <b>stock_available</b>
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
