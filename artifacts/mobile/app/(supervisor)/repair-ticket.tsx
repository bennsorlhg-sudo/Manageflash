import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Linking, ActivityIndicator, Platform, Modal, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost } from "@/utils/api";

/* ─────────────── أنواع الخدمة ─────────────── */
type ServiceType = "hotspot_internal" | "hotspot_external" | "broadband";
const SERVICE_TYPES: { key: ServiceType; label: string; color: string }[] = [
  { key: "hotspot_internal", label: "هوتسبوت داخلي", color: Colors.primary },
  { key: "hotspot_external", label: "هوتسبوت خارجي", color: Colors.warning },
  { key: "broadband",        label: "برودباند",        color: Colors.info },
];

type Priority = "urgent" | "normal";
const PRIORITIES: { key: Priority; label: string; color: string }[] = [
  { key: "urgent", label: "عاجل", color: Colors.error },
  { key: "normal", label: "عادي", color: Colors.success },
];

const showContact = (t: ServiceType) => t !== "hotspot_external";

/* ─────────────── المكوّن الرئيسي ─────────────── */
export default function CreateRepairTicketScreen() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const { token, user } = useAuth();

  /* حقل رقم الخدمة */
  const [serviceNumber, setServiceNumber]   = useState("");
  const [fetching,      setFetching]        = useState(false);
  const [fetchMsg,      setFetchMsg]        = useState<{ text: string; ok: boolean } | null>(null);

  /* بيانات العميل */
  const [clientName,    setClientName]      = useState("");
  const [clientPhone,   setClientPhone]     = useState("");
  const [location,      setLocation]        = useState("");
  const [locationUrl,   setLocationUrl]     = useState("");

  /* نوع الخدمة والأولوية */
  const [serviceType,   setServiceType]     = useState<ServiceType>("hotspot_internal");

  /* تفاصيل التذكرة */
  const [problemDesc,   setProblemDesc]     = useState("");
  const [priority,      setPriority]        = useState<Priority>("normal");
  const [notes,         setNotes]           = useState("");
  const [photoUri,      setPhotoUri]        = useState<string | null>(null);
  const [photoBase64,   setPhotoBase64]     = useState<string | null>(null);

  /* التخصيص */
  type AssignMode = "all" | "specific";
  const [assignMode,          setAssignMode]          = useState<AssignMode>("all");
  const [engineers,           setEngineers]           = useState<{ id: number; name: string; phone?: string }[]>([]);
  const [selectedEngineerId,  setSelectedEngineerId]  = useState<number | null>(null);
  const [selectedEngineerName,setSelectedEngineerName]= useState("");

  /* مودال النتيجة */
  const [modal, setModal] = useState<{ visible: boolean; title: string; msg: string; ok: boolean; back: boolean }>({
    visible: false, title: "", msg: "", ok: true, back: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const showModal = (title: string, msg: string, ok = true, back = false) =>
    setModal({ visible: true, title, msg, ok, back });

  /* ─── جلب قائمة المهندسين ─── */
  useEffect(() => {
    apiGet("/users/engineers", token)
      .then((data: any) => setEngineers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [token]);

  /* ─── جلب بيانات الخدمة ─── */
  const handleFetch = async () => {
    const cleaned = serviceNumber.trim().replace(/\s/g, "");
    if (!cleaned) return;
    setFetching(true);
    setFetchMsg(null);

    /* P كبير أو صغير = برودباند */
    const isBroadband = cleaned.startsWith("P") || cleaned.startsWith("p");
    const numericPart = parseInt(cleaned.replace(/\D/g, "")) || 0;

    try {
      const endpoint = isBroadband
        ? `/network/broadband-points?search=${numericPart}&limit=50`
        : `/network/hotspot-points?search=${numericPart}&limit=50`;
      const res = await apiGet(endpoint, token).catch(() => ({ data: [] }));
      const rows: any[] = Array.isArray(res) ? res : (res?.data ?? []);

      const match =
        rows.find((p: any) => Number(p.flashNumber) === numericPart || p.id === numericPart)
        ?? rows[0]
        ?? null;

      if (match) {
        /* اكتشاف النوع من بيانات الشبكة */
        const detected: ServiceType = isBroadband
          ? "broadband"
          : (match.hotspotType === "external" ? "hotspot_external" : "hotspot_internal");

        setClientName(match.clientName ?? match.name ?? "");
        setClientPhone(match.clientPhone ?? match.phone ?? "");
        setLocation(match.location ?? match.address ?? "");
        setLocationUrl(match.locationUrl ?? "");
        setServiceType(detected);
        setFetchMsg({ text: "✔ تم جلب البيانات تلقائياً", ok: true });
      } else {
        /* لا يوجد تطابق — لكن نحدد برودباند إن كان P */
        if (isBroadband) setServiceType("broadband");
        setFetchMsg({
          text: "لا توجد بيانات لهذا الرقم – الرجاء إدخال البيانات يدوياً",
          ok: false,
        });
      }
    } catch {
      setFetchMsg({ text: "حدث خطأ في البحث، يمكنك الإدخال يدوياً", ok: false });
    } finally {
      setFetching(false);
    }
  };

  /* ─── اختيار صورة ─── */
  const pickPhoto = async (fromCamera = false) => {
    try {
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") return;
        const r = await ImagePicker.launchCameraAsync({ quality: 0.3, base64: true });
        if (!r.canceled) {
          setPhotoUri(r.assets[0].uri);
          setPhotoBase64(r.assets[0].base64 ? `data:image/jpeg;base64,${r.assets[0].base64}` : null);
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") return;
        const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.3, base64: true, mediaTypes: ["images"] as any });
        if (!r.canceled) {
          setPhotoUri(r.assets[0].uri);
          setPhotoBase64(r.assets[0].base64 ? `data:image/jpeg;base64,${r.assets[0].base64}` : null);
        }
      }
    } catch {}
  };

  /* ─── التحقق من البيانات ─── */
  const validate = (asDraft: boolean): string | null => {
    if (!serviceNumber.trim()) return "رقم الخدمة مطلوب";
    if (!problemDesc.trim())   return "وصف المشكلة مطلوب";
    if (!location.trim())      return "وصف الموقع مطلوب";
    if (!asDraft && showContact(serviceType)) {
      if (!clientName.trim())  return "اسم العميل مطلوب";
      if (!clientPhone.trim()) return "رقم الجوال مطلوب";
    }
    if (!asDraft && assignMode === "specific" && !selectedEngineerId) {
      return "يجب اختيار اسم المهندس عند التخصيص لمهندس معين";
    }
    return null;
  };

  /* ─── حفظ ─── */
  const handleSave = async (asDraft: boolean) => {
    const err = validate(asDraft);
    if (err) { showModal("تحقق من البيانات", err, false); return; }

    setSubmitting(true);
    try {
      await apiPost("/tickets/repair", token, {
        serviceNumber: serviceNumber.trim(),
        clientName:    showContact(serviceType) ? clientName.trim() || null : null,
        clientPhone:   showContact(serviceType) ? clientPhone.trim() || null : null,
        serviceType,
        problemDescription: problemDesc.trim(),
        location:      location.trim() || null,
        locationUrl:   locationUrl.trim() || null,
        notes:         notes.trim() || null,
        priority,
        status:        asDraft ? "draft" : "pending",
        createdByName: user?.name ?? null,
        assignedToId:   assignMode === "specific" ? selectedEngineerId  : null,
        assignedToName: assignMode === "specific" ? selectedEngineerName : null,
        contractImageUrl: photoBase64 ?? null,
      });

      showModal(
        asDraft ? "تم الحفظ كمسودة" : "تم الإرسال",
        asDraft
          ? "تم حفظ التذكرة كمسودة بنجاح"
          : "تم إرسال التذكرة للمهندس الفني بنجاح",
        true,
        true,
      );
    } catch (e: any) {
      showModal("خطأ", e?.message ?? "فشل في حفظ التذكرة", false);
    } finally {
      setSubmitting(false);
    }
  };

  /* ─────────────── واجهة المستخدم ─────────────── */
  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* رأس الصفحة */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>إنشاء تذكرة إصلاح</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ══════════════ رقم الخدمة ══════════════ */}
        <SectionTitle title="رقم الخدمة" required />
        <Text style={styles.hint}>مثال: 30 (هوتسبوت) أو P30 (برودباند)</Text>
        <View style={styles.fetchRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={serviceNumber}
            onChangeText={t => { setServiceNumber(t); setFetchMsg(null); }}
            placeholder="رقم الخدمة..."
            placeholderTextColor={Colors.textMuted}
            textAlign="right"
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={handleFetch}
          />
          <TouchableOpacity style={styles.fetchBtn} onPress={handleFetch} disabled={fetching}>
            {fetching
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.fetchBtnText}>بحث</Text>
            }
          </TouchableOpacity>
        </View>
        {fetchMsg && (
          <View style={[styles.fetchMsgBox, { borderColor: (fetchMsg.ok ? Colors.success : Colors.warning) + "60" }]}>
            <Ionicons
              name={fetchMsg.ok ? "checkmark-circle" : "information-circle"}
              size={16}
              color={fetchMsg.ok ? Colors.success : Colors.warning}
            />
            <Text style={[styles.fetchMsgText, { color: fetchMsg.ok ? Colors.success : Colors.warning }]}>
              {fetchMsg.text}
            </Text>
          </View>
        )}

        {/* ══════════════ نوع الخدمة ══════════════ */}
        <SectionTitle title="نوع الخدمة" required />
        <View style={styles.chipRow}>
          {SERVICE_TYPES.map(st => (
            <TouchableOpacity
              key={st.key}
              style={[styles.chip, serviceType === st.key && { backgroundColor: st.color, borderColor: st.color }]}
              onPress={() => setServiceType(st.key)}
            >
              <Text style={[styles.chipText, serviceType === st.key && { color: "#fff" }]}>
                {st.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ══════════════ بيانات العميل ══════════════ */}
        {showContact(serviceType) && (
          <>
            <SectionTitle title="اسم العميل" required />
            <TextInput
              style={styles.input}
              value={clientName}
              onChangeText={setClientName}
              placeholder="اسم العميل..."
              placeholderTextColor={Colors.textMuted}
              textAlign="right"
            />

            <SectionTitle title="رقم الجوال" required />
            <TextInput
              style={styles.input}
              value={clientPhone}
              onChangeText={setClientPhone}
              placeholder="رقم الجوال..."
              placeholderTextColor={Colors.textMuted}
              textAlign="right"
              keyboardType="phone-pad"
            />
          </>
        )}

        {/* ══════════════ الموقع ══════════════ */}
        <SectionTitle title="وصف الموقع" required />
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="وصف الموقع..."
          placeholderTextColor={Colors.textMuted}
          textAlign="right"
        />

        <SectionTitle title="رابط الموقع (اختياري)" />
        <View style={styles.urlRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={locationUrl}
            onChangeText={setLocationUrl}
            placeholder="https://maps.google.com/..."
            placeholderTextColor={Colors.textMuted}
            textAlign="right"
            autoCapitalize="none"
            keyboardType="url"
          />
          {!!locationUrl.trim() && (
            <TouchableOpacity style={styles.mapBtn} onPress={() => Linking.openURL(locationUrl)}>
              <Ionicons name="map" size={18} color={Colors.info} />
            </TouchableOpacity>
          )}
        </View>

        {/* ══════════════ وصف المشكلة ══════════════ */}
        <SectionTitle title="وصف المشكلة" required />
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={problemDesc}
          onChangeText={setProblemDesc}
          placeholder="صف المشكلة..."
          placeholderTextColor={Colors.textMuted}
          multiline
          textAlign="right"
          textAlignVertical="top"
        />

        {/* ══════════════ الأولوية ══════════════ */}
        <SectionTitle title="الأولوية" />
        <View style={styles.chipRow}>
          {PRIORITIES.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[styles.chip, priority === p.key && { backgroundColor: p.color, borderColor: p.color }]}
              onPress={() => setPriority(p.key)}
            >
              <Text style={[styles.chipText, priority === p.key && { color: "#fff" }]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ══════════════ ملاحظات داخلية ══════════════ */}
        <SectionTitle title="ملاحظات داخلية (اختياري)" />
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={notes}
          onChangeText={setNotes}
          placeholder="ملاحظات إضافية..."
          placeholderTextColor={Colors.textMuted}
          multiline
          textAlign="right"
          textAlignVertical="top"
        />

        {/* ══════════════ صورة ══════════════ */}
        <SectionTitle title="صورة (اختياري)" />
        {photoUri ? (
          <View style={styles.photoPreviewBox}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
            <TouchableOpacity style={styles.removePhoto} onPress={() => { setPhotoUri(null); setPhotoBase64(null); }}>
              <Ionicons name="close-circle" size={22} color={Colors.error} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: "row-reverse", gap: 10 }}>
            <TouchableOpacity style={[styles.photoBtn, { flex: 1 }]} onPress={() => pickPhoto(true)}>
              <Ionicons name="camera-outline" size={20} color={Colors.textSecondary} />
              <Text style={styles.photoBtnText}>كاميرا</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.photoBtn, { flex: 1 }]} onPress={() => pickPhoto(false)}>
              <Ionicons name="images-outline" size={20} color={Colors.textSecondary} />
              <Text style={styles.photoBtnText}>المعرض</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ══════════════ التخصيص ══════════════ */}
        <SectionTitle title="التخصيص" />
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[
              styles.assignChip,
              assignMode === "all" && { backgroundColor: Colors.roles.supervisor, borderColor: Colors.roles.supervisor },
            ]}
            onPress={() => {
              setAssignMode("all");
              setSelectedEngineerId(null);
              setSelectedEngineerName("");
            }}
          >
            <Ionicons
              name="people"
              size={15}
              color={assignMode === "all" ? "#fff" : Colors.textSecondary}
            />
            <Text style={[styles.chipText, assignMode === "all" && { color: "#fff" }]}>
              إرسال للكل
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.assignChip,
              assignMode === "specific" && { backgroundColor: Colors.primary, borderColor: Colors.primary },
            ]}
            onPress={() => setAssignMode("specific")}
          >
            <Ionicons
              name="person"
              size={15}
              color={assignMode === "specific" ? "#fff" : Colors.textSecondary}
            />
            <Text style={[styles.chipText, assignMode === "specific" && { color: "#fff" }]}>
              تخصيص لمهندس
            </Text>
          </TouchableOpacity>
        </View>

        {assignMode === "specific" && (
          <View style={styles.engineerListBox}>
            {engineers.length === 0 ? (
              <Text style={styles.emptyEngText}>لا يوجد مهندسون مسجلون</Text>
            ) : (
              engineers.map(eng => (
                <TouchableOpacity
                  key={eng.id}
                  style={[
                    styles.engineerRow,
                    selectedEngineerId === eng.id && styles.engineerRowActive,
                  ]}
                  onPress={() => {
                    setSelectedEngineerId(eng.id);
                    setSelectedEngineerName(eng.name);
                  }}
                >
                  <View style={[
                    styles.radioCircle,
                    selectedEngineerId === eng.id && { backgroundColor: Colors.primary, borderColor: Colors.primary },
                  ]}>
                    {selectedEngineerId === eng.id && (
                      <View style={styles.radioDot} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.engineerName, selectedEngineerId === eng.id && { color: Colors.primary }]}>
                      {eng.name}
                    </Text>
                    {eng.phone && (
                      <Text style={styles.engineerPhone}>{eng.phone}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {assignMode === "specific" && selectedEngineerName ? (
          <View style={styles.selectedEngineerBadge}>
            <Ionicons name="checkmark-circle" size={15} color={Colors.success} />
            <Text style={styles.selectedEngineerText}>سيُخصص للمهندس: {selectedEngineerName}</Text>
          </View>
        ) : assignMode === "all" ? (
          <View style={styles.selectedEngineerBadge}>
            <Ionicons name="people-circle-outline" size={15} color={Colors.roles.supervisor} />
            <Text style={[styles.selectedEngineerText, { color: Colors.roles.supervisor }]}>
              ستُرسل لجميع المهندسين الفنيين
            </Text>
          </View>
        ) : null}

        {/* ══════════════ أزرار الحفظ ══════════════ */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btnDraft, submitting && { opacity: 0.6 }]}
            onPress={() => handleSave(true)}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <><Ionicons name="save-outline" size={18} color={Colors.primary} />
                 <Text style={styles.btnDraftText}>حفظ كمسودة</Text></>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnSend, submitting && { opacity: 0.6 }]}
            onPress={() => handleSave(false)}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Ionicons name="send" size={18} color="#fff" />
                 <Text style={styles.btnSendText}>إرسال للمهندس الفني</Text></>
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} disabled={submitting}>
          <Text style={styles.cancelBtnText}>إلغاء</Text>
        </TouchableOpacity>

        <View style={{ height: 50 }} />
      </ScrollView>

      {/* ══════════════ مودال النتيجة ══════════════ */}
      <Modal visible={modal.visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Ionicons
              name={modal.ok ? "checkmark-circle" : "close-circle"}
              size={52}
              color={modal.ok ? Colors.success : Colors.error}
            />
            <Text style={styles.modalTitle}>{modal.title}</Text>
            <Text style={styles.modalMsg}>{modal.msg}</Text>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: modal.ok ? Colors.success : Colors.error }]}
              onPress={() => {
                setModal(m => ({ ...m, visible: false }));
                if (modal.back) router.back();
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

/* ─── مكوّن عنوان القسم ─── */
function SectionTitle({ title, required }: { title: string; required?: boolean }) {
  return (
    <View style={{ flexDirection: "row-reverse", alignItems: "center", marginTop: 16, marginBottom: 6 }}>
      {required && <Text style={{ color: Colors.error, marginLeft: 4 }}>*</Text>}
      <Text style={styles.label}>{title}</Text>
    </View>
  );
}

/* ─── الأنماط ─── */
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
  scroll: { padding: 18 },
  hint: { fontSize: 12, color: Colors.textMuted, textAlign: "right", marginBottom: 8 },
  label: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary, textAlign: "right" },

  /* حقل رقم الخدمة */
  fetchRow: { flexDirection: "row-reverse", gap: 8 },
  fetchBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 72,
  },
  fetchBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  fetchMsgBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
  },
  fetchMsgText: { fontSize: 13, textAlign: "right", flex: 1 },

  /* حقول الإدخال */
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
    textAlign: "right",
  },
  inputMulti: { minHeight: 80, paddingTop: 12 },

  /* صفوف */
  urlRow: { flexDirection: "row-reverse", gap: 8 },
  mapBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  /* chips */
  chipRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  assignChip: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },

  /* صورة */
  photoBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  photoBtnText: { fontSize: 14, color: Colors.textSecondary },
  photoPreviewBox: {
    marginTop: 10,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    alignSelf: "flex-start",
  },
  photoPreview: { width: 120, height: 120, borderRadius: 12 },
  removePhoto: { position: "absolute", top: 4, right: 4 },

  /* أزرار الحفظ */
  actionRow: { flexDirection: "row-reverse", gap: 10, marginTop: 28 },
  btnDraft: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  btnDraftText: { color: Colors.primary, fontWeight: "bold", fontSize: 14 },
  btnSend: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  btnSendText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  cancelBtn: { alignItems: "center", marginTop: 14, paddingVertical: 10 },
  cancelBtnText: { color: Colors.textMuted, fontSize: 14 },

  /* التخصيص */
  engineerListBox: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 10,
    overflow: "hidden",
  },
  engineerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  engineerRowActive: {
    backgroundColor: Colors.primary + "11",
  },
  radioCircle: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  radioDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff",
  },
  engineerName: { fontSize: 14, fontWeight: "600", color: Colors.text, textAlign: "right" },
  engineerPhone: { fontSize: 12, color: Colors.textMuted, textAlign: "right", marginTop: 2 },
  emptyEngText: { fontSize: 13, color: Colors.textMuted, textAlign: "center", padding: 16 },
  selectedEngineerBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.success + "40",
  },
  selectedEngineerText: { fontSize: 13, color: Colors.success, fontWeight: "600" },

  /* مودال */
  overlay: { flex: 1, backgroundColor: "#000000AA", alignItems: "center", justifyContent: "center" },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 28,
    width: "82%",
    alignItems: "center",
    gap: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: Colors.text, textAlign: "center" },
  modalMsg:   { fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
  modalBtn:   { marginTop: 6, paddingHorizontal: 36, paddingVertical: 12, borderRadius: 12 },
  modalBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
});
