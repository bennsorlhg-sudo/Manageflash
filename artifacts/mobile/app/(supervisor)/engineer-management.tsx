import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, Modal, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useColors } from "@/context/ThemeContext";
import type { ThemeColors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost } from "@/utils/api";

const SUP_COLOR = Colors.roles?.supervisor ?? "#00BCD4";

/* ── أنواع ── */
interface Engineer { id: number; name: string; phone: string | null; role: string; }
interface AchievSummary { engineerId: number | null; engineerName: string; total: number; repairs: number; installations: number; }

type Period = "all" | "week" | "month" | "year";
const PERIODS: { key: Period; label: string }[] = [
  { key: "all",   label: "الكل" },
  { key: "week",  label: "هذا الأسبوع" },
  { key: "month", label: "هذا الشهر" },
  { key: "year",  label: "هذه السنة" },
];

/* ════ المكوّن الرئيسي ════ */
export default function EngineerManagementScreen() {
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const { token } = useAuth();
  const C        = useColors();
  const s        = useMemo(() => makeStyles(C), [C]);

  const [engineers,   setEngineers]   = useState<Engineer[]>([]);
  const [achievements, setAchievements] = useState<AchievSummary[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [period,      setPeriod]      = useState<Period>("month");
  const [search,      setSearch]      = useState("");

  /* مودال إسناد مهمة */
  const [taskTarget,  setTaskTarget]  = useState<Engineer | null>(null);
  const [taskDesc,    setTaskDesc]    = useState("");
  const [sendingTask, setSendingTask] = useState(false);
  const [taskError,   setTaskError]   = useState("");

  /* ─── جلب البيانات ─── */
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [engs, achiev] = await Promise.all([
        apiGet("/users/engineers", token).catch(() => []),
        apiGet(`/achievements/summary${period !== "all" ? `?period=${period}` : ""}`, token).catch(() => []),
      ]);
      setEngineers(Array.isArray(engs) ? engs : []);
      setAchievements(Array.isArray(achiev) ? achiev : []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [token, period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── إسناد مهمة ─── */
  const sendTask = async () => {
    if (!taskTarget || !taskDesc.trim()) { setTaskError("أدخل وصف المهمة"); return; }
    setSendingTask(true);
    setTaskError("");
    try {
      await apiPost("/tasks", token, { description: taskDesc.trim(), targetUserId: taskTarget.id, targetRole: "tech_engineer" });
      setTaskTarget(null);
      setTaskDesc("");
    } catch {
      setTaskError("فشل في إرسال المهمة");
    } finally { setSendingTask(false); }
  };

  /* ─── بحث ─── */
  const filtered = engineers.filter(e => !search.trim() || e.name.includes(search.trim()));

  const totalAchiev = achievements.reduce((s, a) => s + a.total, 0);
  const totalRepairs = achievements.reduce((s, a) => s + a.repairs, 0);
  const totalInstalls = achievements.reduce((s, a) => s + a.installations, 0);

  const getAchievForEng = (name: string) => achievements.find(a => a.engineerName === name);

  /* ─── Loading ─── */
  if (loading) return (
    <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
      <ActivityIndicator size="large" color={SUP_COLOR} />
    </View>
  );

  return (
    <View style={[s.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>

      {/* ── رأس الصفحة ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-forward" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={s.title}>إدارة المهندسين</Text>
        <TouchableOpacity onPress={() => { setRefreshing(true); fetchData(true); }} style={s.refreshBtn}>
          <Ionicons name="refresh" size={20} color={SUP_COLOR} />
        </TouchableOpacity>
      </View>

      {/* ── فلتر الفترة الزمنية ── */}
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

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(true); }} tintColor={SUP_COLOR} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── بطاقة الملخص ── */}
        <View style={s.summaryCard}>
          <View style={s.summaryHeader}>
            <Ionicons name="trophy" size={20} color="#FFD700" />
            <Text style={s.summaryTitle}>إنجازات الفريق</Text>
            <Text style={s.summaryPeriodLabel}>{PERIODS.find(p => p.key === period)?.label}</Text>
          </View>
          <View style={s.summaryStats}>
            <View style={s.statBox}>
              <Text style={s.statNum}>{totalAchiev}</Text>
              <Text style={s.statLabel}>إجمالي الإنجازات</Text>
            </View>
            <View style={[s.statBox, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.border }]}>
              <Text style={[s.statNum, { color: Colors.error }]}>{totalRepairs}</Text>
              <Text style={s.statLabel}>إصلاحات</Text>
            </View>
            <View style={s.statBox}>
              <Text style={[s.statNum, { color: Colors.success }]}>{totalInstalls}</Text>
              <Text style={s.statLabel}>تركيبات</Text>
            </View>
          </View>
        </View>

        {/* ── بحث ── */}
        <View style={s.searchRow}>
          <Ionicons name="search" size={16} color={C.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="بحث باسم المهندس..."
            placeholderTextColor={C.textMuted}
            value={search}
            onChangeText={setSearch}
            textAlign="right"
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── قائمة المهندسين ── */}
        {filtered.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="people-outline" size={52} color={C.textMuted} />
            <Text style={s.emptyText}>لا يوجد مهندسون</Text>
          </View>
        ) : (
          filtered.map(eng => {
            const achiev = getAchievForEng(eng.name);
            return (
              <EngineerCard
                key={eng.id}
                engineer={eng}
                achiev={achiev}
                C={C}
                onTask={() => { setTaskTarget(eng); setTaskDesc(""); setTaskError(""); }}
                onDetail={() => router.push({ pathname: "/(supervisor)/engineer-detail", params: { engineerId: String(eng.id), engineerName: eng.name, period } } as any)}
              />
            );
          })
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ════ مودال إسناد مهمة ════ */}
      <Modal visible={!!taskTarget} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.taskModal}>
            <Text style={s.taskModalTitle}>إسناد مهمة</Text>
            {taskTarget && <Text style={s.taskModalSub}>{taskTarget.name}</Text>}
            <TextInput
              style={s.taskInput}
              placeholder="وصف المهمة..."
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={4}
              value={taskDesc}
              onChangeText={(t) => { setTaskDesc(t); setTaskError(""); }}
              textAlign="right"
              textAlignVertical="top"
            />
            {!!taskError && <Text style={s.taskError}>{taskError}</Text>}
            <View style={s.taskModalBtns}>
              <TouchableOpacity style={s.taskCancelBtn} onPress={() => setTaskTarget(null)}>
                <Text style={s.taskCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.taskSendBtn, sendingTask && { opacity: 0.6 }]} onPress={sendTask} disabled={sendingTask}>
                {sendingTask
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <>
                      <Ionicons name="send" size={16} color="#fff" />
                      <Text style={s.taskSendText}>إرسال</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ════ بطاقة مهندس ════ */
function EngineerCard({ engineer, achiev, C, onTask, onDetail }: {
  engineer: Engineer;
  achiev: AchievSummary | undefined;
  C: ThemeColors;
  onTask: () => void;
  onDetail: () => void;
}) {
  const hasPhone = !!engineer.phone;
  const total    = achiev?.total ?? 0;
  const repairs  = achiev?.repairs ?? 0;
  const installs = achiev?.installations ?? 0;

  return (
    <View style={[ec.card, { backgroundColor: C.surface, borderColor: C.border }]}>
      {/* رأس البطاقة */}
      <View style={ec.head}>
        <View style={[ec.avatar, { backgroundColor: SUP_COLOR + "22" }]}>
          <Ionicons name="person" size={22} color={SUP_COLOR} />
        </View>
        <View style={ec.nameBox}>
          <Text style={[ec.name, { color: C.text }]}>{engineer.name}</Text>
          {hasPhone && (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${engineer.phone}`)}>
              <Text style={[ec.phone, { color: Colors.success }]}>{engineer.phone}</Text>
            </TouchableOpacity>
          )}
        </View>
        {total > 0 && (
          <View style={ec.trophyBadge}>
            <Ionicons name="trophy" size={14} color="#FFD700" />
            <Text style={ec.trophyCount}>{total}</Text>
          </View>
        )}
      </View>

      {/* إنجازات المهندس في الفترة */}
      <View style={[ec.achievRow, { borderColor: C.border }]}>
        <View style={ec.achievCell}>
          <Text style={ec.achievNum}>{total}</Text>
          <Text style={[ec.achievLabel, { color: C.textMuted }]}>إجمالي</Text>
        </View>
        <View style={[ec.achievCell, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.border }]}>
          <Text style={[ec.achievNum, { color: Colors.error }]}>{repairs}</Text>
          <Text style={[ec.achievLabel, { color: C.textMuted }]}>إصلاح</Text>
        </View>
        <View style={ec.achievCell}>
          <Text style={[ec.achievNum, { color: Colors.success }]}>{installs}</Text>
          <Text style={[ec.achievLabel, { color: C.textMuted }]}>تركيب</Text>
        </View>
      </View>

      {/* أزرار الإجراءات */}
      <View style={ec.btnRow}>
        <TouchableOpacity style={[ec.btn, { backgroundColor: SUP_COLOR + "18", borderColor: SUP_COLOR + "55" }]} onPress={onDetail}>
          <Ionicons name="bar-chart-outline" size={15} color={SUP_COLOR} />
          <Text style={[ec.btnText, { color: SUP_COLOR }]}>تفاصيل الإنجازات</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[ec.btn, { backgroundColor: Colors.warning + "18", borderColor: Colors.warning + "55" }]} onPress={onTask}>
          <Ionicons name="send-outline" size={15} color={Colors.warning} />
          <Text style={[ec.btnText, { color: Colors.warning }]}>إسناد مهمة</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ════ أنماط ════ */
function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: C.background },
    header:       { flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
    title:        { flex: 1, fontSize: 18, fontWeight: "bold", color: C.text, textAlign: "right" },
    refreshBtn:   { padding: 6 },
    periodScroll: { maxHeight: 48 },
    periodRow:    { flexDirection: "row-reverse", paddingHorizontal: 14, paddingBottom: 10, gap: 8 },
    periodBtn:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface },
    periodBtnText:{ fontSize: 13, color: C.textSecondary },
    content:      { padding: 14, gap: 12 },
    summaryCard:  { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
    summaryHeader:{ flexDirection: "row-reverse", alignItems: "center", padding: 14, gap: 8, backgroundColor: SUP_COLOR + "12" },
    summaryTitle: { flex: 1, fontSize: 15, fontWeight: "bold", color: C.text, textAlign: "right" },
    summaryPeriodLabel: { fontSize: 12, color: C.textMuted },
    summaryStats: { flexDirection: "row-reverse" },
    statBox:      { flex: 1, alignItems: "center", paddingVertical: 14 },
    statNum:      { fontSize: 22, fontWeight: "bold", color: C.text },
    statLabel:    { fontSize: 11, color: C.textMuted, marginTop: 2 },
    searchRow:    { flexDirection: "row-reverse", alignItems: "center", backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
    searchInput:  { flex: 1, fontSize: 14, color: C.text },
    emptyBox:     { alignItems: "center", paddingVertical: 50, gap: 10 },
    emptyText:    { fontSize: 15, color: C.textMuted },
    overlay:      { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
    taskModal:    { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
    taskModalTitle:{ fontSize: 17, fontWeight: "bold", color: C.text, textAlign: "center" },
    taskModalSub: { fontSize: 14, color: C.textSecondary, textAlign: "center" },
    taskInput:    { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 14, color: C.text, minHeight: 100, backgroundColor: C.background },
    taskError:    { color: Colors.error, fontSize: 13, textAlign: "center" },
    taskModalBtns:{ flexDirection: "row-reverse", gap: 10 },
    taskCancelBtn:{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: "center" },
    taskCancelText:{ fontSize: 14, color: C.textSecondary },
    taskSendBtn:  { flex: 1, padding: 14, borderRadius: 12, backgroundColor: SUP_COLOR, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    taskSendText: { fontSize: 14, fontWeight: "bold", color: "#fff" },
  });
}

const ec = StyleSheet.create({
  card:      { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: 2 },
  head:      { flexDirection: "row-reverse", alignItems: "center", padding: 14, gap: 10 },
  avatar:    { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  nameBox:   { flex: 1, gap: 2 },
  name:      { fontSize: 15, fontWeight: "bold", textAlign: "right" },
  phone:     { fontSize: 13, textAlign: "right" },
  trophyBadge:{ flexDirection: "row", alignItems: "center", backgroundColor: "#FFD70022", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
  trophyCount:{ fontSize: 13, fontWeight: "bold", color: "#FFD700" },
  achievRow: { flexDirection: "row-reverse", borderTopWidth: 1 },
  achievCell:{ flex: 1, alignItems: "center", paddingVertical: 12 },
  achievNum: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  achievLabel:{ fontSize: 11, marginTop: 2 },
  btnRow:    { flexDirection: "row-reverse", gap: 8, padding: 12 },
  btn:       { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", padding: 10, borderRadius: 10, borderWidth: 1, gap: 5 },
  btnText:   { fontSize: 12, fontWeight: "600" },
});
