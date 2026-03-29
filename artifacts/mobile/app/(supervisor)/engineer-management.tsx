import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, Modal, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, formatDate } from "@/utils/api";

interface Engineer {
  id: number;
  name: string;
  phone: string | null;
  role: string;
}

interface EngineerStats {
  pending: number;
  in_progress: number;
  completed: number;
  total: number;
}

export default function EngineerManagementScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [statsMap, setStatsMap] = useState<Record<number, EngineerStats>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  /* ─── مودال إسناد مهمة ─── */
  const [showTask, setShowTask] = useState(false);
  const [taskTarget, setTaskTarget] = useState<Engineer | null>(null);
  const [taskDesc, setTaskDesc] = useState("");
  const [sendingTask, setSendingTask] = useState(false);

  /* ─── مودال تفاصيل مهندس ─── */
  const [showDetail, setShowDetail] = useState(false);
  const [detailEng, setDetailEng] = useState<Engineer | null>(null);
  const [detailTasks, setDetailTasks] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [engData, tasks] = await Promise.all([
        apiGet("/users/engineers", token),
        apiGet("/tasks?targetRole=tech_engineer", token),
      ]);

      setEngineers(engData);

      /* حساب إحصائيات كل مهندس من المهام */
      const map: Record<number, EngineerStats> = {};
      (tasks as any[]).forEach((t: any) => {
        /* نحاول نطابق بالاسم لأن المهام تخزن targetPersonName */
        const eng = engData.find((e: Engineer) =>
          e.name && t.targetPersonName && e.name.trim() === t.targetPersonName.trim()
        );
        if (eng) {
          if (!map[eng.id]) map[eng.id] = { pending: 0, in_progress: 0, completed: 0, total: 0 };
          map[eng.id].total++;
          if (t.status === "pending") map[eng.id].pending++;
          else if (t.status === "in_progress") map[eng.id].in_progress++;
          else if (t.status === "completed") map[eng.id].completed++;
        }
      });
      setStatsMap(map);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = engineers.filter(e =>
    !search || e.name?.includes(search) || e.phone?.includes(search)
  );

  const openAssignTask = (eng: Engineer) => {
    setTaskTarget(eng); setTaskDesc(""); setShowTask(true);
  };

  const submitTask = async () => {
    if (!taskTarget || !taskDesc.trim()) return;
    setSendingTask(true);
    try {
      await apiPost("/tasks", token, {
        title: taskDesc,
        description: taskDesc,
        targetRole: "tech_engineer",
        targetPersonName: taskTarget.name,
      });
      setShowTask(false);
    } catch {} finally { setSendingTask(false); }
  };

  const openDetail = async (eng: Engineer) => {
    setDetailEng(eng); setDetailTasks([]); setShowDetail(true); setDetailLoading(true);
    try {
      const tasks = await apiGet(`/tasks?targetRole=tech_engineer`, token);
      const mine = (tasks as any[]).filter((t: any) =>
        t.targetPersonName && t.targetPersonName.trim() === eng.name.trim()
      );
      setDetailTasks(mine);
    } catch {} finally { setDetailLoading(false); }
  };

  const statColor = { pending: Colors.warning, in_progress: Colors.info, completed: Colors.success };
  const statLabel = { pending: "جديدة", in_progress: "جاري", completed: "مكتملة" };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.roles.supervisor} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>إدارة المهندسين</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search} onChangeText={setSearch}
          placeholder="بحث بالاسم أو الهاتف"
          placeholderTextColor={Colors.textMuted} textAlign="right"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
      >
        <Text style={styles.countText}>{filtered.length} مهندس</Text>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={60} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {engineers.length === 0 ? "لا يوجد مهندسون مسجلون" : "لا توجد نتائج"}
            </Text>
            {engineers.length === 0 && (
              <Text style={styles.emptyHint}>يمكن إضافة مهندسين من قسم إدارة الفريق لدى المالك</Text>
            )}
          </View>
        ) : filtered.map(eng => {
          const st = statsMap[eng.id];
          return (
            <TouchableOpacity key={eng.id} style={styles.card} onPress={() => openDetail(eng)} activeOpacity={0.8}>
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{eng.name?.charAt(0) ?? "م"}</Text>
                </View>
                <View style={styles.engInfo}>
                  <Text style={styles.engName}>{eng.name}</Text>
                  {eng.phone && <Text style={styles.engPhone}>{eng.phone}</Text>}
                  <View style={styles.roleTag}>
                    <Ionicons name="construct" size={11} color={Colors.roles.tech_engineer} />
                    <Text style={styles.roleTagText}>مهندس تقني</Text>
                  </View>
                </View>
              </View>

              {/* إحصائيات المهام */}
              {st && st.total > 0 ? (
                <View style={styles.statsRow}>
                  {(["pending", "in_progress", "completed"] as const).map(k => (
                    <View key={k} style={[styles.statBox, { backgroundColor: statColor[k] + "15" }]}>
                      <Text style={[styles.statNum, { color: statColor[k] }]}>{st[k]}</Text>
                      <Text style={[styles.statLabel, { color: statColor[k] }]}>{statLabel[k]}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noTasksText}>لا توجد مهام مسندة</Text>
              )}

              {/* أزرار */}
              <View style={styles.cardActions}>
                {eng.phone && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => Linking.openURL(`tel:${eng.phone}`)}
                  >
                    <Ionicons name="call" size={16} color={Colors.success} />
                    <Text style={[styles.actionBtnText, { color: Colors.success }]}>اتصال</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openAssignTask(eng)}
                >
                  <Ionicons name="add-circle" size={16} color={Colors.primary} />
                  <Text style={[styles.actionBtnText, { color: Colors.primary }]}>إسناد مهمة</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openDetail(eng)}
                >
                  <Ionicons name="list" size={16} color={Colors.info} />
                  <Text style={[styles.actionBtnText, { color: Colors.info }]}>المهام</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ══ مودال إسناد مهمة ══ */}
      <Modal visible={showTask} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>مهمة لـ {taskTarget?.name}</Text>
            <TextInput
              style={styles.dialogInput}
              value={taskDesc} onChangeText={setTaskDesc}
              placeholder="وصف المهمة..."
              placeholderTextColor={Colors.textMuted}
              textAlign="right" multiline numberOfLines={3}
              autoFocus
            />
            <View style={styles.dialogBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowTask(false)}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, (!taskDesc.trim() || sendingTask) && { opacity: 0.5 }]}
                onPress={submitTask}
                disabled={!taskDesc.trim() || sendingTask}
              >
                {sendingTask
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={styles.confirmBtnText}>إرسال</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ مودال تفاصيل مهمة ══ */}
      <Modal visible={showDetail} animationType="slide" transparent>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={() => setShowDetail(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>{detailEng?.name} — المهام</Text>
              <View style={{ width: 24 }} />
            </View>

            {detailLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
            ) : detailTasks.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="checkmark-circle-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>لا توجد مهام مسندة</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.sheetContent}>
                {detailTasks.map(t => {
                  const statusColors: Record<string, string> = {
                    pending: Colors.warning, in_progress: Colors.info, completed: Colors.success,
                  };
                  const statusLabels: Record<string, string> = {
                    pending: "جديدة", in_progress: "جاري", completed: "مكتملة",
                  };
                  const sc = statusColors[t.status] ?? Colors.textSecondary;
                  return (
                    <View key={t.id} style={styles.taskRow}>
                      <View>
                        <Text style={styles.taskTitle}>{t.title ?? t.description}</Text>
                        <Text style={styles.taskDate}>{formatDate(t.createdAt)}</Text>
                      </View>
                      <View style={[styles.taskBadge, { backgroundColor: sc + "20" }]}>
                        <Text style={[styles.taskBadgeText, { color: sc }]}>{statusLabels[t.status] ?? t.status}</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  searchRow: {
    flexDirection: "row-reverse", alignItems: "center",
    margin: 14, backgroundColor: Colors.surface, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  content: { paddingHorizontal: 14 },
  countText: { fontSize: 12, color: Colors.textMuted, textAlign: "right", marginBottom: 10 },
  empty: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
  emptyHint: { fontSize: 12, color: Colors.textMuted, textAlign: "center", paddingHorizontal: 40 },

  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: Colors.border,
  },
  cardTop: { flexDirection: "row-reverse", alignItems: "center", gap: 12, marginBottom: 12 },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: Colors.roles.tech_engineer + "30",
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 22, fontWeight: "bold", color: Colors.roles.tech_engineer },
  engInfo: { flex: 1, alignItems: "flex-end", gap: 4 },
  engName: { fontSize: 16, fontWeight: "bold", color: Colors.text },
  engPhone: { fontSize: 13, color: Colors.textSecondary },
  roleTag: {
    flexDirection: "row-reverse", alignItems: "center", gap: 4,
    backgroundColor: Colors.roles.tech_engineer + "18",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  roleTagText: { fontSize: 11, fontWeight: "bold", color: Colors.roles.tech_engineer },

  statsRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 12 },
  statBox: { flex: 1, borderRadius: 10, padding: 8, alignItems: "center" },
  statNum: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 10, fontWeight: "600", marginTop: 2 },
  noTasksText: { fontSize: 12, color: Colors.textMuted, textAlign: "right", marginBottom: 12 },

  cardActions: {
    flexDirection: "row-reverse", gap: 8, borderTopWidth: 1,
    borderTopColor: Colors.border, paddingTop: 10, marginTop: 4,
  },
  actionBtn: {
    flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border,
  },
  actionBtnText: { fontSize: 11, fontWeight: "600" },

  /* Dialog */
  overlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "center", alignItems: "center", padding: 20 },
  dialog: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, width: "100%", gap: 14 },
  dialogTitle: { fontSize: 16, fontWeight: "bold", color: Colors.text, textAlign: "right" },
  dialogInput: {
    backgroundColor: Colors.background, borderRadius: 10, padding: 12,
    color: Colors.text, borderWidth: 1, borderColor: Colors.border, textAlignVertical: "top",
  },
  dialogBtns: { flexDirection: "row-reverse", gap: 10 },
  cancelBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center",
    borderWidth: 1, borderColor: Colors.border,
  },
  cancelBtnText: { color: Colors.text, fontWeight: "600" },
  confirmBtn: { flex: 2, borderRadius: 10, paddingVertical: 12, alignItems: "center", backgroundColor: Colors.roles.supervisor },
  confirmBtnText: { color: "#FFF", fontWeight: "bold" },

  /* Sheet */
  sheetOverlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
  sheet: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "75%" },
  sheetHeader: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sheetTitle: { fontSize: 17, fontWeight: "bold", color: Colors.text },
  sheetContent: { padding: 16 },
  taskRow: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start",
    backgroundColor: Colors.surface, borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  taskTitle: { fontSize: 14, fontWeight: "600", color: Colors.text, textAlign: "right", flex: 1 },
  taskDate: { fontSize: 11, color: Colors.textMuted, textAlign: "right", marginTop: 3 },
  taskBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginRight: 8 },
  taskBadgeText: { fontSize: 11, fontWeight: "bold" },
});
