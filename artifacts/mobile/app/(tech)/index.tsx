import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Modal, TextInput, ActivityIndicator, RefreshControl, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";
import { apiGet, apiPost, apiPatch, formatDate } from "@/utils/api";

type TabKey = "new" | "pending" | "completed";

interface RepairTicket {
  id: number;
  serviceNumber: string;
  clientName: string | null;
  serviceType: string;
  problemDescription: string | null;
  status: string;
  assignedToName: string | null;
  locationUrl: string | null;
  notes: string | null;
  createdAt: string;
}

interface InstallationTicket {
  id: number;
  clientName: string | null;
  clientPhone: string | null;
  serviceType: string;
  address: string | null;
  locationUrl: string | null;
  notes: string | null;
  status: string;
  assignedToName: string | null;
  scheduledAt: string | null;
  createdAt: string;
}

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
}

interface GeneralTask {
  id: number;
  description: string;
  status: string;
  targetRole: string;
  createdAt: string;
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  hotspot: "هوت سبوت",
  hotspot_internal: "هوت سبوت داخلي",
  hotspot_external: "هوت سبوت خارجي",
  broadband: "برودباند",
  broadband_fiber: "فايبر",
};

export default function TechEngineerHomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabKey>("new");
  const [repairTickets, setRepairTickets] = useState<RepairTicket[]>([]);
  const [installTickets, setInstallTickets] = useState<InstallationTicket[]>([]);
  const [fieldTasks, setFieldTasks] = useState<FieldTask[]>([]);
  const [generalTasks, setGeneralTasks] = useState<GeneralTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedFieldTask, setSelectedFieldTask] = useState<FieldTask | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [isCompleteModal, setIsCompleteModal] = useState(false);
  const [updating, setUpdating] = useState(false);

  const myName = user?.name?.trim() ?? "";

  const isMyTicket = (assignedName: string | null) => {
    if (!assignedName || assignedName.trim() === "") return true;
    return assignedName.trim() === myName;
  };

  const fetchAll = useCallback(async () => {
    try {
      const [repairRaw, installRaw, ftRaw, gtRaw] = await Promise.all([
        apiGet("/tickets/repair", token).catch(() => []),
        apiGet("/tickets/installation", token).catch(() => []),
        apiGet("/field-tasks", token).catch(() => []),
        apiGet("/tasks?targetRole=tech_engineer", token).catch(() => []),
      ]);

      setRepairTickets(
        Array.isArray(repairRaw)
          ? repairRaw.filter((t: RepairTicket) => isMyTicket(t.assignedToName) && t.status !== "archived")
          : []
      );
      setInstallTickets(
        Array.isArray(installRaw)
          ? installRaw.filter((t: InstallationTicket) => isMyTicket(t.assignedToName) && t.status !== "archived")
          : []
      );
      setFieldTasks(
        Array.isArray(ftRaw)
          ? ftRaw.filter((t: FieldTask) => isMyTicket(t.assignedEngineerName))
          : []
      );
      setGeneralTasks(Array.isArray(gtRaw) ? gtRaw : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, myName]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const mapStatus = (s: string): TabKey => {
    if (s === "new" || s === "pending") return "new";
    if (s === "in_progress") return "pending";
    return "completed";
  };

  const allNew = [
    ...repairTickets.filter(t => mapStatus(t.status) === "new"),
    ...installTickets.filter(t => mapStatus(t.status) === "new"),
    ...fieldTasks.filter(t => mapStatus(t.status) === "new"),
    ...generalTasks.filter(t => mapStatus(t.status) === "new"),
  ];
  const allPending = [
    ...repairTickets.filter(t => mapStatus(t.status) === "pending"),
    ...installTickets.filter(t => mapStatus(t.status) === "pending"),
    ...fieldTasks.filter(t => mapStatus(t.status) === "pending"),
    ...generalTasks.filter(t => mapStatus(t.status) === "pending"),
  ];
  const allCompleted = [
    ...repairTickets.filter(t => mapStatus(t.status) === "completed"),
    ...installTickets.filter(t => mapStatus(t.status) === "completed"),
    ...fieldTasks.filter(t => mapStatus(t.status) === "completed"),
    ...generalTasks.filter(t => mapStatus(t.status) === "completed"),
  ];

  const counts = { new: allNew.length, pending: allPending.length, completed: allCompleted.length };

  const updateRepairStatus = async (id: number, status: string) => {
    try {
      await apiPatch(`/tickets/repair/${id}`, token, { status });
      setRepairTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    } catch (e: any) {
      showAlert("خطأ", e.message ?? "فشل التحديث");
    }
  };

  const updateInstallStatus = async (id: number, status: string) => {
    try {
      await apiPatch(`/tickets/installation/${id}`, token, { status });
      setInstallTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    } catch (e: any) {
      showAlert("خطأ", e.message ?? "فشل التحديث");
    }
  };

  const updateFieldStatus = async (id: number, status: string, notes?: string) => {
    setUpdating(true);
    try {
      if (status === "in_progress") {
        await apiPost(`/field-tasks/${id}/start`, token, {});
      } else if (status === "completed") {
        await apiPost(`/field-tasks/${id}/complete`, token, notes ? { notes } : {});
      }
      setFieldTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
      setIsCompleteModal(false);
      setCompletionNotes("");
    } catch (e: any) {
      showAlert("خطأ", e.message ?? "فشل التحديث");
    } finally {
      setUpdating(false);
    }
  };

  const updateGeneralStatus = async (id: number, status: string) => {
    try {
      await apiPatch(`/tasks/${id}`, token, { status });
      setGeneralTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    } catch (e: any) {
      showAlert("خطأ", e.message ?? "فشل التحديث");
    }
  };

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMsg, setAlertMsg] = useState("");
  const showAlert = (title: string, msg: string) => {
    setAlertTitle(title); setAlertMsg(msg); setAlertVisible(true);
  };

  const copyText = async (text: string) => {
    await Clipboard.setStringAsync(text);
    showAlert("تم النسخ", "تم نسخ الموقع");
  };

  const callPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    Linking.openURL(`tel:${cleaned}`);
  };

  const openMap = (url: string) => {
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.roles.tech_engineer} />
      </View>
    );
  }

  const activeItems =
    activeTab === "new" ? allNew :
    activeTab === "pending" ? allPending :
    allCompleted;

  const isEmpty = activeItems.length === 0;

  const renderRepairCard = (ticket: RepairTicket) => (
    <View key={`repair-${ticket.id}`} style={[styles.taskCard, { borderLeftColor: Colors.error, borderLeftWidth: 3 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: Colors.error + "20" }]}>
          <Ionicons name="build" size={14} color={Colors.error} />
          <Text style={[styles.typeText, { color: Colors.error }]}>صيانة</Text>
        </View>
        <Text style={styles.refText}>#{ticket.serviceNumber}</Text>
      </View>

      {ticket.clientName ? <Text style={styles.clientName}>{ticket.clientName}</Text> : null}
      {ticket.problemDescription ? (
        <View style={styles.infoRow}>
          <Ionicons name="alert-circle-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.infoText}>{ticket.problemDescription}</Text>
        </View>
      ) : null}
      <View style={styles.infoRow}>
        <Ionicons name="wifi-outline" size={16} color={Colors.textMuted} />
        <Text style={styles.infoText}>{SERVICE_TYPE_LABELS[ticket.serviceType] ?? ticket.serviceType}</Text>
      </View>
      {ticket.notes ? (
        <View style={styles.infoRow}>
          <Ionicons name="document-text-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.infoText}>{ticket.notes}</Text>
        </View>
      ) : null}
      <Text style={styles.dateText}>{formatDate(ticket.createdAt)}</Text>

      <View style={styles.actionRow}>
        {ticket.locationUrl ? (
          <TouchableOpacity style={styles.actionBtn} onPress={() => openMap(ticket.locationUrl!)}>
            <Ionicons name="location" size={20} color={Colors.primaryLight} />
            <Text style={[styles.actionBtnText, { color: Colors.primaryLight }]}>الموقع</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.actionBtn} onPress={() => copyText(ticket.locationUrl ?? ticket.serviceNumber)}>
          <Ionicons name="copy-outline" size={20} color={Colors.textSecondary} />
          <Text style={[styles.actionBtnText, { color: Colors.textSecondary }]}>نسخ</Text>
        </TouchableOpacity>
      </View>

      {mapStatus(ticket.status) === "new" && (
        <TouchableOpacity style={styles.mainBtn} onPress={() => updateRepairStatus(ticket.id, "in_progress")}>
          <Text style={styles.mainBtnText}>▶ بدء التنفيذ</Text>
        </TouchableOpacity>
      )}
      {mapStatus(ticket.status) === "pending" && (
        <TouchableOpacity style={[styles.mainBtn, { backgroundColor: Colors.success }]} onPress={() => updateRepairStatus(ticket.id, "completed")}>
          <Text style={styles.mainBtnText}>✓ إكمال المهمة</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderInstallCard = (ticket: InstallationTicket) => (
    <View key={`install-${ticket.id}`} style={[styles.taskCard, { borderLeftColor: Colors.primary, borderLeftWidth: 3 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: Colors.primary + "20" }]}>
          <Ionicons name="add-circle" size={14} color={Colors.primary} />
          <Text style={[styles.typeText, { color: Colors.primary }]}>تركيب</Text>
        </View>
        <Text style={styles.refText}>#{ticket.id}</Text>
      </View>

      {ticket.clientName ? <Text style={styles.clientName}>{ticket.clientName}</Text> : null}
      {ticket.clientPhone ? (
        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.infoText}>{ticket.clientPhone}</Text>
        </View>
      ) : null}
      <View style={styles.infoRow}>
        <Ionicons name="wifi-outline" size={16} color={Colors.textMuted} />
        <Text style={styles.infoText}>{SERVICE_TYPE_LABELS[ticket.serviceType] ?? ticket.serviceType}</Text>
      </View>
      {ticket.address ? (
        <View style={styles.infoRow}>
          <Ionicons name="home-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.infoText}>{ticket.address}</Text>
        </View>
      ) : null}
      {ticket.notes ? (
        <View style={styles.infoRow}>
          <Ionicons name="document-text-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.infoText}>{ticket.notes}</Text>
        </View>
      ) : null}
      {ticket.scheduledAt ? (
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.infoText}>موعد: {formatDate(ticket.scheduledAt)}</Text>
        </View>
      ) : null}
      <Text style={styles.dateText}>{formatDate(ticket.createdAt)}</Text>

      <View style={styles.actionRow}>
        {ticket.clientPhone ? (
          <TouchableOpacity style={styles.actionBtn} onPress={() => callPhone(ticket.clientPhone!)}>
            <Ionicons name="call" size={20} color={Colors.success} />
            <Text style={[styles.actionBtnText, { color: Colors.success }]}>اتصال</Text>
          </TouchableOpacity>
        ) : null}
        {ticket.locationUrl ? (
          <TouchableOpacity style={styles.actionBtn} onPress={() => openMap(ticket.locationUrl!)}>
            <Ionicons name="location" size={20} color={Colors.primaryLight} />
            <Text style={[styles.actionBtnText, { color: Colors.primaryLight }]}>الموقع</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {mapStatus(ticket.status) === "new" && (
        <TouchableOpacity style={styles.mainBtn} onPress={() => updateInstallStatus(ticket.id, "in_progress")}>
          <Text style={styles.mainBtnText}>▶ بدء التنفيذ</Text>
        </TouchableOpacity>
      )}
      {mapStatus(ticket.status) === "pending" && (
        <TouchableOpacity style={[styles.mainBtn, { backgroundColor: Colors.success }]} onPress={() => updateInstallStatus(ticket.id, "completed")}>
          <Text style={styles.mainBtnText}>✓ إكمال المهمة</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderFieldCard = (task: FieldTask) => (
    <View key={`ft-${task.id}`} style={[styles.taskCard, { borderLeftColor: Colors.warning, borderLeftWidth: 3 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: Colors.warning + "20" }]}>
          <Ionicons name="construct" size={14} color={Colors.warning} />
          <Text style={[styles.typeText, { color: Colors.warning }]}>مهمة ميدانية</Text>
        </View>
        <Text style={styles.refText}>#{task.serviceNumber}</Text>
      </View>

      {task.clientName ? <Text style={styles.clientName}>{task.clientName}</Text> : null}
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
        <TouchableOpacity style={styles.actionBtn} onPress={() => callPhone(task.phoneNumber)}>
          <Ionicons name="call" size={20} color={Colors.success} />
          <Text style={[styles.actionBtnText, { color: Colors.success }]}>اتصال</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => copyText(task.location)}>
          <Ionicons name="copy-outline" size={20} color={Colors.primaryLight} />
          <Text style={[styles.actionBtnText, { color: Colors.primaryLight }]}>نسخ الموقع</Text>
        </TouchableOpacity>
      </View>

      {mapStatus(task.status) === "new" && (
        <TouchableOpacity style={styles.mainBtn} onPress={() => updateFieldStatus(task.id, "in_progress")}>
          <Text style={styles.mainBtnText}>▶ بدء التنفيذ</Text>
        </TouchableOpacity>
      )}
      {mapStatus(task.status) === "pending" && (
        <TouchableOpacity style={[styles.mainBtn, { backgroundColor: Colors.success }]}
          onPress={() => { setSelectedFieldTask(task); setIsCompleteModal(true); }}>
          <Text style={styles.mainBtnText}>✓ إكمال المهمة</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderGeneralCard = (task: GeneralTask) => (
    <View key={`gt-${task.id}`} style={[styles.taskCard, { borderLeftColor: Colors.roles.supervisor, borderLeftWidth: 3 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: Colors.roles.supervisor + "20" }]}>
          <Ionicons name="clipboard-outline" size={14} color={Colors.roles.supervisor} />
          <Text style={[styles.typeText, { color: Colors.roles.supervisor }]}>مهمة إدارية</Text>
        </View>
        <Text style={styles.refText}>#{task.id}</Text>
      </View>
      <Text style={styles.clientName}>{task.description}</Text>
      <Text style={styles.dateText}>{formatDate(task.createdAt)}</Text>

      {mapStatus(task.status) === "new" && (
        <TouchableOpacity style={styles.mainBtn} onPress={() => updateGeneralStatus(task.id, "in_progress")}>
          <Text style={styles.mainBtnText}>▶ بدء التنفيذ</Text>
        </TouchableOpacity>
      )}
      {mapStatus(task.status) === "pending" && (
        <TouchableOpacity style={[styles.mainBtn, { backgroundColor: Colors.success }]} onPress={() => updateGeneralStatus(task.id, "completed")}>
          <Text style={styles.mainBtnText}>✓ إكمال المهمة</Text>
        </TouchableOpacity>
      )}
    </View>
  );

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
            {activeTab === "new" && [
              ...repairTickets.filter(t => mapStatus(t.status) === "new").map(renderRepairCard),
              ...installTickets.filter(t => mapStatus(t.status) === "new").map(renderInstallCard),
              ...fieldTasks.filter(t => mapStatus(t.status) === "new").map(renderFieldCard),
              ...generalTasks.filter(t => mapStatus(t.status) === "new").map(renderGeneralCard),
            ]}
            {activeTab === "pending" && [
              ...repairTickets.filter(t => mapStatus(t.status) === "pending").map(renderRepairCard),
              ...installTickets.filter(t => mapStatus(t.status) === "pending").map(renderInstallCard),
              ...fieldTasks.filter(t => mapStatus(t.status) === "pending").map(renderFieldCard),
              ...generalTasks.filter(t => mapStatus(t.status) === "pending").map(renderGeneralCard),
            ]}
            {activeTab === "completed" && [
              ...repairTickets.filter(t => mapStatus(t.status) === "completed").map(renderRepairCard),
              ...installTickets.filter(t => mapStatus(t.status) === "completed").map(renderInstallCard),
              ...fieldTasks.filter(t => mapStatus(t.status) === "completed").map(renderFieldCard),
              ...generalTasks.filter(t => mapStatus(t.status) === "completed").map(renderGeneralCard),
            ]}
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
                {selectedFieldTask.serviceNumber}
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

      {/* Custom Alert Modal */}
      <Modal visible={alertVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 24 }]}>
            <Text style={[styles.modalTitle, { marginBottom: 8 }]}>{alertTitle}</Text>
            <Text style={{ color: Colors.textSecondary, textAlign: "right", marginBottom: 16 }}>{alertMsg}</Text>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => setAlertVisible(false)}>
              <Text style={styles.confirmBtnText}>حسناً</Text>
            </TouchableOpacity>
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
  infoRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 5 },
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
