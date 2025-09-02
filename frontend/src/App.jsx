import "./index.css";
import { useState } from "react";
import Dashboard from "@/pages/Dashboard.jsx"; // หน้าเลือกวิดีโอที่คุณมีอยู่
import ProductsPage from "@/pages/Products.jsx";

import { Button } from "@/components/ui/button";
import { Package, Radio } from "lucide-react";

export default function App() {
  const [page, setPage] = useState("dashboard"); // 'dashboard' | 'products'

  return (
    <div className="min-h-screen">
      {/* Simple topbar */}
      <div className="border-b">
        <div className="container py-3 flex items-center gap-2">
          <Button
            variant={page === "dashboard" ? "default" : "outline"}
            onClick={()=>setPage("dashboard")}
            className="gap-2"
          >
            <Radio className="w-4 h-4" /> Live
          </Button>
          <Button
            variant={page === "products" ? "default" : "outline"}
            onClick={()=>setPage("products")}
            className="gap-2"
          >
            <Package className="w-4 h-4" /> Products
          </Button>
        </div>
      </div>

      {page === "dashboard" ? <Dashboard /> : <ProductsPage />}
    </div>
  );
}
