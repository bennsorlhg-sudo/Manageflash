import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

type ServiceInfo = {
  number: string;
  name: string;
  phone: string;
  address: string;
  type: string;
  status: string;
  location: string;
};

const mockHotspotDB: Record<string, ServiceInfo> = {
  "30": { number: "30", name: "محمد حسن", phone: "0501234567", address: "حي الصفا - شارع 5", type: "هوت سبوت داخلي", status: "نشط", location: "https://maps.google.com/?q=21.5,39.2" },
  "42": { number: "42", name: "علي سعد", phone: "0509876543", address: "حي النزهة - بلك 3", type: "هوت سبوت خارجي", status: "نشط ناقص", location: "https://maps.google.com/?q=21.4,39.1" },
  "15": { number: "15", name: "عمر خالد", phone: "0507654321", address: "المدينة القديمة", type: "هوت سبوت داخلي", status: "موقوف", location: "" },
};

const mockBroadbandDB: Record<string, ServiceInfo> = {
  "p30": { number: "p30", name: "أحمد راشد - شركة الفجر", phone: "0502345678", address: "شارع الملك فهد", type: "بروادباند", status: "نشط", location: "https://maps.google.com/?q=21.6,39.3" },
  "p5": { number: "p5", name: "فهد الشمري", phone: "0508765432", address: "الحي التجاري", type: "بروادباند", status: "نشط", location: "" },
};

const engineers = [
  { id: 1, name: "أحمد علي" },
  { id: 2, name: "محمد سالم" },
  { id: 3, name: "خالد عمر" },
  { id: 4, name: "يوسف كمال" },
];

const statusColor: Record<string, string> = {
  "نشط": "bg-blue-100 text-blue-700",
  "نشط ناقص": "bg-yellow-100 text-yellow-700",
  "جاهز": "bg-green-100 text-green-700",
  "فارغ": "bg-red-100 text-red-700",
  "موقوف": "bg-gray-100 text-gray-700",
};

export default function RepairTicket() {
  const [serviceNumber, setServiceNumber] = useState("");
  const [serviceInfo, setServiceInfo] = useState<ServiceInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [description, setDescription] = useState("");
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [assignMode, setAssignMode] = useState<"all" | "specific" | null>(null);
  const [selectedEngineer, setSelectedEngineer] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [manualData, setManualData] = useState({ name: "", phone: "", address: "", type: "هوت سبوت داخلي" });

  function handleFetch() {
    const trimmed = serviceNumber.trim().toLowerCase();
    if (!trimmed) return;

    const isBroadband = trimmed.startsWith("p");
    const db = isBroadband ? mockBroadbandDB : mockHotspotDB;
    const found = db[trimmed];

    if (found) {
      setServiceInfo(found);
      setNotFound(false);
      setManualMode(false);
    } else {
      setServiceInfo(null);
      setNotFound(true);
    }
  }

  function detectType(num: string): string {
    if (num.toLowerCase().startsWith("p")) return "بروادباند";
    return "هوت سبوت داخلي / خارجي";
  }

  function handleSubmit() {
    if (!assignMode) return;
    if (assignMode === "specific" && !selectedEngineer) return;
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div dir="rtl" className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="p-8">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-green-700 mb-2">تم إرسال التذكرة</h2>
            <p className="text-gray-600 text-sm mb-2">
              تذكرة إصلاح للنقطة رقم <strong>{serviceInfo?.number || serviceNumber}</strong>
            </p>
            {assignMode === "specific" && (
              <p className="text-gray-500 text-sm">
                مُسنَدة إلى: <strong>{engineers.find(e => e.id === selectedEngineer)?.name}</strong>
              </p>
            )}
            {assignMode === "all" && (
              <p className="text-gray-500 text-sm">مُرسَلة لجميع المهندسين</p>
            )}
            <Button className="mt-6 w-full" onClick={() => { setSubmitted(false); setServiceNumber(""); setServiceInfo(null); setNotFound(false); setManualMode(false); setDescription(""); setPhotoUploaded(false); setAssignMode(null); setSelectedEngineer(null); }}>
              تذكرة جديدة
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 font-sans">
      <div className="bg-red-600 text-white px-4 py-4">
        <p className="text-sm text-red-200">إنشاء تذكرة</p>
        <h1 className="text-xl font-bold">تذكرة تصليح</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">رقم الخدمة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="مثال: 30 أو p30"
                value={serviceNumber}
                onChange={(e) => { setServiceNumber(e.target.value); setServiceInfo(null); setNotFound(false); }}
                className="text-right"
                dir="ltr"
              />
              <Button onClick={handleFetch} className="shrink-0">بحث</Button>
            </div>
            {serviceNumber && (
              <p className="text-xs text-gray-500">
                النوع المكتشف: <strong>{detectType(serviceNumber)}</strong>
              </p>
            )}
          </CardContent>
        </Card>

        {serviceInfo && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-green-800">بيانات النقطة</CardTitle>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[serviceInfo.status] || "bg-gray-100"}`}>
                  {serviceInfo.status}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500">الاسم</p>
                  <p className="font-medium">{serviceInfo.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">النوع</p>
                  <p className="font-medium">{serviceInfo.type}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">الهاتف</p>
                  <a href={`tel:${serviceInfo.phone}`} className="font-medium text-blue-600">{serviceInfo.phone}</a>
                </div>
                <div>
                  <p className="text-xs text-gray-500">العنوان</p>
                  <p className="font-medium text-sm">{serviceInfo.address}</p>
                </div>
              </div>
              {serviceInfo.location && (
                <a href={serviceInfo.location} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline flex items-center gap-1">
                  📍 فتح الموقع على الخريطة
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {notFound && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <p className="text-orange-700 text-sm font-medium mb-2">⚠️ لم يتم العثور على النقطة في قاعدة البيانات</p>
              <Button variant="outline" size="sm" onClick={() => { setManualMode(true); setNotFound(false); }} className="border-orange-400 text-orange-700">
                إدخال البيانات يدوياً
              </Button>
            </CardContent>
          </Card>
        )}

        {manualMode && (
          <Card className="border-yellow-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">إدخال يدوي</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">الاسم</Label>
                <Input value={manualData.name} onChange={e => setManualData(p => ({ ...p, name: e.target.value }))} className="text-right mt-1" />
              </div>
              <div>
                <Label className="text-xs">الهاتف</Label>
                <Input value={manualData.phone} onChange={e => setManualData(p => ({ ...p, phone: e.target.value }))} className="text-right mt-1" dir="ltr" />
              </div>
              <div>
                <Label className="text-xs">العنوان</Label>
                <Input value={manualData.address} onChange={e => setManualData(p => ({ ...p, address: e.target.value }))} className="text-right mt-1" />
              </div>
              <div>
                <Label className="text-xs">النوع</Label>
                <select
                  value={manualData.type}
                  onChange={e => setManualData(p => ({ ...p, type: e.target.value }))}
                  className="w-full mt-1 border rounded px-3 py-2 text-sm text-right bg-white"
                >
                  <option>هوت سبوت داخلي</option>
                  <option>هوت سبوت خارجي</option>
                  <option>بروادباند</option>
                </select>
              </div>
            </CardContent>
          </Card>
        )}

        {(serviceInfo || manualMode) && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">تفاصيل المشكلة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">وصف المشكلة (اختياري)</Label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full mt-1 border rounded px-3 py-2 text-sm resize-none h-20 text-right"
                    placeholder="اكتب وصف المشكلة هنا..."
                    dir="rtl"
                  />
                </div>
                <div>
                  <Label className="text-xs">إضافة صورة (اختياري)</Label>
                  <div
                    className={`mt-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${photoUploaded ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-blue-400"}`}
                    onClick={() => setPhotoUploaded(!photoUploaded)}
                  >
                    {photoUploaded ? (
                      <p className="text-green-600 text-sm">✅ تم اختيار الصورة</p>
                    ) : (
                      <p className="text-gray-500 text-sm">📷 انقر لاختيار صورة</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">إسناد المهمة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setAssignMode("all")}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-colors ${assignMode === "all" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600"}`}
                  >
                    📢 إرسال للجميع
                  </button>
                  <button
                    onClick={() => setAssignMode("specific")}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-colors ${assignMode === "specific" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600"}`}
                  >
                    👤 إسناد لمهندس
                  </button>
                </div>

                {assignMode === "specific" && (
                  <div className="space-y-2">
                    <Label className="text-xs">اختر المهندس</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {engineers.map((eng) => (
                        <button
                          key={eng.id}
                          onClick={() => setSelectedEngineer(eng.id)}
                          className={`p-2 rounded-lg border-2 text-sm transition-colors ${selectedEngineer === eng.id ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 text-gray-600"}`}
                        >
                          {eng.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              onClick={handleSubmit}
              disabled={!assignMode || (assignMode === "specific" && !selectedEngineer)}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-3"
            >
              إرسال تذكرة الإصلاح
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
