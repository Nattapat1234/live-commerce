import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, Plus, Search } from "lucide-react";

export default function ProductToolbar({ q, onQChange, loading, onRefresh, onOpenCreate }) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div className="w-full md:w-80 space-y-2">
        <Label htmlFor="q">ค้นหา (SKU/ชื่อ)</Label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="q"
            className="pl-9"
            value={q}
            onChange={(e) => onQChange?.(e.target.value)}
            placeholder="เช่น sk01 หรือ เสื้อยืด"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={onRefresh}
          disabled={loading}
          className="border-brand text-brand hover:bg-brand-soft"
        >
          <RefreshCw className="w-4 h-4 mr-2" /> {loading ? "กำลังโหลด..." : "รีเฟรช"}
        </Button>
        <Button onClick={onOpenCreate}>
          <Plus className="w-4 h-4 mr-2" /> เพิ่มสินค้า
        </Button>
      </div>
    </div>
  );
}
