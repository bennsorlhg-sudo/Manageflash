import { useState, useEffect } from "react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

function getApiUrl(path: string) {
  return `/api${path}`;
}

const CARD_PRICES: Record<number, number> = {
  200: 180,
  300: 270,
  500: 450,
  1000: 900,
  2000: 1800,
  3000: 2700,
  5000: 5000,
  9000: 9000,
};

const DENOMINATIONS = [200, 300, 500, 1000, 2000, 3000, 5000, 9000];

const ROLE_LABELS: Record<string, string> = {
  finance_manager: "مدير المالية",
  supervisor: "المشرف",
  tech_engineer: "المهندس التقني",
};

type Screen = "dashboard" | "custody" | "task" | "report" | "import";
type ReportPeriod = "day" | "week" | "month" | "custom";

interface DashboardSummary {
  ownerName: string;
  cashBalance: number;
  totalCustody: number;
  totalLoans: number;
  totalCardValue: number;
  totalSalesPoints: number;
  hotspotCount: number;
  broadbandCount: number;
}

interface FinancialReport {
  period: string;
  from: string;
  to: string;
  totalSales: number;
  totalExpenses: number;
  profit: number;
  salesBreakdown: { hotspot: number; broadband: number };
  expenseBreakdown: { operational: number; salary: number; other: number };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", minimumFractionDigits: 0 }).format(amount);
}

function MetricCard({
  title,
  value,
  subtitle,
  prominent = false,
  color = "default",
}: {
  title: string;
  value: string;
  subtitle?: string;
  prominent?: boolean;
  color?: "default" | "green" | "blue" | "amber" | "purple";
}) {
  const colorClasses = {
    default: "bg-white border-gray-200",
    green: "bg-emerald-50 border-emerald-200",
    blue: "bg-blue-50 border-blue-200",
    amber: "bg-amber-50 border-amber-200",
    purple: "bg-purple-50 border-purple-200",
  };

  const valueClasses = {
    default: "text-gray-900",
    green: "text-emerald-700",
    blue: "text-blue-700",
    amber: "text-amber-700",
    purple: "text-purple-700",
  };

  return (
    <div
      className={`rounded-xl border p-4 ${colorClasses[color]} ${prominent ? "col-span-2 p-6" : ""}`}
      style={{ direction: "rtl" }}
    >
      <p className={`text-sm font-medium text-gray-500 mb-1`}>{title}</p>
      <p className={`font-bold ${prominent ? "text-3xl" : "text-xl"} ${valueClasses[color]}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function DashboardHome({ summary, onNavigate }: { summary: DashboardSummary | null; onNavigate: (s: Screen) => void }) {
  return (
    <div style={{ direction: "rtl" }}>
      <div className="bg-gradient-to-l from-blue-600 to-blue-800 text-white px-4 py-6 rounded-b-2xl mb-4">
        <p className="text-blue-200 text-sm mb-1">مرحباً بك</p>
        <h1 className="text-xl font-bold">{summary?.ownerName ?? "فهد الهندي - مالك الشبكة"}</h1>
        <p className="text-blue-300 text-xs mt-1">لوحة تحكم المالك</p>
      </div>

      {summary ? (
        <div className="px-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              title="الرصيد النقدي"
              value={formatCurrency(summary.cashBalance)}
              subtitle="الرصيد الإجمالي"
              prominent={true}
              color="green"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              title="إجمالي العهدة"
              value={formatCurrency(summary.totalCustody)}
              color="blue"
            />
            <MetricCard
              title="إجمالي السلف"
              value={formatCurrency(summary.totalLoans)}
              color="amber"
            />
            <MetricCard
              title="قيمة الكروت"
              value={formatCurrency(summary.totalCardValue)}
              color="purple"
            />
            <MetricCard
              title="نقاط البيع"
              value={String(summary.totalSalesPoints)}
              subtitle={`هوتسبوت: ${summary.hotspotCount} | إنترنت: ${summary.broadbandCount}`}
              color="default"
            />
          </div>
        </div>
      ) : (
        <div className="px-4">
          <LoadingSpinner />
        </div>
      )}

      <div className="px-4 mt-6">
        <h2 className="text-sm font-semibold text-gray-500 mb-3">الإجراءات السريعة</h2>
        <div className="grid grid-cols-2 gap-3">
          <ActionButton
            label="إضافة عهدة"
            icon="💰"
            description="تسليم كروت أو نقد"
            onClick={() => onNavigate("custody")}
          />
          <ActionButton
            label="إضافة مهمة"
            icon="📋"
            description="تكليف فريق العمل"
            onClick={() => onNavigate("task")}
          />
          <ActionButton
            label="التقارير المالية"
            icon="📊"
            description="المبيعات والمصاريف"
            onClick={() => onNavigate("report")}
          />
          <ActionButton
            label="استيراد البيانات"
            icon="📥"
            description="رفع ملفات الكروت"
            onClick={() => onNavigate("import")}
          />
        </div>
      </div>
    </div>
  );
}

function ActionButton({ label, icon, description, onClick }: { label: string; icon: string; description: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-4 text-right hover:border-blue-300 hover:bg-blue-50 transition-colors active:scale-95"
      style={{ direction: "rtl" }}
    >
      <span className="text-2xl block mb-1">{icon}</span>
      <p className="font-semibold text-sm text-gray-900">{label}</p>
      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
    </button>
  );
}

function AddCustodyScreen({ onBack }: { onBack: () => void }) {
  const [type, setType] = useState<"cash" | "cards">("cash");
  const [amount, setAmount] = useState("");
  const [denomination, setDenomination] = useState<number>(1000);
  const [cardCount, setCardCount] = useState("");
  const [toRole, setToRole] = useState("finance_manager");
  const [toPersonName, setToPersonName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const calculatedValue = type === "cards" && cardCount
    ? (CARD_PRICES[denomination] ?? 0) * parseInt(cardCount || "0")
    : 0;

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const body: Record<string, unknown> = { type, toRole };
      if (toPersonName) body.toPersonName = toPersonName;
      if (notes) body.notes = notes;
      if (type === "cash") {
        body.amount = parseFloat(amount);
      } else {
        body.denomination = denomination;
        body.cardCount = parseInt(cardCount);
      }

      const res = await fetch(getApiUrl("/custody"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "فشل إضافة العهدة");
      }
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 px-4 text-center" style={{ direction: "rtl" }}>
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">تمت إضافة العهدة بنجاح</h2>
        <p className="text-gray-500 mb-6">تم تسجيل العهدة وإضافتها للحساب</p>
        <button
          onClick={onBack}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium"
        >
          العودة للرئيسية
        </button>
      </div>
    );
  }

  return (
    <div style={{ direction: "rtl" }} className="pb-8">
      <div className="bg-blue-600 text-white px-4 py-5 flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-blue-200 hover:text-white text-xl leading-none">←</button>
        <h2 className="font-bold text-lg">إضافة عهدة</h2>
      </div>

      <div className="px-4 space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">نوع العهدة</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setType("cash")}
              className={`py-3 rounded-lg border font-medium text-sm transition-colors ${type === "cash" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200"}`}
            >
              💵 نقد
            </button>
            <button
              onClick={() => setType("cards")}
              className={`py-3 rounded-lg border font-medium text-sm transition-colors ${type === "cards" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200"}`}
            >
              🃏 كروت
            </button>
          </div>
        </div>

        {type === "cash" ? (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">المبلغ (ريال)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="أدخل المبلغ"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-right focus:border-blue-500 focus:outline-none"
            />
          </div>
        ) : (
          <>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">الفئة (ريال)</label>
              <select
                value={denomination}
                onChange={e => setDenomination(parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-right focus:border-blue-500 focus:outline-none"
              >
                {DENOMINATIONS.map(d => (
                  <option key={d} value={d}>
                    {d} ريال (سعر: {CARD_PRICES[d]} ريال)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">عدد الكروت</label>
              <input
                type="number"
                value={cardCount}
                onChange={e => setCardCount(e.target.value)}
                placeholder="أدخل العدد"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-right focus:border-blue-500 focus:outline-none"
                min="1"
              />
            </div>
            {cardCount && parseInt(cardCount) > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                <p className="text-sm text-emerald-700">
                  القيمة الإجمالية: <span className="font-bold">{formatCurrency(calculatedValue)}</span>
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  {cardCount} كرت × {CARD_PRICES[denomination]} ريال
                </p>
              </div>
            )}
          </>
        )}

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">تسليم إلى</label>
          <select
            value={toRole}
            onChange={e => setToRole(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-right focus:border-blue-500 focus:outline-none"
          >
            <option value="finance_manager">مدير المالية</option>
            <option value="supervisor">المشرف</option>
            <option value="tech_engineer">المهندس التقني</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">اسم الشخص (اختياري)</label>
          <input
            type="text"
            value={toPersonName}
            onChange={e => setToPersonName(e.target.value)}
            placeholder="اسم الشخص المستلم"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-right focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">ملاحظات (اختياري)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="أي ملاحظات إضافية"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-right focus:border-blue-500 focus:outline-none resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || (type === "cash" ? !amount : !cardCount)}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          {loading ? "جارٍ الحفظ..." : "إضافة العهدة"}
        </button>
      </div>
    </div>
  );
}

function AddTaskScreen({ onBack }: { onBack: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetRole, setTargetRole] = useState("finance_manager");
  const [targetPersonName, setTargetPersonName] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const body: Record<string, unknown> = { title, description, targetRole };
      if (targetPersonName) body.targetPersonName = targetPersonName;

      const res = await fetch(getApiUrl("/tasks"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "فشل إضافة المهمة");
      }
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 px-4 text-center" style={{ direction: "rtl" }}>
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">تمت إضافة المهمة بنجاح</h2>
        <p className="text-gray-500 mb-6">ستظهر المهمة في واجهة {ROLE_LABELS[targetRole]}</p>
        <button
          onClick={onBack}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium"
        >
          العودة للرئيسية
        </button>
      </div>
    );
  }

  return (
    <div style={{ direction: "rtl" }} className="pb-8">
      <div className="bg-blue-600 text-white px-4 py-5 flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-blue-200 hover:text-white text-xl leading-none">←</button>
        <h2 className="font-bold text-lg">إضافة مهمة</h2>
      </div>

      <div className="px-4 space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">تكليف</label>
          <select
            value={targetRole}
            onChange={e => setTargetRole(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-right focus:border-blue-500 focus:outline-none"
          >
            <option value="finance_manager">مدير المالية</option>
            <option value="supervisor">المشرف</option>
            <option value="tech_engineer">المهندس التقني</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">اسم الشخص (اختياري)</label>
          <input
            type="text"
            value={targetPersonName}
            onChange={e => setTargetPersonName(e.target.value)}
            placeholder="اسم الشخص المكلَّف"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-right focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">عنوان المهمة</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="أدخل عنوان المهمة"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-right focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">تفاصيل المهمة</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="اكتب تفاصيل المهمة المطلوبة"
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-right focus:border-blue-500 focus:outline-none resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !title || !description}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          {loading ? "جارٍ الحفظ..." : "إضافة المهمة"}
        </button>
      </div>
    </div>
  );
}

function ReportScreen({ onBack }: { onBack: () => void }) {
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchReport = async () => {
    setLoading(true);
    setError("");
    try {
      let url = getApiUrl(`/finances/report?period=${period}`);
      if (period === "custom" && customFrom && customTo) {
        url += `&from=${customFrom}&to=${customTo}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("فشل تحميل التقرير");
      const data = await res.json() as FinancialReport;
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReport();
  }, []);

  return (
    <div style={{ direction: "rtl" }} className="pb-8">
      <div className="bg-blue-600 text-white px-4 py-5 flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-blue-200 hover:text-white text-xl leading-none">←</button>
        <h2 className="font-bold text-lg">التقارير المالية</h2>
      </div>

      <div className="px-4 space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(["day", "week", "month", "custom"] as ReportPeriod[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${period === p ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-700"}`}
            >
              {p === "day" ? "اليوم" : p === "week" ? "الأسبوع" : p === "month" ? "الشهر" : "مخصص"}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">من</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">إلى</label>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        )}

        <button
          onClick={fetchReport}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm"
        >
          تحديث التقرير
        </button>

        {loading && <LoadingSpinner />}
        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

        {report && !loading && (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 text-center">
              الفترة: {report.from} — {report.to}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <p className="text-xs text-emerald-600 mb-1">المبيعات</p>
                <p className="font-bold text-emerald-700 text-sm">{formatCurrency(report.totalSales)}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                <p className="text-xs text-red-600 mb-1">المصاريف</p>
                <p className="font-bold text-red-700 text-sm">{formatCurrency(report.totalExpenses)}</p>
              </div>
              <div className={`rounded-xl p-3 text-center border ${report.profit >= 0 ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"}`}>
                <p className={`text-xs mb-1 ${report.profit >= 0 ? "text-blue-600" : "text-amber-600"}`}>الربح</p>
                <p className={`font-bold text-sm ${report.profit >= 0 ? "text-blue-700" : "text-amber-700"}`}>{formatCurrency(report.profit)}</p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="font-semibold text-sm text-gray-700 mb-3">تفصيل المبيعات</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">هوتسبوت</span>
                  <span className="font-medium text-gray-900">{formatCurrency(report.salesBreakdown.hotspot)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">إنترنت ثابت</span>
                  <span className="font-medium text-gray-900">{formatCurrency(report.salesBreakdown.broadband)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="font-semibold text-sm text-gray-700 mb-3">تفصيل المصاريف</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">تشغيلية</span>
                  <span className="font-medium text-gray-900">{formatCurrency(report.expenseBreakdown.operational)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">رواتب</span>
                  <span className="font-medium text-gray-900">{formatCurrency(report.expenseBreakdown.salary)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">أخرى</span>
                  <span className="font-medium text-gray-900">{formatCurrency(report.expenseBreakdown.other)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ImportScreen({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<"hotspot" | "broadband" | "salespoints">("hotspot");
  const [jsonInput, setJsonInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");

  const handleImport = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      let records: unknown[];
      try {
        records = JSON.parse(jsonInput) as unknown[];
        if (!Array.isArray(records)) throw new Error("يجب أن يكون المحتوى مصفوفة JSON");
      } catch {
        setError("تنسيق JSON غير صالح. تأكد من إدخال مصفوفة JSON صحيحة.");
        setLoading(false);
        return;
      }

      const endpoint = activeTab === "hotspot" ? "/import/hotspot"
        : activeTab === "broadband" ? "/import/broadband"
        : "/import/sales-points";

      const res = await fetch(getApiUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });

      const data = await res.json() as { imported: number; skipped: number; errors: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "فشل الاستيراد");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  const placeholders: Record<string, string> = {
    hotspot: `[
  { "serial": "HS001", "denomination": 1000, "batchNumber": "B001" },
  { "serial": "HS002", "denomination": 500, "batchNumber": "B001" }
]`,
    broadband: `[
  { "serial": "BB001", "denomination": 2000, "batchNumber": "B001" },
  { "serial": "BB002", "denomination": 1000 }
]`,
    salespoints: `[
  { "name": "محل أبو أحمد", "location": "الرياض", "contactName": "أحمد", "contactPhone": "05xxxxxxxx" },
  { "name": "بقالة النجمة", "location": "جدة" }
]`,
  };

  return (
    <div style={{ direction: "rtl" }} className="pb-8">
      <div className="bg-blue-600 text-white px-4 py-5 flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-blue-200 hover:text-white text-xl leading-none">←</button>
        <h2 className="font-bold text-lg">استيراد البيانات</h2>
      </div>

      <div className="px-4 space-y-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(["hotspot", "broadband", "salespoints"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab === "salespoints" ? "salespoints" : tab); setResult(null); setError(""); }}
              className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${activeTab === tab ? "bg-white shadow text-blue-700" : "text-gray-500"}`}
            >
              {tab === "hotspot" ? "هوتسبوت" : tab === "broadband" ? "إنترنت ثابت" : "نقاط البيع"}
            </button>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
          <p className="font-medium mb-1">تعليمات الاستيراد:</p>
          {activeTab === "hotspot" && <p>الحقول المطلوبة: serial، denomination (الفئة بالأرقام). الحجم المتوقع: 979 سجل.</p>}
          {activeTab === "broadband" && <p>الحقول المطلوبة: serial، denomination (الفئة بالأرقام). الحجم المتوقع: 632 سجل.</p>}
          {activeTab === "salespoints" && <p>الحقل المطلوب: name (اسم نقطة البيع). الحجم المتوقع: 56 سجل.</p>}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">بيانات JSON</label>
          <textarea
            value={jsonInput}
            onChange={e => setJsonInput(e.target.value)}
            placeholder={placeholders[activeTab]}
            rows={8}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-xs font-mono focus:border-blue-500 focus:outline-none resize-none"
            style={{ direction: "ltr", textAlign: "left" }}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
        )}

        {result && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
            <p className="font-semibold text-emerald-800">نتيجة الاستيراد</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-2xl font-bold text-emerald-700">{result.imported}</p>
                <p className="text-xs text-emerald-600">مستورد</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{result.skipped}</p>
                <p className="text-xs text-amber-600">متخطى</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{result.errors.length}</p>
                <p className="text-xs text-red-600">أخطاء</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="bg-red-50 rounded-lg p-2 text-xs text-red-700 space-y-1">
                {result.errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={loading || !jsonInput.trim()}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          {loading ? "جارٍ الاستيراد..." : "بدء الاستيراد"}
        </button>
      </div>
    </div>
  );
}

export default function OwnerDashboard() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch(getApiUrl("/dashboard/summary"));
        if (res.ok) {
          const data = await res.json() as DashboardSummary;
          setSummary(data);
        }
      } catch {
        // ignore
      }
    };
    void fetchSummary();
  }, [screen]);

  return (
    <div className="min-h-screen bg-gray-50 max-w-sm mx-auto">
      {screen === "dashboard" && <DashboardHome summary={summary} onNavigate={setScreen} />}
      {screen === "custody" && <AddCustodyScreen onBack={() => setScreen("dashboard")} />}
      {screen === "task" && <AddTaskScreen onBack={() => setScreen("dashboard")} />}
      {screen === "report" && <ReportScreen onBack={() => setScreen("dashboard")} />}
      {screen === "import" && <ImportScreen onBack={() => setScreen("dashboard")} />}
    </div>
  );
}
