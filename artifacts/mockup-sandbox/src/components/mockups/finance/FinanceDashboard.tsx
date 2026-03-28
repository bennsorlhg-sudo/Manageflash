import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Package,
  DollarSign,
  ShoppingCart,
  ArrowUpCircle,
  ArrowDownCircle,
  BarChart3,
  Users,
  Receipt,
  Clock,
} from "lucide-react";
import { mockSummary, mockPurchaseRequests, formatCurrency } from "./data";
import SellScreen from "./SellScreen";
import DisburseScreen from "./DisburseScreen";
import CollectScreen from "./CollectScreen";
import CustodyScreen from "./CustodyScreen";
import ManageSalesScreen from "./ManageSalesScreen";
import SalesScreen from "./SalesScreen";
import ExpensesScreen from "./ExpensesScreen";
import DebtsLoansScreen from "./DebtsLoansScreen";

type ActiveScreen =
  | "dashboard"
  | "sell"
  | "disburse"
  | "collect"
  | "custody"
  | "manage-sales"
  | "sales-points"
  | "sales"
  | "expenses"
  | "debts-loans";

export default function FinanceDashboard() {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>("dashboard");

  const navigate = (screen: ActiveScreen) => setActiveScreen(screen);

  if (activeScreen === "sell") return <SellScreen onBack={() => navigate("dashboard")} />;
  if (activeScreen === "disburse") return <DisburseScreen onBack={() => navigate("dashboard")} />;
  if (activeScreen === "collect") return <CollectScreen onBack={() => navigate("dashboard")} />;
  if (activeScreen === "custody") return <CustodyScreen onBack={() => navigate("dashboard")} />;
  if (activeScreen === "manage-sales") return <ManageSalesScreen onBack={() => navigate("dashboard")} />;
  if (activeScreen === "sales") return <SalesScreen onBack={() => navigate("dashboard")} />;
  if (activeScreen === "expenses") return <ExpensesScreen onBack={() => navigate("dashboard")} />;
  if (activeScreen === "debts-loans") return <DebtsLoansScreen onBack={() => navigate("dashboard")} />;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">المسؤول المالي</p>
          <h1 className="text-lg font-bold text-gray-900">{mockSummary.financeManagerName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">الجمعة، 28 مارس 2026</span>
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
            {mockSummary.financeManagerName[0]}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3 max-w-md mx-auto">
        <Card className="border-0 shadow-md bg-gradient-to-l from-indigo-600 to-indigo-800 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-200 text-sm">إجمالي المستحقات</p>
                <p className="text-3xl font-bold mt-1">{formatCurrency(mockSummary.totalOwed)}</p>
              </div>
              <div className="bg-white/20 rounded-full p-3">
                <TrendingUp className="w-7 h-7" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="border shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-green-100 rounded-full p-1.5">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-xs text-muted-foreground">إجمالي القروض</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(mockSummary.totalLoans)}</p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-blue-100 rounded-full p-1.5">
                  <Wallet className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-xs text-muted-foreground">الصندوق</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(mockSummary.cashBox)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="border shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-orange-100 rounded-full p-1.5">
                  <Package className="w-4 h-4 text-orange-600" />
                </div>
                <span className="text-xs text-muted-foreground">إجمالي العهد</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(mockSummary.totalCustody)}</p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-purple-100 rounded-full p-1.5">
                  <CreditCard className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-xs text-muted-foreground">إجمالي الكروت</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(mockSummary.totalCards)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              className="h-16 flex-col gap-1 text-xs font-medium"
              onClick={() => navigate("disburse")}
            >
              <ArrowUpCircle className="w-5 h-5 text-red-500" />
              صرف
            </Button>
            <Button
              variant="outline"
              className="h-16 flex-col gap-1 text-xs font-medium"
              onClick={() => navigate("collect")}
            >
              <ArrowDownCircle className="w-5 h-5 text-green-500" />
              تحصيل
            </Button>
            <Button
              variant="outline"
              className="h-16 flex-col gap-1 text-xs font-medium"
              onClick={() => navigate("sell")}
            >
              <ShoppingCart className="w-5 h-5 text-blue-500" />
              بيع
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-14 flex-col gap-1 text-xs font-medium"
              onClick={() => navigate("manage-sales")}
            >
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              إدارة المبيعات
            </Button>
            <Button
              variant="outline"
              className="h-14 flex-col gap-1 text-xs font-medium"
              onClick={() => navigate("custody")}
            >
              <Users className="w-5 h-5 text-teal-500" />
              نقاط البيع
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              className="h-14 flex-col gap-1 text-xs font-medium"
              onClick={() => navigate("expenses")}
            >
              <Receipt className="w-5 h-5 text-orange-500" />
              المصروفات
            </Button>
            <Button
              variant="outline"
              className="h-14 flex-col gap-1 text-xs font-medium"
              onClick={() => navigate("debts-loans")}
            >
              <DollarSign className="w-5 h-5 text-yellow-600" />
              الديون والقروض
            </Button>
            <Button
              variant="outline"
              className="h-14 flex-col gap-1 text-xs font-medium"
              onClick={() => navigate("sales")}
            >
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              المبيعات
            </Button>
          </div>
        </div>

        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-800">طلبات الشراء المعلقة</h2>
            <Badge variant="secondary" className="text-xs">
              {mockPurchaseRequests.length} طلبات
            </Badge>
          </div>
          <div className="space-y-2">
            {mockPurchaseRequests.map((req) => (
              <Card key={req.id} className="border shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{req.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        من: {req.requestedBy}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {req.amount ? (
                        <span className="text-sm font-semibold text-indigo-600">
                          {formatCurrency(req.amount)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">غير محدد</span>
                      )}
                      <Badge className="text-xs bg-yellow-100 text-yellow-800 border-yellow-200">
                        <Clock className="w-3 h-3 ml-1" />
                        معلق
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{req.createdAt}</p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" className="flex-1 h-7 text-xs bg-green-600 hover:bg-green-700">
                      موافقة
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs text-red-600 border-red-200 hover:bg-red-50">
                      رفض
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
