import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Search,
  ArrowUpDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { mockLoans, mockDebts, formatCurrency } from "./data";

type Tab = "loans" | "debts";
type SortDir = "asc" | "desc";

interface DebtsLoansScreenProps {
  onBack: () => void;
}

export default function DebtsLoansScreen({ onBack }: DebtsLoansScreenProps) {
  const [activeTab, setActiveTab] = useState<Tab>("loans");
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const loans = mockLoans
    .filter((l) => l.entityName.includes(search))
    .sort((a, b) => sortDir === "desc" ? b.remaining - a.remaining : a.remaining - b.remaining);

  const debts = mockDebts
    .filter((d) => d.entityName.includes(search))
    .sort((a, b) => sortDir === "desc" ? b.remaining - a.remaining : a.remaining - b.remaining);

  const totalLoansRemaining = mockLoans.reduce((s, l) => s + l.remaining, 0);
  const totalDebtsRemaining = mockDebts.reduce((s, d) => s + d.remaining, 0);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">الديون والقروض</h1>
      </div>

      <div className="bg-white border-b">
        <div className="flex">
          <button
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "loans"
                ? "border-green-500 text-green-600"
                : "border-transparent text-muted-foreground"
            }`}
            onClick={() => { setActiveTab("loans"); setSearch(""); }}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="w-4 h-4" />
              القروض (لنا)
            </div>
          </button>
          <button
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "debts"
                ? "border-red-500 text-red-600"
                : "border-transparent text-muted-foreground"
            }`}
            onClick={() => { setActiveTab("debts"); setSearch(""); }}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingDown className="w-4 h-4" />
              الديون (علينا)
            </div>
          </button>
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-3">
        {activeTab === "loans" && (
          <Card className="border-0 shadow-sm bg-gradient-to-l from-green-600 to-green-800 text-white">
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="text-green-100 text-xs">إجمالي القروض المتبقية</p>
                <p className="text-2xl font-bold mt-0.5">{formatCurrency(totalLoansRemaining)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-white/70" />
            </CardContent>
          </Card>
        )}
        {activeTab === "debts" && (
          <Card className="border-0 shadow-sm bg-gradient-to-l from-red-600 to-red-800 text-white">
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="text-red-100 text-xs">إجمالي الديون المتبقية</p>
                <p className="text-2xl font-bold mt-0.5">{formatCurrency(totalDebtsRemaining)}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-white/70" />
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>
          <button
            onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
            className="border rounded-lg px-3 flex items-center gap-1 text-xs text-muted-foreground hover:bg-gray-50"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>

        {activeTab === "loans" && (
          <div className="space-y-2">
            {loans.map((loan) => (
              <Card key={loan.id} className="border shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-sm">{loan.entityName}</p>
                    <Badge className={loan.remaining === 0 ? "bg-green-100 text-green-800 border-green-200" : "bg-orange-100 text-orange-800 border-orange-200"}>
                      {loan.remaining === 0 ? "مُسدَّد" : `متبقي ${formatCurrency(loan.remaining)}`}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-center">
                    <div className="bg-gray-50 rounded p-1.5">
                      <p className="text-muted-foreground">الإجمالي</p>
                      <p className="font-semibold">{formatCurrency(loan.total)}</p>
                    </div>
                    <div className="bg-green-50 rounded p-1.5">
                      <p className="text-muted-foreground">محصَّل</p>
                      <p className="font-semibold text-green-600">{formatCurrency(loan.paid)}</p>
                    </div>
                    <div className="bg-orange-50 rounded p-1.5">
                      <p className="text-muted-foreground">متبقي</p>
                      <p className="font-semibold text-orange-600">{formatCurrency(loan.remaining)}</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
                    <div
                      className="bg-green-500 h-1 rounded-full"
                      style={{ width: `${(loan.paid / loan.total) * 100}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === "debts" && (
          <div className="space-y-2">
            {debts.map((debt) => (
              <Card key={debt.id} className="border shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-sm">{debt.entityName}</p>
                    <Badge className={debt.remaining === 0 ? "bg-green-100 text-green-800 border-green-200" : "bg-red-100 text-red-800 border-red-200"}>
                      {debt.remaining === 0 ? "مُسدَّد" : `متبقي ${formatCurrency(debt.remaining)}`}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-center">
                    <div className="bg-gray-50 rounded p-1.5">
                      <p className="text-muted-foreground">الإجمالي</p>
                      <p className="font-semibold">{formatCurrency(debt.total)}</p>
                    </div>
                    <div className="bg-blue-50 rounded p-1.5">
                      <p className="text-muted-foreground">مدفوع</p>
                      <p className="font-semibold text-blue-600">{formatCurrency(debt.paid)}</p>
                    </div>
                    <div className="bg-red-50 rounded p-1.5">
                      <p className="text-muted-foreground">متبقي</p>
                      <p className="font-semibold text-red-600">{formatCurrency(debt.remaining)}</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
                    <div
                      className="bg-blue-500 h-1 rounded-full"
                      style={{ width: `${(debt.paid / debt.total) * 100}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
