import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Search,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  CheckCircle,
} from "lucide-react";
import { mockLoans, mockDebts, formatCurrency, type LoanRecord, type DebtRecord } from "./data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type Tab = "loans" | "debts";
type SortDir = "asc" | "desc";

interface CollectScreenProps {
  onBack: () => void;
}

export default function CollectScreen({ onBack }: CollectScreenProps) {
  const [activeTab, setActiveTab] = useState<Tab>("loans");
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedLoan, setSelectedLoan] = useState<LoanRecord | null>(null);
  const [selectedDebt, setSelectedDebt] = useState<DebtRecord | null>(null);
  const [collectAmount, setCollectAmount] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const loans = mockLoans
    .filter((l) => l.entityName.includes(search) && l.remaining > 0)
    .sort((a, b) => sortDir === "desc" ? b.remaining - a.remaining : a.remaining - b.remaining);

  const debts = mockDebts
    .filter((d) => d.entityName.includes(search) && d.remaining > 0)
    .sort((a, b) => sortDir === "desc" ? b.remaining - a.remaining : a.remaining - b.remaining);

  const handleCollectLoan = () => {
    if (!selectedLoan || !collectAmount) return;
    setSuccessMsg(`تم تحصيل ${formatCurrency(parseFloat(collectAmount))} من ${selectedLoan.entityName}`);
    setShowSuccess(true);
    setSelectedLoan(null);
    setCollectAmount("");
  };

  const handlePayDebt = () => {
    if (!selectedDebt || !collectAmount) return;
    setSuccessMsg(`تم دفع ${formatCurrency(parseFloat(collectAmount))} لـ ${selectedDebt.entityName}`);
    setShowSuccess(true);
    setSelectedDebt(null);
    setCollectAmount("");
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <div className="text-center">
          <div className="bg-green-100 rounded-full p-6 w-24 h-24 mx-auto flex items-center justify-center mb-4">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">تمت العملية بنجاح</h2>
          <p className="text-muted-foreground">{successMsg}</p>
          <div className="mt-6 flex gap-3 justify-center">
            <Button onClick={() => setShowSuccess(false)}>عملية جديدة</Button>
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
        <h1 className="text-lg font-bold">تحصيل</h1>
      </div>

      <div className="bg-white border-b">
        <div className="flex">
          <button
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "loans"
                ? "border-green-500 text-green-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => { setActiveTab("loans"); setSearch(""); }}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="w-4 h-4" />
              تحصيل قرض
            </div>
          </button>
          <button
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "debts"
                ? "border-red-500 text-red-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => { setActiveTab("debts"); setSearch(""); }}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingDown className="w-4 h-4" />
              سداد دين
            </div>
          </button>
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث باسم الجهة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
            title="ترتيب حسب المبلغ"
          >
            <ArrowUpDown className="w-4 h-4" />
          </Button>
        </div>

        {activeTab === "loans" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">القروض المستحقة (لنا)</p>
              <Badge variant="secondary">{loans.length} جهة</Badge>
            </div>
            {loans.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">لا توجد قروض مستحقة</div>
            ) : (
              loans.map((loan) => (
                <Card key={loan.id} className="border shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-sm">{loan.entityName}</p>
                      <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                        متبقي {formatCurrency(loan.remaining)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-center mb-3">
                      <div className="bg-gray-50 rounded p-1.5">
                        <p className="text-muted-foreground">الإجمالي</p>
                        <p className="font-semibold">{formatCurrency(loan.total)}</p>
                      </div>
                      <div className="bg-green-50 rounded p-1.5">
                        <p className="text-muted-foreground">مُحصَّل</p>
                        <p className="font-semibold text-green-600">{formatCurrency(loan.paid)}</p>
                      </div>
                      <div className="bg-orange-50 rounded p-1.5">
                        <p className="text-muted-foreground">المتبقي</p>
                        <p className="font-semibold text-orange-600">{formatCurrency(loan.remaining)}</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                      <div
                        className="bg-green-500 h-1.5 rounded-full"
                        style={{ width: `${(loan.paid / loan.total) * 100}%` }}
                      />
                    </div>
                    <Button
                      size="sm"
                      className="w-full h-8 text-xs bg-green-600 hover:bg-green-700"
                      onClick={() => setSelectedLoan(loan)}
                    >
                      تحصيل جزئي / كامل
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === "debts" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">الديون المستحقة (علينا)</p>
              <Badge variant="secondary">{debts.length} جهة</Badge>
            </div>
            {debts.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">لا توجد ديون مستحقة</div>
            ) : (
              debts.map((debt) => (
                <Card key={debt.id} className="border shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-sm">{debt.entityName}</p>
                      <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                        متبقي {formatCurrency(debt.remaining)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-center mb-3">
                      <div className="bg-gray-50 rounded p-1.5">
                        <p className="text-muted-foreground">الإجمالي</p>
                        <p className="font-semibold">{formatCurrency(debt.total)}</p>
                      </div>
                      <div className="bg-blue-50 rounded p-1.5">
                        <p className="text-muted-foreground">مدفوع</p>
                        <p className="font-semibold text-blue-600">{formatCurrency(debt.paid)}</p>
                      </div>
                      <div className="bg-red-50 rounded p-1.5">
                        <p className="text-muted-foreground">المتبقي</p>
                        <p className="font-semibold text-red-600">{formatCurrency(debt.remaining)}</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${(debt.paid / debt.total) * 100}%` }}
                      />
                    </div>
                    <Button
                      size="sm"
                      className="w-full h-8 text-xs bg-red-600 hover:bg-red-700"
                      onClick={() => setSelectedDebt(debt)}
                    >
                      سداد جزئي / كامل
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      <Dialog open={!!selectedLoan} onOpenChange={() => { setSelectedLoan(null); setCollectAmount(""); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تحصيل قرض — {selectedLoan?.entityName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-green-50 rounded-lg p-3 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">إجمالي القرض</span>
                <span className="font-medium">{selectedLoan && formatCurrency(selectedLoan.total)}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">محصَّل</span>
                <span className="font-medium text-green-600">{selectedLoan && formatCurrency(selectedLoan.paid)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>المتبقي</span>
                <span className="text-orange-600">{selectedLoan && formatCurrency(selectedLoan.remaining)}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>المبلغ المحصَّل</Label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0"
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  className="pl-10"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">ر.س</span>
              </div>
              {selectedLoan && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setCollectAmount(String(selectedLoan.remaining))}
                >
                  تحصيل الكامل ({formatCurrency(selectedLoan.remaining)})
                </Button>
              )}
            </div>
            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleCollectLoan} disabled={!collectAmount}>
              تأكيد التحصيل
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedDebt} onOpenChange={() => { setSelectedDebt(null); setCollectAmount(""); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>سداد دين — {selectedDebt?.entityName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-50 rounded-lg p-3 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">إجمالي الدين</span>
                <span className="font-medium">{selectedDebt && formatCurrency(selectedDebt.total)}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">مدفوع</span>
                <span className="font-medium text-blue-600">{selectedDebt && formatCurrency(selectedDebt.paid)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>المتبقي</span>
                <span className="text-red-600">{selectedDebt && formatCurrency(selectedDebt.remaining)}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>المبلغ المدفوع</Label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0"
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  className="pl-10"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">ر.س</span>
              </div>
              {selectedDebt && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setCollectAmount(String(selectedDebt.remaining))}
                >
                  سداد الكامل ({formatCurrency(selectedDebt.remaining)})
                </Button>
              )}
            </div>
            <Button className="w-full bg-red-600 hover:bg-red-700" onClick={handlePayDebt} disabled={!collectAmount}>
              تأكيد السداد
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
