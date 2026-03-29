/**
 * نظام تذاكر التركيب
 * مراحل: إنشاء → جديدة → تجهيز → تنفيذ → أرشفة
 */
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, Platform, Modal,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, apiDelete, formatDateTime } from "@/utils/api";

/* ─── أنواع ─── */
type Tab     = "create" | "new" | "preparing" | "in_progress" | "archived";
type SvcType = "hotspot_internal" | "broadband_internal" | "external";
type SubType = "hotspot" | "broadband" | null;

const TAB_LABELS: Record<Tab, string> = {
  create: "إنشاء", new: "جديدة", preparing: "تجهيز", in_progress: "تنفيذ", archived: "مؤرشفة",
};
const TAB_COLORS: Record<Tab, string> = {
  create:     "#9C27B0",
  new:        "#FF9800",
  preparing:  "#2196F3",
  in_progress:"#4CAF50",
  archived:   Colors.textSecondary,
};

interface RelayPoint { description: string; locationUrl: string; }

/* ─────────────────────────────────────────────────── */
export default function InstallationTicketsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [activeTab, setActiveTab]   = useState<Tab>("create");
  const [tickets, setTickets]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [engineers, setEngineers]   = useState<{id:number; name:string}[]>([]);

  /* نتيجة العمليات */
  const [resultModal, setResultModal] = useState({ visible: false, title: "", msg: "", ok: true });
  const showResult = (title: string, msg: string, ok = true) =>
    setResultModal({ visible: true, title, msg, ok });

  /* ── الحالة الخاصة بمودال التجهيز ── */
  const [prepTicket,  setPrepTicket]  = useState<any>(null);
  const [prepVisible, setPrepVisible] = useState(false);

  /* ── مودال الأرشفة ── */
  const [archTicket,  setArchTicket]  = useState<any>(null);
  const [archVisible, setArchVisible] = useState(false);
  const [archNotes,   setArchNotes]   = useState("");

  /* ── مودال حذف ── */
  const [delTicket,  setDelTicket]  = useState<any>(null);
  const [delVisible, setDelVisible] = useState(false);

  /* ─── جلب البيانات ─── */
  useEffect(() => {
    apiGet("/engineers", token).then(setEngineers).catch(() => {});
    fetchTickets();
  }, [token]);

  const fetchTickets = useCallback(async () => {
    try {
      const data = await apiGet("/tickets/installation?parentOnly=true", token);
      setTickets(data);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  /* ─── عدد التذاكر لكل تبويب ─── */
  const tabCount = (t: Tab) => t === "create" ? 0 :
    tickets.filter(tk => tk.status === t).length;

  /* ─── حذف تذكرة ─── */
  const handleDelete = async () => {
    if (!delTicket) return;
    try {
      await apiDelete(`/tickets/installation/${delTicket.id}`, token);
      setTickets(prev => prev.filter(t => t.id !== delTicket.id));
    } catch (e: any) { showResult("خطأ", e?.message ?? "فشل الحذف", false); }
    finally { setDelVisible(false); setDelTicket(null); }
  };

  /* ─── تنفيذ ─── */
  const handleExecute = async (id: number) => {
    try {
      const res = await apiPost(`/tickets/installation/${id}/execute`, token, {});
      setTickets(prev => prev.map(t => t.id === id ? res : t));
    } catch (e: any) { showResult("خطأ", e?.message ?? "فشل التنفيذ", false); }
  };

  /* ─── أرشفة ─── */
  const handleArchive = async () => {
    if (!archTicket) return;
    try {
      const res = await apiPost(`/tickets/installation/${archTicket.id}/archive`, token, {
        archiveNotes: archNotes.trim() || null,
      });
      setTickets(prev => prev.map(t => t.id === archTicket.id ? res : t));
      showResult("تمت الأرشفة", "تم حفظ البيانات في قاعدة البيانات بنجاح", true);
    } catch (e: any) { showResult("خطأ", e?.message ?? "فشل الأرشفة", false); }
    finally { setArchVisible(false); setArchTicket(null); setArchNotes(""); }
  };

  /* ─── قائمة التذاكر ─── */
  const renderTicket = (t: any) => {
    const color = TAB_COLORS[t.status as Tab] ?? Colors.textSecondary;
    return (
      <View key={t.id} style={[styles.card, { borderLeftWidth: 3, borderLeftColor: color }]}>
        {/* رأس البطاقة */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>
              {t.clientName ?? (t.address ? t.address.slice(0, 30) : "تذكرة تركيب")}
            </Text>
            <Text style={styles.cardSvcType}>{SVC_LABEL[t.serviceType] ?? t.serviceType}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: color + "22" }]}>
            <Text style={[styles.statusText, { color }]}>{TAB_LABELS[t.status as Tab] ?? t.status}</Text>
          </View>
        </View>

        {/* بيانات العميل */}
        {!!t.clientPhone && (
          <View style={styles.rowItem}>
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${t.clientPhone}`)}>
              <View style={styles.actionChip}>
                <Ionicons name="call" size={13} color={Colors.success} />
                <Text style={[styles.chipText, { color: Colors.success }]}>{t.clientPhone}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
        {!!t.address && (
          <View style={styles.rowItem}>
            <Ionicons name="location-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.infoText}>{t.address}</Text>
          </View>
        )}
        {!!t.locationUrl && (
          <TouchableOpacity style={styles.rowItem} onPress={() => Linking.openURL(t.locationUrl)}>
            <Ionicons name="map" size={13} color={Colors.info} />
            <Text style={[styles.infoText, { color: Colors.info }]}>فتح الخريطة</Text>
          </TouchableOpacity>
        )}
        {!!t.subscriptionFee && (
          <View style={styles.rowItem}>
            <Ionicons name="cash-outline" size={13} color="#00BCD4" />
            <Text style={[styles.infoText, { color: "#00BCD4" }]}>الاشتراك: {t.subscriptionFee} ريال</Text>
          </View>
        )}
        {!!t.assignedToName && (
          <View style={styles.rowItem}>
            <Ionicons name="person-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.infoText}>الفني: {t.assignedToName}</Text>
          </View>
        )}
        {t.hasRelayPoints && (
          <View style={styles.rowItem}>
            <Ionicons name="git-network-outline" size={13} color="#FF9800" />
            <Text style={[styles.infoText, { color: "#FF9800" }]}>يوجد نقاط وسيطة</Text>
          </View>
        )}
        <Text style={styles.dateText}>{formatDateTime(t.createdAt)}</Text>

        {/* أزرار الأكشن */}
        <View style={styles.actionRow}>
          {t.status === "new" && (
            <>
              <TouchableOpacity style={[styles.actBtn, { backgroundColor: "#2196F322" }]}
                onPress={() => { setPrepTicket(t); setPrepVisible(true); }}>
                <Text style={[styles.actBtnText, { color: "#2196F3" }]}>تجهيز</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actBtn, { backgroundColor: Colors.error + "22" }]}
                onPress={() => { setDelTicket(t); setDelVisible(true); }}>
                <Text style={[styles.actBtnText, { color: Colors.error }]}>حذف</Text>
              </TouchableOpacity>
            </>
          )}
          {t.status === "preparing" && (
            <TouchableOpacity style={[styles.actBtn, { backgroundColor: Colors.success + "22" }]}
              onPress={() => handleExecute(t.id)}>
              <Text style={[styles.actBtnText, { color: Colors.success }]}>بدء التنفيذ</Text>
            </TouchableOpacity>
          )}
          {t.status === "in_progress" && (
            <TouchableOpacity style={[styles.actBtn, { backgroundColor: Colors.textSecondary + "22" }]}
              onPress={() => { setArchTicket(t); setArchVisible(true); }}>
              <Text style={[styles.actBtnText, { color: Colors.textSecondary }]}>أرشفة</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* رأس الصفحة */}
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
          const count = tabCount(t);
          const col   = TAB_COLORS[t];
          return (
            <TouchableOpacity key={t}
              style={[styles.tab, activeTab === t && { backgroundColor: col, borderColor: col }]}
              onPress={() => setActiveTab(t)}>
              <Text style={[styles.tabText, activeTab === t && { color: "#fff" }]}>
                {TAB_LABELS[t]}{count > 0 ? ` (${count})` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* محتوى */}
      {activeTab === "create" ? (
        <CreateForm
          token={token}
          engineers={engineers}
          onCreated={(t) => {
            setTickets(prev => [t, ...prev]);
            setActiveTab("new");
            showResult("تم الإنشاء", "تم إنشاء تذكرة التركيب بنجاح");
          }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true); fetchTickets();
          }} />}
        >
          {loading ? (
            <ActivityIndicator size="large" color={TAB_COLORS[activeTab]} style={{ marginTop: 40 }} />
          ) : tickets.filter(t => t.status === activeTab).length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="document-text-outline" size={40} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>لا توجد تذاكر في هذه الفئة</Text>
            </View>
          ) : (
            tickets.filter(t => t.status === activeTab).map(renderTicket)
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── مودال التجهيز ── */}
      {prepVisible && prepTicket && (
        <PrepareModal
          ticket={prepTicket}
          engineers={engineers}
          token={token}
          onClose={() => { setPrepVisible(false); setPrepTicket(null); }}
          onDone={(updated) => {
            setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
            showResult("تم التجهيز", "تم حفظ بيانات التجهيز، يمكن الآن بدء التنفيذ");
            setPrepVisible(false); setPrepTicket(null);
          }}
        />
      )}

      {/* ── مودال الأرشفة ── */}
      <Modal visible={archVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "70%" }]}>
            <Text style={styles.modalTitle}>تأكيد الأرشفة</Text>
            {archTicket && (
              <ScrollView style={{ width: "100%" }}>
                <DataRow label="النوع"   value={SVC_LABEL[archTicket.serviceType] ?? archTicket.serviceType} />
                <DataRow label="العميل"  value={archTicket.clientName ?? "—"} />
                <DataRow label="الجهاز"  value={archTicket.deviceName ?? "—"} />
                <DataRow label="السيريال" value={archTicket.deviceSerial ?? "—"} />
                <DataRow label="الاشتراك" value={archTicket.subscriptionFee ? `${archTicket.subscriptionFee} ريال` : "—"} />
                <DataRow label="الموقع"  value={archTicket.address ?? "—"} />
              </ScrollView>
            )}
            <Text style={[styles.fieldLabel, { width: "100%", textAlign: "right", marginTop: 12 }]}>ملاحظات الأرشفة</Text>
            <TextInput
              style={[styles.input, { width: "100%", height: 70 }]}
              value={archNotes} onChangeText={setArchNotes}
              placeholder="أي ملاحظات..." placeholderTextColor={Colors.textSecondary}
              textAlign="right" textAlignVertical="top" multiline
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: Colors.textSecondary + "22" }]}
                onPress={() => { setArchVisible(false); setArchNotes(""); }}>
                <Text style={[styles.modalActionText, { color: Colors.textSecondary }]}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: Colors.success + "22" }]}
                onPress={handleArchive}>
                <Text style={[styles.modalActionText, { color: Colors.success }]}>تأكيد الأرشفة</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── مودال الحذف ── */}
      <Modal visible={delVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="trash" size={40} color={Colors.error} />
            <Text style={styles.modalTitle}>حذف التذكرة</Text>
            <Text style={styles.modalMsg}>هل تريد حذف هذه التذكرة نهائياً؟</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: Colors.textSecondary + "22" }]}
                onPress={() => { setDelVisible(false); setDelTicket(null); }}>
                <Text style={[styles.modalActionText, { color: Colors.textSecondary }]}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: Colors.error + "22" }]}
                onPress={handleDelete}>
                <Text style={[styles.modalActionText, { color: Colors.error }]}>حذف</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── مودال النتيجة ── */}
      <Modal visible={resultModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name={resultModal.ok ? "checkmark-circle" : "close-circle"}
              size={48} color={resultModal.ok ? Colors.success : Colors.error} />
            <Text style={styles.modalTitle}>{resultModal.title}</Text>
            <Text style={styles.modalMsg}>{resultModal.msg}</Text>
            <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: resultModal.ok ? Colors.success : Colors.error, paddingHorizontal: 32 }]}
              onPress={() => setResultModal(m => ({ ...m, visible: false }))}>
              <Text style={[styles.modalActionText, { color: "#fff" }]}>حسناً</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ═══════════════════════════════════════════════════
   مكوّن: نموذج الإنشاء (خطوات)
═══════════════════════════════════════════════════ */
const SVC_LABEL: Record<string, string> = {
  hotspot_internal:   "داخلي — هوتسبوت",
  broadband_internal: "داخلي — برودباند",
  external:           "خارجي",
};

function CreateForm({ token, engineers, onCreated }: {
  token: string | null;
  engineers: {id: number; name: string}[];
  onCreated: (t: any) => void;
}) {
  /* الخطوات: 1=نوع، 2=نوع فرعي (داخلي فقط)، 3=نموذج */
  const [step, setStep]           = useState<1|2|3>(1);
  const [isInternal, setIsInternal] = useState<boolean | null>(null);
  const [subType, setSubType]     = useState<SubType>(null);
  const [submitting, setSubmitting] = useState(false);
  const [assignedId, setAssignedId] = useState<number|null>(null);
  const [assignedName, setAssignedName] = useState("");

  const [form, setForm] = useState({
    clientName: "", clientPhone: "", address: "",
    locationUrl: "", subscriptionFee: "", notes: "",
  });

  const getSvcType = (): SvcType => {
    if (!isInternal)  return "external";
    if (subType === "hotspot")   return "hotspot_internal";
    return "broadband_internal";
  };

  const handleSubmit = async () => {
    const svcType = getSvcType();
    if (svcType !== "external") {
      if (!form.clientName.trim()) return;
      if (!form.clientPhone.trim()) return;
    } else {
      if (!form.address.trim()) return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        serviceType: svcType,
        clientName:  form.clientName.trim() || null,
        clientPhone: form.clientPhone.replace(/\D/g, "").trim() || null,
        address:     form.address.trim() || null,
        locationUrl: form.locationUrl.trim() || null,
        notes:       form.notes.trim() || null,
        assignedToId:   assignedId ?? null,
        assignedToName: assignedName || null,
      };
      if (svcType === "hotspot_internal" && form.subscriptionFee) {
        payload.subscriptionFee = parseFloat(form.subscriptionFee) || null;
      }
      const res = await apiPost("/tickets/installation", token, payload);
      /* إعادة تعيين */
      setStep(1); setIsInternal(null); setSubType(null);
      setForm({ clientName: "", clientPhone: "", address: "", locationUrl: "", subscriptionFee: "", notes: "" });
      setAssignedId(null); setAssignedName("");
      onCreated(res);
    } catch {} finally { setSubmitting(false); }
  };

  const F = ({ label, field, kb, placeholder, multiline }: {
    label: string; field: keyof typeof form; kb?: any; placeholder?: string; multiline?: boolean;
  }) => (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={[styles.input, multiline && { height: 70 }]}
        value={form[field]} onChangeText={v => setForm(f => ({ ...f, [field]: v }))}
        placeholder={placeholder ?? label} placeholderTextColor={Colors.textSecondary}
        keyboardType={kb} textAlign="right"
        textAlignVertical={multiline ? "top" : "center"} multiline={multiline} />
    </>
  );

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* ── الخطوة 1: نوع التركيب ── */}
      {step === 1 && (
        <View>
          <Text style={styles.stepTitle}>الخطوة 1 / تحديد نوع التركيب</Text>
          <TouchableOpacity style={styles.bigChoice} onPress={() => { setIsInternal(true); setStep(2); }}>
            <Ionicons name="home" size={28} color="#2196F3" />
            <View style={{ marginRight: 12, flex: 1 }}>
              <Text style={styles.bigChoiceTitle}>داخلي</Text>
              <Text style={styles.bigChoiceSub}>هوتسبوت أو برودباند لعميل</Text>
            </View>
            <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.bigChoice} onPress={() => { setIsInternal(false); setStep(3); }}>
            <Ionicons name="wifi" size={28} color="#FF9800" />
            <View style={{ marginRight: 12, flex: 1 }}>
              <Text style={styles.bigChoiceTitle}>خارجي</Text>
              <Text style={styles.bigChoiceSub}>نقطة بث خارجية</Text>
            </View>
            <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── الخطوة 2: نوع فرعي ── */}
      {step === 2 && (
        <View>
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
            <Ionicons name="arrow-forward" size={18} color={Colors.textSecondary} />
            <Text style={styles.backBtnText}>رجوع</Text>
          </TouchableOpacity>
          <Text style={styles.stepTitle}>الخطوة 2 / نوع الخدمة الداخلية</Text>
          <TouchableOpacity style={styles.bigChoice} onPress={() => { setSubType("hotspot"); setStep(3); }}>
            <Ionicons name="wifi" size={28} color="#4CAF50" />
            <View style={{ marginRight: 12, flex: 1 }}>
              <Text style={styles.bigChoiceTitle}>هوتسبوت</Text>
              <Text style={styles.bigChoiceSub}>تركيب جهاز هوتسبوت للعميل</Text>
            </View>
            <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.bigChoice} onPress={() => { setSubType("broadband"); setStep(3); }}>
            <Ionicons name="globe" size={28} color="#2196F3" />
            <View style={{ marginRight: 12, flex: 1 }}>
              <Text style={styles.bigChoiceTitle}>برودباند</Text>
              <Text style={styles.bigChoiceSub}>تركيب خط إنترنت برودباند</Text>
            </View>
            <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── الخطوة 3: النموذج ── */}
      {step === 3 && (
        <View>
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(isInternal ? 2 : 1)}>
            <Ionicons name="arrow-forward" size={18} color={Colors.textSecondary} />
            <Text style={styles.backBtnText}>رجوع</Text>
          </TouchableOpacity>

          {/* بادج النوع */}
          <View style={styles.svcBadge}>
            <Ionicons name={getSvcType() === "external" ? "wifi" : getSvcType() === "hotspot_internal" ? "wifi" : "globe"}
              size={16} color="#fff" />
            <Text style={styles.svcBadgeText}>{SVC_LABEL[getSvcType()]}</Text>
          </View>

          {/* ── هوتسبوت داخلي ── */}
          {getSvcType() === "hotspot_internal" && (
            <>
              <F label="اسم العميل *"      field="clientName" />
              <F label="رقم الجوال *"      field="clientPhone" kb="phone-pad" />
              <F label="الموقع / الحي"     field="address" />
              <F label="قيمة الاشتراك (ريال) — اختياري"
                 field="subscriptionFee" kb="decimal-pad" placeholder="0.00" />
            </>
          )}

          {/* ── برودباند داخلي ── */}
          {getSvcType() === "broadband_internal" && (
            <>
              <F label="اسم العميل *" field="clientName" />
              <F label="رقم الجوال *" field="clientPhone" kb="phone-pad" />
              <F label="وصف الموقع"   field="address" multiline />
              <F label="رابط الموقع (خرائط)" field="locationUrl" />
            </>
          )}

          {/* ── خارجي ── */}
          {getSvcType() === "external" && (
            <>
              <F label="وصف الموقع *" field="address" multiline />
              <F label="رابط الموقع (اختياري)" field="locationUrl" />
            </>
          )}

          <F label="ملاحظات (اختياري)" field="notes" multiline />

          {/* إسناد فني */}
          <Text style={styles.fieldLabel}>الفني المسؤول (اختياري)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}>
            <TouchableOpacity style={[styles.chip, assignedId === null && styles.chipActive]}
              onPress={() => { setAssignedId(null); setAssignedName(""); }}>
              <Text style={[styles.chipText, assignedId === null && styles.chipTextActive]}>الكل</Text>
            </TouchableOpacity>
            {engineers.map(e => (
              <TouchableOpacity key={e.id} style={[styles.chip, assignedId === e.id && styles.chipActive]}
                onPress={() => { setAssignedId(e.id); setAssignedName(e.name); }}>
                <Text style={[styles.chipText, assignedId === e.id && styles.chipTextActive]}>{e.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {assignedId !== null && (
            <Text style={styles.selectedHint}>✔ سيُسند للمهندس: {assignedName}</Text>
          )}

          <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>إنشاء التذكرة</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

/* ═══════════════════════════════════════════════════
   مكوّن: مودال التجهيز
═══════════════════════════════════════════════════ */
function PrepareModal({ ticket, engineers, token, onClose, onDone }: {
  ticket: any;
  engineers: {id:number; name:string}[];
  token: string | null;
  onClose: () => void;
  onDone: (updated: any) => void;
}) {
  const [saving, setSaving]   = useState(false);
  const [assignedId, setAssignedId]     = useState<number|null>(ticket.assignedToId ?? null);
  const [assignedName, setAssignedName] = useState(ticket.assignedToName ?? "");

  /* حقول مشتركة */
  const [address,     setAddress]     = useState(ticket.address ?? "");
  const [locationUrl, setLocationUrl] = useState(ticket.locationUrl ?? "");
  const [deviceName,  setDeviceName]  = useState(ticket.deviceName ?? "");
  const [deviceSerial, setDeviceSerial] = useState(ticket.deviceSerial ?? "");
  const [notes,       setNotes]       = useState(ticket.notes ?? "");

  /* هوتسبوت */
  const [subFee, setSubFee] = useState(ticket.subscriptionFee ?? "");
  /* برودباند */
  const [subName,   setSubName]   = useState(ticket.subscriptionName ?? "");
  const [inetFee,   setInetFee]   = useState(ticket.internetFee ?? "");

  /* نقاط وسيطة */
  const [hasRelays, setHasRelays] = useState(false);
  const [relays, setRelays]       = useState<RelayPoint[]>([{ description: "", locationUrl: "" }]);

  const addRelay  = () => setRelays(r => [...r, { description: "", locationUrl: "" }]);
  const setRelay  = (i: number, field: keyof RelayPoint, val: string) =>
    setRelays(r => r.map((rp, idx) => idx === i ? { ...rp, [field]: val } : rp));
  const removeRelay = (i: number) => setRelays(r => r.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        address: address.trim() || null,
        locationUrl: locationUrl.trim() || null,
        deviceName: deviceName.trim() || null,
        deviceSerial: deviceSerial.trim() || null,
        notes: notes.trim() || null,
        assignedToId:   assignedId ?? null,
        assignedToName: assignedName || null,
      };
      if (ticket.serviceType === "hotspot_internal") {
        payload.subscriptionFee = parseFloat(subFee) || null;
      }
      if (ticket.serviceType === "broadband_internal") {
        payload.subscriptionName = subName.trim() || null;
        payload.internetFee      = parseFloat(inetFee) || null;
      }
      if (hasRelays) {
        payload.relayPoints = relays.filter(r => r.description.trim());
      }
      const res = await apiPost(`/tickets/installation/${ticket.id}/prepare`, token, payload);
      onDone(res);
    } catch (e: any) { } finally { setSaving(false); }
  };

  const F = ({ label, value, onChange, kb, multiline, placeholder }: {
    label: string; value: string; onChange: (v: string) => void;
    kb?: any; multiline?: boolean; placeholder?: string;
  }) => (
    <>
      <Text style={[styles.fieldLabel, { marginTop: 10 }]}>{label}</Text>
      <TextInput style={[styles.input, multiline && { height: 60 }]}
        value={value} onChangeText={onChange}
        placeholder={placeholder ?? label} placeholderTextColor={Colors.textSecondary}
        keyboardType={kb} textAlign="right"
        textAlignVertical={multiline ? "top" : "center"} multiline={multiline} />
    </>
  );

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { maxHeight: "90%", padding: 0 }]}>
          {/* رأس المودال */}
          <View style={styles.prepHeader}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.prepTitle}>
              تجهيز — {SVC_LABEL[ticket.serviceType] ?? ticket.serviceType}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
            {/* ── تأكيد الموقع ── */}
            <SectionTitle title="تأكيد الموقع" icon="location" />
            <F label="وصف الموقع"    value={address}     onChange={setAddress}     multiline />
            <F label="رابط الموقع"   value={locationUrl} onChange={setLocationUrl} placeholder="https://maps.google.com/..." />

            {/* ── هوتسبوت: قيمة الاشتراك ── */}
            {ticket.serviceType === "hotspot_internal" && (
              <>
                <SectionTitle title="قيمة الاشتراك" icon="cash" />
                <F label="قيمة الاشتراك (ريال)" value={subFee} onChange={setSubFee} kb="decimal-pad" placeholder="0.00" />
              </>
            )}

            {/* ── برودباند: بيانات الاشتراك ── */}
            {ticket.serviceType === "broadband_internal" && (
              <>
                <SectionTitle title="بيانات الاشتراك" icon="globe" />
                <F label="اسم الاشتراك"          value={subName}  onChange={setSubName} />
                <F label="قيمة اشتراك الإنترنت"  value={inetFee}  onChange={setInetFee} kb="decimal-pad" placeholder="0.00" />
              </>
            )}

            {/* ── تسليم الجهاز ── */}
            {ticket.serviceType !== "external" && (
              <>
                <SectionTitle title="تسليم الجهاز" icon="hardware-chip" />
                <F label="اسم الجهاز"    value={deviceName}   onChange={setDeviceName} />
                <F label="رقم الجهاز / السيريال" value={deviceSerial} onChange={setDeviceSerial} />
              </>
            )}

            {/* ── تجهيز خارجي: بيانات المهندس ── */}
            {ticket.serviceType === "external" && (
              <>
                <SectionTitle title="تسليم للمهندس" icon="person" />
              </>
            )}

            {/* ── إسناد المهندس ── */}
            <SectionTitle title="الفني المسؤول" icon="people" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}>
              <TouchableOpacity style={[styles.chip, assignedId === null && styles.chipActive]}
                onPress={() => { setAssignedId(null); setAssignedName(""); }}>
                <Text style={[styles.chipText, assignedId === null && styles.chipTextActive]}>الكل</Text>
              </TouchableOpacity>
              {engineers.map(e => (
                <TouchableOpacity key={e.id} style={[styles.chip, assignedId === e.id && styles.chipActive]}
                  onPress={() => { setAssignedId(e.id); setAssignedName(e.name); }}>
                  <Text style={[styles.chipText, assignedId === e.id && styles.chipTextActive]}>{e.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* ── نقاط وسيطة (هوتسبوت فقط) ── */}
            {ticket.serviceType === "hotspot_internal" && (
              <>
                <View style={styles.toggleRow}>
                  <Switch value={hasRelays} onValueChange={setHasRelays}
                    trackColor={{ false: Colors.border, true: "#FF980044" }}
                    thumbColor={hasRelays ? "#FF9800" : Colors.textSecondary} />
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.toggleTitle}>إضافة نقاط بث وسيطة</Text>
                    <Text style={styles.toggleSub}>نقاط تُركَّب قبل وصول الخدمة للعميل</Text>
                  </View>
                </View>

                {hasRelays && (
                  <View style={styles.relayContainer}>
                    {relays.map((rp, i) => (
                      <View key={i} style={styles.relayCard}>
                        <View style={styles.relayHeader}>
                          <TouchableOpacity onPress={() => removeRelay(i)} style={{ marginLeft: 4 }}>
                            <Ionicons name="close-circle" size={18} color={Colors.error} />
                          </TouchableOpacity>
                          <Text style={styles.relayNum}>نقطة {i + 1}</Text>
                        </View>
                        <Text style={styles.fieldLabel}>وصف الموقع *</Text>
                        <TextInput style={styles.input}
                          value={rp.description}
                          onChangeText={v => setRelay(i, "description", v)}
                          placeholder="مثال: سطح منزل أحمد..."
                          placeholderTextColor={Colors.textSecondary}
                          textAlign="right" />
                        <Text style={styles.fieldLabel}>رابط الموقع (اختياري)</Text>
                        <TextInput style={styles.input}
                          value={rp.locationUrl}
                          onChangeText={v => setRelay(i, "locationUrl", v)}
                          placeholder="https://maps.google.com/..."
                          placeholderTextColor={Colors.textSecondary}
                          textAlign="right" />
                      </View>
                    ))}
                    <TouchableOpacity style={styles.addRelayBtn} onPress={addRelay}>
                      <Ionicons name="add-circle-outline" size={18} color="#FF9800" />
                      <Text style={[styles.fieldLabel, { color: "#FF9800", margin: 0, marginRight: 4 }]}>
                        إضافة نقطة
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            <F label="ملاحظات" value={notes} onChange={setNotes} multiline />

            <TouchableOpacity style={[styles.submitBtn, saving && { opacity: 0.6 }, { marginTop: 20 }]}
              onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Ionicons name="save" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>حفظ بيانات التجهيز</Text>
                </>
              )}
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ─── مساعدات ─── */
function SectionTitle({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Ionicons name={icon as any} size={16} color={Colors.primary} />
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );
}
function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataValue}>{value}</Text>
      <Text style={styles.dataLabel}>{label}:</Text>
    </View>
  );
}

/* ═══════════════════════════════════════════════════
   Styles
═══════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pageTitle: { fontSize: 18, fontWeight: "bold", color: Colors.text },
  tabsBar:   { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabsContent: { flexDirection: "row-reverse", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tab:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  tabText:     { fontSize: 12, color: Colors.textSecondary },
  scrollContent: { padding: 16 },

  /* بطاقة التذكرة */
  card: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader:   { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  cardTitle:    { fontSize: 15, fontWeight: "bold", color: Colors.text, textAlign: "right" },
  cardSvcType:  { fontSize: 11, color: Colors.textSecondary, textAlign: "right", marginTop: 2 },
  statusBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
  statusText:   { fontSize: 11, fontWeight: "bold" },
  rowItem:      { flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 4 },
  infoText:     { fontSize: 13, color: Colors.textSecondary, flex: 1, textAlign: "right" },
  dateText:     { fontSize: 11, color: Colors.textSecondary, textAlign: "right", marginTop: 6 },
  actionChip:   { flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: Colors.success + "15", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  chipText:     { fontSize: 12, color: Colors.textSecondary },
  actionRow:    { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  actBtn:       { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  actBtnText:   { fontSize: 12, fontWeight: "bold" },

  /* نموذج الإنشاء */
  stepTitle:    { fontSize: 14, fontWeight: "bold", color: Colors.textSecondary, textAlign: "right", marginBottom: 16, marginTop: 4 },
  bigChoice: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
    flexDirection: "row-reverse", alignItems: "center",
    borderWidth: 1, borderColor: Colors.border, marginBottom: 12,
  },
  bigChoiceTitle: { fontSize: 16, fontWeight: "bold", color: Colors.text, textAlign: "right" },
  bigChoiceSub:   { fontSize: 12, color: Colors.textSecondary, textAlign: "right", marginTop: 2 },
  backBtn:     { flexDirection: "row-reverse", alignItems: "center", gap: 6, marginBottom: 12 },
  backBtnText: { fontSize: 14, color: Colors.textSecondary },
  svcBadge:    { flexDirection: "row-reverse", alignItems: "center", gap: 6, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignSelf: "flex-end", marginBottom: 12 },
  svcBadgeText: { fontSize: 12, color: "#fff", fontWeight: "bold" },
  fieldLabel:  { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: Colors.surface, borderRadius: 10, padding: 12,
    color: Colors.text, fontSize: 14, borderWidth: 1, borderColor: Colors.border,
  },
  chipsRow:  { flexDirection: "row-reverse", gap: 8, paddingVertical: 8 },
  chip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTextActive: { color: "#fff", fontWeight: "bold" },
  selectedHint: { fontSize: 12, color: Colors.success, textAlign: "right", marginTop: 4 },
  submitBtn:    { backgroundColor: "#9C27B0", borderRadius: 12, padding: 14, flexDirection: "row-reverse", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 20 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  /* نقاط الترحيل */
  toggleRow:  { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginTop: 16, marginBottom: 8, backgroundColor: Colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  toggleTitle: { fontSize: 14, fontWeight: "bold", color: Colors.text, textAlign: "right" },
  toggleSub:   { fontSize: 12, color: Colors.textSecondary, textAlign: "right" },
  relayContainer: { gap: 10 },
  relayCard: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border },
  relayHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  relayNum:    { fontSize: 13, fontWeight: "bold", color: Colors.text },
  addRelayBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 6, justifyContent: "center", paddingVertical: 10, borderWidth: 1, borderColor: "#FF980044", borderRadius: 10, borderStyle: "dashed" },

  /* مودال التجهيز */
  prepHeader:  { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  prepTitle:   { fontSize: 16, fontWeight: "bold", color: Colors.text },
  sectionTitle:{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 18, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 6 },
  sectionTitleText: { fontSize: 14, fontWeight: "bold", color: Colors.text },

  /* مودال عام */
  modalOverlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, alignItems: "center", width: "100%", gap: 10,
  },
  modalTitle:  { fontSize: 18, fontWeight: "bold", color: Colors.text },
  modalMsg:    { fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
  modalBtns:   { flexDirection: "row-reverse", gap: 10, width: "100%", marginTop: 8 },
  modalActionBtn:  { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  modalActionText: { fontSize: 14, fontWeight: "bold" },

  dataRow:  { flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dataLabel: { fontSize: 13, color: Colors.textSecondary },
  dataValue:  { fontSize: 13, color: Colors.text, fontWeight: "600" },

  emptyBox:  { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
});
