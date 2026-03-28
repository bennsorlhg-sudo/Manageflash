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

const PERIOD_LABELS: Record<string, string> = {
  day: "اليوم", week: "هذا الأسبوع", month: "هذا الشهر",
};

export default function SalesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [filter, setFilter] = useState<"day" | "week" | "month">("day");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSales = useCallback(async () => {
    try {
      const params = new URLSearchParams({ type: "sale", limit: "100" });
      const data = await apiGet(`/transactions?${params}`, token);
      setTransactions(data);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const filterByPeriod = (items: any[]) => {
    const now = new Date();
    return items.filter(t => {
      const d = new Date(t.createdAt);
      if (filter === "day") {
        return d.toDateString() === now.toDateString();
      } else if (filter === "week") {
        const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
        return d >= weekAgo;
      }
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  };

  const filtered = filterByPeriod(transactions);
  const total = filtered.reduce((s, t) => s + parseFloat(t.amount), 0);
  const hotspot = filtered.filter(t => t.category === "hotspot").reduce((s, t) => s + parseFloat(t.amount), 0);
  const broadband = filtered.filter(t => t.category === "broadband").reduce((s, t) => s + parseFloat(t.amount), 0);

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>المبيعات</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.filterRow}>
        {(["day", "week", "month"] as const).map(p => (
          <TouchableOpacity
            key={p} style={[styles.filterBtn, filter === p && styles.filterBtnActive]}
            onPress={() => setFilter(p)}
          >
            <Text style={[styles.filterBtnText, filter === p && styles.filterBtnTextActive]}>
              {PERIOD_LABELS[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSales(); }} />}
      >
        {/* ملخص */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>إجمالي {PERIOD_LABELS[filter]}</Text>
          <Text style={styles.summaryTotal}>{formatCurrency(total)}</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>هوتسبوت</Text>
              <Text style={[styles.summaryItemValue, { color: Colors.primary }]}>{formatCurrency(hotspot)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>برودباند</Text>
              <Text style={[styles.summaryItemValue, { color: Colors.info }]}>{formatCurrency(broadband)}</Text>
            </View>
          </View>
        </View>

        {/* قائمة */}
        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>لا توجد مبيعات في هذه الفترة</Text>
          </View>
        ) : (
          <>
            <Text style={styles.listHeader}>سجل المبيعات ({filtered.length})</Text>
            {filtered.map(t => (
              <View key={t.id} style={styles.txCard}>
                <View style={styles.txHeader}>
                  <Text style={styles.txDesc}>{t.description}</Text>
                  <Text style={[styles.txAmount, { color: Colors.success }]}>{formatCurrency(parseFloat(t.amount))}</Text>
                </View>
                <View style={styles.txFooter}>
                  <Text style={styles.txDate}>{formatDateTime(t.createdAt)}</Text>
                  <View style={[styles.txCategory, { backgroundColor: t.category === "hotspot" ? Colors.primary + "22" : Colors.info + "22" }]}>
                    <Text style={[styles.txCategoryText, { color: t.category === "hotspot" ? Colors.primary : Colors.info }]}>
                      {t.category === "hotspot" ? "هوتسبوت" : "برودباند"}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  backButton: { padding: 4 },
  filterRow: { flexDirection: "row-reverse", padding: 16, gap: 8 },
  filterBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterBtnText: { fontSize: 13, color: Colors.textSecondary, fontFamily: "Inter_600SemiBold" },
  filterBtnTextActive: { color: "#FFF" },
  content: { padding: 16, paddingTop: 0 },
  summaryCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  summaryTitle: { fontSize: 14, color: Colors.textSecondary },
  summaryTotal: { fontSize: 32, fontFamily: "Inter_800ExtraBold", color: Colors.success, marginVertical: 8 },
  summaryRow: { flexDirection: "row-reverse", width: "100%" },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryItemLabel: { fontSize: 12, color: Colors.textMuted },
  summaryItemValue: { fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 4 },
  summaryDivider: { width: 1, backgroundColor: Colors.border },
  emptyCard: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
  listHeader: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 12, textAlign: "right" },
  txCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  txHeader: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 8 },
  txDesc: { fontSize: 14, color: Colors.text, flex: 1, textAlign: "right" },
  txAmount: { fontSize: 15, fontFamily: "Inter_700Bold" },
  txFooter: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  txDate: { fontSize: 11, color: Colors.textMuted },
  txCategory: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  txCategoryText: { fontSize: 11, fontWeight: "600" },
});
