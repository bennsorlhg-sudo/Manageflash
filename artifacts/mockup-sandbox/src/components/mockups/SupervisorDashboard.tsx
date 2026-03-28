import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

const mockTasks = [
  { id: 1, type: "تصليح", label: "صيانة نقطة 42", engineer: "أحمد علي", status: "قيد التنفيذ" },
  { id: 2, type: "تركيب", label: "تركيب هوت سبوت جديد - حي الصفا", engineer: "محمد سالم", status: "قيد التنفيذ" },
  { id: 3, type: "تصليح", label: "صيانة نقطة p15 - بروادباند", engineer: "خالد عمر", status: "معلق" },
  { id: 4, type: "تركيب", label: "تركيب بروادباند - شارع الجمهورية", engineer: "غير مُسند", status: "جديد" },
  { id: 5, type: "سحب", label: "سحب جهاز 38 - انتهاء اشتراك", engineer: "أحمد علي", status: "جديد" },
];

const mockPurchaseRequests = [
  { id: 1, item: "كابلات شبكة CAT6", qty: 5, priority: "عالية", status: "قيد المراجعة" },
  { id: 2, item: "روتر واي فاي", qty: 2, priority: "متوسطة", status: "موافق" },
  { id: 3, item: "مشابك تثبيت", qty: 50, priority: "منخفضة", status: "قيد المراجعة" },
];

const mockOwnerTasks = [
  { id: 1, label: "مراجعة تقرير الأعطال الأسبوعي", due: "اليوم" },
  { id: 2, label: "تحديث بيانات الاشتراكات المنتهية", due: "غداً" },
];

const statusColor: Record<string, string> = {
  "قيد التنفيذ": "bg-yellow-100 text-yellow-800",
  "معلق": "bg-orange-100 text-orange-800",
  "جديد": "bg-blue-100 text-blue-800",
  "منجز": "bg-green-100 text-green-800",
};

const priorityColor: Record<string, string> = {
  "عالية": "bg-red-100 text-red-700",
  "متوسطة": "bg-orange-100 text-orange-700",
  "منخفضة": "bg-green-100 text-green-700",
};

const requestStatusColor: Record<string, string> = {
  "قيد المراجعة": "bg-yellow-100 text-yellow-800",
  "موافق": "bg-green-100 text-green-800",
  "مرفوض": "bg-red-100 text-red-800",
};

export default function SupervisorDashboard() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const subscriptionIndicator = {
    hotspot: 3450,
    broadband: 1800,
    total: 5250,
  };

  const infoCards = [
    { label: "مهام المالك", value: mockOwnerTasks.length, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "مهام السحب", value: 3, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "تذاكر الإصلاح", value: 2, color: "text-red-600", bg: "bg-red-50" },
    { label: "تذاكر التركيب", value: 4, color: "text-blue-600", bg: "bg-blue-50" },
  ];

  const sections = [
    {
      title: "التذاكر والمهام",
      buttons: [
        { label: "تذكرة تصليح", href: "RepairTicket", icon: "🔧" },
        { label: "تذاكر التركيب", href: "InstallationTickets", icon: "📋" },
        { label: "مهام المالك", href: null, icon: "👤" },
      ],
    },
    {
      title: "إدارة قاعدة البيانات",
      buttons: [
        { label: "نقاط الهوت سبوت", href: "DatabaseManagement", icon: "📡" },
        { label: "نقاط البروادباند", href: "DatabaseManagement", icon: "🌐" },
        { label: "نقاط البيع", href: null, icon: "🏪" },
      ],
    },
    {
      title: "الإدارة والمالية",
      buttons: [
        { label: "المهندسون الفنيون", href: "EngineerManagement", icon: "👷" },
        { label: "طلبات الشراء", href: "PurchaseRequests", icon: "🛒" },
        { label: "تسليم الاشتراكات", href: null, icon: "💰" },
      ],
    },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 font-sans">
      <div className="bg-blue-700 text-white px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-200">لوحة تحكم</p>
            <h1 className="text-xl font-bold">المشرف - محمد العمري</h1>
          </div>
          <div className="text-left">
            <p className="text-xs text-blue-200">الجمعة، 28 مارس 2026</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white">
        <p className="text-xs text-green-100 mb-1">قيمة الاشتراكات المحصّلة (غير مُسلَّمة)</p>
        <p className="text-3xl font-bold">{subscriptionIndicator.total.toLocaleString()} ج.م</p>
        <div className="flex gap-4 mt-1">
          <span className="text-xs text-green-200">هوت سبوت: {subscriptionIndicator.hotspot.toLocaleString()} ج.م</span>
          <span className="text-xs text-green-200">بروادباند: {subscriptionIndicator.broadband.toLocaleString()} ج.م</span>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="grid grid-cols-4 gap-2">
          {infoCards.map((card) => (
            <Card key={card.label} className={`${card.bg} border-0 shadow-sm`}>
              <CardContent className="p-3 text-center">
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                <p className="text-xs text-gray-600 mt-1 leading-tight">{card.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-340px)]">
        <div className="px-4 space-y-4 pb-4">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-sm font-semibold text-gray-500 mb-2">{section.title}</h2>
              <div className="grid grid-cols-3 gap-2">
                {section.buttons.map((btn) => (
                  <button
                    key={btn.label}
                    onClick={() => setActiveSection(btn.href || btn.label)}
                    className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex flex-col items-center gap-1 hover:border-blue-300 hover:shadow-md transition-all active:scale-95"
                  >
                    <span className="text-2xl">{btn.icon}</span>
                    <span className="text-xs text-center text-gray-700 font-medium leading-tight">{btn.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <Separator />

          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-2">آخر 5 مهام غير مكتملة</h2>
            <div className="space-y-2">
              {mockTasks.map((task) => (
                <Card key={task.id} className="shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{task.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{task.engineer}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[task.status] || "bg-gray-100 text-gray-700"}`}>
                          {task.status}
                        </span>
                        <span className="text-xs text-gray-400">{task.type}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-2">مهام المالك</h2>
            <div className="space-y-2">
              {mockOwnerTasks.map((task) => (
                <Card key={task.id} className="shadow-sm bg-purple-50">
                  <CardContent className="p-3 flex items-center justify-between">
                    <p className="text-sm text-gray-800">{task.label}</p>
                    <span className="text-xs text-purple-600 font-medium">{task.due}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-2">طلبات الشراء الأخيرة</h2>
            <div className="space-y-2">
              {mockPurchaseRequests.map((req) => (
                <Card key={req.id} className="shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{req.item}</p>
                        <p className="text-xs text-gray-500">الكمية: {req.qty}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${requestStatusColor[req.status]}`}>
                          {req.status}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColor[req.priority]}`}>
                          {req.priority}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {activeSection && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-4 py-2 rounded-full">
          سيتم فتح: {activeSection}
        </div>
      )}
    </div>
  );
}
