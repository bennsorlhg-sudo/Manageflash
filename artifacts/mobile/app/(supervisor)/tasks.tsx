import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, Modal, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiDelete, formatDate } from "@/utils/api";

/* ─── حالات العرض ─── */
const STATUS_INFO: Record<string, { bg: string; color: string; label: string }> = {
  pending:     { bg: "#FF980022", color: "#FF9800", label: "جديدة" },
  new:         { bg: "#FF980022", color: "#FF9800", label: "جديدة" },
  draft:       { bg: Colors.surfaceElevated, color: Colors.textSecondary, label: "مسودة" },
  in_progress: { bg: "#2196F322", color: "#2196F3", label: "جاري التنفيذ" },
  completed:   { bg: "#4CAF5022", color: "#4CAF50", label: "مكتملة" },
  archived:    { bg: Colors.surfaceElevated, color: Colors.textSecondary, label: "مؤرشفة" },
};

const SERVICE_TYPE_AR: Record<string, string> = {
  hotspot_internal: "هوتسبوت داخلي",
  hotspot_external: "هوتسبوت خارجي",
  broadband:        "برودباند",
  hotspot:          "هوتسبوت",
};

const FILTERS = [
  { key: "all",         label: "الكل" },
  { key: "pending",     label: "جديدة" },
  { key: "in_progress", label: "جاري" },
  { key: "completed",   label: "مكتملة" },
  { key: "draft",       label: "مسودة" },
];

export default function TaskTrackingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();

  const [filter,        setFilter]        = useState("all");
  const [tasks,         setTasks]         = useState<any[]>([]);
  const [repairTickets, setRepairTickets] = useState<any[]>([]);
  const [installTickets,setInstallTickets]= useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [activeSource,  setActiveSource]  = useState<"tasks" | "repair" | "install">("repair");

  /* مودال الحذف */
  const [deleteModal, setDeleteModal] = useState<{ visible: boolean; id: number | null }>({
    visible: false, id: null,
  });
  const [deleting, setDeleting] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [t, r, i] = await Promise.all([
        apiGet("/tasks", token),
        apiGet("/tickets/repair", token),
        apiGet("/tickets/installation", token),
      ]);
      setTasks(Array.isArray(t) ? t : []);
      setRepairTickets(Array.isArray(r) ? r : []);
      setInstallTickets(Array.isArray(i) ? i : []);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getItems = () => {
    if (activeSource === "repair")  return repairTickets;
    if (activeSource === "install") return installTickets;
    return tasks;
  };

  const filtered = getItems().filter(item => {
    if (filter === "all")         return true;
    if (filter === "draft")       return item.status === "draft";
    if (filter === "pending")     return ["pending", "new"].includes(item.status ?? "");
    if (filter === "in_progress") return item.status === "in_progress";
    if (filter === "completed")   return ["completed", "archived"].includes(item.status ?? "");
    return true;
  });

  const getStatusInfo = (status: string) => STATUS_INFO[status]
    ?? { bg: Colors.surfaceElevated, color: Colors.textSecondary, label: status };

  /* حذف التذكرة */
  const confirmDelete = (id: number) => setDeleteModal({ visible: true, id });
  const handleDelete = async () => {
    if (!deleteModal.id) return;
    setDeleting(true);
    try {
      await apiDelete(`/tickets/repair/${deleteModal.id}`, token);
      setRepairTickets(prev => prev.filter(t => t.id !== deleteModal.id));
    } catch {} finally {
      setDeleting(false);
      setDeleteModal({ visible: false, id: null });
    }
  };

  /* ─────────────── التحميل ─────────────── */
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.roles.supervisor} />
      </View>
    );
  }

  /* ─────────────── الواجهة ─────────────── */
  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* رأس */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>متابعة المهام</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* تبديل المصدر */}
      <View style={styles.sourceRow}>
        {[
          { key: "repair",  label: "الإصلاح",  count: repairTickets.length,  color: Colors.error },
          { key: "install", label: "التركيبات", count: installTickets.length, color: Colors.info  },
          { key: "tasks",   label: "المهام",     count: tasks.length,          color: Colors.warning},
        ].map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.sourceBtn, activeSource === s.key && { backgroundColor: s.color + "22", borderColor: s.color }]}
            onPress={() => setActiveSource(s.key as any)}
          >
            {s.count > 0 && (
              <View style={[styles.badge, { backgroundColor: s.color }]}>
                <Text style={styles.badgeText}>{s.count}</Text>
              </View>
            )}
            <Text style={[styles.sourceBtnText, activeSource === s.key && { color: s.color, fontWeight: "bold" }]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* فلتر الحالة */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterBtnText, filter === f.key && styles.filterBtnTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor={Colors.roles.supervisor} />}
      >
        <Text style={styles.countText}>{filtered.length} عنصر</Text>

        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-circle-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>لا توجد عناصر في هذا الفلتر</Text>
          </View>
        ) : activeSource === "repair" ? (
          filtered.map(item => <RepairCard key={item.id} item={item} onDelete={() => confirmDelete(item.id)} />)
        ) : (
          filtered.map(item => <GenericCard key={item.id} item={item} source={activeSource} />)
        )}

        <View style={{ height: 50 }} />
      </ScrollView>

      {/* مودال تأكيد الحذف */}
      <Modal visible={deleteModal.visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Ionicons name="trash" size={48} color={Colors.error} />
            <Text style={styles.modalTitle}>حذف التذكرة</Text>
            <Text style={styles.modalMsg}>هل أنت متأكد من حذف التذكرة؟{"\n"}لن تظهر للمهندس الفني بعد الحذف.</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: Colors.error }]}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalBtnText}>حذف</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }]}
                onPress={() => setDeleteModal({ visible: false, id: null })}
                disabled={deleting}
              >
                <Text style={[styles.modalBtnText, { color: Colors.textSecondary }]}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ──────────────────────────────────────────
   بطاقة تذكرة الإصلاح
────────────────────────────────────────── */
function RepairCard({ item, onDelete }: { item: any; onDelete: () => void }) {
  const si = item.status === "new"     ? STATUS_INFO["pending"]
           : item.status === "archived" ? STATUS_INFO["archived"]
           : STATUS_INFO[item.status] ?? { bg: Colors.surfaceElevated, color: Colors.textSecondary, label: item.status };

  const serviceLabel = SERVICE_TYPE_AR[item.serviceType] ?? item.serviceType ?? "—";
  const serviceColor = item.serviceType === "broadband"        ? Colors.info
                     : item.serviceType === "hotspot_external" ? Colors.warning
                     : Colors.primary;
  const showContact = item.serviceType !== "hotspot_external";

  return (
    <View style={styles.card}>
      {/* ── رأس البطاقة ── */}
      <View style={styles.cardHeader}>
        <View style={[styles.typePill, { backgroundColor: serviceColor + "22" }]}>
          <Text style={[styles.typePillText, { color: serviceColor }]}>{serviceLabel}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: si.bg }]}>
          <Text style={[styles.statusPillText, { color: si.color }]}>{si.label}</Text>
        </View>
      </View>

      <Text style={styles.serviceNum}>رقم الخدمة: {item.serviceNumber ?? "—"}</Text>

      {showContact && item.clientName && (
        <Text style={styles.cardText}>{item.clientName}</Text>
      )}
      {showContact && item.clientPhone && (
        <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(`tel:${item.clientPhone}`)}>
          <Ionicons name="call-outline" size={14} color={Colors.success} />
          <Text style={[styles.cardText, { color: Colors.success }]}>{item.clientPhone}</Text>
        </TouchableOpacity>
      )}
      {item.location && (
        <Text style={styles.locationText}>{item.location}</Text>
      )}
      {item.locationUrl && (
        <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(item.locationUrl)}>
          <Ionicons name="location-outline" size={14} color={Colors.info} />
          <Text style={[styles.cardText, { color: Colors.info }]}>فتح الخريطة</Text>
        </TouchableOpacity>
      )}
      {item.problemDescription && (
        <Text style={styles.problemText}>{item.problemDescription}</Text>
      )}
      {/* التخصيص */}
      <View style={styles.assignBadge}>
        {item.assignedToName ? (
          <>
            <Ionicons name="person-circle" size={14} color={Colors.primary} />
            <Text style={[styles.assignBadgeText, { color: Colors.primary }]}>
              مخصصة للمهندس: {item.assignedToName}
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="people-circle-outline" size={14} color={Colors.roles.supervisor} />
            <Text style={[styles.assignBadgeText, { color: Colors.roles.supervisor }]}>
              مرسلة للكل
            </Text>
          </>
        )}
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <Ionicons name="trash-outline" size={15} color={Colors.error} />
          <Text style={styles.deleteBtnText}>حذف</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ──────────────────────────────────────────
   بطاقة عامة (تركيبات / مهام)
────────────────────────────────────────── */
function GenericCard({ item, source }: { item: any; source: string }) {
  const si = STATUS_INFO[item.status === "new" ? "pending" : item.status]
    ?? { bg: Colors.surfaceElevated, color: Colors.textSecondary, label: item.status ?? "" };

  const title = source === "install"
    ? `تركيب: ${item.clientName ?? "—"}`
    : item.title ?? item.description ?? "مهمة";

  const sub = source === "install"
    ? (item.address ?? item.serviceType ?? "")
    : (item.targetPersonName ?? item.targetRole ?? "");

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.genericTitle}>{title}</Text>
        <View style={[styles.statusPill, { backgroundColor: si.bg }]}>
          <Text style={[styles.statusPillText, { color: si.color }]}>{si.label}</Text>
        </View>
      </View>
      {!!sub && <Text style={styles.cardText}>{sub}</Text>}
      {item.assignedToName && <Text style={styles.assignedText}>المهندس: {item.assignedToName}</Text>}
      <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
    </View>
  );
}

/* ──────────────────────────────────────────
   الأنماط
────────────────────────────────────────── */
const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },

  sourceRow: { flexDirection: "row-reverse", padding: 12, gap: 8 },
  sourceBtn: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  sourceBtnText: { fontSize: 12, color: Colors.textSecondary },
  badge: {
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
  badgeText: { fontSize: 10, color: "#fff", fontWeight: "bold" },

  filterScroll: { maxHeight: 44 },
  filterContent: { flexDirection: "row-reverse", paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterBtnText: { fontSize: 12, color: Colors.textSecondary },
  filterBtnTextActive: { color: "#fff", fontWeight: "bold" },

  content:   { padding: 14 },
  countText: { color: Colors.textMuted, fontSize: 12, textAlign: "right", marginBottom: 8 },
  emptyBox:  { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },

  /* البطاقة */
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  typePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  typePillText: { fontSize: 12, fontWeight: "bold" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusPillText: { fontSize: 11, fontWeight: "bold" },

  serviceNum:    { fontSize: 14, fontWeight: "bold", color: Colors.text, textAlign: "right" },
  genericTitle:  { fontSize: 14, fontWeight: "bold", color: Colors.text, textAlign: "right", flex: 1 },
  cardText:      { fontSize: 13, color: Colors.textSecondary, textAlign: "right" },
  locationText:  { fontSize: 13, color: Colors.textSecondary, textAlign: "right" },
  problemText:   { fontSize: 13, color: Colors.text, textAlign: "right", fontStyle: "italic" },
  assignedText:  { fontSize: 12, color: Colors.textMuted, textAlign: "right" },
  dateText:      { fontSize: 11, color: Colors.textMuted, textAlign: "right" },

  infoRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  cardFooter: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  deleteBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  deleteBtnText: { fontSize: 13, color: Colors.error, fontWeight: "600" },
  assignBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: "flex-end",
  },
  assignBadgeText: { fontSize: 12, fontWeight: "600" },

  /* مودال الحذف */
  overlay: { flex: 1, backgroundColor: "#000000BB", alignItems: "center", justifyContent: "center" },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 28,
    width: "84%",
    alignItems: "center",
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: Colors.text },
  modalMsg:   { fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
  modalBtns:  { flexDirection: "row-reverse", gap: 10, marginTop: 6 },
  modalBtn:   { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  modalBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
});
