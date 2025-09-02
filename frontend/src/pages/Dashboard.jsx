import { useMemo, useState } from "react";
import { api } from "@/api/client.js";
import { useInterval } from "@/hooks/useInterval.js";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// icons
import {
  Radio,
  Play,
  Square,
  VideoIcon,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Sparkles,
} from "lucide-react";

/** การ์ดวิดีโอ */
function VideoCard({ v, selected, onSelect }) {
  const badgeTone =
    (v.live_status || "").toLowerCase() === "live"
      ? "badge-success"
      : (v.live_status || "").toLowerCase() === "scheduled"
        ? "badge-warning"
        : "";

  return (
    <Card
      onClick={() => onSelect?.(v)}
      className={`cursor-pointer transition-all ${
        selected ? "ring-2 ring-[hsl(var(--primary))]" : "hover:border-brand"
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <VideoIcon className="w-4 h-4 text-brand" />
            <span className="font-mono">{v.id}</span>
          </div>
          <Badge className={badgeTone || "bg-brand-soft"}>{v.live_status || "video"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {v.description || "(no description)"}
        </p>
        <p className="text-xs text-muted-foreground">
          {v.created_time ? new Date(v.created_time).toLocaleString() : "-"}
        </p>
        {v.permalink_url && (
          <a
            href={v.permalink_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline text-brand"
            onClick={(e) => e.stopPropagation()}
          >
            เปิดบน Facebook ↗
          </a>
        )}
      </CardContent>
    </Card>
  );
}

/** ปุ่ม action แถวคิว/ประวัติ */
function RowActions({ row, onConfirm, onCancel, busy }) {
  const disabled = busy || row.status !== "reserved";
  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={disabled} onClick={() => onConfirm(row)}>
        <CheckCircle2 className="w-4 h-4 mr-1" />
        Confirm
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="hover:bg-brand-soft"
        disabled={disabled}
        onClick={() => onCancel(row)}
      >
        <XCircle className="w-4 h-4 mr-1" />
        Cancel
      </Button>
    </div>
  );
}

export default function Dashboard() {
  const [pageId, setPageId] = useState("");
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [session, setSession] = useState(null);
  const [queue, setQueue] = useState({ summary: [], queue: [] });
  const [pollQueue, setPollQueue] = useState(false);
  const [q, setQ] = useState("");

  // แหล่งวิดีโอ: auto / all / uploaded
  const [videoSource, setVideoSource] = useState("auto");

  // ประวัติ
  const [history, setHistory] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [historyQ, setHistoryQ] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);

  // busy map สำหรับปุ่ม confirm/cancel
  const [busyMap, setBusyMap] = useState({});

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return videos;
    return videos.filter(
      (v) =>
        (v.id || "").toLowerCase().includes(s) || (v.description || "").toLowerCase().includes(s),
    );
  }, [videos, q]);

  async function load() {
    const pid = pageId.trim() || "me";
    setLoading(true);
    try {
      if (videoSource === "auto") {
        const live = await api.fbLiveCurrent(pid);
        if (live?.live && live?.video?.id) {
          const one = { ...live.video.raw, id: live.video.id, live_status: "live" };
          setVideos([one]);
          setSelected(one);
          setLoading(false);
          return;
        }
        const rows = await api.fbVideos(pid, "all");
        setVideos(rows);
        setSelected(null);
        setLoading(false);
        return;
      }
      const rows = await api.fbVideos(pid, videoSource); // 'all' | 'uploaded'
      setVideos(rows);
      setSelected(null);
    } catch (e) {
      alert(e?.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  }

  async function autoStart() {
    if (!pageId.trim()) return alert("กรุณาใส่ Page ID");
    try {
      const out = await api.fbAutoStart(pageId.trim());
      if (!out?.ok) return alert(out?.error || "เริ่มไม่สำเร็จ");
      setSession(out.session);
      setPollQueue(true);
      await refreshHistory(); // โหลดประวัติทันที
    } catch (e) {
      alert(e.message);
    }
  }

  async function manualStart() {
    if (!selected) return alert("กรุณาเลือกวิดีโอ");
    try {
      const sess = await api.createLive(pageId.trim() || "me", selected.id);
      setSession(sess);
      await api.startPoller(sess.id);
      setPollQueue(true);
      await refreshHistory();
    } catch (e) {
      alert(e.message);
    }
  }

  async function stop() {
    if (!session?.id) return;
    try {
      await api.stopPoller(session.id);
      setPollQueue(false);
    } catch {
      // intentionally ignored
    }
  }

  async function refreshQueue() {
    if (!session?.id) return;
    try {
      setQueue(await api.getQueue(session.id));
    } catch {
      // intentionally ignored
    }
  }
  useInterval(refreshQueue, 2000, pollQueue);

  async function refreshHistory() {
    if (!session?.id) return;
    setHistoryLoading(true);
    try {
      const rows = await api.getReservations(session.id, {
        status: statusFilter,
        limit: 300,
        q: historyQ.trim(),
      });
      setHistory(rows);
    } catch {
      // เงียบไว้เพื่อไม่กวน UI
    } finally {
      setHistoryLoading(false);
    }
  }
  // อัปเดตประวัติอัตโนมัติเมื่อกำลังจับคิว
  useInterval(refreshHistory, 5000, pollQueue);

  // ===== Admin actions =====
  async function handleConfirm(row) {
    setBusyMap((m) => ({ ...m, [row.id]: true }));
    try {
      await api.adminConfirmReservation(row.id);
      await Promise.all([refreshQueue(), refreshHistory()]);
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    } finally {
      setBusyMap((m) => {
        const c = { ...m };
        delete c[row.id];
        return c;
      });
    }
  }

  async function handleCancel(row) {
    setBusyMap((m) => ({ ...m, [row.id]: true }));
    try {
      await api.adminCancelReservation(row.id, { reason: "admin_cancel" });
      await Promise.all([refreshQueue(), refreshHistory()]);
    } catch (e) {
      alert(e?.response?.data?.error || e.message);
    } finally {
      setBusyMap((m) => {
        const c = { ...m };
        delete c[row.id];
        return c;
      });
    }
  }

  const prettyWhen = (r) => {
    const d = r.confirmed_at || r.canceled_at || r.expires_at || r.created_at;
    return d ? new Date(d).toLocaleString() : "-";
    // ถ้าคุณเพิ่ม created_at ใน DB จะสวยขึ้น
  };

  return (
    <div className="container py-6 space-y-6">
      {/* Title */}
      <div className="flex items-center gap-2">
        <Radio className="w-5 h-5 text-brand" />
        <h1 className="text-2xl font-semibold text-brand">Live Video Picker & Queue Monitor</h1>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">เลือกเพจ / โหลดวิดีโอ</CardTitle>

            {/* Source selector */}
            <div className="hidden md:flex items-center gap-2">
              <span className="text-sm text-muted-foreground">แหล่งข้อมูล:</span>
              <div className="flex rounded-lg border overflow-hidden">
                <Button
                  variant={videoSource === "auto" ? "default" : "ghost"}
                  className={videoSource === "auto" ? "" : "hover:bg-brand-soft"}
                  onClick={() => setVideoSource("auto")}
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  Auto
                </Button>
                <Button
                  variant={videoSource === "all" ? "default" : "ghost"}
                  className={videoSource === "all" ? "" : "hover:bg-brand-soft"}
                  onClick={() => setVideoSource("all")}
                >
                  ทั้งหมด
                </Button>
                <Button
                  variant={videoSource === "uploaded" ? "default" : "ghost"}
                  className={videoSource === "uploaded" ? "" : "hover:bg-brand-soft"}
                  onClick={() => setVideoSource("uploaded")}
                >
                  อัปโหลด
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="page-id">Facebook Page ID</Label>
              <Input
                id="page-id"
                placeholder="เช่น 1234567890 (ว่าง = me)"
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="search">ค้นหา (ID/คำอธิบาย)</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  className="pl-9"
                  placeholder="พิมพ์คำค้น"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={load} disabled={loading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {loading ? "กำลังโหลด..." : "โหลดวิดีโอ / ตรวจ Live"}
              </Button>
              <Button
                variant="outline"
                onClick={autoStart}
                className="border-brand text-brand hover:bg-brand-soft"
              >
                <Play className="w-4 h-4 mr-2" />
                Auto Start (ถ้ามี Live)
              </Button>
            </div>
          </div>

          <Separator />

          {/* Video grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filtered.map((v) => (
              <VideoCard key={v.id} v={v} selected={selected?.id === v.id} onSelect={setSelected} />
            ))}
            {!loading && filtered.length === 0 && (
              <div className="text-sm text-muted-foreground">
                ยังไม่มีข้อมูล (ใส่ Page ID แล้วกด “โหลดวิดีโอ / ตรวจ Live”)
              </div>
            )}
          </div>

          {/* Bottom actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-muted-foreground">
              เลือกวิดีโอ: <span className="font-mono">{selected?.id || "-"}</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={manualStart} disabled={!selected}>
                <Play className="w-4 h-4 mr-2" />
                เริ่มจับคอมเมนต์
              </Button>
              <Button
                variant="outline"
                onClick={stop}
                disabled={!session}
                className="hover:bg-brand-soft"
              >
                <Square className="w-4 h-4 mr-2" />
                หยุด
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Queue + History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">สรุปต่อสินค้า</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>สินค้า</TableHead>
                  <TableHead className="w-[80px]">จอง</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.summary.map((s) => (
                  <TableRow key={s.product_id}>
                    <TableCell className="font-mono">{s.sku}</TableCell>
                    <TableCell>{s.name}</TableCell>
                    <TableCell>{s.reserved_count}</TableCell>
                  </TableRow>
                ))}
                {queue.summary.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      ยังไม่มีคิว
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Latest queue with actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">รายการคิวล่าสุด</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80 rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>สินค้า</TableHead>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>คิว</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="w-[220px]">การจัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.queue.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.product_id}</TableCell>
                      <TableCell>{r.user_name || "-"}</TableCell>
                      <TableCell>{r.position_in_queue}</TableCell>
                      <TableCell>
                        {r.status === "reserved" ? (
                          <Badge className="badge-success-soft">reserved</Badge>
                        ) : (
                          <Badge variant="secondary">{r.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <RowActions
                          row={r}
                          busy={!!busyMap[r.id]}
                          onConfirm={handleConfirm}
                          onCancel={handleCancel}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {queue.queue.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        ยังไม่มีคิว
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* --- NEW: Reservation History --- */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">ประวัติการจอง</CardTitle>
            <div className="flex items-center gap-2">
              <select
                className="h-9 w-[160px] rounded-md border bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">ทั้งหมด</option>
                <option value="reserved">reserved</option>
                <option value="confirmed">confirmed</option>
                <option value="canceled">canceled</option>
                <option value="expired">expired</option>
              </select>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9 w-[220px]"
                  placeholder="ค้นหา (SKU/ชื่อผู้จอง/สินค้า)"
                  value={historyQ}
                  onChange={(e) => setHistoryQ(e.target.value)}
                />
              </div>

              <Button onClick={refreshHistory} disabled={historyLoading || !session?.id}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {historyLoading ? "กำลังโหลด..." : "รีเฟรช"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[420px] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เวลา</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>สินค้า</TableHead>
                  <TableHead>ผู้จอง</TableHead>
                  <TableHead>คิว</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="w-[220px]">การจัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{prettyWhen(r)}</TableCell>
                    <TableCell className="font-mono">{r.sku}</TableCell>
                    <TableCell>{r.product_name}</TableCell>
                    <TableCell>{r.user_name || "-"}</TableCell>
                    <TableCell>{r.position_in_queue}</TableCell>
                    <TableCell>
                      {r.status === "reserved" ? (
                        <Badge className="badge-warning-soft">reserved</Badge>
                      ) : r.status === "confirmed" ? (
                        <Badge className="badge-success">confirmed</Badge>
                      ) : r.status === "canceled" ? (
                        <Badge variant="secondary">canceled</Badge>
                      ) : (
                        <Badge variant="secondary">expired</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <RowActions
                        row={r}
                        busy={!!busyMap[r.id]}
                        onConfirm={handleConfirm}
                        onCancel={handleCancel}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      ยังไม่มีประวัติ (เริ่ม session แล้วรอสักครู่)
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-3">
        <span>Session:</span>
        <span className="font-mono">{session?.id || "-"}</span>
        <span>สถานะ:</span>
        {pollQueue ? (
          <Badge className="badge-success">Running</Badge>
        ) : (
          <Badge variant="secondary">Idle</Badge>
        )}
      </div>
    </div>
  );
}
