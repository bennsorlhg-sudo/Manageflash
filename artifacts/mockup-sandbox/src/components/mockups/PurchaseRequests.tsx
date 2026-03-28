import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

type Priority = "عالية" | "متوسطة" | "منخفضة";
type RequestStatus = "قيد المراجعة" | "موافق" | "مرفوض" | "تم الشراء";

interface PurchaseRequest {
  id: number;
  item: string;
  qty: number;
  unit: string;
  description: string;
  priority: Priority;
  notes: string;
  status: RequestStatus;
  createdAt: string;
  createdBy: string;
}

const MOCK_REQUESTS: PurchaseRequest[] = [
  {
    id: 1,
    item: "كابلات شبكة CAT6",
    qty: 500,
    unit: "متر",
    description: "كابلات لتمديد نقاط الهوت سبوت الجديدة",
    priority: "عالية",
    notes: "ضروري قبل نهاية الأسبوع",
    status: "قيد المراجعة",
    createdAt: "28/03/2026",
    createdBy: "محمد العمري",
  },
  {
    id: 2,
    item: "روتر واي فاي TP-Link",
    qty: 5,
    unit: "قطعة",
    description: "أجهزة إضافية لتغطية الطلبات الجديدة",
    priority: "متوسطة",
    notes: "",
    status: "موافق",
    createdAt: "25/03/2026",
    createdBy: "محمد العمري",
  },
  {
    id: 3,
    item: "مشابك تثبيت كابلات",
    qty: 200,
    unit: "قطعة",
    description: "للتركيبات الداخلية",
    priority: "منخفضة",
    notes: "يمكن الانتظار حتى الدوري القادم",
    status: "تم الشراء",
    createdAt: "20/03/2026",
    createdBy: "محمد العمري",
  },
  {
    id: 4,
    item: "بطاريات احتياطية UPS",
    qty: 2,
    unit: "قطعة",
    description: "لحماية المعدات من انقطاع الكهرباء",
    priority: "عالية",
    notes: "",
    status: "مرفوض",
    createdAt: "18/03/2026",
    createdBy: "محمد العمري",
  },
];

const priorityColor: Record<Priority, string> = {
  "عالية": "bg-red-100 text-red-700 border-red-200",
  "متوسطة": "bg-orange-100 text-orange-700 border-orange-200",
  "منخفضة": "bg-green-100 text-green-700 border-green-200",
};

const statusColor: Record<RequestStatus, string> = {
  "قيد المراجعة": "bg-yellow-100 text-yellow-800",
  "موافق": "bg-blue-100 text-blue-700",
  "مرفوض": "bg-red-100 text-red-700",
  "تم الشراء": "bg-green-100 text-green-700",
};

const statusIcon: Record<RequestStatus, string> = {
  "قيد المراجعة": "⏳",
  "موافق": "✅",
  "مرفوض": "❌",
  "تم الشراء": "🛍️",
};

export default function PurchaseRequests() {
  const [view, setView] = useState<"list" | "new">("list");
  const [requests, setRequests] = useState<PurchaseRequest[]>(MOCK_REQUESTS);
  const [form, setForm] = useState({
    item: "",
    qty: "",
    unit: "قطعة",
    description: "",
    priority: "متوسطة" as Priority,
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (!form.item || !form.qty) return;
    const newReq: PurchaseRequest = {
      id: Date.now(),
      item: form.item,
      qty: parseInt(form.qty) || 1,
      unit: form.unit,
      description: form.description,
      priority: form.priority,
      notes: form.notes,
      status: "قيد المراجعة",
      createdAt: "28/03/2026",
      createdBy: "محمد العمري",
    };
    setRequests(prev => [newReq, ...prev]);
    setForm({ item: "", qty: "", unit: "قطعة", description: "", priority: "متوسطة", notes: "" });
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setView("list"); }, 1500);
  }

  const activeRequests = requests.filter(r => r.status === "قيد المراجعة" || r.status === "موافق");
  const historyRequests = requests.filter(r => r.status === "مرفوض" || r.status === "تم الشراء");

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 font-sans">
      <div className="bg-orange-600 text-white px-4 py-4">
        <p className="text-sm text-orange-200">الإدارة</p>
        <h1 className="text-xl font-bold">طلبات الشراء</h1>
      </div>

      <div className="flex border-b bg-white">
        <button
          onClick={() => setView("list")}
          className={`flex-1 py-3 text-sm font-medium border-b-2 ${view === "list" ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500"}`}
        >
          الطلبات ({requests.length})
        </button>
        <button
          onClick={() => setView("new")}
          className={`flex-1 py-3 text-sm font-medium border-b-2 ${view === "new" ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500"}`}
        >
          + طلب جديد
        </button>
      </div>

      <ScrollArea className="h-[calc(100vh-140px)]">
        <div className="px-4 py-4 space-y-4">

          {view === "new" && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-700">طلب شراء جديد</h2>

              {submitted && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-green-700 font-semibold">✅ تم إرسال الطلب للمدير المالي</p>
                </div>
              )}

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Label className="text-xs">اسم الصنف *</Label>
                    <Input
                      value={form.item}
                      onChange={e => setForm(p => ({ ...p, item: e.target.value }))}
                      className="mt-1 text-right"
                      placeholder="مثال: كابلات شبكة CAT6"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">الكمية *</Label>
                      <Input
                        value={form.qty}
                        onChange={e => setForm(p => ({ ...p, qty: e.target.value }))}
                        className="mt-1"
                        type="number"
                        dir="ltr"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">الوحدة</Label>
                      <select
                        value={form.unit}
                        onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                        className="w-full mt-1 border rounded px-3 py-2 text-sm text-right bg-white"
                      >
                        <option>قطعة</option>
                        <option>متر</option>
                        <option>كيلو</option>
                        <option>علبة</option>
                        <option>كرتون</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">الوصف</Label>
                    <textarea
                      value={form.description}
                      onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      className="w-full mt-1 border rounded px-3 py-2 text-sm resize-none h-16 text-right"
                      dir="rtl"
                      placeholder="وصف الصنف واستخداماته..."
                    />
                  </div>

                  <div>
                    <Label className="text-xs mb-2 block">الأولوية</Label>
                    <div className="flex gap-2">
                      {(["عالية", "متوسطة", "منخفضة"] as Priority[]).map(p => (
                        <button
                          key={p}
                          onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                          className={`flex-1 py-2 rounded-lg border-2 text-xs font-medium transition-colors ${form.priority === p ? `${priorityColor[p]} border-current` : "border-gray-200 text-gray-500 bg-white"}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">ملاحظات إضافية</Label>
                    <textarea
                      value={form.notes}
                      onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                      className="w-full mt-1 border rounded px-3 py-2 text-sm resize-none h-12 text-right"
                      dir="rtl"
                      placeholder="أي ملاحظات للمدير المالي..."
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">📋 سيظهر الطلب في قائمة المدير المالي للمراجعة والموافقة</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setView("list")}>إلغاء</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!form.item || !form.qty}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  إرسال الطلب
                </Button>
              </div>
            </div>
          )}

          {view === "list" && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-600">الطلبات النشطة ({activeRequests.length})</h2>
                <Button size="sm" onClick={() => setView("new")} className="bg-orange-600 text-white text-xs h-8">+ طلب جديد</Button>
              </div>

              {activeRequests.length === 0 && (
                <Card><CardContent className="p-6 text-center text-gray-400 text-sm">لا توجد طلبات نشطة</CardContent></Card>
              )}

              {activeRequests.map(req => (
                <RequestCard key={req.id} request={req} />
              ))}

              {historyRequests.length > 0 && (
                <>
                  <Separator />
                  <h2 className="text-sm font-semibold text-gray-400">السجل ({historyRequests.length})</h2>
                  {historyRequests.map(req => (
                    <RequestCard key={req.id} request={req} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function RequestCard({ request }: { request: PurchaseRequest }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <p className="font-semibold text-gray-800 text-sm">{request.item}</p>
            <p className="text-xs text-gray-500 mt-0.5">{request.qty} {request.unit}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[request.status]}`}>
              {statusIcon[request.status]} {request.status}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityColor[request.priority]}`}>
              {request.priority}
            </span>
          </div>
        </div>
        {request.description && (
          <p className="text-xs text-gray-600 mb-2">{request.description}</p>
        )}
        {request.notes && (
          <p className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">{request.notes}</p>
        )}
        <Separator className="my-2" />
        <p className="text-xs text-gray-400">{request.createdAt} • {request.createdBy}</p>
      </CardContent>
    </Card>
  );
}
