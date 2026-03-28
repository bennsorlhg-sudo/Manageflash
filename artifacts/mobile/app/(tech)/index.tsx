import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Modal, TextInput, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";
import { apiGet, apiPatch, formatDate } from "@/utils/api";

export default function TechEngineerHomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"new" | "pending" | "completed">("new");
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [completionNotes, setCompletionNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await apiGet("/tasks?targetRole=tech_engineer", token);
      setTasks(data);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const counts = {
    new: tasks.filter(t => t.status === "pending").length,
    pending: tasks.filter(t => t.status === "in_progress").length,
    completedToday: tasks.filter(t => t.status === "completed").length,
  };

  const filteredTasks = tasks.filter(t => {
    if (activeTab === "new") return t.status === "pending";
    if (activeTab === "pending") return t.status === "in_progress";
    return t.status === "completed";
  });

  const updateStatus = async (id: number, status: string, notes?: string) => {
    setUpdating(true);
    try {
      await apiPatch(`/tasks/${id}`, token, { status, notes });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
      setIsModalOpen(false);
      setCompletionNotes("");
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    } finally {
      setUpdating(false);
    }
  };

  const copyText = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("تم النسخ", "تم نسخ النص");
  };

  const getPriorityColor = (p: string) => {
    if (p === "urgent") return Colors.error;
    if (p === "high") return Colors.warning;
    if (p === "medium") return Colors.info;
    return Colors.textMuted;
  };

  const getPriorityLabel = (p: string) => {
    const map: Record<string, string> = { urgent: "عاجل", high: "مرتفع", medium: "متوسط", low: "منخفض" };
    return map[p] ?? p;
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.roles.tech_engineer} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.welcomeText}>المهندس الفني — {user?.name}</Text>
          <Text style={styles.roleText}>فلاش نت</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/(tech)/profile")}>
          <Ionicons name="person-circle" size={40} color={Colors.roles.tech_engineer} />
        </TouchableOpacity>
      </View>

      <View style={styles.countGrid}>
        <TouchableOpacity style={styles.countCard} onPress={() => setActiveTab("new")}>
          <Text style={[styles.countValue, activeTab === "new" && { color: Colors.roles.tech_engineer }]}>{counts.new}</Text>
          <Text style={styles.countLabel}>مهام جديدة</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.countCard} onPress={() => setActiveTab("pending")}>
          <Text style={[styles.countValue, { color: Colors.warning }, activeTab === "pending" && { color: Colors.warning }]}>{counts.pending}</Text>
          <Text style={styles.countLabel}>قيد التنفيذ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.countCard} onPress={() => setActiveTab("completed")}>
          <Text style={[styles.countValue, { color: Colors.success }]}>{counts.completedToday}</Text>
          <Text style={styles.countLabel}>مكتملة</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === "completed" && styles.tabActive]} onPress={() => setActiveTab("completed")}>
          <Text style={[styles.tabText, activeTab === "completed" && styles.tabTextActive]}>المكتملة</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === "pending" && styles.tabActive]} onPress={() => setActiveTab("pending")}>
          <Text style={[styles.tabText, activeTab === "pending" && styles.tabTextActive]}>قيد التنفيذ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === "new" && styles.tabActive]} onPress={() => setActiveTab("new")}>
          <Text style={[styles.tabText, activeTab === "new" && styles.tabTextActive]}>الجديدة</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTasks(); }} />}
      >
        {filteredTasks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-done-circle-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {activeTab === "new" ? "لا توجد مهام جديدة" : activeTab === "pending" ? "لا توجد مهام جارية" : "لا توجد مهام مكتملة"}
            </Text>
          </View>
        ) : filteredTasks.map(task => (
          <View key={task.id} style={styles.taskCard}>
            <View style={styles.cardHeader}>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(task.priority) + "20" }]}>
                <Text style={[styles.priorityText, { color: getPriorityColor(task.priority) }]}>
                  {getPriorityLabel(task.priority)}
                </Text>
              </View>
              <Text style={styles.refText}>#{task.id}</Text>
            </View>

            <Text style={styles.taskTitle}>{task.title}</Text>
            {task.description && <Text style={styles.taskDesc}>{task.description}</Text>}
            {task.targetPersonName && <Text style={styles.locationText}>{task.targetPersonName}</Text>}

            <Text style={styles.dateText}>{formatDate(task.createdAt)}</Text>

            <View style={styles.actionRow}>
              {task.targetPersonName && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(`tel:${task.targetPersonName}`)}>
                  <Ionicons name="call" size={20} color={Colors.success} />
                </TouchableOpacity>
              )}
              {task.description && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => copyText(task.description)}>
                  <Ionicons name="copy" size={20} color={Colors.primaryLight} />
                </TouchableOpacity>
              )}
            </View>

            {task.status === "pending" && (
              <TouchableOpacity style={styles.mainBtn} onPress={() => updateStatus(task.id, "in_progress")}>
                {updating ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.mainBtnText}>بدء التنفيذ</Text>}
              </TouchableOpacity>
            )}

            {task.status === "in_progress" && (
              <TouchableOpacity
                style={[styles.mainBtn, { backgroundColor: Colors.success }]}
                onPress={() => { setSelectedTask(task); setIsModalOpen(true); }}
              >
                <Text style={styles.mainBtnText}>إكمال المهمة</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={isModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>إكمال المهمة</Text>
            <Text style={styles.modalSubtitle}>{selectedTask?.title}</Text>
            <Text style={styles.label}>ملاحظات الإكمال</Text>
            <TextInput
              style={styles.modalInput} multiline
              placeholder="اكتب ملاحظاتك هنا..." placeholderTextColor={Colors.textMuted}
              value={completionNotes} onChangeText={setCompletionNotes}
              textAlign="right"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalOpen(false)}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => updateStatus(selectedTask?.id, "completed", completionNotes)}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.confirmBtnText}>حفظ وإكمال</Text>}
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
  welcomeText: { color: Colors.text, fontSize: 18, fontWeight: "bold" },
  roleText: { color: Colors.roles.tech_engineer, fontSize: 12 },
  countGrid: { flexDirection: "row-reverse", padding: 15, gap: 10 },
  countCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12,
    padding: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.border,
  },
  countValue: { fontSize: 22, fontWeight: "bold", color: Colors.primaryLight },
  countLabel: { fontSize: 10, color: Colors.textSecondary, marginTop: 4, textAlign: "center" },
  tabs: { flexDirection: "row-reverse", borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 15, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.roles.tech_engineer },
  tabText: { color: Colors.textSecondary, fontSize: 13 },
  tabTextActive: { color: Colors.roles.tech_engineer, fontWeight: "bold" },
  listContent: { padding: 20 },
  emptyContainer: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
  taskCard: {
    backgroundColor: Colors.surface, borderRadius: 15,
    padding: 16, marginBottom: 15, borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  priorityBadge: { flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  priorityText: { fontSize: 12, fontWeight: "bold" },
  refText: { color: Colors.textMuted, fontSize: 12 },
  taskTitle: { color: Colors.text, fontSize: 16, fontWeight: "bold", textAlign: "right", marginBottom: 4 },
  taskDesc: { color: Colors.textSecondary, fontSize: 13, textAlign: "right", marginBottom: 4 },
  locationText: { color: Colors.textMuted, fontSize: 13, textAlign: "right", marginTop: 2 },
  dateText: { color: Colors.textMuted, fontSize: 11, textAlign: "right", marginTop: 4 },
  actionRow: { flexDirection: "row-reverse", gap: 15, marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  actionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceElevated, justifyContent: "center", alignItems: "center" },
  mainBtn: { backgroundColor: Colors.primary, borderRadius: 8, padding: 12, alignItems: "center", marginTop: 12 },
  mainBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 20 },
  modalContent: { backgroundColor: Colors.surface, borderRadius: 15, padding: 20, borderWidth: 1, borderColor: Colors.border },
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
