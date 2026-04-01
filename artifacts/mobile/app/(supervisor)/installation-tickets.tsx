/**
 * تركيب جديد — نموذج إنشاء فقط
 * كل متابعة التذاكر تكون في صفحة "متابعة المهام"
 */
import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Platform, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost } from "@/utils/api";

type SvcType = "hotspot_internal" | "broadband_internal" | "external";
type SubType  = "hotspot" | "broadband" | null;
type Step     = 1 | 2 | 3;

const SVC_LABEL: Record<SvcType, string> = {
  hotspot_internal:   "داخلي — هوتسبوت",
  broadband_internal: "داخلي — برودباند",
  external:           "خارجي",
};

const SVC_COLOR: Record<SvcType, string> = {
  hotspot_internal:   "#4CAF50",
  broadband_internal: "#2196F3",
  external:           "#FF9800",
};

export default function NewInstallationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [engineers, setEngineers] = useState<{ id: number; name: string }[]>([]);

  /* خطوات */
  const [step,       setStep]       = useState<Step>(1);
  const [isInternal, setIsInternal] = useState<boolean | null>(null);
  const [subType,    setSubType]    = useState<SubType>(null);

  /* النموذج */
  const [form, setForm] = useState({
    clientName: "", clientPhone: "", address: "",
    locationUrl: "", subscriptionFee: "", notes: "",
  });
  const [assignedId,   setAssignedId]   = useState<number | null>(null);
  const [assignedName, setAssignedName] = useState("");
  const [submitting,   setSubmitting]   = useState(false);

  /* نتيجة */
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    apiGet("/users/engineers", token).then(setEngineers).catch(() => {});
  }, [token]);

  const getSvcType = (): SvcType => {
    if (!isInternal) return "external";
    if (subType === "hotspot") return "hotspot_internal";
    return "broadband_internal";
  };

  const resetForm = () => {
    setStep(1); setIsInternal(null); setSubType(null);
    setForm({ clientName: "", clientPhone: "", address: "", locationUrl: "", subscriptionFee: "", notes: "" });
    setAssignedId(null); setAssignedName("");
    setErrorMsg("");
  };

  const handleSubmit = async () => {
    const svcType = getSvcType();
    if (svcType !== "external") {
      if (!form.clientName.trim()) { setErrorMsg("اسم العميل مطلوب"); return; }
      if (!form.clientPhone.trim()) { setErrorMsg("رقم الجوال مطلوب"); return; }
    } else {
      if (!form.address.trim()) { setErrorMsg("وصف الموقع مطلوب"); return; }
    }
    setSubmitting(true);
    setErrorMsg("");
    try {
      const payload: any = {
        serviceType:    svcType,
        clientName:     form.clientName.trim()  || null,
        clientPhone:    form.clientPhone.replace(/\D/g, "").trim() || null,
        address:        form.address.trim()     || null,
        locationUrl:    form.locationUrl.trim() || null,
        notes:          form.notes.trim()       || null,
        assignedToId:   assignedId   ?? null,
        assignedToName: assignedName || null,
      };
      if (svcType === "hotspot_internal" && form.subscriptionFee) {
        payload.subscriptionFee = parseFloat(form.subscriptionFee) || null;
      }
      await apiPost("/tickets/installation", token, payload);
      resetForm();
      setSuccess(true);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "فشل إنشاء التذكرة");
    } finally {
      setSubmitting(false);
    }
  };

  const F = useCallback(({ label, field, kb, placeholder, multiline }: {
    label: string; field: keyof typeof form; kb?: any; placeholder?: string; multiline?: boolean;
  }) => (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, multiline && { height: 72 }]}
        value={form[field]}
        onChangeText={v => setForm(f => ({ ...f, [field]: v }))}
        placeholder={placeholder ?? label}
        placeholderTextColor={Colors.textSecondary}
        keyboardType={kb}
        textAlign="right"
        textAlignVertical={multiline ? "top" : "center"}
        multiline={multiline}
      />
    </View>
  ), [form]);

  const svcType = getSvcType();
  const svcColor = SVC_COLOR[svcType];

  return (
    <View style={[s.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* رأس الصفحة */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>تركيب جديد</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* مؤشر الخطوات */}
      <View style={s.stepsBar}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={s.stepItem}>
            <View style={[s.stepCircle, step >= n && { backgroundColor: Colors.primary }]}>
              <Text style={[s.stepNum, step >= n && { color: "#fff" }]}>{n}</Text>
            </View>
            {n < 3 && <View style={[s.stepLine, step > n && { backgroundColor: Colors.primary }]} />}
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ══ الخطوة 1: نوع التركيب ══ */}
        {step === 1 && (
          <View>
            <Text style={s.stepTitle}>الخطوة 1 — نوع التركيب</Text>
            <TouchableOpacity style={s.choice} onPress={() => { setIsInternal(true); setStep(2); }}>
              <View style={[s.choiceIcon, { backgroundColor: "#2196F322" }]}>
                <Ionicons name="home" size={26} color="#2196F3" />
              </View>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={s.choiceTitle}>داخلي</Text>
                <Text style={s.choiceSub}>هوتسبوت أو برودباند لعميل</Text>
              </View>
              <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={s.choice} onPress={() => { setIsInternal(false); setStep(3); }}>
              <View style={[s.choiceIcon, { backgroundColor: "#FF980022" }]}>
                <Ionicons name="wifi" size={26} color="#FF9800" />
              </View>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={s.choiceTitle}>خارجي</Text>
                <Text style={s.choiceSub}>نقطة بث خارجية</Text>
              </View>
              <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ══ الخطوة 2: النوع الفرعي (داخلي فقط) ══ */}
        {step === 2 && (
          <View>
            <TouchableOpacity style={s.backBtn} onPress={() => setStep(1)}>
              <Ionicons name="arrow-forward" size={16} color={Colors.textSecondary} />
              <Text style={s.backBtnText}>رجوع</Text>
            </TouchableOpacity>
            <Text style={s.stepTitle}>الخطوة 2 — نوع الخدمة الداخلية</Text>
            <TouchableOpacity style={s.choice} onPress={() => { setSubType("hotspot"); setStep(3); }}>
              <View style={[s.choiceIcon, { backgroundColor: "#4CAF5022" }]}>
                <Ionicons name="wifi" size={26} color="#4CAF50" />
              </View>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={s.choiceTitle}>هوتسبوت</Text>
                <Text style={s.choiceSub}>تركيب جهاز هوتسبوت للعميل</Text>
              </View>
              <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={s.choice} onPress={() => { setSubType("broadband"); setStep(3); }}>
              <View style={[s.choiceIcon, { backgroundColor: "#2196F322" }]}>
                <Ionicons name="globe" size={26} color="#2196F3" />
              </View>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={s.choiceTitle}>برودباند</Text>
                <Text style={s.choiceSub}>تركيب خط إنترنت برودباند</Text>
              </View>
              <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ══ الخطوة 3: النموذج ══ */}
        {step === 3 && (
          <View>
            <TouchableOpacity style={s.backBtn} onPress={() => setStep(isInternal ? 2 : 1)}>
              <Ionicons name="arrow-forward" size={16} color={Colors.textSecondary} />
              <Text style={s.backBtnText}>رجوع</Text>
            </TouchableOpacity>

            {/* شارة النوع */}
            <View style={[s.svcBadge, { backgroundColor: svcColor + "22", borderColor: svcColor + "55" }]}>
              <Ionicons
                name={svcType === "external" ? "wifi" : svcType === "hotspot_internal" ? "wifi" : "globe"}
                size={15} color={svcColor}
              />
              <Text style={[s.svcBadgeText, { color: svcColor }]}>{SVC_LABEL[svcType]}</Text>
            </View>

            {/* حقول هوتسبوت داخلي */}
            {svcType === "hotspot_internal" && (
              <>
                <F label="اسم العميل *"                field="clientName" />
                <F label="رقم الجوال *"                field="clientPhone" kb="phone-pad" />
                <F label="الموقع / الحي"               field="address" />
                <F label="قيمة الاشتراك — اختياري"    field="subscriptionFee" kb="decimal-pad" placeholder="0.00" />
              </>
            )}

            {/* حقول برودباند داخلي */}
            {svcType === "broadband_internal" && (
              <>
                <F label="اسم العميل *" field="clientName" />
                <F label="رقم الجوال *" field="clientPhone" kb="phone-pad" />
                <F label="وصف الموقع"   field="address" multiline />
                <F label="رابط الموقع (خرائط)" field="locationUrl" />
              </>
            )}

            {/* حقول خارجي */}
            {svcType === "external" && (
              <>
                <F label="وصف الموقع *"               field="address" multiline />
                <F label="رابط الموقع — اختياري"      field="locationUrl" />
              </>
            )}

            <F label="ملاحظات — اختياري" field="notes" multiline />

            {/* إسناد فني */}
            <Text style={s.fieldLabel}>الفني المسؤول — اختياري</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
              <TouchableOpacity
                style={[s.chip, assignedId === null && s.chipActive]}
                onPress={() => { setAssignedId(null); setAssignedName(""); }}
              >
                <Text style={[s.chipText, assignedId === null && s.chipActiveText]}>الكل</Text>
              </TouchableOpacity>
              {engineers.map(e => (
                <TouchableOpacity
                  key={e.id}
                  style={[s.chip, assignedId === e.id && s.chipActive]}
                  onPress={() => { setAssignedId(e.id); setAssignedName(e.name); }}
                >
                  <Text style={[s.chipText, assignedId === e.id && s.chipActiveText]}>{e.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {assignedId !== null && (
              <Text style={s.assignedHint}>سيُسند للمهندس: {assignedName}</Text>
            )}

            {/* رسالة خطأ */}
            {!!errorMsg && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
                <Text style={s.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* زر الإنشاء */}
            <TouchableOpacity
              style={[s.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={s.submitBtnText}>إنشاء تذكرة التركيب</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ══ مودال النجاح ══ */}
      <Modal visible={success} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.successCard}>
            <View style={s.successIcon}>
              <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
            </View>
            <Text style={s.successTitle}>تم إنشاء التذكرة</Text>
            <Text style={s.successMsg}>
              تم إنشاء تذكرة التركيب بنجاح وستظهر في صفحة متابعة المهام
            </Text>
            <TouchableOpacity
              style={[s.successBtn, { backgroundColor: Colors.primary }]}
              onPress={() => { setSuccess(false); resetForm(); }}
            >
              <Text style={s.successBtnText}>إنشاء تذكرة أخرى</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.successBtn, { backgroundColor: Colors.surfaceElevated, marginTop: 8 }]}
              onPress={() => { setSuccess(false); router.back(); }}
            >
              <Text style={[s.successBtnText, { color: Colors.text }]}>رجوع للرئيسية</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ════════════════════════════════════════════════
   الأنماط
════════════════════════════════════════════════ */
const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 18, fontWeight: "bold", color: Colors.text },

  /* مؤشر الخطوات */
  stepsBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 40,
    gap: 0,
  },
  stepItem: { flexDirection: "row-reverse", alignItems: "center" },
  stepCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  stepNum: { fontSize: 14, fontWeight: "bold", color: Colors.textSecondary },
  stepLine: { width: 40, height: 2, backgroundColor: Colors.border },

  content: { paddingHorizontal: 18, paddingTop: 8 },
  stepTitle: {
    fontSize: 15, fontWeight: "bold", color: Colors.textSecondary,
    textAlign: "right", marginBottom: 14,
  },

  /* خيارات الخطوة */
  choice: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 0,
  },
  choiceIcon: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  choiceTitle: { fontSize: 15, fontWeight: "bold", color: Colors.text, textAlign: "right" },
  choiceSub:   { fontSize: 12, color: Colors.textSecondary, textAlign: "right", marginTop: 2 },

  backBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
    alignSelf: "flex-end",
  },
  backBtnText: { fontSize: 13, color: Colors.textSecondary },

  /* شارة نوع الخدمة */
  svcBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1,
    marginBottom: 16,
  },
  svcBadgeText: { fontSize: 13, fontWeight: "bold" },

  /* حقول النموذج */
  fieldWrap: { marginBottom: 12 },
  fieldLabel: {
    fontSize: 13, fontWeight: "600", color: Colors.textSecondary,
    textAlign: "right", marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    padding: 12, fontSize: 14, color: Colors.text, textAlign: "right",
    height: 48,
  },

  /* شرائح المهندسين */
  chipsRow: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:       { fontSize: 13, color: Colors.textSecondary },
  chipActiveText: { color: "#fff", fontWeight: "bold" },
  assignedHint: {
    fontSize: 12, color: Colors.primary, textAlign: "right", marginTop: 6, marginBottom: 4,
  },

  /* رسالة خطأ */
  errorBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.error + "18",
    borderRadius: 10, padding: 10, marginTop: 8,
  },
  errorText: { fontSize: 13, color: Colors.error, textAlign: "right", flex: 1 },

  /* زر الإرسال */
  submitBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14, padding: 16, marginTop: 20,
  },
  submitBtnText: { fontSize: 16, fontWeight: "bold", color: "#fff" },

  /* مودال النجاح */
  overlay: { flex: 1, backgroundColor: "#000000BB", alignItems: "center", justifyContent: "center" },
  successCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20, padding: 28, width: "85%", alignItems: "center", gap: 8,
  },
  successIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.success + "18",
    alignItems: "center", justifyContent: "center",
    marginBottom: 8,
  },
  successTitle: { fontSize: 20, fontWeight: "bold", color: Colors.text, textAlign: "center" },
  successMsg:   { fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 22 },
  successBtn: {
    width: "100%", paddingVertical: 13,
    borderRadius: 12, alignItems: "center", marginTop: 4,
  },
  successBtnText: { fontSize: 15, fontWeight: "bold", color: "#fff" },
});
