import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SalesPoint {
  id: number;
  name: string;
  ownerName: string;
  phoneNumber: string;
  location: string;
  oldDebt: string;
  notes?: string;
}

interface Loan {
  id: number;
  salesPointId: number;
  direction: "given" | "received";
  amount: string;
  notes?: string;
  recordedAt: string;
}

const MOCK_SALES_POINTS: SalesPoint[] = [
  { id: 1, name: "نقطة بيع الرياض الشمالية", ownerName: "عبدالله السالم", phoneNumber: "0512345601", location: "حي الغدير، الرياض", oldDebt: "1500.00", notes: "" },
  { id: 2, name: "نقطة بيع العليا", ownerName: "محمد الحربي", phoneNumber: "0512345602", location: "شارع العليا، الرياض", oldDebt: "0.00" },
  { id: 3, name: "نقطة بيع الملز", ownerName: "سعد العمري", phoneNumber: "0512345603", location: "حي الملز، الرياض", oldDebt: "3200.50", notes: "تحت المراجعة" },
  { id: 4, name: "نقطة بيع النسيم", ownerName: "فهد الدوسري", phoneNumber: "0512345604", location: "حي النسيم، الرياض", oldDebt: "750.00" },
  { id: 5, name: "نقطة بيع الشفا", ownerName: "خالد المطيري", phoneNumber: "0512345605", location: "حي الشفا، الرياض", oldDebt: "0.00" },
  { id: 6, name: "نقطة بيع الدرعية", ownerName: "عمر القحطاني", phoneNumber: "0512345606", location: "الدرعية، الرياض", oldDebt: "5000.00" },
  { id: 7, name: "نقطة بيع المرقب", ownerName: "يوسف الزهراني", phoneNumber: "0512345607", location: "حي المرقب، الرياض", oldDebt: "2100.00" },
  { id: 8, name: "نقطة بيع الروضة", ownerName: "تركي السبيعي", phoneNumber: "0512345608", location: "حي الروضة، الرياض", oldDebt: "0.00" },
];

const MOCK_LOANS: Loan[] = [
  { id: 1, salesPointId: 1, direction: "given", amount: "500.00", notes: "سلفة لشراء مستلزمات", recordedAt: "2026-03-15T10:00:00Z" },
  { id: 2, salesPointId: 1, direction: "received", amount: "200.00", notes: "دفعة جزئية", recordedAt: "2026-03-20T14:00:00Z" },
  { id: 3, salesPointId: 3, direction: "given", amount: "1000.00", recordedAt: "2026-03-10T09:00:00Z" },
];

function SalesPointCard({ point, onEdit, onViewLoans }: {
  point: SalesPoint;
  onEdit: (p: SalesPoint) => void;
  onViewLoans: (p: SalesPoint) => void;
}) {
  const hasDebt = parseFloat(point.oldDebt) > 0;
  return (
    <Card className="mb-3 shadow-sm border border-gray-100" dir="rtl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-800 text-sm leading-tight flex-1 ml-2">{point.name}</h3>
          {hasDebt && (
            <span className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">
              دين: {parseFloat(point.oldDebt).toLocaleString("ar-SA")} ر.س
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-0.5">👤 {point.ownerName}</p>
        <p className="text-xs text-gray-500 mb-0.5" dir="ltr" style={{ textAlign: "right" }}>📞 {point.phoneNumber}</p>
        <p className="text-xs text-gray-500 mb-2">📍 {point.location}</p>
        {point.notes && (
          <p className="text-xs text-gray-400 bg-gray-50 rounded p-1.5 mb-2 border border-gray-100">{point.notes}</p>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onEdit(point)} className="text-xs h-7 px-2 flex-1">
            تعديل
          </Button>
          <Button size="sm" variant="outline" onClick={() => onViewLoans(point)} className="text-xs h-7 px-2 flex-1 text-blue-600 border-blue-200">
            السلف والديون
          </Button>
          <Button size="sm" variant="ghost" onClick={() => window.open(`tel:${point.phoneNumber}`)} className="text-xs h-7 px-2">
            📞
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EditDialog({ point, onClose, onSave }: {
  point: SalesPoint | null;
  onClose: () => void;
  onSave: (p: Partial<SalesPoint> & { id?: number }) => void;
}) {
  const isNew = !point?.id;
  const [form, setForm] = useState<Partial<SalesPoint>>(point ?? {});

  const handleChange = (key: keyof SalesPoint) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSave = () => {
    if (!form.name || !form.ownerName || !form.phoneNumber || !form.location) return;
    onSave(form);
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent dir="rtl" className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">{isNew ? "إضافة نقطة بيع جديدة" : "تعديل نقطة البيع"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs mb-1 block">اسم نقطة البيع *</Label>
            <Input value={form.name ?? ""} onChange={handleChange("name")} placeholder="اسم نقطة البيع" className="text-right" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">اسم المالك *</Label>
            <Input value={form.ownerName ?? ""} onChange={handleChange("ownerName")} placeholder="اسم المالك" className="text-right" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">رقم الهاتف *</Label>
            <Input value={form.phoneNumber ?? ""} onChange={handleChange("phoneNumber")} placeholder="05XXXXXXXX" dir="ltr" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">الموقع *</Label>
            <Input value={form.location ?? ""} onChange={handleChange("location")} placeholder="عنوان نقطة البيع" className="text-right" />
          </div>
          {isNew && (
            <div>
              <Label className="text-xs mb-1 block">الدين القديم (مرجعي فقط - لا يتغير)</Label>
              <Input value={form.oldDebt ?? ""} onChange={handleChange("oldDebt")} placeholder="0.00" dir="ltr" type="number" />
              <p className="text-xs text-amber-600 mt-1">⚠️ هذا الحقل مرجعي فقط ولن يتأثر بأي عمليات مالية</p>
            </div>
          )}
          <div>
            <Label className="text-xs mb-1 block">ملاحظات</Label>
            <Textarea value={form.notes ?? ""} onChange={handleChange("notes")} placeholder="ملاحظات إضافية..." className="text-right resize-none" rows={2} />
          </div>
        </div>
        <DialogFooter className="flex gap-2 flex-row-reverse">
          <Button onClick={handleSave} className="flex-1 bg-purple-700 hover:bg-purple-800">حفظ</Button>
          <Button variant="outline" onClick={onClose} className="flex-1">إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LoansDialog({ point, loans, onClose, onAddLoan }: {
  point: SalesPoint;
  loans: Loan[];
  onClose: () => void;
  onAddLoan: (l: Omit<Loan, "id" | "salesPointId" | "recordedAt">) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [direction, setDirection] = useState<"given" | "received">("given");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const pointLoans = loans.filter((l) => l.salesPointId === point.id);
  const totalGiven = pointLoans.filter((l) => l.direction === "given").reduce((s, l) => s + parseFloat(l.amount), 0);
  const totalReceived = pointLoans.filter((l) => l.direction === "received").reduce((s, l) => s + parseFloat(l.amount), 0);
  const net = totalGiven - totalReceived;

  const handleAdd = () => {
    if (!amount) return;
    onAddLoan({ direction, amount, notes: notes || undefined });
    setShowAdd(false);
    setAmount("");
    setNotes("");
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent dir="rtl" className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">السلف والديون - {point.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-red-50 rounded-lg p-2">
              <p className="text-xs text-gray-500">منحناها</p>
              <p className="font-bold text-red-600 text-sm">{totalGiven.toLocaleString("ar-SA")}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-2">
              <p className="text-xs text-gray-500">استلمناها</p>
              <p className="font-bold text-green-600 text-sm">{totalReceived.toLocaleString("ar-SA")}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs text-gray-500">الصافي</p>
              <p className={`font-bold text-sm ${net > 0 ? "text-red-600" : net < 0 ? "text-green-600" : "text-gray-600"}`}>
                {Math.abs(net).toLocaleString("ar-SA")}
              </p>
            </div>
          </div>

          {parseFloat(point.oldDebt) > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
              <p className="text-xs text-amber-700">📌 الدين القديم (مرجعي): {parseFloat(point.oldDebt).toLocaleString("ar-SA")} ر.س</p>
            </div>
          )}

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {pointLoans.length === 0 && <p className="text-center text-gray-400 text-xs py-4">لا توجد سجلات سلف</p>}
            {pointLoans.map((loan) => (
              <div key={loan.id} className={`flex items-center justify-between p-2 rounded-lg border text-xs ${loan.direction === "given" ? "bg-red-50 border-red-100" : "bg-green-50 border-green-100"}`}>
                <div>
                  <span className={`font-medium ${loan.direction === "given" ? "text-red-700" : "text-green-700"}`}>
                    {loan.direction === "given" ? "↗ سلفة ممنوحة" : "↙ مبلغ مستلم"}
                  </span>
                  {loan.notes && <p className="text-gray-500 mt-0.5">{loan.notes}</p>}
                </div>
                <div className="text-right">
                  <p className={`font-bold ${loan.direction === "given" ? "text-red-700" : "text-green-700"}`}>
                    {parseFloat(loan.amount).toLocaleString("ar-SA")} ر.س
                  </p>
                  <p className="text-gray-400 text-xs">{new Date(loan.recordedAt).toLocaleDateString("ar-SA")}</p>
                </div>
              </div>
            ))}
          </div>

          {showAdd ? (
            <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
              <div className="flex gap-2">
                <button
                  onClick={() => setDirection("given")}
                  className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${direction === "given" ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-600 border-gray-200"}`}
                >
                  سلفة ممنوحة
                </button>
                <button
                  onClick={() => setDirection("received")}
                  className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${direction === "received" ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-200"}`}
                >
                  مبلغ مستلم
                </button>
              </div>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="المبلغ (ر.س)" type="number" dir="ltr" className="text-left" />
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)" className="text-right" />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} className="flex-1 text-xs h-8 bg-purple-700 hover:bg-purple-800">حفظ</Button>
                <Button size="sm" variant="outline" onClick={() => setShowAdd(false)} className="flex-1 text-xs h-8">إلغاء</Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setShowAdd(true)} className="w-full text-xs h-8 bg-purple-700 hover:bg-purple-800">
              + إضافة سجل جديد
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="w-full">إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SalesPointsList() {
  const [salesPoints, setSalesPoints] = useState<SalesPoint[]>(MOCK_SALES_POINTS);
  const [loans, setLoans] = useState<Loan[]>(MOCK_LOANS);
  const [search, setSearch] = useState("");
  const [editingPoint, setEditingPoint] = useState<SalesPoint | null | "new">(null);
  const [viewingLoans, setViewingLoans] = useState<SalesPoint | null>(null);

  const filtered = salesPoints.filter((p) =>
    p.name.includes(search) || p.ownerName.includes(search) || p.location.includes(search)
  );

  const handleSave = (form: Partial<SalesPoint> & { id?: number }) => {
    if (form.id) {
      setSalesPoints((prev) => prev.map((p) => p.id === form.id ? { ...p, ...form } as SalesPoint : p));
    } else {
      const newId = Math.max(...salesPoints.map((p) => p.id)) + 1;
      setSalesPoints((prev) => [...prev, { ...form, id: newId, oldDebt: form.oldDebt ?? "0" } as SalesPoint]);
    }
    setEditingPoint(null);
  };

  const handleAddLoan = (loan: Omit<Loan, "id" | "salesPointId" | "recordedAt">) => {
    if (!viewingLoans) return;
    const newId = Math.max(...loans.map((l) => l.id), 0) + 1;
    setLoans((prev) => [...prev, { ...loan, id: newId, salesPointId: viewingLoans.id, recordedAt: new Date().toISOString() }]);
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="bg-gradient-to-l from-indigo-700 to-indigo-900 text-white px-4 pt-8 pb-6">
        <p className="text-sm text-indigo-200 mb-1">المدير المالي</p>
        <h1 className="text-xl font-bold">إدارة نقاط البيع</h1>
        <p className="text-xs text-indigo-300 mt-1">{salesPoints.length} نقطة بيع مسجلة</p>
      </div>

      <div className="px-4 pt-4">
        <div className="flex gap-2 mb-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الموقع..."
            className="flex-1 text-right bg-white border-gray-200"
          />
          <Button
            onClick={() => setEditingPoint({ id: 0, name: "", ownerName: "", phoneNumber: "", location: "", oldDebt: "0" })}
            className="bg-indigo-700 hover:bg-indigo-800 text-white whitespace-nowrap px-3"
          >
            + إضافة
          </Button>
        </div>

        <p className="text-xs text-gray-400 mb-3">{filtered.length} نتيجة</p>

        {filtered.map((point) => (
          <SalesPointCard
            key={point.id}
            point={point}
            onEdit={setEditingPoint}
            onViewLoans={setViewingLoans}
          />
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">لا توجد نتائج مطابقة</div>
        )}
      </div>

      {editingPoint && editingPoint !== "new" && (
        <EditDialog
          point={editingPoint.id === 0 ? null : editingPoint}
          onClose={() => setEditingPoint(null)}
          onSave={handleSave}
        />
      )}

      {viewingLoans && (
        <LoansDialog
          point={viewingLoans}
          loans={loans}
          onClose={() => setViewingLoans(null)}
          onAddLoan={handleAddLoan}
        />
      )}
    </div>
  );
}
