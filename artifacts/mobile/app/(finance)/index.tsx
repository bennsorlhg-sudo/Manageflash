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

/* ─────────────────────────────────────────
   بطاقة KPI نصف الصف
───────────────────────────────────────── */
function KPICard({
  title, value, icon, color, subtitle,
}: {
  title: string; value: number; icon: keyof typeof Ionicons.glyphMap;
  color: string; subtitle?: string;
}) {
  return (
    <View style={[styles.kpiCard, { borderColor: color + "40" }]}>
      <View style={styles.kpiTop}>
        <View style={[styles.kpiIcon, { backgroundColor: color + "1E" }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={styles.kpiTitle} numberOfLines={1}>{title}</Text>
      </View>
      <Text style={[styles.kpiValue, { color }]}>{formatCurrency(value)}</Text>
      {subtitle ? <Text style={styles.kpiSub}>{subtitle}</Text> : null}
    </View>
  );
}

/* ─────────────────────────────────────────
   زر عملية
───────────────────────────────────────── */
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

  /* ─── الأرقام الست ─── */
  const [totalCustody, setTotalCustody] = useState(0);   // إجمالي العهدة
  const [cashBalance, setCashBalance] = useState(0);     // الصندوق النقدي
  const [cardsValue, setCardsValue] = useState(0);       // إجمالي الكروت
  const [agentCustody, setAgentCustody] = useState(0);   // العهدة عند المندوبين
  const [totalLoans, setTotalLoans] = useState(0);       // السلف
  const [totalDebts, setTotalDebts] = useState(0);       // الديون

  /* ─── قوائم مساعدة ─── */
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);
  const [updatingReq, setUpdatingReq] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [summary, reqs] = await Promise.all([
        apiGet("/finances/summary", token),
        apiGet("/purchase-requests", token),
      ]);

      setTotalCustody(summary.totalCustody ?? 0);
      setCashBalance(summary.cashBalance ?? 0);
      setCardsValue(summary.cardsValue ?? 0);
      setAgentCustody(summary.agentCustody ?? 0);
      setTotalLoans(summary.totalLoans ?? 0);
      setTotalDebts(summary.totalDebts ?? 0);

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
      {/* ─── Header ─── */}
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

        {/* ══════════════════════════════════════
            6 بطاقات KPI — 3 صفوف × 2 عمود
            الترتيب كما في المواصفات:
            [ إجمالي العهدة  ]  [ الصندوق النقدي       ]
            [ إجمالي الكروت  ]  [ العهدة عند المندوبين ]
            [ السلف          ]  [ الديون               ]
        ══════════════════════════════════════ */}
        <View style={styles.kpiGrid}>

          {/* صف 1 */}
          <View style={styles.kpiRow}>
            <KPICard
              title="إجمالي العهدة"
              value={totalCustody}
              icon="briefcase"
              color={Colors.primary}
              subtitle="نقد + كروت + برودباند"
            />
            <KPICard
              title="الصندوق النقدي"
              value={cashBalance}
              icon="wallet"
              color={Colors.success}
              subtitle="النقد الفعلي"
            />
          </View>

          {/* صف 2 */}
          <View style={styles.kpiRow}>
            <KPICard
              title="إجمالي الكروت"
              value={cardsValue}
              icon="card"
              color={Colors.info}
              subtitle="قيمة إجمالية"
            />
            <KPICard
              title="عند المندوبين"
              value={agentCustody}
              icon="people"
              color="#9C27B0"
              subtitle="كروت مسلّمة"
            />
          </View>

          {/* صف 3 */}
          <View style={styles.kpiRow}>
            <KPICard
              title="السلف"
              value={totalLoans}
              icon="trending-up"
              color={Colors.warning}
              subtitle="مبيعات بسلفة"
            />
            <KPICard
              title="الديون"
              value={totalDebts}
              icon="trending-down"
              color={Colors.error}
              subtitle="التزامات الشبكة"
            />
          </View>
        </View>

        {/* ─── أزرار العمليات ─── */}
        <View style={styles.actionsBlock}>
          <View style={styles.actionRow}>
            <ActionBtn label="بيع" icon="cart" color={Colors.info} onPress={() => router.push("/(finance)/sell")} />
            <ActionBtn label="صرف" icon="arrow-up-circle" color={Colors.error} onPress={() => router.push("/(finance)/disburse")} />
            <ActionBtn label="تحصيل" icon="arrow-down-circle" color={Colors.success} onPress={() => router.push("/(finance)/collect")} />
          </View>
          <View style={styles.actionRow}>
            <ActionBtn label="إدارة العهدة" icon="briefcase" color="#673AB7" onPress={() => router.push("/(finance)/custody")} />
            <ActionBtn label="نقاط البيع" icon="location" color="#009688" onPress={() => router.push("/(finance)/sales-points")} />
          </View>
          <View style={styles.actionRow}>
            <ActionBtn label="المصاريف" icon="receipt" color="#FF5722" onPress={() => router.push("/(finance)/expenses")} />
            <ActionBtn label="ديون/سلف" icon="stats-chart" color="#795548" onPress={() => router.push("/(finance)/debts-loans")} />
            <ActionBtn label="المبيعات" icon="bar-chart" color="#4CAF50" onPress={() => router.push("/(finance)/sales")} />
          </View>
        </View>

        {/* ─── طلبات الشراء المعلقة ─── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>طلبات الشراء</Text>
          {purchaseRequests.length > 0 && (
            <View style={[styles.badge, { backgroundColor: Colors.warning + "33" }]}>
              <Text style={[styles.badgeText, { color: Colors.warning }]}>{purchaseRequests.length}</Text>
            </View>
          )}
        </View>

        {purchaseRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={28} color={Colors.success} />
            <Text style={styles.emptyText}>لا توجد طلبات شراء معلقة</Text>
          </View>
        ) : (
          purchaseRequests.map((req: any) => (
            <View key={req.id} style={styles.reqCard}>
              <View style={styles.reqRow}>
                {req.amount
                  ? <Text style={styles.reqAmount}>{formatCurrency(parseFloat(req.amount))}</Text>
                  : null}
                <Text style={styles.reqDesc} numberOfLines={2}>{req.description}</Text>
              </View>
              {req.notes ? <Text style={styles.reqNotes}>{req.notes}</Text> : null}
              <View style={styles.reqFooter}>
                <Text style={styles.reqDate}>{formatDate(req.createdAt)}</Text>
                <View style={styles.reqBtns}>
                  <TouchableOpacity
                    style={[styles.reqBtn, { backgroundColor: Colors.error + "20" }]}
                    onPress={() => handleRequestAction(req.id, "rejected")}
                    disabled={updatingReq === req.id}
                  >
                    {updatingReq === req.id
                      ? <ActivityIndicator size="small" color={Colors.error} />
                      : <Text style={[styles.reqBtnText, { color: Colors.error }]}>رفض</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.reqBtn, { backgroundColor: Colors.success + "20" }]}
                    onPress={() => handleRequestAction(req.id, "approved")}
                    disabled={updatingReq === req.id}
                  >
                    {updatingReq === req.id
                      ? <ActivityIndicator size="small" color={Colors.success} />
                      : <Text style={[styles.reqBtnText, { color: Colors.success }]}>موافقة</Text>}
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
  content: { padding: 14 },

  /* ─── KPI Grid ─── */
  kpiGrid: { gap: 10, marginBottom: 20 },
  kpiRow: { flexDirection: "row-reverse", gap: 10 },
  kpiCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 16,
    padding: 14, borderWidth: 1.5, minHeight: 100,
  },
  kpiTop: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 10 },
  kpiIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  kpiTitle: { flex: 1, fontSize: 12, color: Colors.textSecondary, fontWeight: "600", textAlign: "right" },
  kpiValue: { fontSize: 20, fontWeight: "800", textAlign: "right" },
  kpiSub: { fontSize: 10, color: Colors.textMuted, textAlign: "right", marginTop: 3 },

  /* ─── Actions ─── */
  actionsBlock: { gap: 8, marginBottom: 22 },
  actionRow: { flexDirection: "row-reverse", gap: 8 },
  actionBtn: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14,
    paddingVertical: 13, paddingHorizontal: 6, alignItems: "center",
    justifyContent: "center", gap: 6, borderWidth: 1,
  },
  actionIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  actionLabel: { fontSize: 11, color: Colors.text, fontWeight: "600", textAlign: "center" },

  /* ─── Sections ─── */
  sectionHeader: {
    flexDirection: "row-reverse", alignItems: "center",
    justifyContent: "space-between", marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: "bold", color: Colors.text },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: "bold" },

  emptyCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 20,
    alignItems: "center", gap: 8, borderWidth: 1, borderColor: Colors.border,
  },
  emptyText: { fontSize: 13, color: Colors.textMuted },

  reqCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 8,
  },
  reqRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 8 },
  reqDesc: { flex: 1, fontSize: 14, fontWeight: "600", color: Colors.text, textAlign: "right" },
  reqAmount: { fontSize: 14, fontWeight: "bold", color: Colors.primaryLight, flexShrink: 0 },
  reqNotes: { fontSize: 12, color: Colors.textMuted, textAlign: "right", marginBottom: 8 },
  reqFooter: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, marginTop: 4,
  },
  reqDate: { fontSize: 11, color: Colors.textMuted },
  reqBtns: { flexDirection: "row-reverse", gap: 8 },
  reqBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, minWidth: 60, alignItems: "center" },
  reqBtnText: { fontSize: 12, fontWeight: "bold" },
});
