import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Platform,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import { apiGet, apiPut, formatCurrency, formatDate } from "@/utils/api";

/* ─── KPI Card ─── */
function KPICard({
  title, value, icon, color, fullWidth = false, large = false,
}: {
  title: string; value: number; icon: keyof typeof Ionicons.glyphMap;
  color: string; fullWidth?: boolean; large?: boolean;
}) {
  return (
    <View style={[
      styles.kpiCard,
      fullWidth ? { width: "100%" } : { flex: 1 },
      { borderColor: color + "40" },
      large && styles.kpiLarge,
    ]}>
      <View style={styles.kpiRow}>
        <View style={[styles.kpiIcon, { backgroundColor: color + "20" }]}>
          <Ionicons name={icon} size={large ? 28 : 20} color={color} />
        </View>
        <Text style={[styles.kpiTitle, large && styles.kpiTitleLarge]}>{title}</Text>
      </View>
      <Text style={[styles.kpiValue, { color }, large && styles.kpiValueLarge]}>
        {formatCurrency(value)}
      </Text>
    </View>
  );
}

/* ─── Action Button ─── */
function ActionBtn({ label, icon, onPress, color }: {
  label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; color: string;
}) {
  return (
    <TouchableOpacity style={[styles.actionBtn, { borderColor: color + "40" }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.actionIcon, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function FinanceDashboard() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // KPI values
  const [custodyTotal, setCustodyTotal] = useState(0);
  const [cardsTotal, setCardsTotal] = useState(0);
  const [cashBalance, setCashBalance] = useState(0);
  const [loansTotal, setLoansTotal] = useState(0);

  // Lists
  const [custodyList, setCustodyList] = useState<any[]>([]);
  const [sellLoans, setSellLoans] = useState<any[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);
  const [updatingReq, setUpdatingReq] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [summary, cashData, loans, custody, reqs] = await Promise.all([
        apiGet("/custody/summary", token),
        apiGet("/cash-box", token),
        apiGet("/debts", token),          // السلف المنشأة من البيع (debts = ما عليه الآخرون)
        apiGet("/custody", token),
        apiGet("/purchase-requests", token),
      ]);

      // KPI
      setCustodyTotal(summary.total ?? 0);
      setCardsTotal(summary.cardsTotal ?? 0);
      setCashBalance(cashData.balance ?? 0);

      // السلف = ما على الآخرين (debts غير المدفوعة بالكامل)
      const unpaidLoans = (loans as any[]).filter((l: any) => l.status !== "paid");
      setLoansTotal(unpaidLoans.reduce((s: number, l: any) => s + parseFloat(l.amount ?? "0") - parseFloat(l.paidAmount ?? "0"), 0));

      // قائمة العهدة المسلّمة للمندوب (آخر 5)
      setCustodyList((custody as any[]).slice(0, 10));

      // السلف المنشأة من البيع المباشر (عرض آخر 5)
      setSellLoans(unpaidLoans.slice(0, 5));

      // طلبات الشراء المعلقة
      setPurchaseRequests((reqs as any[]).filter((r: any) => r.status === "pending"));
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRequestAction = async (id: number, status: "approved" | "rejected") => {
    setUpdatingReq(id);
    try {
      await apiPut(`/purchase-requests/${id}`, token, { status });
      setPurchaseRequests(prev => prev.filter(r => r.id !== id));
    } catch {} finally { setUpdatingReq(null); }
  };

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/(finance)/profile")}>
          <Ionicons name="person-circle-outline" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>المسؤول المالي — {user?.name}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
      >
        {/* ─── KPI Block ─── */}
        <View style={styles.kpiBlock}>

          {/* 1. إجمالي العهدة — الكبير */}
          <KPICard
            title="إجمالي العهدة"
            value={custodyTotal}
            icon="briefcase"
            color={Colors.primary}
            fullWidth
            large
          />

          {/* 2. قيمة الكروت + نقد */}
          <View style={styles.row}>
            <KPICard title="قيمة الكروت" value={cardsTotal} icon="card" color={Colors.info} />
            <KPICard title="النقد" value={cashBalance} icon="wallet" color={Colors.success} />
          </View>

          {/* 3. السلف */}
          <KPICard
            title="السلف"
            value={loansTotal}
            icon="trending-up"
            color={Colors.warning}
            fullWidth
          />
        </View>

        {/* ─── أزرار العمليات ─── */}
        <View style={styles.actionsBlock}>
          <View style={styles.row}>
            <ActionBtn label="بيع" icon="cart" color={Colors.info} onPress={() => router.push("/(finance)/sell")} />
            <ActionBtn label="صرف" icon="arrow-up-circle" color={Colors.error} onPress={() => router.push("/(finance)/disburse")} />
            <ActionBtn label="تحصيل" icon="arrow-down-circle" color={Colors.success} onPress={() => router.push("/(finance)/collect")} />
          </View>
          <View style={styles.row}>
            <ActionBtn label="إدارة العهدة" icon="briefcase" color="#673AB7" onPress={() => router.push("/(finance)/custody")} />
            <ActionBtn label="نقاط البيع" icon="location" color="#009688" onPress={() => router.push("/(finance)/sales-points")} />
          </View>
          <View style={styles.row}>
            <ActionBtn label="المصاريف" icon="receipt" color="#FF5722" onPress={() => router.push("/(finance)/expenses")} />
            <ActionBtn label="ديون/سلف" icon="people" color="#795548" onPress={() => router.push("/(finance)/debts-loans")} />
            <ActionBtn label="المبيعات" icon="trending-up" color="#4CAF50" onPress={() => router.push("/(finance)/sales")} />
          </View>
        </View>

        {/* ─── العهد المسلّمة للمندوب ─── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>العهد المسلّمة</Text>
          {custodyList.length > 0 && (
            <View style={[styles.badge, { backgroundColor: Colors.primary + "25" }]}>
              <Text style={[styles.badgeText, { color: Colors.primary }]}>{custodyList.length}</Text>
            </View>
          )}
        </View>

        {custodyList.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="briefcase-outline" size={28} color={Colors.textMuted} />
            <Text style={styles.emptyText}>لا توجد عهد مسلّمة</Text>
          </View>
        ) : (
          custodyList.map((item: any) => (
            <View key={item.id} style={styles.listCard}>
              <View style={styles.listRow}>
                <View style={[styles.typePill, { backgroundColor: item.type === "cash" ? Colors.success + "22" : Colors.info + "22" }]}>
                  <Text style={[styles.typePillText, { color: item.type === "cash" ? Colors.success : Colors.info }]}>
                    {item.type === "cash" ? "نقدي" : "كروت"}
                  </Text>
                </View>
                <Text style={styles.listName}>{item.toPersonName ?? "—"}</Text>
              </View>
              <View style={styles.listRow}>
                <Text style={styles.listDate}>{formatDate(item.createdAt)}</Text>
                <Text style={[styles.listAmount, { color: Colors.primary }]}>{formatCurrency(parseFloat(item.amount))}</Text>
              </View>
              {item.notes ? <Text style={styles.listNotes}>{item.notes}</Text> : null}
            </View>
          ))
        )}

        {/* ─── السلف من البيع المباشر ─── */}
        <View style={[styles.sectionHeader, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>السلف (من البيع)</Text>
          {sellLoans.length > 0 && (
            <View style={[styles.badge, { backgroundColor: Colors.warning + "25" }]}>
              <Text style={[styles.badgeText, { color: Colors.warning }]}>{sellLoans.length}</Text>
            </View>
          )}
        </View>

        {sellLoans.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={28} color={Colors.success} />
            <Text style={styles.emptyText}>لا توجد سلف معلقة</Text>
          </View>
        ) : (
          sellLoans.map((item: any) => (
            <View key={item.id} style={[styles.listCard, { borderLeftWidth: 3, borderLeftColor: Colors.warning }]}>
              <View style={styles.listRow}>
                <Text style={[styles.listAmount, { color: Colors.warning }]}>
                  {formatCurrency(parseFloat(item.amount ?? "0") - parseFloat(item.paidAmount ?? "0"))}
                </Text>
                <Text style={styles.listName}>{item.personName ?? "—"}</Text>
              </View>
              <View style={styles.listRow}>
                <Text style={styles.listDate}>{formatDate(item.createdAt)}</Text>
                {item.notes ? <Text style={styles.listNotes}>{item.notes}</Text> : null}
              </View>
            </View>
          ))
        )}

        {/* ─── طلبات الشراء المعلقة ─── */}
        <View style={[styles.sectionHeader, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>طلبات الشراء</Text>
          {purchaseRequests.length > 0 && (
            <View style={[styles.badge, { backgroundColor: Colors.warning + "33" }]}>
              <Text style={[styles.badgeText, { color: Colors.warning }]}>{purchaseRequests.length}</Text>
            </View>
          )}
        </View>

        {purchaseRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={32} color={Colors.success} />
            <Text style={styles.emptyText}>لا توجد طلبات شراء معلقة</Text>
          </View>
        ) : (
          purchaseRequests.map((req: any) => (
            <View key={req.id} style={styles.requestCard}>
              <View style={styles.listRow}>
                <Text style={styles.requestAmount}>{req.amount ? formatCurrency(parseFloat(req.amount)) : "—"}</Text>
                <Text style={styles.requestDesc}>{req.description}</Text>
              </View>
              {req.notes && <Text style={styles.listNotes}>{req.notes}</Text>}
              <View style={styles.requestFooter}>
                <Text style={styles.listDate}>{formatDate(req.createdAt)}</Text>
                <View style={styles.reqBtns}>
                  <TouchableOpacity
                    style={[styles.reqBtn, { backgroundColor: Colors.error + "20" }]}
                    onPress={() => handleRequestAction(req.id, "rejected")}
                    disabled={updatingReq === req.id}
                  >
                    <Text style={[styles.reqBtnText, { color: Colors.error }]}>رفض</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.reqBtn, { backgroundColor: Colors.success + "20" }]}
                    onPress={() => handleRequestAction(req.id, "approved")}
                    disabled={updatingReq === req.id}
                  >
                    <Text style={[styles.reqBtnText, { color: Colors.success }]}>موافقة</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: "bold", color: Colors.text },
  content: { padding: 16 },

  kpiBlock: { gap: 10, marginBottom: 20 },
  row: { flexDirection: "row-reverse", gap: 10 },

  kpiCard: {
    backgroundColor: Colors.surface, borderRadius: 16,
    padding: 14, borderWidth: 1, justifyContent: "center",
  },
  kpiLarge: { padding: 20 },
  kpiRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginBottom: 10 },
  kpiIcon: { padding: 8, borderRadius: 10 },
  kpiTitle: { fontSize: 13, color: Colors.textSecondary, fontWeight: "500" },
  kpiTitleLarge: { fontSize: 16, fontWeight: "600" },
  kpiValue: { fontSize: 22, fontWeight: "bold", textAlign: "right" },
  kpiValueLarge: { fontSize: 32, fontWeight: "800" },

  actionsBlock: { gap: 10, marginBottom: 24 },
  actionBtn: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 8, alignItems: "center",
    justifyContent: "center", gap: 6, borderWidth: 1,
  },
  actionIcon: { padding: 8, borderRadius: 10 },
  actionLabel: { fontSize: 11, color: Colors.text, fontWeight: "600", textAlign: "center" },

  sectionHeader: {
    flexDirection: "row-reverse", alignItems: "center",
    justifyContent: "space-between", marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: "bold", color: Colors.text },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: "bold" },

  emptyCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 20,
    alignItems: "center", gap: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 4,
  },
  emptyText: { fontSize: 13, color: Colors.textMuted },

  listCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 8,
  },
  listRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  listName: { fontSize: 14, fontWeight: "bold", color: Colors.text },
  listAmount: { fontSize: 15, fontWeight: "bold" },
  listDate: { fontSize: 11, color: Colors.textMuted },
  listNotes: { fontSize: 12, color: Colors.textMuted, textAlign: "right", marginTop: 2 },
  typePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typePillText: { fontSize: 11, fontWeight: "600" },

  requestCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 8,
  },
  requestDesc: { fontSize: 14, fontWeight: "600", color: Colors.text, flex: 1, textAlign: "right" },
  requestAmount: { fontSize: 14, fontWeight: "bold", color: Colors.primaryLight },
  requestFooter: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 10, paddingTop: 10,
  },
  reqBtns: { flexDirection: "row-reverse", gap: 8 },
  reqBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  reqBtnText: { fontSize: 12, fontWeight: "600" },
});
