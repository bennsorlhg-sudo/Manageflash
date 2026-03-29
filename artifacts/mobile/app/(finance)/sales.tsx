import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiGet, formatCurrency, formatDateTime } from "@/utils/api";

const PERIODS  = [{ key: "day",   label: "اليوم" }, { key: "week", label: "الأسبوع" }, { key: "month", label: "الشهر" }];
const PAY_TYPES = [{ key: "all", label: "الكل" }, { key: "cash", label: "نقدي" }, { key: "loan", label: "سلفة" }];
const CATS     = [{ key: "all", label: "الكل" }, { key: "hotspot", label: "هوتسبوت" }, { key: "broadband", label: "برودباند" }];

export default function SalesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [period,   setPeriod]   = useState<"day" | "week" | "month">("month");
  const [payType,  setPayType]  = useState("all");
  const [catType,  setCatType]  = useState("all");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSales = useCallback(async () => {
    try {
      const data = await apiGet(`/transactions?type=sale&limit=200`, token);
      setTransactions(Array.isArray(data) ? data : []);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  /* ─── فلترة ─── */
  const filterByPeriod = (items: any[]) => {
    const now = new Date();
    return items.filter(t => {
      const d = new Date(t.createdAt);
      if (period === "day")   return d.toDateString() === now.toDateString();
      if (period === "week")  { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w; }
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  };

  const filtered = filterByPeriod(transactions)
    .filter(t => payType === "all" || (t.paymentType ?? "cash") === payType)
    .filter(t => catType === "all" || t.category === catType);

  const total     = filtered.reduce((s, t) => s + parseFloat(t.amount), 0);
  const hotspot   = filtered.filter(t => t.category === "hotspot")   .reduce((s, t) => s + parseFloat(t.amount), 0);
  const broadband = filtered.filter(t => t.category === "broadband") .reduce((s, t) => s + parseFloat(t.amount), 0);
  const cashTotal = filtered.filter(t => (t.paymentType ?? "cash") === "cash").reduce((s, t) => s + parseFloat(t.amount), 0);
  const loanTotal = filtered.filter(t => t.paymentType === "loan").reduce((s, t) => s + parseFloat(t.amount), 0);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>سجل المبيعات</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ─── فلتر الفترة ─── */}
      <View style={styles.filterRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[styles.filterBtn, period === p.key && styles.filterBtnActive]}
            onPress={() => setPeriod(p.key as any)}
          >
            <Text style={[styles.filterBtnText, period === p.key && styles.filterBtnTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSales(); }} />}
      >
        {/* ─── ملخص ─── */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>إجمالي {PERIODS.find(p => p.key === period)?.label}</Text>
          <Text style={styles.summaryTotal}>{formatCurrency(total)}</Text>

          {/* هوتسبوت / برودباند */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="wifi" size={14} color={Colors.primary} />
              <Text style={styles.summaryItemLabel}>هوتسبوت</Text>
              <Text style={[styles.summaryItemValue, { color: Colors.primary }]}>{formatCurrency(hotspot)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Ionicons name="globe" size={14} color={Colors.info} />
              <Text style={styles.summaryItemLabel}>برودباند</Text>
              <Text style={[styles.summaryItemValue, { color: Colors.info }]}>{formatCurrency(broadband)}</Text>
            </View>
          </View>

          {/* نقدي / سلفة */}
          <View style={[styles.summaryRow, { marginTop: 8, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 }]}>
            <View style={styles.summaryItem}>
              <Ionicons name="cash" size={14} color={Colors.success} />
              <Text style={styles.summaryItemLabel}>نقدي</Text>
              <Text style={[styles.summaryItemValue, { color: Colors.success }]}>{formatCurrency(cashTotal)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Ionicons name="receipt" size={14} color={Colors.warning} />
              <Text style={styles.summaryItemLabel}>سلفة</Text>
              <Text style={[styles.summaryItemValue, { color: Colors.warning }]}>{formatCurrency(loanTotal)}</Text>
            </View>
          </View>
        </View>

        {/* ─── فلاتر إضافية ─── */}
        <View style={styles.subFiltersRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.subFilterLabel}>نوع الدفع</Text>
            <View style={styles.subFilterBtns}>
              {PAY_TYPES.map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.subBtn, payType === p.key && styles.subBtnActive]}
                  onPress={() => setPayType(p.key)}
                >
                  <Text style={[styles.subBtnText, payType === p.key && styles.subBtnTextActive]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.subFilterLabel}>الخدمة</Text>
            <View style={styles.subFilterBtns}>
              {CATS.map(c => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.subBtn, catType === c.key && styles.subBtnActive]}
                  onPress={() => setCatType(c.key)}
                >
                  <Text style={[styles.subBtnText, catType === c.key && styles.subBtnTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ─── قائمة المعاملات ─── */}
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>لا توجد مبيعات في هذه الفترة</Text>
          </View>
        ) : (
          <>
            <Text style={styles.listHeader}>{filtered.length} معاملة</Text>
            {filtered.map(t => {
              const isHotspot = t.category === "hotspot";
              const isCash    = (t.paymentType ?? "cash") === "cash";
              return (
                <View key={t.id} style={styles.txCard}>
                  <View style={styles.txTop}>
                    <Text style={styles.txDesc}>{t.description}</Text>
                    <Text style={[styles.txAmount, { color: Colors.success }]}>
                      {formatCurrency(parseFloat(t.amount))}
                    </Text>
                  </View>
                  {t.personName && t.personName !== t.description && (
                    <Text style={styles.txPerson}>{t.personName}</Text>
                  )}
                  <View style={styles.txFooter}>
                    <Text style={styles.txDate}>{formatDateTime(t.createdAt)}</Text>
                    <View style={styles.txTags}>
                      <View style={[styles.txTag, { backgroundColor: (isHotspot ? Colors.primary : Colors.info) + "20" }]}>
                        <Ionicons name={isHotspot ? "wifi" : "globe"} size={11} color={isHotspot ? Colors.primary : Colors.info} />
                        <Text style={[styles.txTagText, { color: isHotspot ? Colors.primary : Colors.info }]}>
                          {isHotspot ? "هوتسبوت" : "برودباند"}
                        </Text>
                      </View>
                      <View style={[styles.txTag, { backgroundColor: (isCash ? Colors.success : Colors.warning) + "20" }]}>
                        <Ionicons name={isCash ? "cash" : "receipt"} size={11} color={isCash ? Colors.success : Colors.warning} />
                        <Text style={[styles.txTagText, { color: isCash ? Colors.success : Colors.warning }]}>
                          {isCash ? "نقدي" : "سلفة"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  filterRow: { flexDirection: "row-reverse", padding: 14, gap: 8 },
  filterBtn: {
    flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterBtnText: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" },
  filterBtnTextActive: { color: "#FFF" },
  content: { padding: 14, paddingTop: 0 },

  summaryCard: {
    backgroundColor: Colors.surface, borderRadius: 18, padding: 18,
    marginBottom: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center",
  },
  summaryTitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  summaryTotal: { fontSize: 34, fontWeight: "800", color: Colors.success, marginBottom: 14 },
  summaryRow: { flexDirection: "row-reverse", width: "100%" },
  summaryItem: { flex: 1, alignItems: "center", gap: 4 },
  summaryItemLabel: { fontSize: 12, color: Colors.textMuted },
  summaryItemValue: { fontSize: 15, fontWeight: "700" },
  summaryDivider: { width: 1, backgroundColor: Colors.border },

  subFiltersRow: { flexDirection: "row-reverse", gap: 10, marginBottom: 14 },
  subFilterLabel: { fontSize: 11, color: Colors.textMuted, textAlign: "right", marginBottom: 6 },
  subFilterBtns: { flexDirection: "row-reverse", gap: 4 },
  subBtn: {
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  subBtnActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  subBtnText: { fontSize: 10, color: Colors.textSecondary, fontWeight: "600" },
  subBtnTextActive: { color: Colors.primary },

  listHeader: { fontSize: 13, color: Colors.textMuted, textAlign: "right", marginBottom: 10 },
  empty: { alignItems: "center", marginTop: 50, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },

  txCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
  },
  txTop: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  txDesc: { fontSize: 14, color: Colors.text, flex: 1, textAlign: "right" },
  txAmount: { fontSize: 15, fontWeight: "700", flexShrink: 0 },
  txPerson: { fontSize: 12, color: Colors.textSecondary, textAlign: "right", marginBottom: 4 },
  txFooter: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  txDate: { fontSize: 11, color: Colors.textMuted },
  txTags: { flexDirection: "row-reverse", gap: 6 },
  txTag: {
    flexDirection: "row-reverse", alignItems: "center", gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  txTagText: { fontSize: 10, fontWeight: "600" },
});
