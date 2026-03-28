import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Send,
  RotateCcw,
  CheckCircle,
  Package,
  Banknote,
  CreditCard,
} from "lucide-react";
import { mockCustodies, formatCurrency } from "./data";

type CustodyMode = "list" | "send" | "receive";

interface CustodyScreenProps {
  onBack: () => void;
}

export default function CustodyScreen({ onBack }: CustodyScreenProps) {
  const [mode, setMode] = useState<CustodyMode>("list");
  const [selectedCustody, setSelectedCustody] = useState<(typeof mockCustodies)[0] | null>(null);

  const [sendRecipient, setSendRecipient] = useState("");
  const [sendValue, setSendValue] = useState("");

  const [cashReceived, setCashReceived] = useState("");
  const [cardsReturned, setCardsReturned] = useState("");

  const [submitted, setSubmitted] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const handleSend = () => {
    if (!sendRecipient || !sendValue) return;
    setSuccessMsg(`تم إرسال عهدة بقيمة ${formatCurrency(parseFloat(sendValue))} لـ ${sendRecipient}`);
    setSubmitted(true);
  };

  const handleReceive = () => {
    if (!selectedCustody) return;
    const cash = parseFloat(cashReceived) || 0;
    const cards = parseFloat(cardsReturned) || 0;
    setSuccessMsg(
      `تم استلام عهدة ${selectedCustody.recipientName}: نقدي ${formatCurrency(cash)} + كروت ${formatCurrency(cards)}`
    );
    setSubmitted(true);
  };

  const handleReset = () => {
    setSubmitted(false);
    setMode("list");
    setSelectedCustody(null);
    setSendRecipient("");
    setSendValue("");
    setCashReceived("");
    setCardsReturned("");
    setSuccessMsg("");
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <div className="text-center">
          <div className="bg-green-100 rounded-full p-6 w-24 h-24 mx-auto flex items-center justify-center mb-4">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">تمت العملية بنجاح</h2>
          <p className="text-muted-foreground">{successMsg}</p>
          <div className="mt-6 flex gap-3 justify-center">
            <Button onClick={handleReset}>عملية جديدة</Button>
            <Button variant="outline" onClick={onBack}>العودة للرئيسية</Button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "send") {
    return (
      <div className="min-h-screen bg-gray-50" dir="rtl">
        <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
          <button onClick={() => setMode("list")} className="text-muted-foreground hover:text-foreground">
            <ArrowRight className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">إرسال عهدة</h1>
        </div>
        <div className="p-4 max-w-md mx-auto space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label>اسم المستلم</Label>
                <Input
                  placeholder="اسم الموظف أو نقطة البيع"
                  value={sendRecipient}
                  onChange={(e) => setSendRecipient(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>قيمة العهدة (كروت)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0"
                    value={sendValue}
                    onChange={(e) => setSendValue(e.target.value)}
                    className="pl-10"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">ر.س</span>
                </div>
              </div>
              {sendValue && sendRecipient && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                  <p className="text-orange-800 font-medium">ملاحظة</p>
                  <p className="text-orange-700 mt-1">
                    سيتم خصم {formatCurrency(parseFloat(sendValue) || 0)} من إجمالي الكروت
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          <Button
            className="w-full h-12 text-base"
            disabled={!sendRecipient || !sendValue}
            onClick={handleSend}
          >
            تأكيد إرسال العهدة
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "receive" && selectedCustody) {
    const remaining = selectedCustody.custodyValue - selectedCustody.cashReturned - selectedCustody.cardsReturned;
    return (
      <div className="min-h-screen bg-gray-50" dir="rtl">
        <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
          <button onClick={() => { setMode("list"); setSelectedCustody(null); }} className="text-muted-foreground hover:text-foreground">
            <ArrowRight className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">استلام عهدة — {selectedCustody.recipientName}</h1>
        </div>
        <div className="p-4 max-w-md mx-auto space-y-4">
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-orange-800">ملخص العهدة</span>
                <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                  متبقي {formatCurrency(remaining)}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground">إجمالي العهدة</p>
                  <p className="font-semibold">{formatCurrency(selectedCustody.custodyValue)}</p>
                </div>
                <div className="bg-white rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground">تاريخ الإرسال</p>
                  <p className="font-semibold">{selectedCustody.sentAt}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-green-600" />
                  النقد المستلم
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="pl-10"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">ر.س</span>
                </div>
                <p className="text-xs text-muted-foreground">يُضاف للصندوق النقدي</p>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-purple-600" />
                  قيمة الكروت المرتجعة
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0"
                    value={cardsReturned}
                    onChange={(e) => setCardsReturned(e.target.value)}
                    className="pl-10"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">ر.س</span>
                </div>
                <p className="text-xs text-muted-foreground">يُضاف لإجمالي الكروت</p>
              </div>

              {(cashReceived || cardsReturned) && (
                <div className="bg-gray-50 rounded-lg p-3 border text-sm">
                  <p className="font-medium mb-2">ملخص الاستلام</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">نقد ← الصندوق</span>
                      <span className="text-green-600 font-medium">{formatCurrency(parseFloat(cashReceived) || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">كروت ← المخزون</span>
                      <span className="text-purple-600 font-medium">{formatCurrency(parseFloat(cardsReturned) || 0)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 mt-1">
                      <span className="font-medium">الإجمالي المُسوَّى</span>
                      <span className="font-bold">{formatCurrency((parseFloat(cashReceived) || 0) + (parseFloat(cardsReturned) || 0))}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            className="w-full h-12 text-base"
            disabled={!cashReceived && !cardsReturned}
            onClick={handleReceive}
          >
            تأكيد استلام العهدة
          </Button>
        </div>
      </div>
    );
  }

  const activeCustodies = mockCustodies.filter((c) => !c.isSettled);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">إدارة العهد</h1>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-4">
        <Button
          className="w-full h-12 bg-orange-600 hover:bg-orange-700 flex items-center gap-2"
          onClick={() => setMode("send")}
        >
          <Send className="w-5 h-5" />
          إرسال عهدة جديدة
        </Button>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-800">العهد النشطة</h2>
            <Badge variant="secondary">{activeCustodies.length} عهد</Badge>
          </div>
          <div className="space-y-2">
            {activeCustodies.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">لا توجد عهد نشطة</div>
            ) : (
              activeCustodies.map((custody) => {
                const remaining = custody.custodyValue - custody.cashReturned - custody.cardsReturned;
                return (
                  <Card key={custody.id} className="border shadow-sm">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-sm">{custody.recipientName}</p>
                          <p className="text-xs text-muted-foreground">{custody.sentAt}</p>
                        </div>
                        <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                          <Package className="w-3 h-3 ml-1" />
                          {formatCurrency(custody.custodyValue)}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-2">
                        <span>متبقي: <span className="font-semibold text-orange-600">{formatCurrency(remaining)}</span></span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-8 text-xs border-orange-200 text-orange-700 hover:bg-orange-50"
                        onClick={() => { setSelectedCustody(custody); setMode("receive"); }}
                      >
                        <RotateCcw className="w-3.5 h-3.5 ml-1" />
                        استلام العهدة
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-800 mb-2">العهد المسوَّاة</h2>
          <div className="space-y-2">
            {mockCustodies.filter((c) => c.isSettled).map((custody) => (
              <Card key={custody.id} className="border shadow-sm bg-gray-50">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-muted-foreground">{custody.recipientName}</p>
                      <p className="text-xs text-muted-foreground">{custody.sentAt}</p>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                      <CheckCircle className="w-3 h-3 ml-1" />
                      مُسوَّاة
                    </Badge>
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
