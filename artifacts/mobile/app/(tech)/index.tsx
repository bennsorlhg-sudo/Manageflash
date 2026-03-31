import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Modal, TextInput, ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";
import { apiGet, apiPost, apiPatch } from "@/utils/api";

/* ═══════════════════════════════════════════
   أنواع البيانات
═══════════════════════════════════════════ */
type TabKey = "new" | "inprogress" | "completed";

interface UnifiedTask {
  key: string;
  source: "repair" | "install" | "field" | "general";
  sourceId: number;
  kind: string;
  serviceNumber: string;
  clientName: string | null;
  location: string | null;
  locationUrl: string | null;
  phone: string | null;
  status: string;
  rawStatus: string;
  completedAt: string | null;
  createdAt: string;
  notes: string | null;
  problemDescription: string | null;
}

/* ═══════════════════════════════════════════
   تحويل الـ status → تبويب
═══════════════════════════════════════════ */
const toTab = (s: string): TabKey => {
  if (["new", "pending"].includes(s)) return "new";
  if (["in_progress", "preparing"].includes(s)) return "inprogress";
  return "completed";
};

/* ═══════════════════════════════════════════
   نوع المهمة بالعربي
═══════════════════════════════════════════ */
const kindLabel = (source: string, rawType: string): string => {
  if (source === "repair") return "إصلاح";
  if (source === "install") return "تركيب";
  if (source === "general") return "مهمة";
  const m: Record<string, string> = {
    repair: "إصلاح",
    installation: "تركيب",
    install: "تركيب",
    external: "خارجي",
    hotspot_external: "خارجي",
    pull: "سحب",
    sach: "سحب",
  };
  return m[rawType] ?? rawType;
};

/* ═══════════════════════════════════════════
   ألوان الأنواع
═══════════════════════════════════════════ */
const kindColor = (kind: string): string => {
  if (kind === "إصلاح") return Colors.error;
  if (kind === "تركيب") return Colors.success;
  if (kind === "خارجي") return Colors.warning;
  if (kind === "سحب") return "#9C27B0";
  return Colors.roles.tech_engineer;
};

/* ═══════════════════════════════════════════
   تنسيق الوقت
═══════════════════════════════════════════ */
const fmtTime = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
};

const isToday = (iso: string | null): boolean => {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
         d.getMonth() === now.getMonth() &&
         d.getDate() === now.getDate();
};

/* ═══════════════════════════════════════════
   الشاشة الرئيسية
═══════════════════════════════════════════ */
export default function TechEngineerHomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>("new");
  const [tasks, setTasks] = useState<UnifiedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [completeTask, setCompleteTask] = useState<UnifiedTask | null>(null);
  const [completeNotes, setCompleteNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");

  const [viewTask, setViewTask] = useState<UnifiedTask | null>(null);

  const myName = user?.name?.trim() ?? "";

  const isAssignedToMe = (name: string | null | undefined) =>
    !name || name.trim() === "" || name.trim() === myName;

  /* ═══ جلب البيانات ═══ */
  const fetchAll = useCallback(async () => {
    try {
      const [repairRaw, installRaw, ftRaw, gtRaw] = await Promise.all([
        apiGet("/tickets/repair", token).catch(() => []),
        apiGet("/tickets/installation", token).catch(() => []),
        apiGet("/field-tasks", token).catch(() => []),
        apiGet("/tasks?targetRole=tech_engineer", token).catch(() => []),
      ]);

      const unified: UnifiedTask[] = [];

      if (Array.isArray(repairRaw)) {
        for (const t of repairRaw) {
          if (!isAssignedToMe(t.assignedToName)) continue;
          if (t.status === "archived") continue;
          unified.push({
            key: `repair-${t.id}`,
            source: "repair",
            sourceId: t.id,
            kind: "إصلاح",
            serviceNumber: t.serviceNumber ?? `#${t.id}`,
            clientName: t.clientName ?? null,
            location: null,
            locationUrl: t.locationUrl ?? null,
            phone: t.clientPhone ?? null,
            status: toTab(t.status),
            rawStatus: t.status,
            completedAt: t.resolvedAt ?? null,
            createdAt: t.createdAt,
            notes: t.notes ?? null,
            problemDescription: t.problemDescription ?? null,
          });
        }
      }

      if (Array.isArray(installRaw)) {
        for (const t of installRaw) {
          if (!isAssignedToMe(t.assignedToName)) continue;
          if (t.status === "archived") continue;
          unified.push({
            key: `install-${t.id}`,
            source: "install",
            sourceId: t.id,
            kind: "تركيب",
            serviceNumber: `#${t.id}`,
            clientName: t.clientName ?? null,
            location: t.address ?? null,
            locationUrl: t.locationUrl ?? null,
            phone: t.clientPhone ?? null,
            status: toTab(t.status),
            rawStatus: t.status,
            completedAt: t.completedAt ?? null,
            createdAt: t.createdAt,
            notes: t.notes ?? null,
            problemDescription: null,
          });
        }
      }

      if (Array.isArray(ftRaw)) {
        for (const t of ftRaw) {
          if (!isAssignedToMe(t.assignedEngineerName)) continue;
          const kLabel = kindLabel("field", t.taskType ?? "");
          unified.push({
            key: `field-${t.id}`,
            source: "field",
            sourceId: t.id,
            kind: kLabel,
            serviceNumber: t.serviceNumber ?? `#${t.id}`,
            clientName: t.clientName ?? null,
            location: t.location ?? null,
            locationUrl: t.location?.startsWith("http") ? t.location : null,
            phone: t.phoneNumber ?? null,
            status: toTab(t.status),
            rawStatus: t.status,
            completedAt: t.completedAt ?? null,
            createdAt: t.createdAt,
            notes: t.notes ?? null,
            problemDescription: null,
          });
        }
      }

      if (Array.isArray(gtRaw)) {
        for (const t of gtRaw) {
          if (!isAssignedToMe(t.targetPersonName)) continue;
          unified.push({
            key: `general-${t.id}`,
            source: "general",
            sourceId: t.id,
            kind: "مهمة",
            serviceNumber: t.title ?? `#${t.id}`,
            clientName: null,
            location: t.description ?? null,
            locationUrl: null,
            phone: null,
            status: toTab(t.status),
            rawStatus: t.status,
            completedAt: t.completedAt ?? null,
            createdAt: t.createdAt,
            notes: null,
            problemDescription: t.description ?? null,
          });
        }
      }

      setTasks(unified);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, myName]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ═══ الحسابات ═══ */
  const newTasks = tasks.filter(t => t.status === "new");
  const inProgressTasks = tasks.filter(t => t.status === "inprogress");
  const completedTasks = tasks.filter(t => t.status === "completed");
  const todayTasks = completedTasks.filter(t => isToday(t.completedAt));

  const activeItems =
    activeTab === "new" ? newTasks :
    activeTab === "inprogress" ? inProgressTasks :
    completedTasks;

  /* ═══ الإجراءات ═══ */
  const startTask = async (task: UnifiedTask) => {
    setSaving(true);
    try {
      if (task.source === "repair") {
        await apiPatch(`/tickets/repair/${task.sourceId}`, token, { status: "in_progress" });
      } else if (task.source === "install") {
        await apiPatch(`/tickets/installation/${task.sourceId}`, token, { status: "in_progress" });
      } else if (task.source === "field") {
        await apiPost(`/field-tasks/${task.sourceId}/start`, token, {});
      } else if (task.source === "general") {
        await apiPatch(`/tasks/${task.sourceId}`, token, { status: "in_progress" });
      }
      setTasks(prev => prev.map(t =>
        t.key === task.key ? { ...t, status: "inprogress", rawStatus: "in_progress" } : t
      ));
    } catch {
      showAlert("فشل بدء التنفيذ");
    } finally {
      setSaving(false);
    }
  };

  const openCompleteModal = (task: UnifiedTask) => {
    setCompleteTask(task);
    setCompleteNotes("");
  };

  const saveComplete = async () => {
    if (!completeTask) return;
    setSaving(true);
    const task = completeTask;
    try {
      if (task.source === "repair") {
        await apiPatch(`/tickets/repair/${task.sourceId}`, token, {
          status: "completed", notes: completeNotes || undefined,
        });
      } else if (task.source === "install") {
        await apiPatch(`/tickets/installation/${task.sourceId}`, token, {
          status: "completed", engineerNotes: completeNotes || undefined,
        });
      } else if (task.source === "field") {
        await apiPost(`/field-tasks/${task.sourceId}/complete`, token, {
          notes: completeNotes || undefined,
        });
      } else if (task.source === "general") {
        await apiPatch(`/tasks/${task.sourceId}`, token, {
          status: "completed", notes: completeNotes || undefined,
        });
      }
      const now = new Date().toISOString();
      setTasks(prev => prev.map(t =>
        t.key === task.key
          ? { ...t, status: "completed", rawStatus: "completed", completedAt: now, notes: completeNotes || t.notes }
          : t
      ));
      setCompleteTask(null);
      setCompleteNotes("");
    } catch {
      showAlert("فشل حفظ التنفيذ");
    } finally {
      setSaving(false);
    }
  };

  const copyLocation = async (text: string) => {
    await Clipboard.setStringAsync(text);
    showAlert("تم نسخ الموقع");
  };

  const showAlert = (msg: string) => {
    setAlertMsg(msg);
    setAlertVisible(true);
    setTimeout(() => setAlertVisible(false), 2000);
  };

  /* ═══ Loading ═══ */
  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.roles.tech_engineer} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Ionicons name="construct" size={22} color={Colors.roles.tech_engineer} />
        <Text style={styles.headerTitle}>
          المهندس الفني — <Text style={styles.engineerName}>{user?.name ?? ""}</Text>
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor={Colors.roles.tech_engineer} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── البطاقات السريعة ── */}
        <View style={styles.countRow}>
          <CountCard label="مهامي الجديدة" count={newTasks.length} color={Colors.primary} onPress={() => setActiveTab("new")} active={activeTab === "new"} />
          <CountCard label="جاري التنفيذ" count={inProgressTasks.length} color={Colors.warning} onPress={() => setActiveTab("inprogress")} active={activeTab === "inprogress"} />
          <CountCard label="تم اليوم" count={todayTasks.length} color={Colors.success} onPress={() => setActiveTab("completed")} active={activeTab === "completed"} />
        </View>

        {/* ── التبويبات ── */}
        <View style={styles.tabRow}>
          <TabBtn label="الجديدة" tab="new" active={activeTab} onPress={setActiveTab} count={newTasks.length} />
          <TabBtn label="الجاري" tab="inprogress" active={activeTab} onPress={setActiveTab} count={inProgressTasks.length} />
          <TabBtn label="المكتملة" tab="completed" active={activeTab} onPress={setActiveTab} count={completedTasks.length} />
        </View>

        {/* ── قائمة المهام ── */}
        {activeItems.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-circle-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {activeTab === "new" ? "لا توجد مهام جديدة" :
               activeTab === "inprogress" ? "لا توجد مهام جارية" : "لا توجد مهام مكتملة"}
            </Text>
          </View>
        ) : (
          activeItems.map(task =>
            activeTab === "completed"
              ? <CompletedCard key={task.key} task={task} onView={() => setViewTask(task)} />
              : <TaskCard
                  key={task.key}
                  task={task}
                  tab={activeTab}
                  saving={saving}
                  onStart={() => startTask(task)}
                  onComplete={() => openCompleteModal(task)}
                  onCopy={copyLocation}
                />
          )
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ══ مودال إتمام التنفيذ ══ */}
      <Modal visible={!!completeTask} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>تم التنفيذ</Text>

            <Text style={styles.modalLabel}>ملاحظات التنفيذ</Text>
            <TextInput
              style={styles.modalInput}
              multiline
              numberOfLines={4}
              placeholder="اكتب ملاحظاتك هنا (اختياري)"
              placeholderTextColor={Colors.textMuted}
              value={completeNotes}
              onChangeText={setCompleteNotes}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setCompleteTask(null)}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={saveComplete}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.saveBtnText}>حفظ</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ مودال عرض المهمة المكتملة ══ */}
      <Modal visible={!!viewTask} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.viewHeader}>
              <Text style={styles.modalTitle}>تفاصيل المهمة</Text>
              <TouchableOpacity onPress={() => setViewTask(null)}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            {viewTask && (
              <>
                <View style={[styles.kindBadge, { backgroundColor: kindColor(viewTask.kind) + "20" }]}>
                  <Text style={[styles.kindBadgeText, { color: kindColor(viewTask.kind) }]}>{viewTask.kind}</Text>
                </View>
                <Text style={styles.viewRef}>{viewTask.serviceNumber}</Text>
                {viewTask.clientName ? <Text style={styles.viewClient}>{viewTask.clientName}</Text> : null}
                {viewTask.problemDescription ? (
                  <Text style={styles.viewDesc}>{viewTask.problemDescription}</Text>
                ) : null}
                {viewTask.location && !viewTask.location.startsWith("http") ? (
                  <Text style={styles.viewDesc}>{viewTask.location}</Text>
                ) : null}
                {viewTask.notes ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>ملاحظات التنفيذ:</Text>
                    <Text style={styles.notesText}>{viewTask.notes}</Text>
                  </View>
                ) : null}
                <Text style={styles.viewTime}>
                  اكتملت: {viewTask.completedAt ? new Date(viewTask.completedAt).toLocaleString("ar-YE") : "—"}
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ══ تنبيه بسيط ══ */}
      {alertVisible && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{alertMsg}</Text>
        </View>
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════
   مكوّنات مساعدة
═══════════════════════════════════════════ */
function CountCard({ label, count, color, onPress, active }: {
  label: string; count: number; color: string; onPress: () => void; active: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.countCard, active && { borderColor: color, borderWidth: 2 }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.countNum, { color }]}>{count}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function TabBtn({ label, tab, active, onPress, count }: {
  label: string; tab: TabKey; active: TabKey; onPress: (t: TabKey) => void; count: number;
}) {
  const isActive = tab === active;
  return (
    <TouchableOpacity
      style={[styles.tabBtn, isActive && styles.tabBtnActive]}
      onPress={() => onPress(tab)}
      activeOpacity={0.8}
    >
      <Text style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}>
        {label} {count > 0 ? `(${count})` : ""}
      </Text>
    </TouchableOpacity>
  );
}

function TaskCard({ task, tab, saving, onStart, onComplete, onCopy }: {
  task: UnifiedTask;
  tab: TabKey;
  saving: boolean;
  onStart: () => void;
  onComplete: () => void;
  onCopy: (s: string) => void;
}) {
  const color = kindColor(task.kind);
  const locationText = task.location && !task.location.startsWith("http") ? task.location : null;
  const hasUrl = !!task.locationUrl;
  const hasPhone = !!task.phone;
  const hasLocation = !!(locationText || hasUrl);

  return (
    <View style={[styles.taskCard, { borderRightColor: color, borderRightWidth: 4 }]}>
      {/* ─ رأس البطاقة ─ */}
      <View style={styles.cardTop}>
        <View style={[styles.kindBadge, { backgroundColor: color + "20" }]}>
          <Text style={[styles.kindBadgeText, { color }]}>{task.kind}</Text>
        </View>
        <Text style={styles.refNum}>{task.serviceNumber}</Text>
      </View>

      {/* ─ اسم العميل ─ */}
      {task.clientName ? (
        <Text style={styles.clientName}>{task.clientName}</Text>
      ) : null}

      {/* ─ وصف/ملاحظة ─ */}
      {task.problemDescription ? (
        <Text style={styles.descText} numberOfLines={2}>{task.problemDescription}</Text>
      ) : null}

      {/* ─ الموقع ─ */}
      {hasLocation ? (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={15} color={Colors.textMuted} />
          {locationText ? (
            <Text style={styles.locationText} numberOfLines={1}>{locationText}</Text>
          ) : (
            <Text style={styles.locationText}>رابط الموقع</Text>
          )}
        </View>
      ) : null}

      {/* ─ أزرار الإجراء ─ */}
      <View style={styles.actionRow}>
        {hasPhone && (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => Linking.openURL(`tel:${task.phone!.replace(/\D/g, "")}`)}
          >
            <Ionicons name="call" size={16} color={Colors.success} />
            <Text style={[styles.iconBtnText, { color: Colors.success }]}>اتصال</Text>
          </TouchableOpacity>
        )}

        {hasLocation && (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => hasUrl
              ? Linking.openURL(task.locationUrl!)
              : onCopy(locationText!)
            }
          >
            <Ionicons name={hasUrl ? "map" : "copy-outline"} size={16} color={Colors.primary} />
            <Text style={[styles.iconBtnText, { color: Colors.primary }]}>
              {hasUrl ? "الخريطة" : "نسخ الموقع"}
            </Text>
          </TouchableOpacity>
        )}

        {hasLocation && locationText && (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => onCopy(locationText)}
          >
            <Ionicons name="copy-outline" size={16} color={Colors.textMuted} />
            <Text style={[styles.iconBtnText, { color: Colors.textMuted }]}>نسخ</Text>
          </TouchableOpacity>
        )}

        <View style={{ flex: 1 }} />

        {tab === "new" ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: Colors.warning }]}
            onPress={onStart}
            disabled={saving}
          >
            <Ionicons name="play" size={14} color="#fff" />
            <Text style={styles.actionBtnText}>بدء التنفيذ</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: Colors.success }]}
            onPress={onComplete}
            disabled={saving}
          >
            <Ionicons name="checkmark" size={14} color="#fff" />
            <Text style={styles.actionBtnText}>تم التنفيذ</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function CompletedCard({ task, onView }: { task: UnifiedTask; onView: () => void }) {
  const color = kindColor(task.kind);
  return (
    <View style={[styles.completedCard, { borderRightColor: color, borderRightWidth: 3 }]}>
      <View style={styles.completedLeft}>
        <View style={[styles.kindBadge, { backgroundColor: color + "20" }]}>
          <Text style={[styles.kindBadgeText, { color }]}>{task.kind}</Text>
        </View>
        <Text style={styles.completedRef}>{task.serviceNumber}</Text>
        {task.clientName ? <Text style={styles.completedClient}>{task.clientName}</Text> : null}
      </View>
      <View style={styles.completedRight}>
        <Text style={styles.completedTime}>{fmtTime(task.completedAt)}</Text>
        <TouchableOpacity style={styles.viewBtn} onPress={onView}>
          <Text style={styles.viewBtnText}>عرض</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════
   الأنماط
═══════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 8 },

  /* header */
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerTitle: { fontSize: 17, color: Colors.text, fontWeight: "700", textAlign: "right" },
  engineerName: { color: Colors.roles.tech_engineer },

  /* count cards */
  countRow: { flexDirection: "row-reverse", gap: 10, marginBottom: 16 },
  countCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 8, alignItems: "center",
    borderColor: Colors.border, borderWidth: 1,
  },
  countNum: { fontSize: 28, fontWeight: "800" },
  countLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 4, textAlign: "center" },

  /* tabs */
  tabRow: {
    flexDirection: "row-reverse", gap: 8, marginBottom: 16,
    backgroundColor: Colors.surface, borderRadius: 12, padding: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  tabBtnActive: { backgroundColor: Colors.roles.tech_engineer },
  tabBtnText: { fontSize: 13, color: Colors.textMuted, fontWeight: "600" },
  tabBtnTextActive: { color: "#fff" },

  /* empty */
  emptyBox: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, color: Colors.textMuted },

  /* task card */
  taskCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    padding: 14, marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  cardTop: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  kindBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  kindBadgeText: { fontSize: 12, fontWeight: "700" },
  refNum: { fontSize: 15, color: Colors.text, fontWeight: "700" },
  clientName: { fontSize: 15, color: Colors.text, fontWeight: "600", textAlign: "right", marginBottom: 4 },
  descText: { fontSize: 13, color: Colors.textMuted, textAlign: "right", marginBottom: 6, lineHeight: 19 },

  /* location */
  locationRow: { flexDirection: "row-reverse", alignItems: "center", gap: 5, marginBottom: 10 },
  locationText: { fontSize: 13, color: Colors.textMuted, flex: 1, textAlign: "right" },

  /* action row */
  actionRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 4 },
  iconBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8, backgroundColor: Colors.background },
  iconBtnText: { fontSize: 12, fontWeight: "600" },
  actionBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 5, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  actionBtnText: { fontSize: 13, color: "#fff", fontWeight: "700" },

  /* completed card */
  completedCard: {
    backgroundColor: Colors.surface, borderRadius: 12,
    padding: 12, marginBottom: 10,
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
  },
  completedLeft: { flex: 1, gap: 4 },
  completedRef: { fontSize: 14, color: Colors.text, fontWeight: "700", textAlign: "right" },
  completedClient: { fontSize: 12, color: Colors.textMuted, textAlign: "right" },
  completedRight: { alignItems: "center", gap: 6, paddingLeft: 10 },
  completedTime: { fontSize: 14, color: Colors.textMuted, fontWeight: "600" },
  viewBtn: { backgroundColor: Colors.primary + "20", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  viewBtnText: { fontSize: 13, color: Colors.primary, fontWeight: "700" },

  /* modal */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalBox: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  viewHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { fontSize: 18, color: Colors.text, fontWeight: "800", textAlign: "right", marginBottom: 16 },
  modalLabel: { fontSize: 14, color: Colors.textMuted, textAlign: "right", marginBottom: 8 },
  modalInput: {
    backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.border, padding: 12, color: Colors.text,
    fontSize: 14, textAlign: "right", minHeight: 100, marginBottom: 20,
  },
  modalActions: { flexDirection: "row-reverse", gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  cancelBtnText: { fontSize: 15, color: Colors.textMuted, fontWeight: "600" },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.success, alignItems: "center" },
  saveBtnText: { fontSize: 15, color: "#fff", fontWeight: "700" },

  /* view modal details */
  viewRef: { fontSize: 18, color: Colors.text, fontWeight: "800", textAlign: "right", marginTop: 8, marginBottom: 4 },
  viewClient: { fontSize: 15, color: Colors.text, textAlign: "right", marginBottom: 4 },
  viewDesc: { fontSize: 14, color: Colors.textMuted, textAlign: "right", lineHeight: 20, marginBottom: 8 },
  viewTime: { fontSize: 13, color: Colors.textMuted, textAlign: "right", marginTop: 8 },
  notesBox: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, marginTop: 8 },
  notesLabel: { fontSize: 12, color: Colors.textMuted, textAlign: "right", marginBottom: 4 },
  notesText: { fontSize: 14, color: Colors.text, textAlign: "right", lineHeight: 20 },

  /* toast */
  toast: {
    position: "absolute", bottom: 40, left: 20, right: 20,
    backgroundColor: "rgba(0,0,0,0.8)", borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 20, alignItems: "center",
  },
  toastText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
