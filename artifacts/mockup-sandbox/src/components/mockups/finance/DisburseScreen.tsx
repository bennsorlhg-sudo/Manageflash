import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  Banknote,
  TrendingDown,
  Camera,
  CheckCircle,
  Calendar,
  ShoppingBag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { mockExpenseTemplates, formatCurrency } from "./data";

type ExpenseType = "daily" | "monthly_obligation" | "purchase";
type PaymentMethod = "cash" | "debt";

interface DisburseScreenProps {
  onBack: () => void;
}

export default function DisburseScreen({ onBack }: DisburseScreenProps) {
  const [expenseType, setExpenseType] = useState<ExpenseType>("daily");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");
  const [expenseName, setExpenseName] = useState("");
  const [customName, setCustomName] = useState("");
  const [creditorName, setCreditorName] = useState("");
  const [invoicePhoto, setInvoicePhoto] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const expenseTypes = [
    { value: "daily" as const, label: "مصروف يومي", icon: Banknote, color: "orange" },
    { value: "monthly_obligation" as const, label: "التزام شهري", icon: Calendar, color: "purple" },
    { value: "purchase" as const, label: "شراء", icon: ShoppingBag, color: "blue" },
  ];

  const finalName = expenseName === "custom" ? customName : expenseName;

  const handleSubmit = () => {
    if (!amount || !finalName) return;
    setSubmitted(true);
  };

  const handleReset = () => {
    setSubmitted(false);
    setAmount("");
    setExpenseName("");
    setCustomName("");
    setCreditorName("");
    setPaymentMethod("cash");
    setExpenseType("daily");
    setInvoicePhoto(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <div className="text-center">
          <div className="bg-green-100 rounded-full p-6 w-24 h-24 mx-auto flex items-center justify-center mb-4">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">تم تسجيل المصروف بنجاح</h2>
          <p className="text-muted-foreground mb-1">{finalName}</p>
          <p className="text-2xl font-bold text-red-600 mb-1">{formatCurrency(parseFloat(amount))}</p>
          <Badge className={paymentMethod === "cash" ? "bg-orange-100 text-orange-800 border-orange-200" : "bg-red-100 text-red-800 border-red-200"}>
            {paymentMethod === "cash" ? "نقدي — خُصم من الصندوق" : "دين — سُجل على الشركة"}
          </Badge>
          <div className="mt-6 flex gap-3 justify-center">
            <Button onClick={handleReset}>صرف جديد</Button>
            <Button variant="outline" onClick={onBack}>العودة للرئيسية</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">صرف</h1>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">نوع المصروف</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {expenseTypes.map(({ value, label, icon: Icon, color }) => (
              <button
                key={value}
                onClick={() => setExpenseType(value)}
                className={`w-full rounded-xl border-2 p-3 flex items-center gap-3 transition-all ${
                  expenseType === value
                    ? `border-${color}-400 bg-${color}-50`
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className={`rounded-full p-2 ${expenseType === value ? `bg-${color}-100` : "bg-gray-100"}`}>
                  <Icon className={`w-5 h-5 ${expenseType === value ? `text-${color}-600` : "text-gray-500"}`} />
                </div>
                <span className={`text-sm font-medium ${expenseType === value ? `text-${color}-700` : "text-gray-700"}`}>
                  {label}
                </span>
                {expenseType === value && (
                  <div className="mr-auto w-4 h-4 rounded-full border-2 border-current flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-current" />
                  </div>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">طريقة الدفع</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPaymentMethod("cash")}
              className={`rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all ${
                paymentMethod === "cash"
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className={`rounded-full p-2 ${paymentMethod === "cash" ? "bg-green-100" : "bg-gray-100"}`}>
                <Banknote className={`w-6 h-6 ${paymentMethod === "cash" ? "text-green-600" : "text-gray-500"}`} />
              </div>
              <span className={`text-sm font-medium ${paymentMethod === "cash" ? "text-green-700" : "text-gray-700"}`}>
                نقدي
              </span>
              {paymentMethod === "cash" && (
                <span className="text-xs text-green-600">يُخصم من الصندوق</span>
              )}
            </button>
            <button
              onClick={() => setPaymentMethod("debt")}
              className={`rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all ${
                paymentMethod === "debt"
                  ? "border-red-500 bg-red-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className={`rounded-full p-2 ${paymentMethod === "debt" ? "bg-red-100" : "bg-gray-100"}`}>
                <TrendingDown className={`w-6 h-6 ${paymentMethod === "debt" ? "text-red-600" : "text-gray-500"}`} />
              </div>
              <span className={`text-sm font-medium ${paymentMethod === "debt" ? "text-red-700" : "text-gray-700"}`}>
                دين
              </span>
              {paymentMethod === "debt" && (
                <span className="text-xs text-red-600">لا يُخصم من الصندوق</span>
              )}
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>اسم المصروف</Label>
              <Select value={expenseName} onValueChange={setExpenseName}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر من القائمة أو أدخل اسماً جديداً" />
                </SelectTrigger>
                <SelectContent>
                  {mockExpenseTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                  ))}
                  <SelectItem value="custom">+ اسم جديد</SelectItem>
                </SelectContent>
              </Select>
              {expenseName === "custom" && (
                <Input
                  placeholder="أدخل اسم المصروف"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>

            {paymentMethod === "debt" && (
              <div className="space-y-1.5">
                <Label>اسم الدائن</Label>
                <Input
                  placeholder="الجهة المدينة"
                  value={creditorName}
                  onChange={(e) => setCreditorName(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="amount">المبلغ</Label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-10 text-right"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">ر.س</span>
              </div>
            </div>

            <button
              onClick={() => setInvoicePhoto(!invoicePhoto)}
              className={`w-full border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${
                invoicePhoto ? "border-indigo-400 bg-indigo-50" : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <Camera className={`w-6 h-6 ${invoicePhoto ? "text-indigo-500" : "text-gray-400"}`} />
              <span className={`text-sm ${invoicePhoto ? "text-indigo-600 font-medium" : "text-muted-foreground"}`}>
                {invoicePhoto ? "تم إرفاق الفاتورة ✓" : "إرفاق صورة الفاتورة (اختياري)"}
              </span>
            </button>

            {amount && finalName && (
              <div className="bg-gray-50 rounded-lg p-3 border">
                <p className="text-xs text-muted-foreground mb-1">ملخص العملية</p>
                <p className="text-sm font-medium">{finalName}</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(parseFloat(amount) || 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {paymentMethod === "cash"
                    ? "يُخصم من الصندوق النقدي"
                    : "يُسجل كدين على الشركة ولا يُخصم من الصندوق"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          className="w-full h-12 text-base"
          disabled={!amount || !finalName}
          onClick={handleSubmit}
        >
          تأكيد الصرف
        </Button>
      </div>
    </div>
  );
}
