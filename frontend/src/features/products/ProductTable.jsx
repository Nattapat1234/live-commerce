import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, PackagePlus, Trash2 } from "lucide-react";
import { formatTHBFromCents } from "@/utils/currency";

export default function ProductTable({ items, onEdit, onRestock, onDelete }) {
  return (
    <ScrollArea className="h-[540px] rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead>ชื่อ</TableHead>
            <TableHead>ราคา</TableHead>
            <TableHead>สต็อก (เหลือ/รวม)</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead className="w-[220px]">การจัดการ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-mono">{p.sku}</TableCell>
              <TableCell>{p.name}</TableCell>
              <TableCell>{formatTHBFromCents(p.price_cents)}</TableCell>
              <TableCell>
                {p.stock_available} / {p.stock_total}
              </TableCell>
              <TableCell>
                {p.is_active ? (
                  <Badge className="badge-success-soft">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => onEdit?.(p)}>
                    <Pencil className="w-4 h-4 mr-1" /> แก้ไข
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onRestock?.(p)}>
                    <PackagePlus className="w-4 h-4 mr-1" /> Restock
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onDelete?.(p)}>
                    <Trash2 className="w-4 h-4 mr-1" /> ลบ
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                ไม่มีข้อมูล
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
