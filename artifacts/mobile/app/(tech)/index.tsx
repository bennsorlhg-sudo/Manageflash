import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Modal, TextInput, ActivityIndicator, RefreshControl, Alert, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";
import { apiGet, apiPatch, apiPost, formatDate } from "@/utils/api";

type TabKey = "new" | "pending" | "completed";

interface FieldTask {
  id: number;
  taskType: string;
  serviceNumber: string;
  clientName: string | null;
  location: string;
  phoneNumber: string;
  status: string;
  assignedEngineerName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GeneralTask {
  id: number;
  title?: string;
  description: string;
  status: string;
  priority?: string;
  targetRole: string;
  assignedByRole?: string;
  createdAt: string;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  repair: "صيانة",
  installation: "تركيب",
  maintenance: "صيانة دورية",
};

const TASK_TYPE_ICONS: Record<string, string> = {
  repair: "build",
  installation: "add-circle",
  maintenance: "construct",
};

export default function TechEngineerHomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabKey>("new");
  const [fieldTasks, setFieldTasks] = useState<FieldTask[]>([]);
  const [generalTasks, setGeneralTasks] = useState<GeneralTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedFieldTask, setSelectedFieldTask] = useState<FieldTask | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [isCompleteModal, setIsCompleteModal] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [ft, gt] = await Promise.all([
        apiGet("/field-tasks", token).catch(() => []),
        apiGet("/tasks?targetRole=tech_engineer", token).catch(() => []),
      ]);
      const myName = user?.name ?? "";
      const filtered = Array.isArray(ft)
        ? ft.filter((t: FieldTask) => !t.assignedEngineerName || t.assignedEngineerName === myName)
        : [];
      setFieldTasks(filtered);
      setGeneralTasks(Array.isArray(gt) ? gt : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, user?.name]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const mapStatus = (s: string): TabKey => {
    if (s === "new" || s === "pending") return "new";
    if (s === "in_progress") return "pending";
    return "completed";
  };

  const filteredField = fieldTasks.filter(t => mapStatus(t.status) === activeTab);
  const filteredGeneral = generalTasks.filter(t => mapStatus(t.status) === activeTab);

  const counts = {
    new: fieldTasks.filter(t => mapStatus(t.status) === "new").length
      + generalTasks.filter(t => mapStatus(t.status) === "new").length,
    pending: fieldTasks.filter(t => mapStatus(t.status) === "pending").length
      + generalTasks.filter(t => mapStatus(t.status) === "pending").length,
    completed: fieldTasks.filter(t => mapStatus(t.status) === "completed").length
      + generalTasks.filter(t => mapStatus(t.status) === "completed").length,
  };

  const updateFieldStatus = async (id: number, status: string, notes?: string) => {
    setUpdating(true);
    try {
      if (status === "in_progress") {
        await apiPost(`/field-tasks/${id}/start`, token, {});
      } else if (status === "completed") {
        await apiPost(`/field-tasks/${id}/complete`, token, notes ? { notes } : {});
      } else {
        await apiPatch(`/field-tasks/${id}`, token, { notes: notes ?? "" });
      }
      setFieldTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
      setIsCompleteModal(false);
      setCompletionNotes("");
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "فشل التحديث");
    } finally {
      setUpdating(false);
    }
  };

  const updateGeneralStatus = async (id: number, status: string) => {
    try {
      await apiPatch(`/tasks/${id}`, token, { status });
      setGeneralTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "فشل التحديث");
    }
  };

  const copyText = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("تم النسخ", "تم نسخ الموقع");
  };

  const callPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    Linking.openURL(`tel:${cleaned}`);
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.roles.tech_engineer} />
      </View>
    );
  }

  const isEmpty = filteredField.length === 0 && filteredGeneral.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.welcomeText}>المهندس الفني — {user?.name}</Text>
          <Text style={styles.roleText}>فلاش نت</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/(tech)/profile")}>
          <Ionicons name="person-circle" size={40} color={Colors.roles.tech_engineer} />
        </TouchableOpacity>
      </View>

      {/* Count Cards */}
      <View style={styles.countGrid}>
        {([
          { key: "new" as TabKey, label: "مهام جديدة", color: Colors.roles.tech_engineer },
          { key: "pending" as TabKey, label: "قيد التنفيذ", color: Colors.warning },
          { key: "completed" as TabKey, label: "مكتملة", color: Colors.success },
        ]).map(({ key, label, color }) => (
          <TouchableOpacity
            key={key}
            style={[styles.countCard, activeTab === key && { borderColor: color, borderWidth: 2 }]}
            onPress={() => setActiveTab(key)}
          >
            <Text style={[styles.countValue, { color }]}>{counts[key]}</Text>
            <Text style={styles.countLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {([
          { key: "completed" as TabKey, label: "المكتملة" },
          { key: "pending" as TabKey, label: "قيد التنفيذ" },
          { key: "new" as TabKey, label: "الجديدة" },
        ]).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeTab === key && styles.tabActive]}
            onPress={() => setActiveTab(key)}
          >
            <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} />
        }
      >
        {isEmpty ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-done-circle-outline" size={56} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {activeTab === "new" ? "لا توجد مهام جديدة" : activeTab === "pending" ? "لا توجد مهام جارية" : "لا توجد مهام مكتملة"}
            </Text>
          </View>
        ) : (
          <>
            {/* Field Tasks */}
            {filteredField.map(task => (
              <View key={`ft-${task.id}`} style={styles.taskCard}>
                <View style={styles.cardHeader}>
                  <View style={[
                    styles.typeBadge,
                    { backgroundColor: task.taskType === "repair" ? Colors.error + "20" : Colors.primary + "20" }
                  ]}>
                    <Ionicons
                      name={(TASK_TYPE_ICONS[task.taskType] ?? "build") as any}
                      size={14}
                      color={task.taskType === "repair" ? Colors.error : Colors.primary}
                    />
                    <Text style={[
                      styles.typeText,
                      { color: task.taskType === "repair" ? Colors.error : Colors.primary }
                    ]}>
                      {TASK_TYPE_LABELS[task.taskType] ?? task.taskType}
                    </Text>
                  </View>
                  <Text style={styles.refText}>#{task.serviceNumber}</Text>
                </View>

                {task.clientName ? (
                  <Text style={styles.clientName}>{task.clientName}</Text>
                ) : null}

                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={16} color={Colors.textMuted} />
                  <Text style={styles.infoText}>{task.location}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={16} color={Colors.textMuted} />
                  <Text style={styles.infoText}>{task.phoneNumber}</Text>
                </View>

                {task.notes ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="document-text-outline" size={16} color={Colors.textMuted} />
                    <Text style={styles.infoText}>{task.notes}</Text>
                  </View>
                ) : null}

                <Text style={styles.dateText}>{formatDate(task.createdAt)}</Text>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => callPhone(task.phoneNumber)}
                  >
                    <Ionicons name="call" size={20} color={Colors.success} />
                    <Text style={[styles.actionBtnText, { color: Colors.success }]}>اتصال</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => copyText(task.location)}
                  >
                    <Ionicons name="copy-outline" size={20} color={Colors.primaryLight} />
                    <Text style={[styles.actionBtnText, { color: Colors.primaryLight }]}>نسخ الموقع</Text>
                  </TouchableOpacity>
                </View>

                {(task.status === "new" || task.status === "pending") && activeTab === "new" && (
                  <TouchableOpacity
                    style={styles.mainBtn}
                    onPress={() => updateFieldStatus(task.id, "in_progress")}
                  >
                    <Text style={styles.mainBtnText}>▶ بدء التنفيذ</Text>
                  </TouchableOpacity>
                )}
                {task.status === "in_progress" && activeTab === "pending" && (
                  <TouchableOpacity
                    style={[styles.mainBtn, { backgroundColor: Colors.success }]}
                    onPress={() => { setSelectedFieldTask(task); setIsCompleteModal(true); }}
                  >
                    <Text style={styles.mainBtnText}>✓ إكمال المهمة</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {/* General Tasks */}
            {filteredGeneral.map(task => (
              <View key={`gt-${task.id}`} style={[styles.taskCard, { borderLeftWidth: 3, borderLeftColor: Colors.warning }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.typeBadge, { backgroundColor: Colors.warning + "20" }]}>
                    <Ionicons name="clipboard-outline" size={14} color={Colors.warning} />
                    <Text style={[styles.typeText, { color: Colors.warning }]}>مهمة إدارية</Text>
                  </View>
                  <Text style={styles.refText}>#{task.id}</Text>
                </View>

                <Text style={styles.clientName}>{task.description}</Text>
                <Text style={styles.dateText}>{formatDate(task.createdAt)}</Text>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => copyText(task.description)}
                  >
                    <Ionicons name="copy-outline" size={20} color={Colors.primaryLight} />
                    <Text style={[styles.actionBtnText, { color: Colors.primaryLight }]}>نسخ</Text>
                  </TouchableOpacity>
                </View>

                {task.status === "pending" && activeTab === "new" && (
                  <TouchableOpacity
                    style={styles.mainBtn}
                    onPress={() => updateGeneralStatus(task.id, "in_progress")}
                  >
                    <Text style={styles.mainBtnText}>▶ بدء التنفيذ</Text>
                  </TouchableOpacity>
                )}
                {task.status === "in_progress" && activeTab === "pending" && (
                  <TouchableOpacity
                    style={[styles.mainBtn, { backgroundColor: Colors.success }]}
                    onPress={() => updateGeneralStatus(task.id, "completed")}
                  >
                    <Text style={styles.mainBtnText}>✓ إكمال المهمة</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Complete Field Task Modal */}
      <Modal visible={isCompleteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>إكمال المهمة الميدانية</Text>
            {selectedFieldTask && (
              <Text style={styles.modalSubtitle}>
                {TASK_TYPE_LABELS[selectedFieldTask.taskType] ?? selectedFieldTask.taskType} — {selectedFieldTask.serviceNumber}
              </Text>
            )}
            <Text style={styles.label}>ملاحظات الإكمال (اختياري)</Text>
            <TextInput
              style={styles.modalInput}
              multiline
              placeholder="اكتب ملاحظاتك هنا..."
              placeholderTextColor={Colors.textMuted}
              value={completionNotes}
              onChangeText={setCompletionNotes}
              textAlign="right"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsCompleteModal(false)}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => selectedFieldTask && updateFieldStatus(selectedFieldTask.id, "completed", completionNotes)}
                disabled={updating}
              >
                {updating
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={styles.confirmBtnText}>حفظ وإكمال</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "center", padding: 20,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  welcomeText: { color: Colors.text, fontSize: 18, fontWeight: "bold", textAlign: "right" },
  roleText: { color: Colors.roles.tech_engineer, fontSize: 12 },
  countGrid: { flexDirection: "row-reverse", padding: 15, gap: 10 },
  countCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12,
    padding: 12, alignItems: "center",
    borderWidth: 1, borderColor: Colors.border,
  },
  countValue: { fontSize: 24, fontWeight: "bold" },
  countLabel: { fontSize: 10, color: Colors.textSecondary, marginTop: 4, textAlign: "center" },
  tabs: { flexDirection: "row-reverse", borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.roles.tech_engineer },
  tabText: { color: Colors.textSecondary, fontSize: 13 },
  tabTextActive: { color: Colors.roles.tech_engineer, fontWeight: "bold" },
  listContent: { padding: 16, gap: 12 },
  emptyContainer: { alignItems: "center", marginTop: 80, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
  taskCard: {
    backgroundColor: Colors.surface, borderRadius: 15,
    padding: 16, borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "center", marginBottom: 10,
  },
  typeBadge: {
    flexDirection: "row-reverse", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 5,
  },
  typeText: { fontSize: 12, fontWeight: "bold" },
  refText: { color: Colors.textMuted, fontSize: 12 },
  clientName: { color: Colors.text, fontSize: 16, fontWeight: "bold", textAlign: "right", marginBottom: 8 },
  infoRow: {
    flexDirection: "row-reverse", alignItems: "center", gap: 8,
    marginBottom: 5,
  },
  infoText: { color: Colors.textSecondary, fontSize: 13, flex: 1, textAlign: "right" },
  dateText: { color: Colors.textMuted, fontSize: 11, textAlign: "right", marginTop: 6 },
  actionRow: {
    flexDirection: "row-reverse", gap: 10, marginTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12,
  },
  actionBtn: {
    flexDirection: "row-reverse", alignItems: "center", gap: 6,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  actionBtnText: { fontSize: 13, fontWeight: "600" },
  mainBtn: {
    backgroundColor: Colors.primary, borderRadius: 10,
    padding: 12, alignItems: "center", marginTop: 12,
  },
  mainBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 20 },
  modalContent: {
    backgroundColor: Colors.surface, borderRadius: 16,
    padding: 20, borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: "bold", textAlign: "right", marginBottom: 4 },
  modalSubtitle: { color: Colors.textSecondary, fontSize: 14, textAlign: "right", marginBottom: 16 },
  label: { color: Colors.textSecondary, fontSize: 14, textAlign: "right", marginBottom: 8 },
  modalInput: {
    backgroundColor: Colors.background, borderRadius: 8, padding: 12,
    color: Colors.text, height: 100, textAlignVertical: "top",
    borderWidth: 1, borderColor: Colors.border,
  },
  modalActions: { flexDirection: "row-reverse", gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, padding: 12, alignItems: "center", borderRadius: 8, backgroundColor: Colors.surfaceElevated },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: "bold" },
  confirmBtn: { flex: 1, padding: 12, alignItems: "center", borderRadius: 8, backgroundColor: Colors.success },
  confirmBtnText: { color: "#FFF", fontWeight: "bold" },
});
