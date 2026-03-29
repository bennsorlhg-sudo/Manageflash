import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, Platform, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, apiPatch, formatDateTime } from "@/utils/api";

type Tab     = "create" | "new" | "preparing" | "in_progress" | "archived";
type SvcType = "hotspot_internal" | "broadband_internal" | "external";

const TAB_LABELS: Record<Tab, string> = {
  create: "إنشاء تذكرة", new: "جديدة", preparing: "تجهيز", in_progress: "تنفيذ", archived: "مؤرشفة",
};

const SVC_OPTIONS: { value: SvcType; label: string }[] = [
  { value: "hotspot_internal",   label: "داخلي — هوتسبوت" },
  { value: "broadband_internal", label: "داخلي — برودباند" },
  { value: "external",           label: "خارجي" },
];

const STATUS_COLOR: Record<string, string> = {
  new: "#9C27B0", preparing: "#FF9800", in_progress: "#2196F3", archived: Colors.textSecondary,
};

export default function InstallationTicketsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("create");
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState({ visible: false, title: "", message: "", color: Colors.success });
  const showModal = (t: string, m: string, c = Colors.error) => setModal({ visible: true, title: t, message: m, color: c });

  /* نموذج الإنشاء */
  const [svcType, setSvcType] = useState<SvcType>("hotspot_internal");
  const [form, setForm] = useState({
    clientName: "", clientPhone: "", locationDescription: "",
    locationUrl: "", subscriptionFee: "", notes: "",
  });
  const [assignedToId,   setAssignedToId]   = useState<number | null>(null);
  const [assignedToName, setAssignedToName] = useState("");
  const [engineers,      setEngineers]      = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    apiGet("/users/engineers", token).then(setEngineers).catch(() => {});
  }, [token]);

  const fetchTickets = useCallback(async () => {
    try {
      const data = await apiGet("/tickets/installation", token);
      setTickets(data);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const resetForm = () => {
    setForm({ clientName: "", clientPhone: "", locationDescription: "", locationUrl: "", subscriptionFee: "", notes: "" });
    setSvcType("hotspot_internal"); setAssignedToId(null); setAssignedToName("");
  };

  const handleSubmit = async () => {
    if (svcType !== "external" && !form.clientName.trim()) {
      showModal("خطأ", "أدخل اسم العميل");
      return;
    }
    if (svcType !== "external" && !form.clientPhone.trim()) {
      showModal("خطأ", "أدخل رقم الجوال");
      return;
    }
    setSubmitting(true);
    try {
      const newTicket = await apiPost("/tickets/installation", token, {
        serviceType: svcType,
        clientName: form.clientName.trim() || null,
        clientPhone: form.clientPhone.replace(/\D/g, "").trim() || null,
        address: form.locationDescription.trim() || null,
        locationUrl: form.locationUrl.trim() || null,
        subscriptionFee: parseFloat(form.subscriptionFee) || null,
        notes: form.notes.trim() || null,
        assignedToId: assignedToId ?? null,
        assignedToName: assignedToName || null,
      });
      setTickets((prev) => [newTicket, ...prev]);
      resetForm();
      showModal("تم الإنشاء", "تم إنشاء التذكرة بنجاح", Colors.success);
      setActiveTab("new");
    } catch (e: any) {
      showModal("خطأ", e?.message ?? "فشل إنشاء التذكرة");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const updated = await apiPatch(`/tickets/installation/${id}`, token, { status });
      setTickets((prev) => prev.map((t) => t.id === id ? updated : t));
    } catch (e: any) {
      showModal("خطأ", e?.message ?? "فشل تحديث الحالة");
    }
  };

  const filteredTickets = tickets.filter((t) => t.status === activeTab || (activeTab === "new" && t.status === "new"));

  const svcLabel = (type: string) => SVC_OPTIONS.find((s) => s.value === type)?.label ?? type;

  const renderTicket = (t: any) => (
    <View key={t.id} style={styles.ticketCard}>
      <View style={styles.ticketHeader}>
        <Text style={styles.ticketName}>{t.clientName ?? "خارجي"}</Text>
        <View style={[styles.typeBadge, { backgroundColor: (STATUS_COLOR[t.status] ?? Colors.primary) + "22" }]}>
          <Text style={[styles.typeBadgeText, { color: STATUS_COLOR[t.status] ?? Colors.primary }]}>
            {TAB_LABELS[t.status as Tab] ?? t.status}
          </Text>
        </View>
      </View>

      <Text style={styles.svcType}>{svcLabel(t.serviceType)}</Text>

      {!!t.clientPhone && (
        <View style={styles.actionRowInline}>
          <TouchableOpacity style={styles.inlineBtn} onPress={() => Linking.openURL(`tel:${t.clientPhone}`)}>
            <Ionicons name="call" size={14} color={Colors.success} />
            <Text style={[styles.inlineBtnText, { color: Colors.success }]}>اتصال</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.inlineBtn} onPress={() => {/* clipboard not critical */}}>
            <Ionicons name="copy" size={14} color={Colors.textSecondary} />
            <Text style={styles.inlineBtnText}>{t.clientPhone}</Text>
          </TouchableOpacity>
        </View>
      )}
      {!!t.address && (
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>{t.address}</Text>
          <Ionicons name="location" size={14} color={Colors.textSecondary} />
        </View>
      )}
      {!!t.locationUrl && (
        <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(t.locationUrl)}>
          <Text style={[styles.infoText, { color: Colors.info }]}>فتح الخريطة</Text>
          <Ionicons name="map" size={14} color={Colors.info} />
        </TouchableOpacity>
      )}
      {!!t.subscriptionFee && (
        <Text style={styles.feeText}>قيمة الاشتراك: {t.subscriptionFee} ريال</Text>
      )}
      {!!t.notes && <Text style={styles.notesText}>{t.notes}</Text>}
      {!!t.assignedToName && <Text style={styles.assignedText}>الفني: {t.assignedToName}</Text>}
      <Text style={styles.dateText}>{formatDateTime(t.createdAt)}</Text>

      <View style={styles.actionRow}>
        {t.status === "new" && (
          <TouchableOpacity style={[styles.actBtn, { backgroundColor: "#FF980022" }]}
            onPress={() => updateStatus(t.id, "preparing")}>
            <Text style={[styles.actBtnText, { color: "#FF9800" }]}>تجهيز</Text>
          </TouchableOpacity>
        )}
        {t.status === "preparing" && (
          <TouchableOpacity style={[styles.actBtn, { backgroundColor: Colors.info + "22" }]}
            onPress={() => updateStatus(t.id, "in_progress")}>
            <Text style={[styles.actBtnText, { color: Colors.info }]}>تنفيذ</Text>
          </TouchableOpacity>
        )}
        {t.status !== "archived" && (
          <TouchableOpacity style={[styles.actBtn, { backgroundColor: Colors.textSecondary + "22" }]}
            onPress={() => updateStatus(t.id, "archived")}>
            <Text style={[styles.actBtnText, { color: Colors.textSecondary }]}>أرشفة</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const F = ({ label, value, onChange, placeholder, keyboard, multiline }: {
    label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; keyboard?: any; multiline?: boolean;
  }) => (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        placeholderTextColor={Colors.textSecondary}
        keyboardType={keyboard ?? "default"}
        textAlign="right"
        textAlignVertical={multiline ? "top" : "center"}
        multiline={multiline}
      />
    </>
  );

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* رأس */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>تذاكر التركيب</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* تبويبات */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.tabsBar} contentContainerStyle={styles.tabsContent}>
        {(["create", "new", "preparing", "in_progress", "archived"] as Tab[]).map((t) => {
          const count = t === "create" ? 0 : tickets.filter((tk) => tk.status === t).length;
          return (
            <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.tabActive]}
              onPress={() => setActiveTab(t)}>
              <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
                {TAB_LABELS[t]}{count > 0 ? ` (${count})` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {activeTab === "create" ? (
        /* ─── نموذج الإنشاء ─── */
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* نوع التركيب */}
          <Text style={styles.fieldLabel}>نوع التركيب</Text>
          <View style={styles.svcRow}>
            {SVC_OPTIONS.map((s) => (
              <TouchableOpacity key={s.value}
                style={[styles.svcBtn, svcType === s.value && styles.svcBtnActive]}
                onPress={() => setSvcType(s.value)}>
                <Text style={[styles.svcBtnText, svcType === s.value && styles.svcBtnTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* داخلي — هوتسبوت */}
          {svcType === "hotspot_internal" && (
            <>
              <F label="اسم العميل *" value={form.clientName} onChange={(v) => setForm((f) => ({ ...f, clientName: v }))} />
              <F label="رقم الجوال *" value={form.clientPhone} onChange={(v) => setForm((f) => ({ ...f, clientPhone: v }))} keyboard="phone-pad" />
              <F label="الموقع / الحي" value={form.locationDescription} onChange={(v) => setForm((f) => ({ ...f, locationDescription: v }))} />
              <F label="قيمة الاشتراك (ريال)" value={form.subscriptionFee} onChange={(v) => setForm((f) => ({ ...f, subscriptionFee: v }))} keyboard="decimal-pad" />
            </>
          )}

          {/* داخلي — برودباند */}
          {svcType === "broadband_internal" && (
            <>
              <F label="اسم العميل *" value={form.clientName} onChange={(v) => setForm((f) => ({ ...f, clientName: v }))} />
              <F label="رقم الجوال *" value={form.clientPhone} onChange={(v) => setForm((f) => ({ ...f, clientPhone: v }))} keyboard="phone-pad" />
              <F label="وصف الموقع" value={form.locationDescription} onChange={(v) => setForm((f) => ({ ...f, locationDescription: v }))} multiline />
              <F label="رابط الموقع" value={form.locationUrl} onChange={(v) => setForm((f) => ({ ...f, locationUrl: v }))} />
            </>
          )}

          {/* خارجي */}
          {svcType === "external" && (
            <>
              <F label="وصف الموقع" value={form.locationDescription} onChange={(v) => setForm((f) => ({ ...f, locationDescription: v }))} multiline />
              <F label="رابط الموقع" value={form.locationUrl} onChange={(v) => setForm((f) => ({ ...f, locationUrl: v }))} />
            </>
          )}

          {/* ملاحظات */}
          <F label="ملاحظات (اختياري)" value={form.notes} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} multiline />

          {/* إسناد الفني */}
          <Text style={styles.fieldLabel}>الفني المسؤول</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.engRow}>
            <TouchableOpacity
              style={[styles.engChip, assignedToId === null && styles.engChipActive]}
              onPress={() => { setAssignedToId(null); setAssignedToName(""); }}>
              <Text style={[styles.engChipText, assignedToId === null && styles.engChipTextActive]}>الكل</Text>
            </TouchableOpacity>
            {engineers.map((eng) => (
              <TouchableOpacity key={eng.id}
                style={[styles.engChip, assignedToId === eng.id && styles.engChipActive]}
                onPress={() => { setAssignedToId(eng.id); setAssignedToName(eng.name); }}>
                <Text style={[styles.engChipText, assignedToId === eng.id && styles.engChipTextActive]}>
                  {eng.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {assignedToId !== null && (
            <Text style={styles.selectedHint}>✔ سيُسند للمهندس: {assignedToName}</Text>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>إنشاء تذكرة التركيب</Text>
              </>
            )}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        /* ─── قائمة التذاكر ─── */
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTickets(); }} />}
        >
          {loading ? (
            <ActivityIndicator size="large" color={Colors.success} style={{ marginTop: 40 }} />
          ) : filteredTickets.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="document-text-outline" size={40} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>لا توجد تذاكر في هذه الفئة</Text>
            </View>
          ) : filteredTickets.map(renderTicket)}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* مودال */}
      <Modal visible={modal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name={modal.color === Colors.success ? "checkmark-circle" : "close-circle"} size={48} color={modal.color} />
            <Text style={styles.modalTitle}>{modal.title}</Text>
            <Text style={styles.modalMsg}>{modal.message}</Text>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: modal.color }]}
              onPress={() => setModal((m) => ({ ...m, visible: false }))}>
              <Text style={styles.modalBtnText}>حسناً</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pageTitle: { fontSize: 18, fontWeight: "bold", color: Colors.text },
  tabsBar:   { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabsContent: { flexDirection: "row-reverse", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tab:       { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  tabActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  tabText:   { fontSize: 12, color: Colors.textSecondary },
  tabTextActive: { color: "#fff", fontWeight: "bold" },
  scrollContent: { padding: 16 },

  fieldLabel: { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: Colors.surface, borderRadius: 10, padding: 12,
    color: Colors.text, fontSize: 14, borderWidth: 1, borderColor: Colors.border,
  },
  inputMulti: { height: 80, textAlignVertical: "top" },

  svcRow: { flexDirection: "row-reverse", gap: 8, flexWrap: "wrap", marginBottom: 4 },
  svcBtn: {
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  svcBtnActive:   { backgroundColor: Colors.success, borderColor: Colors.success },
  svcBtnText:     { fontSize: 12, color: Colors.textSecondary },
  svcBtnTextActive: { color: "#fff", fontWeight: "bold" },

  engRow: { flexDirection: "row-reverse", gap: 8, paddingVertical: 8 },
  engChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  engChipActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  engChipText:   { fontSize: 13, color: Colors.textSecondary },
  engChipTextActive: { color: "#fff", fontWeight: "bold" },
  selectedHint: { fontSize: 12, color: Colors.success, textAlign: "right", marginTop: 6 },

  submitBtn: {
    backgroundColor: Colors.success, borderRadius: 12, padding: 14,
    flexDirection: "row-reverse", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 20,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  ticketCard: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  ticketHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  ticketName:   { fontSize: 15, fontWeight: "bold", color: Colors.text },
  typeBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBadgeText: { fontSize: 11, fontWeight: "bold" },
  svcType:      { fontSize: 12, color: Colors.textSecondary, textAlign: "right", marginBottom: 6 },
  infoRow:      { flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 4 },
  infoText:     { fontSize: 13, color: Colors.textSecondary },
  feeText:      { fontSize: 13, color: "#00BCD4", textAlign: "right", marginTop: 4 },
  notesText:    { fontSize: 12, color: Colors.textSecondary, textAlign: "right", marginTop: 4 },
  assignedText: { fontSize: 12, color: Colors.info, textAlign: "right", marginTop: 4 },
  dateText:     { fontSize: 11, color: Colors.textSecondary, textAlign: "right", marginTop: 6 },

  actionRowInline: { flexDirection: "row-reverse", gap: 8, marginTop: 4 },
  inlineBtn:    { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  inlineBtnText: { fontSize: 12, color: Colors.textSecondary },

  actionRow:    { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  actBtn:       { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  actBtnText:   { fontSize: 12, fontWeight: "bold" },

  emptyBox:  { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },

  modalOverlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard:    { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, alignItems: "center", width: "100%", gap: 12 },
  modalTitle:   { fontSize: 18, fontWeight: "bold", color: Colors.text },
  modalMsg:     { fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
  modalBtn:     { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 32, marginTop: 8 },
  modalBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
});
