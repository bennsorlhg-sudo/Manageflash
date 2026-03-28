import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

type View = "list" | "new" | "inprogress" | "archived" | "review";
type TicketType = "hotspot-internal" | "hotspot-external" | "broadband";

interface Ticket {
  id: number;
  type: TicketType;
  clientName: string;
  phone: string;
  address: string;
  speed?: string;
  router?: string;
  notes?: string;
  engineer: string;
  status: "جديد" | "قيد التنفيذ" | "مكتمل" | "مؤرشف";
  createdAt: string;
  completedData?: {
    deviceSerial?: string;
    installNotes?: string;
    subscriptionStart?: string;
    supervisorNotes?: string;
  };
}

const MOCK_TICKETS: Ticket[] = [
  {
    id: 1,
    type: "hotspot-internal",
    clientName: "محمد إبراهيم",
    phone: "0501111111",
    address: "حي الزهراء - شارع النخيل",
    router: "TP-Link AC750",
    engineer: "أحمد علي",
    status: "جديد",
    createdAt: "28/03/2026",
  },
  {
    id: 2,
    type: "broadband",
    clientName: "شركة المستقبل للتجارة",
    phone: "0502222222",
    address: "الحي التجاري - مبنى 7",
    speed: "50 ميجا",
    engineer: "محمد سالم",
    status: "قيد التنفيذ",
    createdAt: "27/03/2026",
  },
  {
    id: 3,
    type: "hotspot-external",
    clientName: "علي حسن",
    phone: "0503333333",
    address: "منطقة صناعية - مخزن 15",
    engineer: "خالد عمر",
    status: "مكتمل",
    createdAt: "25/03/2026",
  },
  {
    id: 4,
    type: "hotspot-internal",
    clientName: "فاطمة سعيد",
    phone: "0504444444",
    address: "حي السلام - بلك 2",
    engineer: "يوسف كمال",
    status: "مؤرشف",
    createdAt: "20/03/2026",
    completedData: {
      deviceSerial: "HS-20260320-004",
      installNotes: "تم التركيب بنجاح",
      subscriptionStart: "20/03/2026",
      supervisorNotes: "تم إضافة العميل لقاعدة البيانات برقم 88",
    },
  },
];

const typeLabel: Record<TicketType, string> = {
  "hotspot-internal": "هوت سبوت داخلي",
  "hotspot-external": "هوت سبوت خارجي",
  "broadband": "بروادباند",
};

const typeColor: Record<TicketType, string> = {
  "hotspot-internal": "bg-blue-100 text-blue-700",
  "hotspot-external": "bg-indigo-100 text-indigo-700",
  "broadband": "bg-purple-100 text-purple-700",
};

const statusColor: Record<string, string> = {
  "جديد": "bg-blue-100 text-blue-700",
  "قيد التنفيذ": "bg-yellow-100 text-yellow-800",
  "مكتمل": "bg-green-100 text-green-700",
  "مؤرشف": "bg-gray-100 text-gray-600",
};

const engineers = ["أحمد علي", "محمد سالم", "خالد عمر", "يوسف كمال"];

export default function InstallationTickets() {
  const [view, setView] = useState<View>("list");
  const [tickets, setTickets] = useState<Ticket[]>(MOCK_TICKETS);
  const [reviewTicket, setReviewTicket] = useState<Ticket | null>(null);

  const [form, setForm] = useState({
    type: "hotspot-internal" as TicketType,
    clientName: "",
    phone: "",
    address: "",
    speed: "",
    router: "",
    notes: "",
    engineer: engineers[0],
  });

  const [reviewData, setReviewData] = useState({
    newNumber: "",
    subscriptionStart: "",
    supervisorNotes: "",
    addToDb: false,
  });

  function handleCreate() {
    if (!form.clientName || !form.phone || !form.address) return;
    const newTicket: Ticket = {
      id: Date.now(),
      type: form.type,
      clientName: form.clientName,
      phone: form.phone,
      address: form.address,
      speed: form.speed,
      router: form.router,
      notes: form.notes,
      engineer: form.engineer,
      status: "جديد",
      createdAt: "28/03/2026",
    };
    setTickets(prev => [newTicket, ...prev]);
    setForm({ type: "hotspot-internal", clientName: "", phone: "", address: "", speed: "", router: "", notes: "", engineer: engineers[0] });
    setView("list");
  }

  function handleArchive(ticket: Ticket) {
    setReviewTicket(ticket);
    setView("review");
  }

  function handleSaveArchive() {
    if (!reviewTicket) return;
    setTickets(prev => prev.map(t =>
      t.id === reviewTicket.id
        ? { ...t, status: "مؤرشف", completedData: { ...t.completedData, supervisorNotes: reviewData.supervisorNotes, subscriptionStart: reviewData.subscriptionStart } }
        : t
    ));
    setReviewTicket(null);
    setView("archived");
  }

  const newTickets = tickets.filter(t => t.status === "جديد");
  const inProgress = tickets.filter(t => t.status === "قيد التنفيذ");
  const completed = tickets.filter(t => t.status === "مكتمل");
  const archived = tickets.filter(t => t.status === "مؤرشف");

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 font-sans">
      <div className="bg-blue-700 text-white px-4 py-4">
        <p className="text-sm text-blue-200">نظام التذاكر</p>
        <h1 className="text-xl font-bold">تذاكر التركيب</h1>
      </div>

      {view !== "review" && (
        <div className="flex border-b bg-white overflow-x-auto">
          {[
            { id: "list" as View, label: "قائمة جديدة", count: newTickets.length },
            { id: "inprogress" as View, label: "قيد التنفيذ", count: inProgress.length },
            { id: "archived" as View, label: "المؤرشف", count: archived.length + completed.length },
            { id: "new" as View, label: "+ تذكرة جديدة", count: null },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${view === tab.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className={`mr-1 text-xs px-1.5 py-0.5 rounded-full ${view === tab.id ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <ScrollArea className="h-[calc(100vh-140px)]">
        <div className="px-4 py-4 space-y-3">

          {view === "new" && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-700">إنشاء تذكرة جديدة</h2>

              <div>
                <Label className="text-sm font-medium mb-2 block">نوع التركيب</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(typeLabel) as [TicketType, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setForm(p => ({ ...p, type: key }))}
                      className={`p-3 rounded-lg border-2 text-xs font-medium transition-colors text-center ${form.type === key ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 bg-white"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Label className="text-xs">اسم العميل *</Label>
                    <Input value={form.clientName} onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))} className="mt-1 text-right" placeholder="الاسم الكامل" />
                  </div>
                  <div>
                    <Label className="text-xs">رقم الهاتف *</Label>
                    <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="mt-1" dir="ltr" placeholder="05xxxxxxxx" />
                  </div>
                  <div>
                    <Label className="text-xs">العنوان *</Label>
                    <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className="mt-1 text-right" placeholder="الحي، الشارع، رقم المبنى" />
                  </div>

                  {form.type === "broadband" && (
                    <div>
                      <Label className="text-xs">سرعة الاشتراك</Label>
                      <select value={form.speed} onChange={e => setForm(p => ({ ...p, speed: e.target.value }))} className="w-full mt-1 border rounded px-3 py-2 text-sm text-right bg-white">
                        <option value="">اختر السرعة</option>
                        <option>10 ميجا</option>
                        <option>20 ميجا</option>
                        <option>50 ميجا</option>
                        <option>100 ميجا</option>
                      </select>
                    </div>
                  )}

                  {(form.type === "hotspot-internal" || form.type === "hotspot-external") && (
                    <div>
                      <Label className="text-xs">نوع الراوتر</Label>
                      <Input value={form.router} onChange={e => setForm(p => ({ ...p, router: e.target.value }))} className="mt-1 text-right" placeholder="مثال: TP-Link AC750" />
                    </div>
                  )}

                  <div>
                    <Label className="text-xs">ملاحظات</Label>
                    <textarea
                      value={form.notes}
                      onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                      className="w-full mt-1 border rounded px-3 py-2 text-sm resize-none h-16 text-right"
                      dir="rtl"
                      placeholder="أي تفاصيل إضافية..."
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">إسناد المهمة</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="grid grid-cols-2 gap-2">
                    {engineers.map(eng => (
                      <button
                        key={eng}
                        onClick={() => setForm(p => ({ ...p, engineer: eng }))}
                        className={`p-2 rounded-lg border-2 text-sm transition-colors ${form.engineer === eng ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 text-gray-600 bg-white"}`}
                      >
                        {eng}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setView("list")} className="w-full">إلغاء</Button>
                <Button onClick={handleCreate} disabled={!form.clientName || !form.phone || !form.address} className="w-full bg-blue-600">إنشاء التذكرة</Button>
              </div>
            </div>
          )}

          {view === "list" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-600">التذاكر الجديدة ({newTickets.length})</h2>
                <Button size="sm" onClick={() => setView("new")} className="bg-blue-600 text-white">+ تذكرة جديدة</Button>
              </div>
              {newTickets.length === 0 && (
                <Card><CardContent className="p-6 text-center text-gray-400 text-sm">لا توجد تذاكر جديدة</CardContent></Card>
              )}
              {newTickets.map(ticket => (
                <TicketCard key={ticket.id} ticket={ticket} onAction={() => {}} />
              ))}
            </div>
          )}

          {view === "inprogress" && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-600">قيد التنفيذ ({inProgress.length})</h2>
              {inProgress.length === 0 && (
                <Card><CardContent className="p-6 text-center text-gray-400 text-sm">لا توجد تذاكر قيد التنفيذ</CardContent></Card>
              )}
              {inProgress.map(ticket => (
                <TicketCard key={ticket.id} ticket={ticket} onAction={() => handleArchive(ticket)} actionLabel="مراجعة وأرشفة" />
              ))}
              {completed.map(ticket => (
                <TicketCard key={ticket.id} ticket={ticket} onAction={() => handleArchive(ticket)} actionLabel="مراجعة وأرشفة" />
              ))}
            </div>
          )}

          {view === "archived" && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-600">المؤرشف والمكتمل ({archived.length + completed.length})</h2>
              {[...archived].map(ticket => (
                <TicketCard key={ticket.id} ticket={ticket} onAction={() => {}} />
              ))}
            </div>
          )}

          {view === "review" && reviewTicket && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setView("inprogress")} className="text-blue-600 text-sm">← رجوع</button>
                <h2 className="text-base font-semibold">مراجعة التذكرة وأرشفتها</h2>
              </div>

              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4 space-y-1">
                  <p className="text-sm font-semibold text-blue-800">{reviewTicket.clientName}</p>
                  <p className="text-xs text-gray-600">{typeLabel[reviewTicket.type]} • {reviewTicket.address}</p>
                  <p className="text-xs text-gray-500">منفذ بواسطة: {reviewTicket.engineer}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">بيانات الإضافة لقاعدة البيانات</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">رقم الخدمة الجديد</Label>
                    <Input value={reviewData.newNumber} onChange={e => setReviewData(p => ({ ...p, newNumber: e.target.value }))} className="mt-1" dir="ltr" placeholder="مثال: 89 أو p12" />
                  </div>
                  <div>
                    <Label className="text-xs">تاريخ بداية الاشتراك</Label>
                    <Input value={reviewData.subscriptionStart} onChange={e => setReviewData(p => ({ ...p, subscriptionStart: e.target.value }))} className="mt-1" dir="ltr" placeholder="DD/MM/YYYY" />
                  </div>
                  <div>
                    <Label className="text-xs">ملاحظات المشرف</Label>
                    <textarea
                      value={reviewData.supervisorNotes}
                      onChange={e => setReviewData(p => ({ ...p, supervisorNotes: e.target.value }))}
                      className="w-full mt-1 border rounded px-3 py-2 text-sm resize-none h-16 text-right"
                      dir="rtl"
                      placeholder="ملاحظات عند الأرشفة..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="addToDb"
                      checked={reviewData.addToDb}
                      onChange={e => setReviewData(p => ({ ...p, addToDb: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <label htmlFor="addToDb" className="text-sm text-gray-700">حفظ في قاعدة البيانات</label>
                  </div>
                </CardContent>
              </Card>

              <Button onClick={handleSaveArchive} className="w-full bg-green-600 hover:bg-green-700">
                ✅ أرشفة وحفظ
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function TicketCard({ ticket, onAction, actionLabel }: { ticket: Ticket; onAction: () => void; actionLabel?: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <p className="font-semibold text-gray-800 text-sm">{ticket.clientName}</p>
            <p className="text-xs text-gray-500 mt-0.5">{ticket.address}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor[ticket.type]}`}>
              {typeLabel[ticket.type]}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[ticket.status]}`}>
              {ticket.status}
            </span>
          </div>
        </div>
        <Separator className="my-2" />
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            <span>👷 {ticket.engineer}</span>
            <span className="mx-2">•</span>
            <span>{ticket.createdAt}</span>
          </div>
          {actionLabel && (
            <Button size="sm" variant="outline" onClick={onAction} className="text-xs h-7">
              {actionLabel}
            </Button>
          )}
        </div>
        {ticket.completedData?.supervisorNotes && (
          <p className="text-xs text-gray-500 mt-2 border-t pt-2">📝 {ticket.completedData.supervisorNotes}</p>
        )}
      </CardContent>
    </Card>
  );
}
