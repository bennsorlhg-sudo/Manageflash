import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Colors } from "@/constants/colors";
import { useColors } from "@/context/ThemeContext";
import type { ThemeColors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiDelete, formatDate } from "@/utils/api";

const SUP_COLOR = Colors.roles?.supervisor ?? "#00BCD4";

type Tab    = "all" | "installation" | "repair";
type Period = "all" | "week" | "month" | "year";

const PERIODS: { key: Period; label: string }[] = [
  { key: "all",   label: "الكل" },
  { key: "week",  label: "الأسبوع" },
  { key: "month", label: "الشهر" },
  { key: "year",  label: "السنة" },
];

const SERVICE_TYPE_AR: Record<string, string> = {
  hotspot_internal: "هوتسبوت داخلي",
  hotspot_external: "هوتسبوت خارجي",
  broadband:        "برودباند",
  broadband_internal: "برودباند داخلي",
  repair:           "إصلاح",
  installation:     "تركيب",
};

/* ════ المكوّن الرئيسي ════ */
export default function EngineerDetailScreen() {
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const { token } = useAuth();
  const C        = useColors();
  const s        = useMemo(() => makeStyles(C), [C]);

  const { engineerId, engineerName, period: initPeriod } = useLocalSearchParams<{
    engineerId: string; engineerName: string; period: Period;
  }>();

  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [period,      setPeriod]      = useState<Period>(initPeriod ?? "month");
  const [tab,         setTab]         = useState<Tab>("all");

  /* مودال تأكيد حذف إنجاز */
  const [deleteId,    setDeleteId]    = useState<number | null>(null);
  const [deleting,    setDeleting]    = useState(false);

  /* ─── جلب البيانات ─── */
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (engineerId) params.set("engineerId", engineerId);
      if (period !== "all") params.set("period", period);
      const data = await apiGet(`/achievements?${params.toString()}`, token).catch(() => []);
      setAchievements(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [token, engineerId, period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── فلترة بالتبويب ─── */
  const filtered = achievements.filter(a => {
    if (tab === "all") return true;
    return a.ticketType === tab;
  });

  /* ─── حذف إنجاز ─── */
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiDelete(`/achievements/${deleteId}`, token);
      setAchievements(prev => prev.filter(a => a.id !== deleteId));
      setDeleteId(null);
    } catch {} finally { setDeleting(false); }
  };

  /* ─── Loading ─── */
  if (loading) return (
    <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
      <ActivityIndicator size="large" color={SUP_COLOR} />
    </View>
  );

  const totalAll    = achievements.length;
  const totalRepair = achievements.filter(a => a.ticketType === "repair").length;
  const totalInstall = achievements.filter(a => a.ticketType === "installation").length;

  return (
    <View style={[s.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>

      {/* ── رأس الصفحة ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-forward" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{engineerName ?? "المهندس"}</Text>
          <Text style={s.subtitle}>سجل الإنجازات</Text>
        </View>
        <TouchableOpacity onPress={() => { setRefreshing(true); fetchData(true); }} style={s.refreshBtn}>
          <Ionicons name="refresh" size={20} color={SUP_COLOR} />
        </TouchableOpacity>
      </View>

      {/* ── فلتر الفترة ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.periodScroll} contentContainerStyle={s.periodRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[s.periodBtn, period === p.key && { backgroundColor: SUP_COLOR + "22", borderColor: SUP_COLOR }]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[s.periodBtnText, period === p.key && { color: SUP_COLOR, fontWeight: "bold" }]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── إحصائيات سريعة ── */}
      <View style={s.statsRow}>
        <StatPill label="إجمالي" count={totalAll}    color={SUP_COLOR}      active={tab === "all"}          onPress={() => setTab("all")} />
        <StatPill label="تركيب"  count={totalInstall} color={Colors.success}  active={tab === "installation"} onPress={() => setTab("installation")} />
        <StatPill label="إصلاح"  count={totalRepair}  color={Colors.error}    active={tab === "repair"}       onPress={() => setTab("repair")} />
      </View>

      {/* ── قائمة الإنجازات ── */}
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(true); }} tintColor={SUP_COLOR} />}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="trophy-outline" size={52} color={C.textMuted} />
            <Text style={s.emptyText}>لا توجد إنجازات في هذه الفترة</Text>
          </View>
        ) : (
          filtered.map(achiev => (
            <AchievCard
              key={achiev.id}
              achiev={achiev}
              C={C}
              onDelete={() => setDeleteId(achiev.id)}
            />
          ))
        )}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ════ مودال تأكيد الحذف ════ */}
      <Modal visible={!!deleteId} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.deleteCard}>
            <View style={[s.deleteIconCircle, { backgroundColor: Colors.error + "18" }]}>
              <Ionicons name="trash" size={32} color={Colors.error} />
            </View>
            <Text style={[s.deleteTitle, { color: C.text }]}>حذف الإنجاز؟</Text>
            <Text style={[s.deleteMsg, { color: C.textSecondary }]}>
              سيتم حذف هذا الإنجاز من سجل المهندس نهائياً.
            </Text>
            <View style={s.deleteActions}>
              <TouchableOpacity style={[s.deleteBtn, { borderWidth: 1, borderColor: C.border }]} onPress={() => setDeleteId(null)}>
                <Text style={{ color: C.textSecondary, fontWeight: "600" }}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.deleteBtn, { backgroundColor: Colors.error }]}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: "#fff", fontWeight: "bold" }}>حذف</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ════ بطاقة إنجاز ════ */
function AchievCard({ achiev, C, onDelete }: { achiev: any; C: ThemeColors; onDelete: () => void }) {
  const isInstall = achiev.ticketType === "installation";
  const typeColor = isInstall ? Colors.success : Colors.error;
  const typeLabel = isInstall ? "تركيب" : "إصلاح";

  const svcLabel = achiev.serviceType
    ? (achiev.serviceType === "hotspot_internal" ? "هوتسبوت داخلي" :
       achiev.serviceType === "hotspot_external" ? "هوتسبوت خارجي" :
       achiev.serviceType === "broadband_internal" ? "برودباند داخلي" :
       achiev.serviceType === "broadband" ? "برودباند" : achiev.serviceType)
    : null;

  return (
    <View style={[ac.card, { backgroundColor: C.surface, borderColor: C.border, borderRightColor: typeColor }]}>
      <View style={ac.head}>
        <View style={[ac.typeBadge, { backgroundColor: typeColor + "18" }]}>
          <Ionicons name={isInstall ? "add-circle" : "build"} size={13} color={typeColor} />
          <Text style={[ac.typeText, { color: typeColor }]}>{typeLabel}</Text>
        </View>
        {achiev.serviceNumber && (
          <Text style={[ac.serviceNum, { color: C.textSecondary }]}>#{achiev.serviceNumber}</Text>
        )}
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={16} color={Colors.error} />
        </TouchableOpacity>
      </View>

      {achiev.clientName && (
        <View style={ac.row}>
          <Ionicons name="person-outline" size={13} color={C.textMuted} />
          <Text style={[ac.rowText, { color: C.text }]}>{achiev.clientName}</Text>
        </View>
      )}
      {svcLabel && (
        <View style={ac.row}>
          <Ionicons name="construct-outline" size={13} color={C.textMuted} />
          <Text style={[ac.rowText, { color: C.textSecondary }]}>{svcLabel}</Text>
        </View>
      )}
      <View style={ac.row}>
        <Ionicons name="person-circle-outline" size={13} color={C.textMuted} />
        <Text style={[ac.rowText, { color: C.textMuted }]}>أرشفه: {achiev.archivedByName ?? "—"}</Text>
      </View>
      <View style={ac.row}>
        <Ionicons name="calendar-outline" size={13} color={C.textMuted} />
        <Text style={[ac.rowText, { color: C.textMuted }]}>{formatDate(achiev.archivedAt)}</Text>
      </View>
    </View>
  );
}

/* ════ SummaryPill ════ */
function StatPill({ label, count, color, active, onPress }: {
  label: string; count: number; color: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[sp.pill, active && { backgroundColor: color + "18", borderColor: color }]}
      onPress={onPress}
    >
      <Text style={[sp.count, active && { color }]}>{count}</Text>
      <Text style={[sp.label, active && { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ════ أنماط ════ */
function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container:     { flex: 1, backgroundColor: C.background },
    header:        { flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
    title:         { fontSize: 17, fontWeight: "bold", color: C.text, textAlign: "right" },
    subtitle:      { fontSize: 12, color: C.textMuted, textAlign: "right" },
    refreshBtn:    { padding: 6 },
    periodScroll:  { maxHeight: 48 },
    periodRow:     { flexDirection: "row-reverse", paddingHorizontal: 14, paddingBottom: 10, gap: 8 },
    periodBtn:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface },
    periodBtnText: { fontSize: 13, color: C.textSecondary },
    statsRow:      { flexDirection: "row-reverse", paddingHorizontal: 14, paddingBottom: 10, gap: 8 },
    content:       { padding: 14, gap: 10 },
    emptyBox:      { alignItems: "center", paddingVertical: 50, gap: 10 },
    emptyText:     { fontSize: 15, color: C.textMuted },
    overlay:       { flex: 1, backgroundColor: "#00000088", justifyContent: "center", alignItems: "center", padding: 24 },
    deleteCard:    { backgroundColor: C.surface, borderRadius: 16, padding: 24, gap: 12, width: "100%", alignItems: "center" },
    deleteIconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
    deleteTitle:   { fontSize: 17, fontWeight: "bold" },
    deleteMsg:     { fontSize: 13, textAlign: "center", lineHeight: 20 },
    deleteActions: { flexDirection: "row-reverse", gap: 10, width: "100%" },
    deleteBtn:     { flex: 1, padding: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  });
}

const ac = StyleSheet.create({
  card:      { borderRadius: 12, borderWidth: 1, borderRightWidth: 4, padding: 12, gap: 6 },
  head:      { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 4 },
  typeBadge: { flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  typeText:  { fontSize: 12, fontWeight: "600" },
  serviceNum:{ fontSize: 12, flex: 1, textAlign: "right" },
  row:       { flexDirection: "row-reverse", alignItems: "center", gap: 5 },
  rowText:   { fontSize: 13 },
});

const sp = StyleSheet.create({
  pill:  { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface, gap: 3 },
  count: { fontSize: 18, fontWeight: "bold", color: Colors.text },
  label: { fontSize: 11, color: Colors.textMuted },
});
