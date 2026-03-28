import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

type View = "engineers" | "add" | "delivery" | "audit";

interface Engineer {
  id: number;
  name: string;
  phone: string;
  specialty: string;
  active: boolean;
  tasksCompleted: number;
}

interface DeliveryLog {
  id: number;
  amount: number;
  type: "هوت سبوت" | "بروادباند";
  date: string;
  note: string;
}

const MOCK_ENGINEERS: Engineer[] = [
  { id: 1, name: "أحمد علي", phone: "0501111111", specialty: "تركيب وصيانة", active: true, tasksCompleted: 42 },
  { id: 2, name: "محمد سالم", phone: "0502222222", specialty: "بروادباند", active: true, tasksCompleted: 28 },
  { id: 3, name: "خالد عمر", phone: "0503333333", specialty: "تركيب وصيانة", active: true, tasksCompleted: 35 },
  { id: 4, name: "يوسف كمال", phone: "0504444444", specialty: "هوت سبوت", active: false, tasksCompleted: 15 },
];

const MOCK_DELIVERY_LOG: DeliveryLog[] = [
  { id: 1, amount: 2500, type: "هوت سبوت", date: "25/03/2026", note: "تسليم أسبوعي" },
  { id: 2, amount: 1200, type: "بروادباند", date: "25/03/2026", note: "تسليم أسبوعي" },
  { id: 3, amount: 1800, type: "هوت سبوت", date: "18/03/2026", note: "تسليم شهري" },
];

export default function EngineerManagement() {
  const [view, setView] = useState<View>("engineers");
  const [engineers, setEngineers] = useState<Engineer[]>(MOCK_ENGINEERS);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>(MOCK_DELIVERY_LOG);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [newEng, setNewEng] = useState({ name: "", phone: "", specialty: "تركيب وصيانة" });

  const [deliveryForm, setDeliveryForm] = useState({
    hotspotAmount: "",
    broadbandAmount: "",
    note: "",
  });
  const [deliverySubmitted, setDeliverySubmitted] = useState(false);

  const [auditForm, setAuditForm] = useState({
    cashActual: "",
    cardsActual: "",
    otherActual: "",
    notes: "",
  });
  const [auditSubmitted, setAuditSubmitted] = useState(false);

  const financeManagerCustody = {
    cash: 8500,
    cards: 3200,
    other: 450,
    total: 12150,
  };

  function handleAddEngineer() {
    if (!newEng.name || !newEng.phone) return;
    setEngineers(prev => [...prev, {
      id: Date.now(),
      name: newEng.name,
      phone: newEng.phone,
      specialty: newEng.specialty,
      active: true,
      tasksCompleted: 0,
    }]);
    setNewEng({ name: "", phone: "", specialty: "تركيب وصيانة" });
    setView("engineers");
  }

  function toggleActive(id: number) {
    setEngineers(prev => prev.map(e => e.id === id ? { ...e, active: !e.active } : e));
  }

  function handleDelivery() {
    const hotspot = parseFloat(deliveryForm.hotspotAmount) || 0;
    const broadband = parseFloat(deliveryForm.broadbandAmount) || 0;
    if (hotspot === 0 && broadband === 0) return;
    if (hotspot > 0) {
      setDeliveryLogs(prev => [{
        id: Date.now(),
        amount: hotspot,
        type: "هوت سبوت",
        date: "28/03/2026",
        note: deliveryForm.note,
      }, ...prev]);
    }
    if (broadband > 0) {
      setDeliveryLogs(prev => [{
        id: Date.now() + 1,
        amount: broadband,
        type: "بروادباند",
        date: "28/03/2026",
        note: deliveryForm.note,
      }, ...prev]);
    }
    setDeliverySubmitted(true);
    setDeliveryForm({ hotspotAmount: "", broadbandAmount: "", note: "" });
    setTimeout(() => setDeliverySubmitted(false), 2000);
  }

  function handleAudit() {
    const cash = parseFloat(auditForm.cashActual) || 0;
    const cards = parseFloat(auditForm.cardsActual) || 0;
    const other = parseFloat(auditForm.otherActual) || 0;
    const actualTotal = cash + cards + other;
    const expectedTotal = financeManagerCustody.total;
    const diff = actualTotal - expectedTotal;
    setAuditSubmitted(true);
  }

  const activeEngineers = engineers.filter(e => e.active);
  const inactiveEngineers = engineers.filter(e => !e.active);

  const auditCash = parseFloat(auditForm.cashActual) || 0;
  const auditCards = parseFloat(auditForm.cardsActual) || 0;
  const auditOther = parseFloat(auditForm.otherActual) || 0;
  const auditTotal = auditCash + auditCards + auditOther;
  const auditDiff = auditTotal - financeManagerCustody.total;

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 font-sans">
      <div className="bg-teal-700 text-white px-4 py-4">
        <p className="text-sm text-teal-200">الإدارة</p>
        <h1 className="text-xl font-bold">المهندسون الفنيون</h1>
      </div>

      <div className="flex border-b bg-white overflow-x-auto">
        {[
          { id: "engineers" as View, label: "المهندسون" },
          { id: "delivery" as View, label: "تسليم اشتراكات" },
          { id: "audit" as View, label: "مراجعة المالي" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`flex-shrink-0 flex-1 py-3 text-sm font-medium border-b-2 ${view === tab.id ? "border-teal-600 text-teal-600" : "border-transparent text-gray-500"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ScrollArea className="h-[calc(100vh-140px)]">
        <div className="px-4 py-4 space-y-4">

          {view === "engineers" && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-600">
                  المهندسون النشطون ({activeEngineers.length})
                </h2>
                <Button size="sm" onClick={() => setView("add")} className="bg-teal-600 text-white">+ إضافة</Button>
              </div>

              {activeEngineers.map(eng => (
                <EngineerCard key={eng.id} engineer={eng} onToggle={() => toggleActive(eng.id)} />
              ))}

              {inactiveEngineers.length > 0 && (
                <>
                  <Separator />
                  <h2 className="text-sm font-semibold text-gray-400">غير نشطون ({inactiveEngineers.length})</h2>
                  {inactiveEngineers.map(eng => (
                    <EngineerCard key={eng.id} engineer={eng} onToggle={() => toggleActive(eng.id)} />
                  ))}
                </>
              )}
            </>
          )}

          {view === "add" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setView("engineers")} className="text-blue-600 text-sm">← رجوع</button>
                <h2 className="text-base font-semibold">إضافة مهندس جديد</h2>
              </div>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Label className="text-xs">الاسم الكامل *</Label>
                    <Input
                      value={newEng.name}
                      onChange={e => setNewEng(p => ({ ...p, name: e.target.value }))}
                      className="mt-1 text-right"
                      placeholder="اسم المهندس"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">رقم الهاتف *</Label>
                    <Input
                      value={newEng.phone}
                      onChange={e => setNewEng(p => ({ ...p, phone: e.target.value }))}
                      className="mt-1"
                      dir="ltr"
                      placeholder="05xxxxxxxx"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">التخصص</Label>
                    <select
                      value={newEng.specialty}
                      onChange={e => setNewEng(p => ({ ...p, specialty: e.target.value }))}
                      className="w-full mt-1 border rounded px-3 py-2 text-sm text-right bg-white"
                    >
                      <option>تركيب وصيانة</option>
                      <option>هوت سبوت</option>
                      <option>بروادباند</option>
                      <option>كل الأعمال</option>
                    </select>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setView("engineers")}>إلغاء</Button>
                <Button onClick={handleAddEngineer} disabled={!newEng.name || !newEng.phone} className="bg-teal-600">إضافة</Button>
              </div>
            </div>
          )}

          {view === "delivery" && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-700">تسليم قيمة الاشتراكات للمدير المالي</h2>

              {deliverySubmitted && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-green-700 font-semibold">✅ تم التسليم وتحديث عهدة المدير المالي</p>
                </div>
              )}

              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <p className="text-xs text-green-700 mb-2 font-medium">قيمة الاشتراكات المحصّلة الحالية</p>
                  <div className="flex justify-between">
                    <div className="text-center">
                      <p className="text-lg font-bold text-green-800">3,450 ج.م</p>
                      <p className="text-xs text-green-600">هوت سبوت</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-green-800">1,800 ج.م</p>
                      <p className="text-xs text-green-600">بروادباند</p>
                    </div>
                    <div className="text-center border-r pr-4">
                      <p className="text-lg font-bold text-green-900">5,250 ج.م</p>
                      <p className="text-xs text-green-600">الإجمالي</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">مبلغ التسليم</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">هوت سبوت (ج.م)</Label>
                    <Input
                      value={deliveryForm.hotspotAmount}
                      onChange={e => setDeliveryForm(p => ({ ...p, hotspotAmount: e.target.value }))}
                      className="mt-1"
                      type="number"
                      dir="ltr"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">بروادباند (ج.م)</Label>
                    <Input
                      value={deliveryForm.broadbandAmount}
                      onChange={e => setDeliveryForm(p => ({ ...p, broadbandAmount: e.target.value }))}
                      className="mt-1"
                      type="number"
                      dir="ltr"
                      placeholder="0"
                    />
                  </div>
                  {(deliveryForm.hotspotAmount || deliveryForm.broadbandAmount) && (
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-sm font-bold text-gray-700">
                        الإجمالي: {((parseFloat(deliveryForm.hotspotAmount) || 0) + (parseFloat(deliveryForm.broadbandAmount) || 0)).toLocaleString()} ج.م
                      </p>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">ملاحظة</Label>
                    <Input
                      value={deliveryForm.note}
                      onChange={e => setDeliveryForm(p => ({ ...p, note: e.target.value }))}
                      className="mt-1 text-right"
                      placeholder="اختياري"
                    />
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={handleDelivery}
                disabled={!deliveryForm.hotspotAmount && !deliveryForm.broadbandAmount}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                💰 تسليم للمدير المالي
              </Button>

              <Separator />

              <h3 className="text-sm font-semibold text-gray-600">سجل التسليم</h3>
              {deliveryLogs.map(log => (
                <Card key={log.id} className="shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{log.amount.toLocaleString()} ج.م</p>
                        <p className="text-xs text-gray-500">{log.type}</p>
                        {log.note && <p className="text-xs text-gray-400">{log.note}</p>}
                      </div>
                      <span className="text-xs text-gray-400">{log.date}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {view === "audit" && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-700">مراجعة عهدة المدير المالي</h2>

              {auditSubmitted && (
                <div className={`border rounded-lg p-4 text-center ${auditDiff === 0 ? "bg-green-50 border-green-200" : Math.abs(auditDiff) <= 100 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"}`}>
                  <p className={`font-bold text-lg ${auditDiff === 0 ? "text-green-700" : auditDiff > 0 ? "text-blue-700" : "text-red-700"}`}>
                    {auditDiff === 0 ? "✅ مطابق تماماً" : auditDiff > 0 ? `زيادة: +${auditDiff.toLocaleString()} ج.م` : `نقص: ${auditDiff.toLocaleString()} ج.م`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">تم إرسال التقرير للمالك</p>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => setAuditSubmitted(false)}>مراجعة جديدة</Button>
                </div>
              )}

              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-blue-800">العهدة المتوقعة للمدير المالي</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">نقداً</span>
                    <span className="font-medium">{financeManagerCustody.cash.toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">بطاقات</span>
                    <span className="font-medium">{financeManagerCustody.cards.toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">أخرى</span>
                    <span className="font-medium">{financeManagerCustody.other.toLocaleString()} ج.م</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm font-bold text-blue-800">
                    <span>الإجمالي</span>
                    <span>{financeManagerCustody.total.toLocaleString()} ج.م</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">القيم الفعلية</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">النقد الفعلي (ج.م)</Label>
                    <Input
                      value={auditForm.cashActual}
                      onChange={e => setAuditForm(p => ({ ...p, cashActual: e.target.value }))}
                      className="mt-1"
                      type="number"
                      dir="ltr"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">البطاقات الفعلية (ج.م)</Label>
                    <Input
                      value={auditForm.cardsActual}
                      onChange={e => setAuditForm(p => ({ ...p, cardsActual: e.target.value }))}
                      className="mt-1"
                      type="number"
                      dir="ltr"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">أخرى (ج.م)</Label>
                    <Input
                      value={auditForm.otherActual}
                      onChange={e => setAuditForm(p => ({ ...p, otherActual: e.target.value }))}
                      className="mt-1"
                      type="number"
                      dir="ltr"
                      placeholder="0"
                    />
                  </div>

                  {(auditForm.cashActual || auditForm.cardsActual || auditForm.otherActual) && (
                    <div className={`rounded-lg p-3 ${auditDiff === 0 ? "bg-green-50" : auditDiff > 0 ? "bg-blue-50" : "bg-red-50"}`}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">الإجمالي الفعلي</span>
                        <span className="font-bold">{auditTotal.toLocaleString()} ج.م</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">الفرق</span>
                        <span className={`font-bold ${auditDiff === 0 ? "text-green-700" : auditDiff > 0 ? "text-blue-700" : "text-red-700"}`}>
                          {auditDiff > 0 ? "+" : ""}{auditDiff.toLocaleString()} ج.م
                        </span>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs">ملاحظات</Label>
                    <textarea
                      value={auditForm.notes}
                      onChange={e => setAuditForm(p => ({ ...p, notes: e.target.value }))}
                      className="w-full mt-1 border rounded px-3 py-2 text-sm resize-none h-16 text-right"
                      dir="rtl"
                      placeholder="أي ملاحظات للتقرير..."
                    />
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={handleAudit}
                disabled={!auditForm.cashActual && !auditForm.cardsActual && !auditForm.otherActual}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                📊 إرسال تقرير المراجعة للمالك
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function EngineerCard({ engineer, onToggle }: { engineer: Engineer; onToggle: () => void }) {
  return (
    <Card className={`shadow-sm ${!engineer.active ? "opacity-60" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${engineer.active ? "bg-teal-500" : "bg-gray-400"}`}>
              {engineer.name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-gray-800">{engineer.name}</p>
              <p className="text-xs text-gray-500">{engineer.specialty}</p>
              <a href={`tel:${engineer.phone}`} className="text-xs text-blue-600" dir="ltr">{engineer.phone}</a>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${engineer.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {engineer.active ? "نشط" : "غير نشط"}
            </span>
            <p className="text-xs text-gray-400">{engineer.tasksCompleted} مهمة</p>
            <Button
              size="sm"
              variant="outline"
              onClick={onToggle}
              className={`text-xs h-7 ${engineer.active ? "text-red-600 border-red-200" : "text-green-600 border-green-200"}`}
            >
              {engineer.active ? "تعطيل" : "تفعيل"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
