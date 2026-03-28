import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  TrendingUp,
  Banknote,
  CreditCard,
  Wifi,
  Calendar,
} from "lucide-react";
import { mockSales, formatCurrency, type SaleRecord } from "./data";

type FilterPeriod = "day" | "week" | "month" | "custom";

interface SalesScreenProps {
  onBack: () => void;
}

export default function SalesScreen({ onBack }: SalesScreenProps) {
  const [period, setPeriod] = useState<FilterPeriod>("day");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const now = new Date("2026-03-28");

  const filteredSales = mockSales.filter((s) => {
    const saleDate = new Date(s.date);
    if (period === "day") {
      return saleDate.toDateString() === now.toDateString();
    } else if (period === "week") {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return saleDate >= weekAgo;
    } else if (period === "month") {
      return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const totalSales = filteredSales.reduce((s, r) => s + r.amount, 0);
  const cashSales = filteredSales.filter((s) => s.paymentMethod === "cash").reduce((s, r) => s + r.amount, 0);
  const loanSales = filteredSales.filter((s) => s.paymentMethod === "loan").reduce((s, r) => s + r.amount, 0);

  const periods: { value: FilterPeriod; label: string }[] = [
    { value: "day", label: "اليوم" },
    { value: "week", label: "الأسبوع" },
    { value: "month", label: "الشهر" },
    { value: "custom", label: "مخصص" },
  ];

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">المبيعات</h1>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-4">
        <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                period === p.value
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-muted-foreground hover:text-gray-600"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">من</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">إلى</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2">
          <Card className="border-0 shadow-md bg-gradient-to-l from-emerald-600 to-emerald-800 text-white">
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-xs">إجمالي المبيعات</p>
                <p className="text-2xl font-bold mt-0.5">{formatCurrency(totalSales)}</p>
              </div>
              <div className="bg-white/20 rounded-full p-2">
                <TrendingUp className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Card className="border shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Banknote className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-muted-foreground">نقدي</span>
                </div>
                <p className="text-lg font-bold">{formatCurrency(cashSales)}</p>
              </CardContent>
            </Card>
            <Card className="border shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span className="text-xs text-muted-foreground">ديون</span>
                </div>
                <p className="text-lg font-bold">{formatCurrency(loanSales)}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground font-medium">سجل المبيعات</p>
            <Badge variant="secondary">{filteredSales.length} عملية</Badge>
          </div>
          <div className="space-y-2">
            {filteredSales.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">لا توجد مبيعات في هذه الفترة</div>
            ) : (
              filteredSales.map((sale) => (
                <SaleCard key={sale.id} sale={sale} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SaleCard({ sale }: { sale: SaleRecord }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`rounded-full p-1.5 ${sale.type === "cards" ? "bg-purple-100" : "bg-teal-100"}`}>
              {sale.type === "cards" ? (
                <CreditCard className={`w-4 h-4 text-purple-600`} />
              ) : (
                <Wifi className={`w-4 h-4 text-teal-600`} />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{sale.entityName}</p>
              <p className="text-xs text-muted-foreground">{sale.type === "cards" ? "كروت شحن" : "باقة نت"}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">{formatCurrency(sale.amount)}</p>
            <Badge className={`text-xs mt-0.5 ${
              sale.paymentMethod === "cash"
                ? "bg-green-100 text-green-800 border-green-200"
                : "bg-blue-100 text-blue-800 border-blue-200"
            }`}>
              {sale.paymentMethod === "cash" ? (
                <><Banknote className="w-3 h-3 ml-1" />نقدي</>
              ) : (
                <><TrendingUp className="w-3 h-3 ml-1" />دين</>
              )}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          {sale.date}
        </div>
      </CardContent>
    </Card>
  );
}
