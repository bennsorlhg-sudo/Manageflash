import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  CheckCircle,
  Send,
  Package,
  RefreshCw,
} from "lucide-react";
import { mockCustodies, formatCurrency } from "./data";

interface ManageSalesScreenProps {
  onBack: () => void;
}

export default function ManageSalesScreen({ onBack }: ManageSalesScreenProps) {
  const [tab, setTab] = useState<"custody" | "points">("custody");

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">إدارة المبيعات</h1>
      </div>

      <div className="bg-white border-b">
        <div className="flex">
          <button
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === "custody"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-muted-foreground"
            }`}
            onClick={() => setTab("custody")}
          >
            <div className="flex items-center justify-center gap-2">
              <Package className="w-4 h-4" />
              العهد
            </div>
          </button>
          <button
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === "points"
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-muted-foreground"
            }`}
            onClick={() => setTab("points")}
          >
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4" />
              نقاط البيع
            </div>
          </button>
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-3">
        {tab === "custody" && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">سجل العهد</p>
              <Badge variant="secondary">{mockCustodies.length} عهدة</Badge>
            </div>
            {mockCustodies.map((custody) => {
              const remaining = custody.custodyValue - custody.cashReturned - custody.cardsReturned;
              return (
                <Card key={custody.id} className="border shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{custody.recipientName}</p>
                        <p className="text-xs text-muted-foreground">{custody.sentAt}</p>
                      </div>
                      <Badge className={custody.isSettled ? "bg-green-100 text-green-800 border-green-200" : "bg-orange-100 text-orange-800 border-orange-200"}>
                        {custody.isSettled ? (
                          <><CheckCircle className="w-3 h-3 ml-1" />مُسوَّاة</>
                        ) : (
                          <><Send className="w-3 h-3 ml-1" />نشطة</>
                        )}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                      <div className="bg-gray-50 rounded p-1.5">
                        <p className="text-muted-foreground">العهدة</p>
                        <p className="font-semibold">{formatCurrency(custody.custodyValue)}</p>
                      </div>
                      <div className="bg-green-50 rounded p-1.5">
                        <p className="text-muted-foreground">نقد</p>
                        <p className="font-semibold text-green-600">{formatCurrency(custody.cashReturned)}</p>
                      </div>
                      <div className="bg-purple-50 rounded p-1.5">
                        <p className="text-muted-foreground">كروت</p>
                        <p className="font-semibold text-purple-600">{formatCurrency(custody.cardsReturned)}</p>
                      </div>
                    </div>
                    {!custody.isSettled && (
                      <div className="mt-2 text-xs text-center text-orange-600 font-medium">
                        متبقي: {formatCurrency(remaining)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}

        {tab === "points" && (
          <div className="text-center py-16 text-muted-foreground">
            <RefreshCw className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">إدارة نقاط البيع</p>
            <p className="text-xs mt-1">هذه الميزة تُدار من خلال واجهة المشرف</p>
          </div>
        )}
      </div>
    </div>
  );
}
