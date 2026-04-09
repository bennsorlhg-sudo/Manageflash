import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/context/ThemeContext";
import type { ThemeColors } from "@/constants/colors";
import { apiGet, formatCurrency } from "@/utils/api";

const ROLE_COLOR = "#00BCD4";

export default function SupervisorDashboard() {
  const Colors = useColors();
  const styles = useMemo(() => makeSupervisorStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [kpi, setKpi] = useState({
    ownerTasks: 0,
    withdrawalTasks: 0,
    repairOpen: 0,
    installPending: 0,
  });
  const [subscriptionValue, setSubscriptionValue] = useState(0);
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);
  const [ownerTasksList, setOwnerTasksList] = useState<any[]>([]);
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [withdrawalTasks, setWithdrawalTasks] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [tasks, fieldTasks, repairTickets, installTickets, purchaseReqs, deliveries] =
        await Promise.all([
          apiGet("/tasks?myTasks=1", token).catch(() => []),
          apiGet("/field-tasks", token).catch(() => []),
          apiGet("/tickets/repair", token).catch(() => []),
          apiGet("/tickets/installation", token).catch(() => []),
          apiGet("/purchase-requests", token).catch(() => []),
          apiGet("/subscription-deliveries", token).catch(() => []),
        ]);

      /* مهامي: كلها مُسندة لي عبر myTasks=1 */
      const ownerTasks = (tasks as any[]).filter(
        (t: any) => t.status !== "completed" && t.status !== "cancelled"
      );
      const withdrawal = (fieldTasks as any[]).filter(
        (t: any) => t.taskType === "withdrawal" || t.type === "withdrawal"
      );
      const openRepair = (repairTickets as any[]).filter(
        (t: any) => t.status !== "completed" && t.status !== "archived"
      );
      const pendingInstall = (installTickets as any[]).filter(
        (t: any) => t.status !== "completed" && t.status !== "archived"
      );

      // قيمة الاشتراكات = مجموع التسليمات النقدية غير المؤكدة
      // نعرض آخر قيمة كراتب إجمالي بشكل تقريبي
      const cashDeliveries = (deliveries as any[]).filter((d: any) => d.cardType === "cash_delivery");
      const totalDelivered = cashDeliveries.reduce((s: number, d: any) => s + parseFloat(d.totalValue ?? "0"), 0);
      setSubscriptionValue(totalDelivered);

      setKpi({
        ownerTasks: ownerTasks.length,
        withdrawalTasks: withdrawal.length,
        repairOpen: openRepair.length,
        installPending: pendingInstall.length,
      });

      setPurchaseRequests((purchaseReqs as any[]).filter((r: any) => r.status === "pending").slice(0, 5));
      setOwnerTasksList(ownerTasks.slice(0, 5));
      setRecentTasks((fieldTasks as any[]).slice(0, 5));
      setWithdrawalTasks(withdrawal.slice(0, 5));
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={ROLE_COLOR} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ROLE_COLOR]} />}
      >
        {/* ─── رأس الصفحة ─── */}
        <View style={styles.header}>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.welcomeText}>المشرف — {user?.name}</Text>
            {/* مؤشر قيمة الاشتراكات */}
            <TouchableOpacity
              style={styles.subscriptionPill}
              onPress={() => router.push("/(supervisor)/subscription-delivery")}
            >
              <Ionicons name="cash-outline" size={14} color={ROLE_COLOR} />
              <Text style={styles.subscriptionPillText}>
                قيمة الاشتراكات: {formatCurrency(subscriptionValue)}
              </Text>
              <Ionicons name="chevron-forward" size={12} color={ROLE_COLOR} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => router.push("/(supervisor)/profile")}>
            <Ionicons name="person-circle" size={42} color={ROLE_COLOR} />
          </TouchableOpacity>
        </View>

        {/* ─── بطاقات KPI ─── */}
        <View style={styles.kpiRow}>
          <KpiCard label="مهام المالك"      value={kpi.ownerTasks}    icon="person"    color="#FF9800" onPress={() => router.push("/(supervisor)/tasks")} />
          <KpiCard label="مهام السحب"       value={kpi.withdrawalTasks} icon="arrow-down-circle" color="#F44336" onPress={() => router.push("/(supervisor)/tasks")} />
        </View>
        <View style={styles.kpiRow}>
          <KpiCard label="الإصلاح"           value={kpi.repairOpen}    icon="build"     color="#4CAF50" onPress={() => router.push("/(supervisor)/repair-ticket")} />
          <KpiCard label="التركيبات الجديدة" value={kpi.installPending} icon="add-circle" color="#2196F3" onPress={() => router.push("/(supervisor)/installation-tickets")} />
        </View>

        {/* ─── قسم إضافة المهام ─── */}
        <SectionHeader title="إضافة مهام" />
        <View style={styles.buttonRow}>
          <ActionBtn label="إصلاح"     icon="build"       color="#F44336" onPress={() => router.push("/(supervisor)/repair-ticket")} />
          <ActionBtn label="تركيب جديد" icon="add-circle"  color="#4CAF50" onPress={() => router.push("/(supervisor)/installation-tickets")} />
          <ActionBtn label="شراء"      icon="cart"        color="#FF9800" onPress={() => router.push("/(supervisor)/purchase-request")} />
        </View>

        {/* ─── قسم الإدارة ─── */}
        <SectionHeader title="الإدارة" />
        <View style={styles.buttonRow}>
          <ActionBtn label="قاعدة البيانات"     icon="server"   color="#2196F3" onPress={() => router.push("/(supervisor)/database")} />
          <ActionBtn label="إدارة المهندسين"    icon="people"   color="#9C27B0" onPress={() => router.push("/(supervisor)/engineer-management")} />
          <ActionBtn label="متابعة المهام"      icon="list"     color={ROLE_COLOR} onPress={() => router.push("/(supervisor)/tasks")} />
        </View>

        {/* ─── قسم المسؤول المالي ─── */}
        <SectionHeader title="المسؤول المالي" />
        <View style={styles.buttonRow}>
          <ActionBtn label="تسليم الاشتراكات" icon="cash"       color="#00BCD4" onPress={() => router.push("/(supervisor)/subscription-delivery")} />
          <ActionBtn label="جرد مالي"          icon="calculator" color="#673AB7" onPress={() => router.push("/(supervisor)/finance-audit")} />
        </View>

        {/* ─── طلبات الشراء ─── */}
        <ListSection
          title="طلبات الشراء"
          badge={purchaseRequests.length}
          badgeColor="#FF9800"
          empty="لا توجد طلبات شراء معلقة"
          onMore={() => router.push("/(supervisor)/purchase-request")}
        >
          {purchaseRequests.map((r) => (
            <ListCard key={r.id} onPress={() => router.push("/(supervisor)/purchase-request")}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle}>{r.description ?? r.itemName ?? "طلب شراء"}</Text>
                <StatusPill status={r.status} />
              </View>
              <Text style={styles.cardSub}>الكمية: {r.quantity ?? "—"} • الأولوية: {PRIORITY_AR[r.priority] ?? r.priority}</Text>
            </ListCard>
          ))}
        </ListSection>

        {/* ─── مهام المالك ─── */}
        <ListSection
          title="مهام المالك"
          badge={ownerTasksList.length}
          badgeColor="#FF9800"
          empty="لا توجد مهام من المالك"
          onMore={() => router.push("/(supervisor)/tasks")}
        >
          {ownerTasksList.map((t) => (
            <ListCard key={t.id} onPress={() => router.push("/(supervisor)/tasks")}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle}>{t.title ?? t.description ?? "مهمة"}</Text>
                <StatusPill status={t.status} />
              </View>
              {t.assigneeName && <Text style={styles.cardSub}>{t.assigneeName}</Text>}
            </ListCard>
          ))}
        </ListSection>

        {/* ─── آخر 5 مهام ─── */}
        <ListSection
          title="آخر 5 مهام"
          empty="لا توجد مهام"
          onMore={() => router.push("/(supervisor)/tasks")}
        >
          {recentTasks.map((t) => (
            <ListCard key={t.id} onPress={() => router.push("/(supervisor)/tasks")}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle}>{t.title ?? t.description ?? "مهمة"}</Text>
                <StatusPill status={t.status} />
              </View>
              {t.assigneeName && <Text style={styles.cardSub}>{t.assigneeName}</Text>}
            </ListCard>
          ))}
        </ListSection>

        {/* ─── مهام السحب ─── */}
        <ListSection
          title="مهام السحب"
          badge={withdrawalTasks.length}
          badgeColor="#F44336"
          empty="لا توجد مهام سحب"
          onMore={() => router.push("/(supervisor)/tasks")}
        >
          {withdrawalTasks.map((t) => (
            <ListCard key={t.id} onPress={() => router.push("/(supervisor)/tasks")}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle}>{t.title ?? t.description ?? "مهمة سحب"}</Text>
                <StatusPill status={t.status} />
              </View>
              {t.assigneeName && <Text style={styles.cardSub}>{t.assigneeName}</Text>}
            </ListCard>
          ))}
        </ListSection>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

/* ──────────────────────────────────────────
   مكونات مساعدة
────────────────────────────────────────── */
const PRIORITY_AR: Record<string, string> = {
  low: "منخفض", medium: "متوسط", high: "عالي", urgent: "عاجل",
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:     { label: "معلق",       color: "#FF9800" },
  in_progress: { label: "جاري",       color: "#2196F3" },
  completed:   { label: "مكتملة",     color: "#4CAF50" },
  approved:    { label: "موافقة",      color: "#4CAF50" },
  rejected:    { label: "مرفوض",      color: "#F44336" },
  new:         { label: "جديد",       color: "#9C27B0" },
  preparing:   { label: "تجهيز",      color: "#FF9800" },
  archived:    { label: "مؤرشف",     color: "#8B9CB3" },
};

function StatusPill({ status }: { status?: string }) {
  const Colors = useColors();
  const styles = useMemo(() => makeSupervisorStyles(Colors), [Colors]);
  const info = STATUS_MAP[status ?? ""] ?? { label: status ?? "", color: Colors.textSecondary };
  return (
    <View style={[styles.pill, { backgroundColor: info.color + "22" }]}>
      <Text style={[styles.pillText, { color: info.color }]}>{info.label}</Text>
    </View>
  );
}

function KpiCard({
  label, value, icon, color, onPress,
}: { label: string; value: number; icon: string; color: string; onPress: () => void }) {
  const Colors = useColors();
  const styles = useMemo(() => makeSupervisorStyles(Colors), [Colors]);
  return (
    <TouchableOpacity style={[styles.kpiCard, { borderColor: color + "44" }]} onPress={onPress}>
      <View style={[styles.kpiIconCircle, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  const Colors = useColors();
  const styles = useMemo(() => makeSupervisorStyles(Colors), [Colors]);
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function ActionBtn({
  label, icon, color, onPress,
}: { label: string; icon: string; color: string; onPress: () => void }) {
  const Colors = useColors();
  const styles = useMemo(() => makeSupervisorStyles(Colors), [Colors]);
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
      <View style={[styles.actionCircle, { borderColor: color + "44" }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ListSection({
  title, badge, badgeColor, empty, children, onMore,
}: {
  title: string; badge?: number; badgeColor?: string;
  empty: string; children?: React.ReactNode; onMore?: () => void;
}) {
  const Colors = useColors();
  const styles = useMemo(() => makeSupervisorStyles(Colors), [Colors]);
  const hasItems = React.Children.count(children) > 0;
  return (
    <View style={styles.listSection}>
      <View style={styles.listSectionHeader}>
        <TouchableOpacity onPress={onMore}>
          <Text style={styles.moreText}>عرض الكل</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
          <Text style={styles.listSectionTitle}>{title}</Text>
          {!!badge && badge > 0 && (
            <View style={[styles.badge, { backgroundColor: (badgeColor ?? "#FF9800") + "33" }]}>
              <Text style={[styles.badgeText, { color: badgeColor ?? "#FF9800" }]}>{badge}</Text>
            </View>
          )}
        </View>
      </View>
      {hasItems ? children : (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{empty}</Text>
        </View>
      )}
    </View>
  );
}

function ListCard({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  const Colors = useColors();
  const styles = useMemo(() => makeSupervisorStyles(Colors), [Colors]);
  return (
    <TouchableOpacity style={styles.listCard} onPress={onPress}>
      {children}
    </TouchableOpacity>
  );
}

/* ──────────────────────────────────────────
   Styles
────────────────────────────────────────── */
function makeSupervisorStyles(C: ThemeColors) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: C.background },
    scrollContent: { padding: 20 },

    header: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 20,
    },
    welcomeText: { fontSize: 18, fontWeight: "bold", color: C.text, textAlign: "right" },

    subscriptionPill: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 4,
      marginTop: 6,
      backgroundColor: "#00BCD422",
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: "#00BCD444",
    },
    subscriptionPillText: {
      fontSize: 12,
      color: "#00BCD4",
      fontWeight: "600",
    },

    kpiRow: {
      flexDirection: "row-reverse",
      gap: 12,
      marginBottom: 12,
    },
    kpiCard: {
      flex: 1,
      backgroundColor: C.surface,
      borderRadius: 14,
      padding: 14,
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
    },
    kpiIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: "center",
      alignItems: "center",
    },
    kpiValue: { fontSize: 24, fontWeight: "bold" },
    kpiLabel: { fontSize: 12, color: C.textSecondary, textAlign: "center" },

    sectionTitle: {
      fontSize: 15,
      fontWeight: "bold",
      color: C.text,
      textAlign: "right",
      marginTop: 8,
      marginBottom: 10,
    },
    buttonRow: {
      flexDirection: "row-reverse",
      gap: 12,
      marginBottom: 18,
      flexWrap: "wrap",
    },
    actionBtn:    { alignItems: "center", width: 76 },
    actionCircle: {
      width: 54, height: 54, borderRadius: 27,
      backgroundColor: C.surface,
      justifyContent: "center", alignItems: "center",
      marginBottom: 6, borderWidth: 1,
    },
    actionLabel:  { fontSize: 10, color: C.textSecondary, textAlign: "center" },

    listSection:  { marginBottom: 16 },
    listSectionHeader: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    listSectionTitle: { fontSize: 15, fontWeight: "bold", color: C.text },
    moreText:     { fontSize: 12, color: ROLE_COLOR },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    badgeText:    { fontSize: 12, fontWeight: "bold" },

    listCard: {
      backgroundColor: C.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: C.border,
    },
    cardRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    cardTitle: { fontSize: 14, fontWeight: "bold", color: C.text, textAlign: "right", flex: 1, marginLeft: 8 },
    cardSub:   { fontSize: 12, color: C.textSecondary, textAlign: "right" },

    emptyBox: {
      backgroundColor: C.surface,
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
      borderWidth: 1,
      borderColor: C.border,
    },
    emptyText: { fontSize: 13, color: C.textSecondary },

    pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    pillText: { fontSize: 11, fontWeight: "600" },
  });
}
