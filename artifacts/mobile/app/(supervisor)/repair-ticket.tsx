import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Linking, ActivityIndicator, Platform, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost } from "@/utils/api";

type Tab = "create" | "open" | "in_progress" | "completed";

const TAB_LABELS: Record<Tab, string> = {
  create: "إنشاء", open: "مفتوحة", in_progress: "جارية", completed: "منجزة",
};

export default function RepairTicketScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("create");
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* نموذج الإنشاء */
  const [serviceNumber, setServiceNumber] = useState("");
  const [clientData, setClientData] = useState<any>(null);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [assignMode, setAssignMode] = useState<"all" | "specific">("all");
  const [assignedToId, setAssignedToId] = useState<number | null>(null);
  const [assignedToName, setAssignedToName] = useState("");
  const [fetching, setFetching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [engineers, setEngineers] = useState<{ id: number; name: string; phone: string }[]>([]);

  const [modal, setModal] = useState({
    visible: false, title: "", message: "", color: Colors.success, goBack: false,
  });
  const showModal = (title: string, message: string, color = Colors.error, goBack = false) =>
    setModal({ visible: true, title, message, color, goBack });

  useEffect(() => {
    apiGet("/users/engineers", token).then(setEngineers).catch(() => {});
    fetchTickets();
  }, [token]);

  const fetchTickets = useCallback(async () => {
    try {
      const data = await apiGet("/tickets/repair", token);
      setTickets(data);
    } catch {} finally {
      setLoadingTickets(false); setRefreshing(false);
    }
  }, [token]);

  const detectType = (num: string) => num.toLowerCase().startsWith("p") ? "broadband" : "hotspot";

  const handleFetch = async () => {
    const cleaned = serviceNumber.trim();
    if (!cleaned) return;
    setFetching(true);
    setClientData(null);
    const type = detectType(cleaned);
    try {
      const endpoint = type === "broadband" ? "/network/broadband-points" : "/network/hotspot-points";
      const points = await apiGet(endpoint, token).catch(() => []);
      const numericId = parseInt(cleaned.replace(/\D/g, ""));
      const match = (points as any[]).find(
        (p: any) => p.id === numericId || p.flashNumber === cleaned || p.name?.includes(cleaned)
      );
      if (match) {
        setClientData({
          name: match.clientName ?? match.name,
          phone: match.clientPhone ?? match.phone,
          location: match.locationDescription ?? match.location,
          locationUrl: match.locationUrl,
          type,
          status: match.status,
          subscriptionFee: match.subscriptionFee ?? match.price,
        });
      } else {
        setClientData({ name: `عميل ${type === "broadband" ? "برودباند" : "هوتسبوت"} - ${cleaned}`, type });
      }
    } catch {
      setClientData({ name: `خدمة رقم ${cleaned}`, type });
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async () => {
    if (!serviceNumber.trim()) {
      showModal("خطأ", "أدخل رقم الخدمة أولاً");
      return;
    }
    setSubmitting(true);
    try {
      const newTicket = await apiPost("/tickets/repair", token, {
        serviceNumber: serviceNumber.trim(),
        clientName: clientData?.name,
        clientPhone: clientData?.phone,
        serviceType: detectType(serviceNumber),
        problemDescription: description.trim() || null,
        notes: notes.trim() || null,
        assignedToId: assignMode === "specific" ? assignedToId : null,
        assignedToName: assignMode === "specific" ? assignedToName : null,
        locationUrl: clientData?.locationUrl ?? null,
      });
      setTickets((prev) => [newTicket, ...prev]);
      setServiceNumber(""); setClientData(null); setDescription(""); setNotes("");
      setAssignMode("all"); setAssignedToId(null); setAssignedToName("");
      showModal("تم الإنشاء", "تم إنشاء تذكرة الإصلاح بنجاح", Colors.success);
      setActiveTab("open");
    } catch (e: any) {
      showModal("خطأ", e?.message ?? "فشل إنشاء التذكرة");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const updated = await apiPost(`/tickets/repair`, token, {}).catch(() => null);
      // Use PATCH
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL ?? ""}/tickets/repair/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status }),
        }
      );
      if (res.ok) {
        const upd = await res.json();
        setTickets((prev) => prev.map((t) => t.id === id ? upd : t));
      }
    } catch {}
  };

  const filteredTickets = tickets.filter((t) => {
    if (activeTab === "open")        return t.status === "open" || t.status === "pending";
    if (activeTab === "in_progress") return t.status === "in_progress";
    if (activeTab === "completed")   return t.status === "completed";
    return false;
  });

  const renderTicket = (t: any) => (
    <View key={t.id} style={styles.ticketCard}>
      <View style={styles.ticketHeader}>
        <View style={[styles.typeBadge, { backgroundColor: (t.serviceType === "broadband" ? Colors.info : Colors.primary) + "22" }]}>
          <Text style={[styles.typeBadgeText, { color: t.serviceType === "broadband" ? Colors.info : Colors.primary }]}>
            {t.serviceType === "broadband" ? "برودباند" : "هوتسبوت"} — {t.serviceNumber}
          </Text>
        </View>
        <Text style={styles.ticketName}>{t.clientName ?? "—"}</Text>
      </View>

      {!!t.clientPhone && (
        <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(`tel:${t.clientPhone}`)}>
          <Text style={[styles.infoText, { color: Colors.success }]}>{t.clientPhone}</Text>
          <Ionicons name="call" size={14} color={Colors.success} />
        </TouchableOpacity>
      )}
      {!!t.locationUrl && (
        <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(t.locationUrl)}>
          <Text style={[styles.infoText, { color: Colors.info }]}>فتح الخريطة</Text>
          <Ionicons name="location" size={14} color={Colors.info} />
        </TouchableOpacity>
      )}
      {!!t.problemDescription && <Text style={styles.problemText}>{t.problemDescription}</Text>}
      {!!t.notes && <Text style={styles.notesText}>{t.notes}</Text>}
      {!!t.assignedToName && (
        <Text style={styles.assignedText}>الفني: {t.assignedToName}</Text>
      )}

      <View style={styles.ticketActions}>
        {(t.status === "open" || t.status === "pending") && (
          <TouchableOpacity style={[styles.actBtn, { backgroundColor: Colors.warning + "22" }]}
            onPress={() => updateStatus(t.id, "in_progress")}>
            <Text style={[styles.actBtnText, { color: Colors.warning }]}>بدء التنفيذ</Text>
          </TouchableOpacity>
        )}
        {t.status === "in_progress" && (
          <TouchableOpacity style={[styles.actBtn, { backgroundColor: Colors.success + "22" }]}
            onPress={() => updateStatus(t.id, "completed")}>
            <Text style={[styles.actBtnText, { color: Colors.success }]}>إنجاز</Text>
          </TouchableOpacity>
        )}
        {t.status !== "completed" && (
          <TouchableOpacity style={[styles.actBtn, { backgroundColor: Colors.error + "22" }]}
            onPress={() => updateStatus(t.id, "archived")}>
            <Text style={[styles.actBtnText, { color: Colors.error }]}>أرشفة</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* رأس الصفحة */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>تذاكر الإصلاح</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* تبويبات */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.tabsBar} contentContainerStyle={styles.tabsContent}>
        {(["create", "open", "in_progress", "completed"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {TAB_LABELS[t]}
              {t !== "create" && tickets.filter((tk) => {
                if (t === "open") return tk.status === "open" || tk.status === "pending";
                return tk.status === t;
              }).length > 0
                ? ` (${tickets.filter((tk) => {
                    if (t === "open") return tk.status === "open" || tk.status === "pending";
                    return tk.status === t;
                  }).length})`
                : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {activeTab === "create" ? (
        /* ─── نموذج الإنشاء ─── */
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* رقم الخدمة */}
          <Text style={styles.fieldLabel}>رقم الخدمة (مثال: 30 هوتسبوت، p30 برودباند)</Text>
          <View style={styles.fetchRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={serviceNumber}
              onChangeText={setServiceNumber}
              placeholder="أدخل رقم الخدمة"
              placeholderTextColor={Colors.textSecondary}
              textAlign="right"
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.fetchBtn} onPress={handleFetch} disabled={fetching}>
              {fetching
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.fetchBtnText}>جلب البيانات</Text>
              }
            </TouchableOpacity>
          </View>

          {/* بيانات العميل المجلوبة */}
          {clientData && (
            <View style={styles.clientCard}>
              <View style={styles.clientHeader}>
                <View style={[styles.typeBadge, {
                  backgroundColor: (clientData.type === "broadband" ? Colors.info : Colors.primary) + "22",
                }]}>
                  <Text style={[styles.typeBadgeText, {
                    color: clientData.type === "broadband" ? Colors.info : Colors.primary,
                  }]}>
                    {clientData.type === "broadband" ? "برودباند" : "هوتسبوت"}
                  </Text>
                </View>
                <Text style={styles.clientName}>{clientData.name}</Text>
              </View>
              {!!clientData.phone && (
                <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(`tel:${clientData.phone}`)}>
                  <Text style={[styles.infoText, { color: Colors.success }]}>{clientData.phone}</Text>
                  <Ionicons name="call" size={14} color={Colors.success} />
                </TouchableOpacity>
              )}
              {!!clientData.location && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>{clientData.location}</Text>
                  <Ionicons name="location" size={14} color={Colors.textSecondary} />
                </View>
              )}
            </View>
          )}

          {/* وصف المشكلة */}
          <Text style={styles.fieldLabel}>وصف المشكلة (اختياري)</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={description}
            onChangeText={setDescription}
            placeholder="صف المشكلة..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            textAlign="right"
            textAlignVertical="top"
          />

          {/* ملاحظات */}
          <Text style={styles.fieldLabel}>ملاحظات (اختياري)</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={notes}
            onChangeText={setNotes}
            placeholder="أي ملاحظات إضافية..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            textAlign="right"
            textAlignVertical="top"
          />

          {/* الفني المسؤول */}
          <Text style={styles.fieldLabel}>الفني المسؤول</Text>
          <View style={styles.assignRow}>
            <TouchableOpacity
              style={[styles.assignBtn, assignMode === "all" && styles.assignBtnActive]}
              onPress={() => { setAssignMode("all"); setAssignedToId(null); setAssignedToName(""); }}
            >
              <Text style={[styles.assignBtnText, assignMode === "all" && styles.assignBtnTextActive]}>الكل</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.assignBtn, assignMode === "specific" && styles.assignBtnActive]}
              onPress={() => setAssignMode("specific")}
            >
              <Text style={[styles.assignBtnText, assignMode === "specific" && styles.assignBtnTextActive]}>تخصيص</Text>
            </TouchableOpacity>
          </View>

          {assignMode === "specific" && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.engRow}>
              {engineers.map((eng) => (
                <TouchableOpacity
                  key={eng.id}
                  style={[styles.engChip, assignedToId === eng.id && styles.engChipActive]}
                  onPress={() => { setAssignedToId(eng.id); setAssignedToName(eng.name); }}
                >
                  <Text style={[styles.engChipText, assignedToId === eng.id && styles.engChipTextActive]}>
                    {eng.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {engineers.length === 0 && (
                <Text style={styles.emptyEngText}>لا يوجد مهندسون مسجلون</Text>
              )}
            </ScrollView>
          )}
          {assignMode === "specific" && assignedToName ? (
            <Text style={styles.selectedHint}>✔ سيُسند للمهندس: {assignedToName}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>إنشاء تذكرة الإصلاح</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        /* ─── قائمة التذاكر ─── */
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {loadingTickets ? (
            <ActivityIndicator size="large" color={Colors.error} style={{ marginTop: 40 }} />
          ) : filteredTickets.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="construct-outline" size={40} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>لا توجد تذاكر</Text>
            </View>
          ) : filteredTickets.map(renderTicket)}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* مودال */}
      <Modal visible={modal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons
              name={modal.color === Colors.success ? "checkmark-circle" : "close-circle"}
              size={48} color={modal.color}
            />
            <Text style={styles.modalTitle}>{modal.title}</Text>
            <Text style={styles.modalMsg}>{modal.message}</Text>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: modal.color }]}
              onPress={() => {
                setModal((m) => ({ ...m, visible: false }));
                if (modal.goBack) router.back();
              }}
            >
              <Text style={styles.modalBtnText}>حسناً</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pageTitle: { fontSize: 18, fontWeight: "bold", color: Colors.text },
  tabsBar:   { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabsContent: { flexDirection: "row-reverse", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tab:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  tabActive:   { backgroundColor: Colors.error, borderColor: Colors.error },
  tabText:     { fontSize: 13, color: Colors.textSecondary },
  tabTextActive: { color: "#fff", fontWeight: "bold" },
  scrollContent: { padding: 16 },

  fieldLabel: { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: 6, marginTop: 14 },
  fetchRow:   { flexDirection: "row-reverse", gap: 10 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    color: Colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputMulti: { height: 80, textAlignVertical: "top" },
  fetchBtn:   { backgroundColor: Colors.error, borderRadius: 10, paddingHorizontal: 14, justifyContent: "center" },
  fetchBtnText: { color: "#fff", fontWeight: "bold", fontSize: 13 },

  clientCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.error + "44",
  },
  clientHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  clientName: { fontSize: 15, fontWeight: "bold", color: Colors.text },
  infoRow:  { flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 4 },
  infoText: { fontSize: 13, color: Colors.textSecondary },

  assignRow: { flexDirection: "row-reverse", gap: 10, marginTop: 2 },
  assignBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  assignBtnActive:   { backgroundColor: Colors.error, borderColor: Colors.error },
  assignBtnText:     { fontSize: 14, color: Colors.textSecondary },
  assignBtnTextActive: { color: "#fff", fontWeight: "bold" },

  engRow:    { flexDirection: "row-reverse", gap: 8, paddingVertical: 10 },
  engChip:   {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  engChipActive: { backgroundColor: Colors.error, borderColor: Colors.error },
  engChipText:   { fontSize: 13, color: Colors.textSecondary },
  engChipTextActive: { color: "#fff", fontWeight: "bold" },
  emptyEngText: { fontSize: 13, color: Colors.textSecondary, paddingVertical: 10 },
  selectedHint: { fontSize: 12, color: Colors.success, textAlign: "right", marginTop: 6 },

  submitBtn: {
    backgroundColor: Colors.error,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  ticketCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ticketHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  ticketName: { fontSize: 15, fontWeight: "bold", color: Colors.text },
  typeBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBadgeText: { fontSize: 11, fontWeight: "bold" },
  problemText: { fontSize: 13, color: Colors.text, textAlign: "right", marginTop: 6 },
  notesText:   { fontSize: 12, color: Colors.textSecondary, textAlign: "right", marginTop: 4 },
  assignedText: { fontSize: 12, color: Colors.info, textAlign: "right", marginTop: 4 },

  ticketActions: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  actBtn:        { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  actBtnText:    { fontSize: 12, fontWeight: "bold" },

  emptyBox:  { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },

  modalOverlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard:    { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, alignItems: "center", width: "100%", gap: 12 },
  modalTitle:   { fontSize: 18, fontWeight: "bold", color: Colors.text },
  modalMsg:     { fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
  modalBtn:     { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 32, marginTop: 8 },
  modalBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
});
