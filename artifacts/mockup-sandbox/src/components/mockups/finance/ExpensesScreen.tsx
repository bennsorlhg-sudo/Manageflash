import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  Receipt,
  Pencil,
  Trash2,
  Plus,
  CheckCircle,
  Calendar,
  Settings,
  ListChecks,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mockExpenses, mockExpenseTemplates, mockObligations, formatCurrency, type ExpenseRecord, type ExpenseTemplate, type Obligation } from "./data";

type FilterPeriod = "day" | "week" | "month" | "custom";
type SubView = "expenses" | "templates" | "obligations";

interface ExpensesScreenProps {
  onBack: () => void;
}

export default function ExpensesScreen({ onBack }: ExpensesScreenProps) {
  const [subView, setSubView] = useState<SubView>("expenses");
  const [period, setPeriod] = useState<FilterPeriod>("month");
  const [expenses, setExpenses] = useState(mockExpenses);
  const [templates, setTemplates] = useState(mockExpenseTemplates);
  const [obligations, setObligations] = useState(mockObligations);

  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<number | null>(null);

  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<ExpenseTemplate | null>(null);

  const [showAddObligation, setShowAddObligation] = useState(false);
  const [newObligationName, setNewObligationName] = useState("");
  const [newObligationAmount, setNewObligationAmount] = useState("");
  const [newObligationStatus, setNewObligationStatus] = useState<"permanent" | "ended">("permanent");
  const [editingObligation, setEditingObligation] = useState<Obligation | null>(null);

  const now = new Date("2026-03-28");
  const filteredExpenses = expenses.filter((e) => {
    const expDate = new Date(e.date);
    if (period === "day") return expDate.toDateString() === now.toDateString();
    if (period === "week") {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return expDate >= weekAgo;
    }
    if (period === "month") return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
    return true;
  });

  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);

  const handleDeleteExpense = (id: number) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    setDeletingExpenseId(null);
  };

  const handleSaveExpenseEdit = () => {
    if (!editingExpense) return;
    setExpenses((prev) => prev.map((e) => e.id === editingExpense.id ? editingExpense : e));
    setEditingExpense(null);
  };

  const handleAddTemplate = () => {
    if (!newTemplateName) return;
    const newT: ExpenseTemplate = { id: Date.now(), name: newTemplateName };
    setTemplates((prev) => [...prev, newT]);
    setNewTemplateName("");
    setShowAddTemplate(false);
  };

  const handleDeleteTemplate = (id: number) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSaveTemplateEdit = () => {
    if (!editingTemplate) return;
    setTemplates((prev) => prev.map((t) => t.id === editingTemplate.id ? editingTemplate : t));
    setEditingTemplate(null);
  };

  const handleAddObligation = () => {
    if (!newObligationName || !newObligationAmount) return;
    const newO: Obligation = {
      id: Date.now(),
      name: newObligationName,
      startDate: now.toISOString().split("T")[0],
      status: newObligationStatus,
      monthlyAmount: parseFloat(newObligationAmount),
      totalPaid: 0,
    };
    setObligations((prev) => [...prev, newO]);
    setNewObligationName("");
    setNewObligationAmount("");
    setShowAddObligation(false);
  };

  const handleDeleteObligation = (id: number) => {
    setObligations((prev) => prev.filter((o) => o.id !== id));
  };

  const periods: { value: FilterPeriod; label: string }[] = [
    { value: "day", label: "اليوم" },
    { value: "week", label: "الأسبوع" },
    { value: "month", label: "الشهر" },
    { value: "custom", label: "مخصص" },
  ];

  const typeLabels: Record<string, string> = {
    daily: "يومي",
    monthly_obligation: "التزام شهري",
    purchase: "شراء",
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">المصروفات</h1>
      </div>

      <div className="bg-white border-b flex">
        <button
          className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${subView === "expenses" ? "border-orange-500 text-orange-600" : "border-transparent text-muted-foreground"}`}
          onClick={() => setSubView("expenses")}
        >
          <div className="flex items-center justify-center gap-1.5"><Receipt className="w-3.5 h-3.5" />السجل</div>
        </button>
        <button
          className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${subView === "templates" ? "border-indigo-500 text-indigo-600" : "border-transparent text-muted-foreground"}`}
          onClick={() => setSubView("templates")}
        >
          <div className="flex items-center justify-center gap-1.5"><Settings className="w-3.5 h-3.5" />القوالب</div>
        </button>
        <button
          className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${subView === "obligations" ? "border-purple-500 text-purple-600" : "border-transparent text-muted-foreground"}`}
          onClick={() => setSubView("obligations")}
        >
          <div className="flex items-center justify-center gap-1.5"><ListChecks className="w-3.5 h-3.5" />الالتزامات</div>
        </button>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-3">
        {subView === "expenses" && (
          <>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {periods.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${period === p.value ? "bg-white shadow-sm text-gray-900" : "text-muted-foreground"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <Card className="border-0 shadow-sm bg-gradient-to-l from-orange-600 to-orange-800 text-white">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-xs">إجمالي المصروفات</p>
                  <p className="text-2xl font-bold mt-0.5">{formatCurrency(totalExpenses)}</p>
                </div>
                <Receipt className="w-8 h-8 text-white/70" />
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">سجل المصروفات ({filteredExpenses.length})</p>
            </div>

            <div className="space-y-2">
              {filteredExpenses.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">لا توجد مصروفات في هذه الفترة</div>
              ) : (
                filteredExpenses.map((expense) => (
                  <Card key={expense.id} className="border shadow-sm">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{expense.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              {typeLabels[expense.type]}
                            </Badge>
                            <Badge className={`text-xs px-1.5 py-0 ${expense.paymentMethod === "cash" ? "bg-green-100 text-green-800 border-green-200" : "bg-red-100 text-red-800 border-red-200"}`}>
                              {expense.paymentMethod === "cash" ? "نقدي" : "دين"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {expense.date}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <p className="text-sm font-bold text-orange-600">{formatCurrency(expense.amount)}</p>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditingExpense({ ...expense })}
                              className="p-1 text-muted-foreground hover:text-indigo-600 rounded"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingExpenseId(expense.id)}
                              className="p-1 text-muted-foreground hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        )}

        {subView === "templates" && (
          <>
            <Button
              className="w-full flex items-center gap-2"
              onClick={() => setShowAddTemplate(true)}
            >
              <Plus className="w-4 h-4" />
              إضافة قالب جديد
            </Button>
            <div className="space-y-2">
              {templates.map((t) => (
                <Card key={t.id} className="border shadow-sm">
                  <CardContent className="p-3 flex items-center justify-between">
                    <p className="text-sm font-medium">{t.name}</p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingTemplate({ ...t })}
                        className="p-1.5 text-muted-foreground hover:text-indigo-600 rounded border hover:border-indigo-200 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(t.id)}
                        className="p-1.5 text-muted-foreground hover:text-red-600 rounded border hover:border-red-200 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {subView === "obligations" && (
          <>
            <Button
              className="w-full flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
              onClick={() => setShowAddObligation(true)}
            >
              <Plus className="w-4 h-4" />
              إضافة التزام جديد
            </Button>
            <div className="space-y-2">
              {obligations.map((ob) => (
                <Card key={ob.id} className="border shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium">{ob.name}</p>
                        <p className="text-xs text-muted-foreground">منذ {ob.startDate}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={ob.status === "permanent" ? "bg-purple-100 text-purple-800 border-purple-200 text-xs" : "bg-gray-100 text-gray-600 border-gray-200 text-xs"}>
                          {ob.status === "permanent" ? "دائم" : "منتهي"}
                        </Badge>
                        <button
                          onClick={() => handleDeleteObligation(ob.id)}
                          className="p-1 text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-purple-50 rounded p-1.5">
                        <p className="text-muted-foreground">الشهري</p>
                        <p className="font-semibold text-purple-700">{formatCurrency(ob.monthlyAmount)}</p>
                      </div>
                      <div className="bg-gray-50 rounded p-1.5">
                        <p className="text-muted-foreground">المدفوع</p>
                        <p className="font-semibold">{formatCurrency(ob.totalPaid)}</p>
                      </div>
                    </div>
                    {ob.status === "ended" && ob.endDate && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        انتهى في: {ob.endDate}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={!!editingExpense} onOpenChange={() => setEditingExpense(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل المصروف</DialogTitle>
          </DialogHeader>
          {editingExpense && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>الاسم</Label>
                <Input
                  value={editingExpense.name}
                  onChange={(e) => setEditingExpense({ ...editingExpense, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>المبلغ</Label>
                <Input
                  type="number"
                  value={editingExpense.amount}
                  onChange={(e) => setEditingExpense({ ...editingExpense, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <Button className="w-full" onClick={handleSaveExpenseEdit}>حفظ التعديلات</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deletingExpenseId !== null} onOpenChange={() => setDeletingExpenseId(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">هل أنت متأكد من حذف هذا المصروف؟</p>
          <div className="flex gap-2">
            <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => deletingExpenseId && handleDeleteExpense(deletingExpenseId)}>
              حذف
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setDeletingExpenseId(null)}>
              إلغاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddTemplate} onOpenChange={setShowAddTemplate}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة قالب جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>اسم القالب</Label>
              <Input
                placeholder="مثال: فاتورة الكهرباء"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleAddTemplate} disabled={!newTemplateName}>إضافة</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل القالب</DialogTitle>
          </DialogHeader>
          {editingTemplate && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>اسم القالب</Label>
                <Input
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                />
              </div>
              <Button className="w-full" onClick={handleSaveTemplateEdit}>حفظ</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAddObligation} onOpenChange={setShowAddObligation}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة التزام جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>اسم الالتزام</Label>
              <Input
                placeholder="مثال: إيجار المستودع"
                value={newObligationName}
                onChange={(e) => setNewObligationName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>المبلغ الشهري</Label>
              <Input
                type="number"
                placeholder="0"
                value={newObligationAmount}
                onChange={(e) => setNewObligationAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setNewObligationStatus("permanent")}
                  className={`p-2.5 rounded-lg border-2 text-sm font-medium transition-all ${newObligationStatus === "permanent" ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-200 text-muted-foreground"}`}
                >
                  دائم
                </button>
                <button
                  onClick={() => setNewObligationStatus("ended")}
                  className={`p-2.5 rounded-lg border-2 text-sm font-medium transition-all ${newObligationStatus === "ended" ? "border-gray-500 bg-gray-50 text-gray-700" : "border-gray-200 text-muted-foreground"}`}
                >
                  منتهي
                </button>
              </div>
            </div>
            <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={handleAddObligation} disabled={!newObligationName || !newObligationAmount}>
              إضافة الالتزام
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
