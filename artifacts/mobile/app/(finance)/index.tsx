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
import { apiGet, apiPatch, formatCurrency, formatDate } from "@/utils/api";

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

/* ─────────────────────────────────────────
   عنوان قسم
───────────────────────────────────────── */
function SectionHeader({ title, count, color }: { title: string; count?: number; color?: string }) {
  const c = color ?? Colors.primary;
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionDot, { backgroundColor: c }]} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {count != null && count > 0 && (
        <View style={[styles.badge, { backgroundColor: c + "28" }]}>
          <Text style={[styles.badgeText, { color: c }]}>{count}</Text>
        </View>
      )}
    </View>
  );
}

const PRIORITY_LABEL: Record<string, { label: string; color: string }> = {
  urgent: { label: "عاجل",   color: "#EF5350" },
  high:   { label: "عالي",   color: "#FF9800" },
  medium: { label: "متوسط",  color: "#42A5F5" },
  low:    { label: "منخفض",  color: "#66BB6A" },
};

export default function FinanceDashboard() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* ─── الأرقام الست ─── */
  const [totalCustody, setTotalCustody]   = useState(0);
  const [cashBalance, setCashBalance]     = useState(0);
  const [cardsValue, setCardsValue]       = useState(0);
  const [agentCustody, setAgentCustody]   = useState(0);
  const [totalLoans, setTotalLoans]       = useState(0);
  const [totalDebts, setTotalDebts]       = useState(0);

  /* ─── مهام المالك ─── */
  const [ownerTasks, setOwnerTasks]       = useState<any[]>([]);
  const [completingTask, setCompletingTask] = useState<number | null>(null);

  /* ─── طلبات الشراء ─── */
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [summary, tasks, reqs] = await Promise.all([
        apiGet("/finances/summary", token),
        apiGet("/tasks?targetRole=finance_manager", token),
        apiGet("/purchase-requests", token),
      ]);

      setTotalCustody(summary.totalCustody ?? 0);
      setCashBalance(summary.cashBalance ?? 0);
      setCardsValue(summary.cardsValue ?? 0);
      setAgentCustody(summary.agentCustody ?? 0);
      setTotalLoans(summary.totalLoans ?? 0);
      setTotalDebts(summary.totalDebts ?? 0);

      setOwnerTasks(
        (tasks as any[]).filter((t: any) => t.status === "pending" || t.status === "in_progress")
      );
      setPurchaseRequests(
        (reqs as any[]).filter((r: any) => r.status === "pending")
      );
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── تنفيذ مهمة ─── */
  const handleCompleteTask = async (id: number) => {
    setCompletingTask(id);
    try {
      await apiPatch(`/tasks/${id}`, token, { status: "completed" });
      setOwnerTasks(prev => prev.filter(t => t.id !== id));
    } catch {} finally { setCompletingTask(null); }
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
        ══════════════════════════════════════ */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiRow}>
            <KPICard title="إجمالي العهدة"    value={totalCustody}  icon="briefcase"     color={Colors.primary}  subtitle="نقد + كروت + برودباند" />
            <KPICard title="الصندوق النقدي"   value={cashBalance}   icon="wallet"         color={Colors.success}  subtitle="النقد الفعلي" />
          </View>
          <View style={styles.kpiRow}>
            <KPICard title="إجمالي الكروت"   value={cardsValue}    icon="card"           color={Colors.info}     subtitle="قيمة إجمالية" />
            <KPICard title="عند المندوبين"    value={agentCustody}  icon="people"         color="#9C27B0"         subtitle="كروت مسلّمة" />
          </View>
          <View style={styles.kpiRow}>
            <KPICard title="السلف"            value={totalLoans}    icon="trending-up"    color={Colors.warning}  subtitle="مبيعات بسلفة" />
            <KPICard title="الديون"           value={totalDebts}    icon="trending-down"  color={Colors.error}    subtitle="التزامات الشبكة" />
          </View>
        </View>

        {/* ─── أزرار العمليات ─── */}
        <View style={styles.actionsBlock}>
          <View style={styles.actionRow}>
            <ActionBtn label="بيع"          icon="cart"           color={Colors.info}    onPress={() => router.push("/(finance)/sell")} />
            <ActionBtn label="صرف"          icon="arrow-up-circle" color={Colors.error}  onPress={() => router.push("/(finance)/disburse")} />
            <ActionBtn label="تحصيل"        icon="arrow-down-circle" color={Colors.success} onPress={() => router.push("/(finance)/collect")} />
          </View>
          <View style={styles.actionRow}>
            <ActionBtn label="إدارة العهدة" icon="briefcase"      color="#673AB7"        onPress={() => router.push("/(finance)/custody")} />
            <ActionBtn label="نقاط البيع"   icon="location"       color="#009688"        onPress={() => router.push("/(finance)/sales-points")} />
          </View>
          <View style={styles.actionRow}>
            <ActionBtn label="المصاريف"     icon="receipt"        color="#FF5722"        onPress={() => router.push("/(finance)/expenses")} />
            <ActionBtn label="ديون/سلف"    icon="stats-chart"    color="#795548"        onPress={() => router.push("/(finance)/debts-loans")} />
            <ActionBtn label="المبيعات"     icon="bar-chart"      color="#4CAF50"        onPress={() => router.push("/(finance)/sales")} />
          </View>
        </View>

        {/* ══════════════════════════════════════
            1. قائمة مهام المالك
        ══════════════════════════════════════ */}
        <SectionHeader title="مهام المالك" count={ownerTasks.length} color="#7E57C2" />

        {ownerTasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-done-circle-outline" size={26} color={Colors.success} />
            <Text style={styles.emptyText}>لا توجد مهام مفتوحة</Text>
          </View>
        ) : (
          ownerTasks.map((task: any) => (
            <View key={task.id} style={[styles.taskCard, { borderRightColor: "#7E57C2" }]}>
              {/* عنوان المهمة */}
              <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
              {task.description ? (
                <Text style={styles.taskDesc} numberOfLines={3}>{task.description}</Text>
              ) : null}
              {/* تذييل: تاريخ + زر */}
              <View style={styles.taskFooter}>
                <TouchableOpacity
                  style={[styles.doneBtn, completingTask === task.id && { opacity: 0.6 }]}
                  onPress={() => handleCompleteTask(task.id)}
                  disabled={completingTask === task.id}
                >
                  {completingTask === task.id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : (
                      <>
                        <Ionicons name="checkmark" size={13} color="#fff" />
                        <Text style={styles.doneBtnText}>تم التنفيذ</Text>
                      </>
                    )}
                </TouchableOpacity>
                <Text style={styles.taskDate}>{formatDate(task.createdAt)}</Text>
              </View>
            </View>
          ))
        )}

        {/* ══════════════════════════════════════
            2. قائمة المشتريات
        ══════════════════════════════════════ */}
        <SectionHeader title="طلبات الشراء" count={purchaseRequests.length} color={Colors.warning} />

        {purchaseRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={26} color={Colors.textMuted} />
            <Text style={styles.emptyText}>لا توجد طلبات شراء معلقة</Text>
          </View>
        ) : (
          purchaseRequests.map((req: any) => {
            const pri = PRIORITY_LABEL[req.priority ?? "medium"] ?? PRIORITY_LABEL.medium;
            return (
              <View key={req.id} style={[styles.purchaseCard, { borderRightColor: pri.color }]}>
                {/* رأس البطاقة: الصنف + الأولوية */}
                <View style={styles.purchaseTop}>
                  <View style={[styles.priBadge, { backgroundColor: pri.color + "22" }]}>
                    <Text style={[styles.priText, { color: pri.color }]}>{pri.label}</Text>
                  </View>
                  <Text style={styles.purchaseTitle} numberOfLines={2}>{req.description}</Text>
                </View>

                {/* الكمية */}
                {req.quantity != null && (
                  <View style={styles.purchaseMeta}>
                    <Ionicons name="layers-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.purchaseMetaText}>
                      الكمية: {req.quantity}{req.unit ? ` ${req.unit}` : ""}
                    </Text>
                  </View>
                )}

                {/* الوصف المختصر */}
                {req.notes ? (
                  <Text style={styles.purchaseNotes} numberOfLines={2}>{req.notes}</Text>
                ) : null}

                {/* التاريخ */}
                <Text style={styles.purchaseDate}>{formatDate(req.createdAt)}</Text>
              </View>
            );
          })
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
  actionsBlock: { gap: 8, marginBottom: 24 },
  actionRow: { flexDirection: "row-reverse", gap: 8 },
  actionBtn: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14,
    paddingVertical: 13, paddingHorizontal: 6, alignItems: "center",
    justifyContent: "center", gap: 6, borderWidth: 1,
  },
  actionIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  actionLabel: { fontSize: 11, color: Colors.text, fontWeight: "600", textAlign: "center" },

  /* ─── Section Header ─── */
  sectionHeader: {
    flexDirection: "row-reverse", alignItems: "center",
    gap: 8, marginBottom: 10, marginTop: 4,
  },
  sectionDot: { width: 4, height: 18, borderRadius: 2 },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: "bold", color: Colors.text, textAlign: "right" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: "bold" },

  /* ─── Empty State ─── */
  emptyCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 20,
    alignItems: "center", gap: 8, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 18,
  },
  emptyText: { fontSize: 13, color: Colors.textMuted },

  /* ─── Task Cards (مهام المالك) ─── */
  taskCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 8,
    borderRightWidth: 3,
  },
  taskTitle: { fontSize: 14, fontWeight: "700", color: Colors.text, textAlign: "right", marginBottom: 4 },
  taskDesc: { fontSize: 12, color: Colors.textSecondary, textAlign: "right", lineHeight: 18, marginBottom: 10 },
  taskFooter: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "center", borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10,
  },
  taskDate: { fontSize: 11, color: Colors.textMuted },
  doneBtn: {
    flexDirection: "row-reverse", alignItems: "center", gap: 5,
    backgroundColor: "#43A047", paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 8,
  },
  doneBtnText: { fontSize: 12, fontWeight: "bold", color: "#fff" },

  /* ─── Purchase Cards (طلبات الشراء) ─── */
  purchaseCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 8,
    borderRightWidth: 3,
  },
  purchaseTop: {
    flexDirection: "row-reverse", alignItems: "flex-start",
    gap: 8, marginBottom: 8,
  },
  purchaseTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: Colors.text, textAlign: "right" },
  priBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexShrink: 0 },
  priText: { fontSize: 11, fontWeight: "bold" },
  purchaseMeta: { flexDirection: "row-reverse", alignItems: "center", gap: 5, marginBottom: 4 },
  purchaseMetaText: { fontSize: 12, color: Colors.textSecondary },
  purchaseNotes: { fontSize: 12, color: Colors.textMuted, textAlign: "right", lineHeight: 17, marginBottom: 4 },
  purchaseDate: { fontSize: 11, color: Colors.textMuted, textAlign: "right" },
});
