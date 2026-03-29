import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Platform, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, formatCurrency } from "@/utils/api";

type Period = "day" | "week" | "month";

const PERIOD_LABELS: Record<Period, string> = {
  day: "اليوم", week: "الأسبوع", month: "الشهر",
};

const TYPE_CONFIG = {
  sales:    { label: "المبيعات",   icon: "bar-chart"    as const, color: Colors.success },
  expenses: { label: "المصروفات", icon: "receipt"       as const, color: Colors.error   },
  profit:   { label: "الربح",     icon: "trending-up"  as const, color: Colors.primary  },
};

interface ReportData {
  period: string;
  from: string;
  to: string;
  totalSales: number;
  totalExpenses: number;
  profit: number;
  salesBreakdown: { hotspot: number; broadband: number };
  expenseBreakdown: { operational: number; salary: number; other: number };
}

function DetailRow({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <View style={s.detailRow}>
      <Text style={[s.detailValue, { color }, bold && s.detailValueBold]}>{value}</Text>
      <Text style={[s.detailLabel, bold && s.detailLabelBold]}>{label}</Text>
    </View>
  );
}

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ type?: string }>();

  const reportType = (params.type ?? "sales") as keyof typeof TYPE_CONFIG;
  const config     = TYPE_CONFIG[reportType] ?? TYPE_CONFIG.sales;

  const [period,  setPeriod]  = useState<Period>("month");
  const [data,    setData]    = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const json = await apiGet(`/finances/report?period=${period}`, token);
      setData(json);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [period, token]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const getMainValue = () => {
    if (!data) return formatCurrency(0);
    if (reportType === "sales")    return formatCurrency(data.totalSales);
    if (reportType === "expenses") return formatCurrency(data.totalExpenses);
    return formatCurrency(data.profit);
  };

  return (
    <View style={[s.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-forward" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>{config.label}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── فلتر الفترة ── */}
      <View style={s.periodRow}>
        {(["day", "week", "month"] as Period[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[s.periodBtn, period === p && { backgroundColor: config.color, borderColor: config.color }]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[s.periodBtnTxt, period === p && { color: "#fff" }]}>
              {PERIOD_LABELS[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: Platform.OS === "web" ? 40 : insets.bottom + 30 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={config.color} size="large" />
          </View>
        ) : (
          <>
            {/* بطاقة القيمة الرئيسية */}
            <View style={[s.mainCard, { borderTopColor: config.color }]}>
              <View style={[s.mainCardIcon, { backgroundColor: config.color + "22" }]}>
                <Ionicons name={config.icon} size={36} color={config.color} />
              </View>
              <Text style={s.mainLabel}>{config.label}</Text>
              <Text style={[s.mainValue, { color: config.color }]}>{getMainValue()}</Text>
              <Text style={s.mainPeriod}>{PERIOD_LABELS[period]}</Text>
              {data && (
                <Text style={s.mainDates}>
                  {data.from} — {data.to}
                </Text>
              )}
            </View>

            {/* ── تفاصيل المبيعات ── */}
            {reportType === "sales" && data && (
              <>
                <Text style={s.sectionTitle}>إجمالي المبيعات</Text>
                <View style={s.detailCard}>
                  <DetailRow
                    label="هوت سبوت"
                    value={formatCurrency(data.salesBreakdown.hotspot)}
                    color={Colors.info}
                  />
                  <View style={s.sep} />
                  <DetailRow
                    label="برودباند"
                    value={formatCurrency(data.salesBreakdown.broadband)}
                    color={Colors.success}
                  />
                  <View style={s.sep} />
                  <DetailRow
                    label="الإجمالي"
                    value={formatCurrency(data.totalSales)}
                    color={Colors.success}
                    bold
                  />
                </View>
              </>
            )}

            {/* ── تفاصيل المصروفات ── */}
            {reportType === "expenses" && data && (
              <>
                <Text style={s.sectionTitle}>تفاصيل المصروفات</Text>
                <View style={s.detailCard}>
                  <DetailRow
                    label="تشغيلي"
                    value={formatCurrency(data.expenseBreakdown.operational)}
                    color={Colors.warning}
                  />
                  <View style={s.sep} />
                  <DetailRow
                    label="رواتب"
                    value={formatCurrency(data.expenseBreakdown.salary)}
                    color={Colors.error}
                  />
                  <View style={s.sep} />
                  <DetailRow
                    label="أخرى"
                    value={formatCurrency(data.expenseBreakdown.other)}
                    color={Colors.textSecondary}
                  />
                  <View style={s.sep} />
                  <DetailRow
                    label="الإجمالي"
                    value={formatCurrency(data.totalExpenses)}
                    color={Colors.error}
                    bold
                  />
                </View>
              </>
            )}

            {/* ── ملخص الربح ── */}
            {reportType === "profit" && data && (
              <>
                <Text style={s.sectionTitle}>ملخص الربحية</Text>
                <View style={s.detailCard}>
                  <DetailRow
                    label="إجمالي المبيعات"
                    value={formatCurrency(data.totalSales)}
                    color={Colors.success}
                  />
                  <View style={s.sep} />
                  <DetailRow
                    label="إجمالي المصروفات"
                    value={formatCurrency(data.totalExpenses)}
                    color={Colors.error}
                  />
                  <View style={s.sep} />
                  <DetailRow
                    label="صافي الربح"
                    value={formatCurrency(data.profit)}
                    color={data.profit >= 0 ? Colors.success : Colors.error}
                    bold
                  />
                </View>

                {/* هامش ربح */}
                {data.totalSales > 0 && (
                  <View style={[s.marginCard, {
                    backgroundColor: data.profit >= 0 ? Colors.success + "12" : Colors.error + "12",
                    borderColor:     data.profit >= 0 ? Colors.success + "44" : Colors.error + "44",
                  }]}>
                    <Text style={s.marginLabel}>هامش الربح</Text>
                    <Text style={[s.marginValue, { color: data.profit >= 0 ? Colors.success : Colors.error }]}>
                      {((data.profit / data.totalSales) * 100).toFixed(1)}%
                    </Text>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "bold", color: Colors.text },

  periodRow: { flexDirection: "row-reverse", paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  periodBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center",
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  periodBtnTxt: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },

  content:     { padding: 16, gap: 16 },
  loadingWrap: { paddingVertical: 60, alignItems: "center" },

  mainCard: {
    backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1,
    borderColor: Colors.border, borderTopWidth: 4, padding: 28,
    alignItems: "center", gap: 6,
  },
  mainCardIcon: { width: 68, height: 68, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  mainLabel:   { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },
  mainValue:   { fontSize: 38, fontWeight: "800" },
  mainPeriod:  { fontSize: 12, color: Colors.textMuted },
  mainDates:   { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  sectionTitle: { fontSize: 15, fontWeight: "700", color: Colors.text, textAlign: "right" },
  detailCard: {
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, padding: 16,
  },
  detailRow: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingVertical: 12,
  },
  detailLabel:      { fontSize: 14, color: Colors.textSecondary },
  detailLabelBold:  { fontWeight: "700", color: Colors.text },
  detailValue:      { fontSize: 15, fontWeight: "600" },
  detailValueBold:  { fontSize: 17, fontWeight: "800" },
  sep: { height: 1, backgroundColor: Colors.border },

  marginCard: {
    borderRadius: 14, borderWidth: 1, padding: 20,
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
  },
  marginLabel: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },
  marginValue: { fontSize: 32, fontWeight: "800" },
});
