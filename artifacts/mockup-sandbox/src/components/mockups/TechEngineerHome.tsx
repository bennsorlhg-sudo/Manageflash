import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type TaskStatus = "new" | "in_progress" | "completed";

interface Task {
  id: number;
  taskType: string;
  serviceNumber: string;
  clientName?: string;
  location: string;
  phoneNumber: string;
  status: TaskStatus;
  notes?: string;
}

const MOCK_TASKS: Task[] = [
  { id: 1, taskType: "تركيب", serviceNumber: "SRV-001", clientName: "أحمد محمد", location: "شارع الملك فهد، الرياض", phoneNumber: "0512345678", status: "new" },
  { id: 2, taskType: "صيانة", serviceNumber: "SRV-002", clientName: "شركة النور", location: "حي العليا، الرياض", phoneNumber: "0598765432", status: "new" },
  { id: 3, taskType: "فحص", serviceNumber: "SRV-003", clientName: null, location: "طريق الدائري الشرقي", phoneNumber: "0551234567", status: "new" },
  { id: 4, taskType: "تركيب", serviceNumber: "SRV-004", clientName: "خالد العمري", location: "شارع التحلية", phoneNumber: "0567891234", status: "in_progress" },
  { id: 5, taskType: "صيانة", serviceNumber: "SRV-005", location: "المنطقة الصناعية", phoneNumber: "0543219876", status: "in_progress" },
  { id: 6, taskType: "تركيب", serviceNumber: "SRV-006", clientName: "مؤسسة الأمل", location: "حي الورود", phoneNumber: "0523456789", status: "completed", notes: "تم التركيب بنجاح" },
  { id: 7, taskType: "فحص", serviceNumber: "SRV-007", location: "شارع السلام", phoneNumber: "0534567890", status: "completed", notes: "الجهاز يعمل بشكل طبيعي" },
];

function StatusBadge({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, { label: string; className: string }> = {
    new: { label: "جديدة", className: "bg-blue-100 text-blue-700 border-blue-200" },
    in_progress: { label: "قيد التنفيذ", className: "bg-amber-100 text-amber-700 border-amber-200" },
    completed: { label: "مكتملة", className: "bg-green-100 text-green-700 border-green-200" },
  };
  const { label, className } = map[status];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>{label}</span>;
}

function TaskCard({
  task,
  onStart,
  onComplete,
}: {
  task: Task;
  onStart?: (id: number) => void;
  onComplete?: (id: number) => void;
}) {
  const handleCall = () => {
    window.open(`tel:${task.phoneNumber}`);
  };

  const handleCopyLocation = () => {
    navigator.clipboard.writeText(task.location).catch(() => {});
  };

  return (
    <Card className="mb-3 shadow-sm border border-gray-100" dir="rtl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
              {task.taskType}
            </span>
            <span className="text-xs text-gray-400 mr-2">#{task.serviceNumber}</span>
          </div>
          <StatusBadge status={task.status} />
        </div>

        {task.clientName && (
          <p className="text-sm font-medium text-gray-800 mb-1">{task.clientName}</p>
        )}

        <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
          <span>📍</span>
          <span className="truncate">{task.location}</span>
        </p>

        <p className="text-sm text-gray-500 mb-3 flex items-center gap-1">
          <span>📞</span>
          <span dir="ltr">{task.phoneNumber}</span>
        </p>

        {task.notes && (
          <p className="text-xs text-gray-400 bg-gray-50 rounded p-2 mb-3 border border-gray-100">
            {task.notes}
          </p>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handleCall} className="text-xs h-8 px-3">
            📞 اتصال
          </Button>
          <Button size="sm" variant="outline" onClick={handleCopyLocation} className="text-xs h-8 px-3">
            📋 نسخ الموقع
          </Button>
          {task.status === "new" && onStart && (
            <Button size="sm" onClick={() => onStart(task.id)} className="text-xs h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white mr-auto">
              بدء التنفيذ
            </Button>
          )}
          {task.status === "in_progress" && onComplete && (
            <Button size="sm" onClick={() => onComplete(task.id)} className="text-xs h-8 px-3 bg-green-600 hover:bg-green-700 text-white mr-auto">
              تم الإنجاز
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TechEngineerHome() {
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const engineerName = "محمد الزهراني";

  const newTasks = tasks.filter((t) => t.status === "new");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  const today = new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const handleStart = (id: number) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: "in_progress" as const } : t));
  };

  const handleOpenComplete = (id: number) => {
    setCompletingId(id);
    setNotes("");
  };

  const handleConfirmComplete = () => {
    if (!completingId) return;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === completingId ? { ...t, status: "completed" as const, notes: notes || undefined } : t
      )
    );
    setCompletingId(null);
    setNotes("");
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="bg-gradient-to-l from-purple-700 to-purple-900 text-white px-4 pt-8 pb-6">
        <p className="text-sm text-purple-200 mb-1">المهندس الفني</p>
        <h1 className="text-xl font-bold">{engineerName}</h1>
        <p className="text-xs text-purple-300 mt-1">{today}</p>
      </div>

      <div className="px-4 -mt-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card className="shadow-sm border-0 bg-white">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{newTasks.length}</p>
              <p className="text-xs text-gray-500 mt-1">مهام جديدة</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-0 bg-white">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-amber-500">{inProgressTasks.length}</p>
              <p className="text-xs text-gray-500 mt-1">قيد التنفيذ</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-0 bg-white">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{completedTasks.length}</p>
              <p className="text-xs text-gray-500 mt-1">مكتملة اليوم</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="new" className="w-full">
          <TabsList className="w-full mb-4 bg-white border border-gray-200 rounded-xl p-1">
            <TabsTrigger value="new" className="flex-1 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg">
              جديدة ({newTasks.length})
            </TabsTrigger>
            <TabsTrigger value="in_progress" className="flex-1 text-xs data-[state=active]:bg-amber-500 data-[state=active]:text-white rounded-lg">
              قيد التنفيذ ({inProgressTasks.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex-1 text-xs data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-lg">
              مكتملة ({completedTasks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new">
            {newTasks.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">لا توجد مهام جديدة</div>
            ) : (
              newTasks.map((task) => (
                <TaskCard key={task.id} task={task} onStart={handleStart} />
              ))
            )}
          </TabsContent>

          <TabsContent value="in_progress">
            {inProgressTasks.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">لا توجد مهام قيد التنفيذ</div>
            ) : (
              inProgressTasks.map((task) => (
                <TaskCard key={task.id} task={task} onComplete={handleOpenComplete} />
              ))
            )}
          </TabsContent>

          <TabsContent value="completed">
            {completedTasks.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">لا توجد مهام مكتملة</div>
            ) : (
              completedTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={completingId !== null} onOpenChange={(open) => !open && setCompletingId(null)}>
        <DialogContent dir="rtl" className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-right">إنهاء المهمة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm text-right block mb-1">ملاحظات (اختياري)</Label>
              <Textarea
                placeholder="أضف ملاحظاتك حول المهمة..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none text-right"
                rows={3}
              />
            </div>
            <div>
              <Label className="text-sm text-right block mb-1">رفع صورة (اختياري)</Label>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors">
                <p className="text-gray-400 text-sm">📷 اضغط لرفع صورة</p>
                <p className="text-gray-300 text-xs mt-1">PNG, JPG حتى 10MB</p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2 flex-row-reverse">
            <Button onClick={handleConfirmComplete} className="bg-green-600 hover:bg-green-700 text-white flex-1">
              تأكيد الإنجاز
            </Button>
            <Button variant="outline" onClick={() => setCompletingId(null)} className="flex-1">
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
