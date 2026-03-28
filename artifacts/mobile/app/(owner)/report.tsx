import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Platform, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

type Period = "day" | "week" | "month";

const PERIOD_LABELS: Record<Period, string> = {
  day: "اليوم",
  week: "الأسبوع",
  month: "الشهر",
};

const TYPE_CONFIG = {
  sales: { label: "المبيعات", icon: "bar-chart" as const, color: Colors.success },
  expenses: { label: "المصروفات", icon: "receipt" as const, color: Colors.error },
  profit: { label: "الربح", icon: "trending-up" as const, color: Colors.primary },
};

interface FinancialReport {
  period: string;
  totalSales: number;
  cashSales: number;
  loanSales: number;
  totalExpenses: number;
  totalProfit: number;
  salesCount: number;
  expensesCount: number;
}

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ type?: string }>();
  const reportType = (params.type ?? "sales") as keyof typeof TYPE_CONFIG;
  const config = TYPE_CONFIG[reportType] ?? TYPE_CONFIG.sales;

  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<FinancialReport | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finances/report?period=${period}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [period, token]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const fmt = (n: number) => n.toLocaleString("ar-SA") + " ﷼";

  const getMainValue = () => {
    if (!data) return "0 ﷼";
    if (reportType === "sales") return fmt(data.totalSales);
    if (reportType === "expenses") return fmt(data.totalExpenses);
    return fmt(data.totalProfit);
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{config.label}</Text>
      </View>

      {/* Period Filter */}
      <View style={styles.periodRow}>
        {(["day", "week", "month"] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
              {PERIOD_LABELS[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingWrap}><ActivityIndicator color={Colors.primary} size="large" /></View>
        ) : (
          <>
            {/* Main Value Card */}
            <View style={[styles.mainCard, { borderTopColor: config.color }]}>
              <View style={[styles.mainCardIcon, { backgroundColor: config.color + "22" }]}>
                <Ionicons name={config.icon} size={32} color={config.color} />
              </View>
              <Text style={styles.mainLabel}>{config.label}</Text>
              <Text style={[styles.mainValue, { color: config.color }]}>{getMainValue()}</Text>
              <Text style={styles.mainPeriod}>{PERIOD_LABELS[period]}</Text>
            </View>

            {reportType === "sales" && data && (
              <View style={styles.detailsSection}>
                <Text style={styles.sectionTitle}>تفاصيل المبيعات</Text>
                <View style={styles.detailCard}>
                  <DetailRow label="مبيعات نقد" value={fmt(data.cashSales)} color={Colors.success} />
                  <View style={styles.separator} />
                  <DetailRow label="مبيعات بالسلفة" value={fmt(data.loanSales)} color={Colors.warning} />
                  <View style={styles.separator} />
                  <DetailRow label="عدد المعاملات" value={String(data.salesCount)} color={Colors.primary} />
                </View>
              </View>
            )}

            {reportType === "expenses" && data && (
              <View style={styles.detailsSection}>
                <Text style={styles.sectionTitle}>تفاصيل المصروفات</Text>
                <View style={styles.detailCard}>
                  <DetailRow label="إجمالي المصروفات" value={fmt(data.totalExpenses)} color={Colors.error} />
                  <View style={styles.separator} />
                  <DetailRow label="عدد المصروفات" value={String(data.expensesCount)} color={Colors.primary} />
                </View>
              </View>
            )}

            {reportType === "profit" && data && (
              <View style={styles.detailsSection}>
                <Text style={styles.sectionTitle}>ملخص الربح</Text>
                <View style={styles.detailCard}>
                  <DetailRow label="إجمالي المبيعات" value={fmt(data.totalSales)} color={Colors.success} />
                  <View style={styles.separator} />
                  <DetailRow label="إجمالي المصروفات" value={fmt(data.totalExpenses)} color={Colors.error} />
                  <View style={styles.separator} />
                  <DetailRow
                    label="صافي الربح"
                    value={fmt(data.totalProfit)}
                    color={data.totalProfit >= 0 ? Colors.success : Colors.error}
                    bold
                  />
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailValue, { color }, bold && styles.detailValueBold]}>{value}</Text>
      <Text style={[styles.detailLabel, bold && styles.detailLabelBold]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  periodRow: {
    flexDirection: "row-reverse", paddingHorizontal: 16, paddingVertical: 12, gap: 8,
  },
  periodBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  periodBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  periodBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  periodBtnTextActive: { color: "#fff" },
  content: { padding: 16, gap: 16 },
  loadingWrap: { paddingVertical: 60, alignItems: "center" },
  mainCard: {
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1,
    borderColor: Colors.border, borderTopWidth: 4, padding: 24, alignItems: "center", gap: 8,
  },
  mainCardIcon: { width: 64, height: 64, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  mainLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  mainValue: { fontSize: 36, fontFamily: "Inter_700Bold" },
  mainPeriod: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  detailsSection: { gap: 10 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "right" },
  detailCard: {
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 16,
  },
  detailRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  detailLabel: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  detailLabelBold: { fontFamily: "Inter_700Bold", color: Colors.text },
  detailValue: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  detailValueBold: { fontSize: 18, fontFamily: "Inter_700Bold" },
  separator: { height: 1, backgroundColor: Colors.border },
});
