import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CreditCard, Wifi, Banknote, TrendingUp, CheckCircle } from "lucide-react";
import { formatCurrency } from "./data";

type SellType = "cards" | "broadband";
type PaymentMethod = "cash" | "loan";

interface SellScreenProps {
  onBack: () => void;
}

export default function SellScreen({ onBack }: SellScreenProps) {
  const [sellType, setSellType] = useState<SellType>("cards");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");
  const [entityName, setEntityName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!amount || !entityName) return;
    setSubmitted(true);
  };

  const handleReset = () => {
    setSubmitted(false);
    setAmount("");
    setEntityName("");
    setNotes("");
    setSellType("cards");
    setPaymentMethod("cash");
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <div className="text-center">
          <div className="bg-green-100 rounded-full p-6 w-24 h-24 mx-auto flex items-center justify-center mb-4">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">تمت عملية البيع بنجاح</h2>
          <p className="text-muted-foreground mb-1">
            {sellType === "cards" ? "كروت شحن" : "اشتراك باقة نت"} — {entityName}
          </p>
          <p className="text-2xl font-bold text-indigo-600 mb-1">{formatCurrency(parseFloat(amount))}</p>
          <Badge className={paymentMethod === "cash" ? "bg-green-100 text-green-800 border-green-200" : "bg-blue-100 text-blue-800 border-blue-200"}>
            {paymentMethod === "cash" ? "نقدي — أُضيف للصندوق" : "دين — سُجل كقرض"}
          </Badge>
          <div className="mt-6 flex gap-3 justify-center">
            <Button onClick={handleReset}>بيع جديد</Button>
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
        <h1 className="text-lg font-bold">بيع</h1>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">نوع البيع</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSellType("cards")}
              className={`rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all ${
                sellType === "cards"
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className={`rounded-full p-2 ${sellType === "cards" ? "bg-indigo-100" : "bg-gray-100"}`}>
                <CreditCard className={`w-6 h-6 ${sellType === "cards" ? "text-indigo-600" : "text-gray-500"}`} />
              </div>
              <span className={`text-sm font-medium ${sellType === "cards" ? "text-indigo-700" : "text-gray-700"}`}>
                كروت شحن
              </span>
            </button>
            <button
              onClick={() => setSellType("broadband")}
              className={`rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all ${
                sellType === "broadband"
                  ? "border-teal-500 bg-teal-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className={`rounded-full p-2 ${sellType === "broadband" ? "bg-teal-100" : "bg-gray-100"}`}>
                <Wifi className={`w-6 h-6 ${sellType === "broadband" ? "text-teal-600" : "text-gray-500"}`} />
              </div>
              <span className={`text-sm font-medium ${sellType === "broadband" ? "text-teal-700" : "text-gray-700"}`}>
                باقة نت
              </span>
            </button>
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
                <span className="text-xs text-green-600">يُضاف للصندوق</span>
              )}
            </button>
            <button
              onClick={() => setPaymentMethod("loan")}
              className={`rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all ${
                paymentMethod === "loan"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className={`rounded-full p-2 ${paymentMethod === "loan" ? "bg-blue-100" : "bg-gray-100"}`}>
                <TrendingUp className={`w-6 h-6 ${paymentMethod === "loan" ? "text-blue-600" : "text-gray-500"}`} />
              </div>
              <span className={`text-sm font-medium ${paymentMethod === "loan" ? "text-blue-700" : "text-gray-700"}`}>
                دين
              </span>
              {paymentMethod === "loan" && (
                <span className="text-xs text-blue-600">يُسجل كقرض</span>
              )}
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="entity">
                {paymentMethod === "loan" ? "اسم المدين" : "اسم العميل / نقطة البيع"}
              </Label>
              <Input
                id="entity"
                placeholder="أدخل الاسم"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
              />
            </div>

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

            <div className="space-y-1.5">
              <Label htmlFor="notes">ملاحظات (اختياري)</Label>
              <Input
                id="notes"
                placeholder="ملاحظة..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {amount && entityName && (
              <div className="bg-gray-50 rounded-lg p-3 border">
                <p className="text-xs text-muted-foreground mb-1">ملخص العملية</p>
                <p className="text-sm font-medium">
                  {sellType === "cards" ? "بيع كروت شحن" : "بيع باقة نت"} لـ {entityName}
                </p>
                <p className="text-lg font-bold text-indigo-600">{formatCurrency(parseFloat(amount) || 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {paymentMethod === "cash"
                    ? "يُضاف للصندوق النقدي"
                    : "يُسجل كقرض على العميل ولا يُضاف للصندوق"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          className="w-full h-12 text-base"
          disabled={!amount || !entityName}
          onClick={handleSubmit}
        >
          تأكيد البيع
        </Button>
      </div>
    </div>
  );
}
