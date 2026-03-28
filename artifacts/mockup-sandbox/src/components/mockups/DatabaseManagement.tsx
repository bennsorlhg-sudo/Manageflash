import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

type Tab = "hotspot" | "broadband";
type Status = "نشط" | "نشط ناقص" | "جاهز" | "فارغ" | "موقوف";
type SubView = "list" | "add" | "view" | "edit";

interface HotspotPoint {
  id: number;
  serviceNumber: number;
  ownerName: string;
  phone: string;
  address: string;
  type: "داخلي" | "خارجي";
  status: Status;
  locationUrl: string;
  subscriptionStart: string;
  monthlyFee: number;
}

interface BroadbandPoint {
  id: number;
  serviceNumber: string;
  subscriptionName: string;
  ownerName: string;
  phone: string;
  address: string;
  speed: string;
  status: Status;
  locationUrl: string;
  subscriptionStart: string;
  monthlyFee: number;
}

const MOCK_HOTSPOT: HotspotPoint[] = [
  { id: 1, serviceNumber: 5, ownerName: "أحمد محمود", phone: "0501234567", address: "حي الصفا - شارع 3", type: "داخلي", status: "نشط", locationUrl: "https://maps.google.com/?q=21.5,39.2", subscriptionStart: "01/01/2025", monthlyFee: 150 },
  { id: 2, serviceNumber: 12, ownerName: "سعد الشمري", phone: "0502345678", address: "حي النزهة - مجمع 7", type: "داخلي", status: "نشط ناقص", locationUrl: "", subscriptionStart: "15/03/2025", monthlyFee: 120 },
  { id: 3, serviceNumber: 18, ownerName: "منيرة العتيبي", phone: "0503456789", address: "شارع الملك عبدالله", type: "خارجي", status: "جاهز", locationUrl: "https://maps.google.com/?q=21.4,39.1", subscriptionStart: "20/06/2025", monthlyFee: 200 },
  { id: 4, serviceNumber: 25, ownerName: "علي حسين", phone: "0504567890", address: "حي الروضة - بلك 5", type: "داخلي", status: "فارغ", locationUrl: "", subscriptionStart: "", monthlyFee: 0 },
  { id: 5, serviceNumber: 30, ownerName: "محمد حسن", phone: "0505678901", address: "حي الزهراء - شارع النخيل", type: "داخلي", status: "نشط", locationUrl: "https://maps.google.com/?q=21.6,39.3", subscriptionStart: "10/08/2025", monthlyFee: 150 },
  { id: 6, serviceNumber: 42, ownerName: "علي سعد", phone: "0506789012", address: "حي النزهة - بلك 3", type: "خارجي", status: "موقوف", locationUrl: "", subscriptionStart: "05/02/2025", monthlyFee: 180 },
];

const MOCK_BROADBAND: BroadbandPoint[] = [
  { id: 1, serviceNumber: "p5", subscriptionName: "مكتب المحامي فهد", ownerName: "فهد الشمري", phone: "0502345678", address: "برج الأعمال - الدور 3", speed: "50 ميجا", status: "نشط", locationUrl: "https://maps.google.com/?q=21.5,39.2", subscriptionStart: "01/09/2025", monthlyFee: 350 },
  { id: 2, serviceNumber: "p12", subscriptionName: "مطعم السمر", ownerName: "خالد العمري", phone: "0503456789", address: "شارع الملك فهد", speed: "20 ميجا", status: "نشط ناقص", locationUrl: "", subscriptionStart: "15/10/2025", monthlyFee: 250 },
  { id: 3, serviceNumber: "p20", subscriptionName: "شركة المستقبل للتجارة", ownerName: "أحمد راشد", phone: "0504567890", address: "الحي التجاري - مبنى 7", speed: "100 ميجا", status: "نشط", locationUrl: "https://maps.google.com/?q=21.4,39.1", subscriptionStart: "01/01/2026", monthlyFee: 600 },
  { id: 4, serviceNumber: "p30", subscriptionName: "صيدلية النجاح", ownerName: "سارة القحطاني", phone: "0505678901", address: "حي السلام - مركز تجاري", speed: "10 ميجا", status: "موقوف", locationUrl: "", subscriptionStart: "01/06/2025", monthlyFee: 150 },
];

const statusColor: Record<Status, string> = {
  "نشط": "bg-blue-100 text-blue-700 border-blue-200",
  "نشط ناقص": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "جاهز": "bg-green-100 text-green-700 border-green-200",
  "فارغ": "bg-red-100 text-red-700 border-red-200",
  "موقوف": "bg-gray-100 text-gray-600 border-gray-200",
};

const statusDot: Record<Status, string> = {
  "نشط": "bg-blue-500",
  "نشط ناقص": "bg-yellow-500",
  "جاهز": "bg-green-500",
  "فارغ": "bg-red-500",
  "موقوف": "bg-gray-400",
};

export default function DatabaseManagement() {
  const [tab, setTab] = useState<Tab>("hotspot");
  const [subView, setSubView] = useState<SubView>("list");
  const [search, setSearch] = useState("");
  const [hotspots, setHotspots] = useState<HotspotPoint[]>(MOCK_HOTSPOT);
  const [broadbands, setBroadbands] = useState<BroadbandPoint[]>(MOCK_BROADBAND);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [newHotspot, setNewHotspot] = useState<Partial<HotspotPoint>>({ type: "داخلي", status: "جاهز", monthlyFee: 150 });
  const [newBroadband, setNewBroadband] = useState<Partial<BroadbandPoint>>({ speed: "20 ميجا", status: "جاهز", monthlyFee: 250 });

  const filteredHotspots = hotspots
    .filter(h =>
      !search ||
      String(h.serviceNumber).includes(search) ||
      h.ownerName.includes(search) ||
      h.phone.includes(search) ||
      h.address.includes(search)
    )
    .sort((a, b) => a.serviceNumber - b.serviceNumber);

  const filteredBroadbands = broadbands
    .filter(b =>
      !search ||
      b.serviceNumber.includes(search) ||
      b.subscriptionName.includes(search) ||
      b.ownerName.includes(search) ||
      b.phone.includes(search)
    );

  const selectedHotspot = tab === "hotspot" ? hotspots.find(h => h.id === selectedId) : null;
  const selectedBroadband = tab === "broadband" ? broadbands.find(b => b.id === selectedId) : null;

  function handleSaveHotspot() {
    if (!newHotspot.ownerName || !newHotspot.phone || !newHotspot.address) return;
    const nextNum = Math.max(...hotspots.map(h => h.serviceNumber)) + 1;
    setHotspots(prev => [...prev, {
      id: Date.now(),
      serviceNumber: nextNum,
      ownerName: newHotspot.ownerName!,
      phone: newHotspot.phone!,
      address: newHotspot.address!,
      type: newHotspot.type || "داخلي",
      status: newHotspot.status || "جاهز",
      locationUrl: newHotspot.locationUrl || "",
      subscriptionStart: newHotspot.subscriptionStart || "",
      monthlyFee: newHotspot.monthlyFee || 0,
    }]);
    setNewHotspot({ type: "داخلي", status: "جاهز", monthlyFee: 150 });
    setSubView("list");
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 font-sans">
      <div className="bg-indigo-700 text-white px-4 py-4">
        <p className="text-sm text-indigo-200">قاعدة البيانات</p>
        <h1 className="text-xl font-bold">إدارة النقاط</h1>
      </div>

      <div className="flex border-b bg-white">
        {[
          { id: "hotspot" as Tab, label: "هوت سبوت", count: hotspots.length },
          { id: "broadband" as Tab, label: "بروادباند", count: broadbands.length },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSubView("list"); setSearch(""); setSelectedId(null); }}
            className={`flex-1 py-3 text-sm font-medium border-b-2 ${tab === t.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500"}`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {subView === "list" && (
        <>
          <div className="px-4 py-3 flex gap-2">
            <Input
              placeholder="بحث بالرقم أو الاسم أو الهاتف..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-right"
              dir="rtl"
            />
            <Button onClick={() => { setSubView("add"); setSearch(""); }} className="bg-indigo-600 shrink-0">+ إضافة</Button>
          </div>

          <div className="px-4 mb-2">
            <div className="flex gap-3 flex-wrap">
              {(Object.entries(statusColor) as [Status, string][]).map(([s, cls]) => (
                <div key={s} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${statusDot[s]}`} />
                  <span className="text-xs text-gray-600">{s}</span>
                </div>
              ))}
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-230px)]">
            <div className="px-4 space-y-2 pb-4">
              {tab === "hotspot" && filteredHotspots.map(point => (
                <Card
                  key={point.id}
                  className={`shadow-sm cursor-pointer hover:shadow-md transition-shadow border-r-4 ${statusColor[point.status].includes("blue") ? "border-r-blue-400" : statusColor[point.status].includes("yellow") ? "border-r-yellow-400" : statusColor[point.status].includes("green") ? "border-r-green-400" : statusColor[point.status].includes("red") ? "border-r-red-400" : "border-r-gray-300"}`}
                  onClick={() => { setSelectedId(point.id); setSubView("view"); }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-indigo-700">{point.serviceNumber}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{point.ownerName}</p>
                          <p className="text-xs text-gray-500">{point.address}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor[point.status]}`}>{point.status}</span>
                        <span className="text-xs text-gray-400">{point.type}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {tab === "broadband" && filteredBroadbands.map(point => (
                <Card
                  key={point.id}
                  className="shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => { setSelectedId(point.id); setSubView("view"); }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{point.subscriptionName}</p>
                        <p className="text-xs text-gray-500">{point.ownerName} • {point.serviceNumber}</p>
                        <p className="text-xs text-gray-400">{point.speed}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor[point.status]}`}>{point.status}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {tab === "hotspot" && filteredHotspots.length === 0 && (
                <Card><CardContent className="p-6 text-center text-gray-400 text-sm">لا توجد نتائج</CardContent></Card>
              )}
              {tab === "broadband" && filteredBroadbands.length === 0 && (
                <Card><CardContent className="p-6 text-center text-gray-400 text-sm">لا توجد نتائج</CardContent></Card>
              )}
            </div>
          </ScrollArea>
        </>
      )}

      {subView === "view" && tab === "hotspot" && selectedHotspot && (
        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="px-4 py-4 space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setSubView("list")} className="text-blue-600 text-sm">← رجوع</button>
              <h2 className="text-base font-semibold">تفاصيل النقطة</h2>
            </div>

            <div className={`p-3 rounded-lg border-2 text-center ${statusColor[selectedHotspot.status]}`}>
              <p className="font-bold text-lg">{selectedHotspot.status}</p>
              <p className="text-sm">نقطة رقم {selectedHotspot.serviceNumber} • {selectedHotspot.type}</p>
            </div>

            <Card>
              <CardContent className="p-4 space-y-3">
                <DetailRow label="الاسم" value={selectedHotspot.ownerName} />
                <Separator />
                <DetailRow
                  label="الهاتف"
                  value={selectedHotspot.phone}
                  isPhone
                />
                <Separator />
                <DetailRow label="العنوان" value={selectedHotspot.address} />
                {selectedHotspot.locationUrl && (
                  <>
                    <Separator />
                    <a href={selectedHotspot.locationUrl} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-blue-600 text-sm"
                      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(selectedHotspot.locationUrl); }}>
                      📍 فتح الموقع على الخريطة
                      <span className="text-xs text-gray-400">(نسخ)</span>
                    </a>
                  </>
                )}
                <Separator />
                <DetailRow label="تاريخ الاشتراك" value={selectedHotspot.subscriptionStart || "—"} />
                <Separator />
                <DetailRow label="الرسوم الشهرية" value={selectedHotspot.monthlyFee ? `${selectedHotspot.monthlyFee} ج.م` : "—"} />
              </CardContent>
            </Card>

            <Button onClick={() => setSubView("edit")} className="w-full bg-indigo-600">✏️ تعديل</Button>
          </div>
        </ScrollArea>
      )}

      {subView === "view" && tab === "broadband" && selectedBroadband && (
        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="px-4 py-4 space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setSubView("list")} className="text-blue-600 text-sm">← رجوع</button>
              <h2 className="text-base font-semibold">تفاصيل الاشتراك</h2>
            </div>

            <div className={`p-3 rounded-lg border-2 text-center ${statusColor[selectedBroadband.status]}`}>
              <p className="font-bold text-lg">{selectedBroadband.status}</p>
              <p className="text-sm">{selectedBroadband.serviceNumber} • {selectedBroadband.speed}</p>
            </div>

            <Card>
              <CardContent className="p-4 space-y-3">
                <DetailRow label="اسم الاشتراك" value={selectedBroadband.subscriptionName} isBold />
                <Separator />
                <DetailRow label="المشترك" value={selectedBroadband.ownerName} />
                <Separator />
                <DetailRow label="الهاتف" value={selectedBroadband.phone} isPhone />
                <Separator />
                <DetailRow label="العنوان" value={selectedBroadband.address} />
                {selectedBroadband.locationUrl && (
                  <>
                    <Separator />
                    <a href={selectedBroadband.locationUrl} target="_blank" rel="noreferrer" className="text-blue-600 text-sm flex items-center gap-1">
                      📍 فتح الموقع على الخريطة
                    </a>
                  </>
                )}
                <Separator />
                <DetailRow label="السرعة" value={selectedBroadband.speed} />
                <Separator />
                <DetailRow label="تاريخ الاشتراك" value={selectedBroadband.subscriptionStart || "—"} />
                <Separator />
                <DetailRow label="الرسوم الشهرية" value={selectedBroadband.monthlyFee ? `${selectedBroadband.monthlyFee} ج.م` : "—"} />
              </CardContent>
            </Card>

            <Button onClick={() => setSubView("edit")} className="w-full bg-indigo-600">✏️ تعديل</Button>
          </div>
        </ScrollArea>
      )}

      {subView === "add" && tab === "hotspot" && (
        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="px-4 py-4 space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setSubView("list")} className="text-blue-600 text-sm">← رجوع</button>
              <h2 className="text-base font-semibold">إضافة نقطة هوت سبوت</h2>
            </div>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div><Label className="text-xs">اسم المالك *</Label><Input value={newHotspot.ownerName || ""} onChange={e => setNewHotspot(p => ({ ...p, ownerName: e.target.value }))} className="mt-1 text-right" /></div>
                <div><Label className="text-xs">الهاتف *</Label><Input value={newHotspot.phone || ""} onChange={e => setNewHotspot(p => ({ ...p, phone: e.target.value }))} className="mt-1" dir="ltr" placeholder="05xxxxxxxx" /></div>
                <div><Label className="text-xs">العنوان *</Label><Input value={newHotspot.address || ""} onChange={e => setNewHotspot(p => ({ ...p, address: e.target.value }))} className="mt-1 text-right" /></div>
                <div>
                  <Label className="text-xs">النوع</Label>
                  <div className="flex gap-2 mt-1">
                    {["داخلي", "خارجي"].map(t => (
                      <button key={t} onClick={() => setNewHotspot(p => ({ ...p, type: t as "داخلي" | "خارجي" }))}
                        className={`flex-1 py-2 rounded-lg border-2 text-sm ${newHotspot.type === t ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">الحالة</Label>
                  <select value={newHotspot.status} onChange={e => setNewHotspot(p => ({ ...p, status: e.target.value as Status }))} className="w-full mt-1 border rounded px-3 py-2 text-sm text-right bg-white">
                    {["نشط", "نشط ناقص", "جاهز", "فارغ", "موقوف"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div><Label className="text-xs">رابط الخريطة</Label><Input value={newHotspot.locationUrl || ""} onChange={e => setNewHotspot(p => ({ ...p, locationUrl: e.target.value }))} className="mt-1" dir="ltr" placeholder="https://maps.google.com/..." /></div>
                <div><Label className="text-xs">الرسوم الشهرية (ج.م)</Label><Input value={newHotspot.monthlyFee || ""} onChange={e => setNewHotspot(p => ({ ...p, monthlyFee: parseInt(e.target.value) || 0 }))} className="mt-1" type="number" dir="ltr" /></div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setSubView("list")}>إلغاء</Button>
              <Button onClick={handleSaveHotspot} disabled={!newHotspot.ownerName || !newHotspot.phone} className="bg-indigo-600">حفظ</Button>
            </div>
          </div>
        </ScrollArea>
      )}

      {subView === "add" && tab === "broadband" && (
        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="px-4 py-4 space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setSubView("list")} className="text-blue-600 text-sm">← رجوع</button>
              <h2 className="text-base font-semibold">إضافة اشتراك بروادباند</h2>
            </div>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div><Label className="text-xs">اسم الاشتراك *</Label><Input value={newBroadband.subscriptionName || ""} onChange={e => setNewBroadband(p => ({ ...p, subscriptionName: e.target.value }))} className="mt-1 text-right" placeholder="مثال: مكتب المحامي / شركة X" /></div>
                <div><Label className="text-xs">اسم المشترك *</Label><Input value={newBroadband.ownerName || ""} onChange={e => setNewBroadband(p => ({ ...p, ownerName: e.target.value }))} className="mt-1 text-right" /></div>
                <div><Label className="text-xs">الهاتف *</Label><Input value={newBroadband.phone || ""} onChange={e => setNewBroadband(p => ({ ...p, phone: e.target.value }))} className="mt-1" dir="ltr" /></div>
                <div><Label className="text-xs">العنوان</Label><Input value={newBroadband.address || ""} onChange={e => setNewBroadband(p => ({ ...p, address: e.target.value }))} className="mt-1 text-right" /></div>
                <div>
                  <Label className="text-xs">السرعة</Label>
                  <select value={newBroadband.speed} onChange={e => setNewBroadband(p => ({ ...p, speed: e.target.value }))} className="w-full mt-1 border rounded px-3 py-2 text-sm text-right bg-white">
                    {["10 ميجا", "20 ميجا", "50 ميجا", "100 ميجا", "200 ميجا"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">الحالة</Label>
                  <select value={newBroadband.status} onChange={e => setNewBroadband(p => ({ ...p, status: e.target.value as Status }))} className="w-full mt-1 border rounded px-3 py-2 text-sm text-right bg-white">
                    {["نشط", "نشط ناقص", "جاهز", "فارغ", "موقوف"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div><Label className="text-xs">الرسوم الشهرية (ج.م)</Label><Input value={newBroadband.monthlyFee || ""} onChange={e => setNewBroadband(p => ({ ...p, monthlyFee: parseInt(e.target.value) || 0 }))} className="mt-1" type="number" dir="ltr" /></div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setSubView("list")}>إلغاء</Button>
              <Button
                onClick={() => {
                  if (!newBroadband.subscriptionName || !newBroadband.phone) return;
                  const nextNum = `p${Math.max(...broadbands.map(b => parseInt(b.serviceNumber.replace("p", "")) || 0)) + 1}`;
                  setBroadbands(prev => [...prev, {
                    id: Date.now(),
                    serviceNumber: nextNum,
                    subscriptionName: newBroadband.subscriptionName!,
                    ownerName: newBroadband.ownerName || "",
                    phone: newBroadband.phone!,
                    address: newBroadband.address || "",
                    speed: newBroadband.speed || "20 ميجا",
                    status: newBroadband.status || "جاهز",
                    locationUrl: "",
                    subscriptionStart: "",
                    monthlyFee: newBroadband.monthlyFee || 0,
                  }]);
                  setNewBroadband({ speed: "20 ميجا", status: "جاهز", monthlyFee: 250 });
                  setSubView("list");
                }}
                disabled={!newBroadband.subscriptionName || !newBroadband.phone}
                className="bg-indigo-600"
              >
                حفظ
              </Button>
            </div>
          </div>
        </ScrollArea>
      )}

      {subView === "edit" && (
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setSubView("view")} className="text-blue-600 text-sm">← رجوع</button>
            <h2 className="text-base font-semibold">تعديل البيانات</h2>
          </div>
          <Card>
            <CardContent className="p-6 text-center text-gray-500">
              <p className="text-2xl mb-2">✏️</p>
              <p className="text-sm">نموذج التعديل سيظهر هنا</p>
              <p className="text-xs text-gray-400 mt-1">يحتوي على نفس حقول إضافة النقطة مع البيانات الحالية محمّلة</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, isPhone, isBold }: { label: string; value: string; isPhone?: boolean; isBold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      {isPhone ? (
        <a href={`tel:${value}`} className="text-sm font-medium text-blue-600" dir="ltr">{value}</a>
      ) : (
        <span className={`text-sm ${isBold ? "font-bold" : "font-medium"} text-gray-800 text-left`}>{value}</span>
      )}
    </div>
  );
}
