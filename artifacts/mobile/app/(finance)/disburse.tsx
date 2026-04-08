import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator, Modal, Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, apiPut, formatCurrency } from "@/utils/api";

type ExpenseType = "daily" | "monthly" | "purchase";
type PayType     = "cash"  | "debt";

const EXPENSE_TYPES: { key: ExpenseType; label: string; icon: keyof typeof Ionicons.glyphMap; color: string; desc: string }[] = [
  { key: "daily",    label: "مصروف يومي",  icon: "today",    color: Colors.warning, desc: "فواتير ومصروفات يومية" },
  { key: "monthly",  label: "التزام شهري", icon: "calendar", color: Colors.info,    desc: "إيجارات والتزامات ثابتة" },
  { key: "purchase", label: "مشتريات",     icon: "cart",     color: "#9C27B0",      desc: "تنفيذ طلبات الشراء" },
];

function AlertModal({ visible, title, message, color, onClose }: {
  visible: boolean; title: string; message: string; color: string; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.alertBox}>
          <View style={[s.alertIconWrap, { backgroundColor: color + "22" }]}>
            <Ionicons
              name={color === Colors.error ? "close-circle" : "checkmark-circle"}
              size={48} color={color}
            />
          </View>
          <Text style={s.alertTitle}>{title}</Text>
          {!!message && <Text style={s.alertMsg}>{message}</Text>}
          <TouchableOpacity style={[s.alertBtn, { backgroundColor: color }]} onPress={onClose}>
            <Text style={s.alertBtnTxt}>حسناً</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  urgent: { label: "عاجل جداً", color: "#B71C1C"       },
  high:   { label: "عاجل",      color: Colors.error    },
  medium: { label: "متوسط",     color: Colors.warning  },
  low:    { label: "منخفض",     color: Colors.success  },
};

/* ── مكوّن زر الصورة ── */
function PhotoPickerBtn({ label, photoUri, onPick, onClear, color }: {
  label: string; photoUri: string | null;
  onPick: (fromCamera: boolean) => void;
  onClear: () => void; color: string;
}) {
  return (
    <View style={s.photoBox}>
      <Text style={s.fieldLabel}>{label} — اختياري</Text>
      {photoUri ? (
        <View style={s.photoPreviewWrap}>
          <Image source={{ uri: photoUri }} style={s.photoPreview} resizeMode="cover" />
          <TouchableOpacity style={s.photoRemoveBtn} onPress={onClear}>
            <Ionicons name="close-circle" size={22} color={Colors.error} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[s.photoPickerRow]}>
          <TouchableOpacity style={[s.photoPickBtn, { borderColor: color + "50" }]} onPress={() => onPick(true)}>
            <Ionicons name="camera" size={18} color={color} />
            <Text style={[s.photoPickBtnTxt, { color }]}>كاميرا</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.photoPickBtn, { borderColor: color + "50" }]} onPress={() => onPick(false)}>
            <Ionicons name="image" size={18} color={color} />
            <Text style={[s.photoPickBtnTxt, { color }]}>معرض</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function DisburseScreen() {
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const { token } = useAuth();

  const [expenseType,    setExpenseType]    = useState<ExpenseType>("daily");
  const [payType,        setPayType]        = useState<PayType>("cash");
  const [description,    setDescription]    = useState("");
  const [amount,         setAmount]         = useState("");
  const [personName,     setPersonName]     = useState("");
  const [saving,         setSaving]         = useState(false);
  const [modal,          setModal]          = useState({ visible: false, title: "", message: "", color: Colors.success });

  /* ── مشتريات ── */
  const [purchaseReqs,    setPurchaseReqs]    = useState<any[]>([]);
  const [loadingReqs,     setLoadingReqs]     = useState(false);
  const [selectedReqs,    setSelectedReqs]    = useState<Set<number>>(new Set());
  const [purchaseAmount,  setPurchaseAmount]  = useState("");

  /* ── صور المشتريات (اختيارية) ── */
  const [itemsPhotoUri,   setItemsPhotoUri]   = useState<string | null>(null);
  const [invoicePhotoUri, setInvoicePhotoUri] = useState<string | null>(null);

  /* عرض صورة مكبّرة */
  const [viewImg, setViewImg] = useState<string | null>(null);

  const showMsg = (title: string, message: string, color = Colors.success) =>
    setModal({ visible: true, title, message, color });

  const fetchPurchaseReqs = useCallback(async () => {
    setLoadingReqs(true);
    try {
      const data = await apiGet("/purchase-requests", token);
      setPurchaseReqs(data.filter((r: any) => r.status === "pending"));
    } catch {} finally {
      setLoadingReqs(false);
    }
  }, [token]);

  useEffect(() => {
    if (expenseType === "purchase") fetchPurchaseReqs();
  }, [expenseType, fetchPurchaseReqs]);

  const calcPurchaseTotal = (ids: Set<number>) => {
    const total = purchaseReqs
      .filter(r => ids.has(r.id))
      .reduce((sum, r) => {
        const p = parseFloat(r.estimatedPrice ?? r.amount ?? "0");
        return sum + (isNaN(p) ? 0 : p);
      }, 0);
    if (total > 0) setPurchaseAmount(String(total));
  };

  const toggleReq = (id: number) => {
    setSelectedReqs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      calcPurchaseTotal(next);
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set(purchaseReqs.map(r => r.id));
    setSelectedReqs(all);
    calcPurchaseTotal(all);
  };

  /* ── التقاط صورة ── */
  const pickPhoto = async (
    setter: (v: string | null) => void,
    fromCamera: boolean
  ) => {
    try {
      let res: ImagePicker.ImagePickerResult;
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") return;
        res = await ImagePicker.launchCameraAsync({ quality: 0.3, base64: true });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") return;
        res = await ImagePicker.launchImageLibraryAsync({ quality: 0.3, base64: true, mediaTypes: ["images"] as any });
      }
      if (!res.canceled && res.assets[0]) {
        setter(`data:image/jpeg;base64,${res.assets[0].base64}`);
      }
    } catch {}
  };

  const parsedAmt = parseFloat(amount.replace(/[^0-9.]/g, "")) || 0;
  const parsedPurchaseAmt = parseFloat(purchaseAmount.replace(/[^0-9.]/g, "")) || 0;

  const canSave = expenseType === "purchase"
    ? selectedReqs.size > 0 && parsedPurchaseAmt > 0
    : parsedAmt > 0 && !!description.trim() && (payType === "cash" || !!personName.trim());

  const handleSave = async () => {
    if (!canSave) return showMsg("خطأ", "أكمل البيانات المطلوبة", Colors.error);
    setSaving(true);
    try {
      if (expenseType === "purchase") {
        const selected = purchaseReqs.filter(r => selectedReqs.has(r.id));
        const desc = selected.map((r: any) =>
          `${r.description ?? "صنف"} (${r.quantity ?? 1})`
        ).join("، ");

        const result = await apiPost("/transactions/disburse", token, {
          expenseType: "purchase",
          paymentType: payType,
          amount: parsedPurchaseAmt,
          description: `مشتريات: ${desc}`,
          personName: payType === "debt" ? (personName.trim() || "المورد") : undefined,
          itemsPhotoUrl:   itemsPhotoUri   ?? null,
          invoicePhotoUrl: invoicePhotoUri ?? null,
        });

        const transactionId = result?.transactionId;

        await Promise.all(
          selected.map(r => apiPut(`/purchase-requests/${r.id}`, token, {
            status: "approved",
            transactionId: transactionId ?? null,
          }))
        );

        showMsg(
          "تم تنفيذ المشتريات ✓",
          `تم تسجيل ${selected.length} صنف\nالإجمالي: ${formatCurrency(parsedPurchaseAmt)}`
        );
        setSelectedReqs(new Set());
        setPurchaseAmount("");
        setItemsPhotoUri(null);
        setInvoicePhotoUri(null);
        fetchPurchaseReqs();
      } else {
        await apiPost("/transactions/disburse", token, {
          expenseType,
          paymentType: payType,
          amount: parsedAmt,
          description: description.trim(),
          personName: payType === "debt" ? personName.trim() : undefined,
        });

        const payLabel = payType === "cash"
          ? "← ينقص من الصندوق النقدي"
          : `← يُسجَّل كدين على الشبكة لصالح ${personName}`;
        showMsg(
          "تم تسجيل الصرف ✓",
          `${description}\n${formatCurrency(parsedAmt)}\n\n${payLabel}`
        );
        setDescription(""); setAmount(""); setPersonName("");
      }
    } catch (e: any) {
      showMsg("خطأ", e?.message ?? "فشل تسجيل الصرف", Colors.error);
    } finally {
      setSaving(false);
    }
  };

  const currentType = EXPENSE_TYPES.find(t => t.key === expenseType)!;

  return (
    <View style={[s.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>صرف</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        {/* ── نوع الصرف ── */}
        <Text style={s.sectionLabel}>نوع الصرف</Text>
        <View style={s.typeRow}>
          {EXPENSE_TYPES.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.typeCard, expenseType === t.key && { borderColor: t.color, backgroundColor: t.color + "12" }]}
              onPress={() => setExpenseType(t.key)}
              activeOpacity={0.8}
            >
              <View style={[s.typeIconWrap, { backgroundColor: t.color + "20" }]}>
                <Ionicons name={t.icon} size={24} color={t.color} />
              </View>
              {expenseType === t.key && (
                <View style={[s.typeCheck, { backgroundColor: t.color }]}>
                  <Ionicons name="checkmark" size={11} color="#fff" />
                </View>
              )}
              <Text style={[s.typeLabel, expenseType === t.key && { color: t.color }]}>{t.label}</Text>
              <Text style={s.typeDesc}>{t.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── طريقة الدفع ── */}
        <Text style={s.sectionLabel}>طريقة الدفع</Text>
        <View style={s.payRow}>
          {([
            { k: "cash", label: "نقد", icon: "cash"    as const, c: Colors.error,   hint: "ينقص من الصندوق" },
            { k: "debt", label: "دين", icon: "receipt" as const, c: Colors.warning, hint: "يُضاف للديون"    },
          ] as const).map(p => (
            <TouchableOpacity
              key={p.k}
              style={[s.payBtn, payType === p.k && { borderColor: p.c, backgroundColor: p.c + "18" }]}
              onPress={() => setPayType(p.k)}
            >
              <Ionicons name={p.icon} size={20} color={payType === p.k ? p.c : Colors.textSecondary} />
              <Text style={[s.payBtnLabel, payType === p.k && { color: p.c }]}>{p.label}</Text>
              <Text style={[s.payBtnHint, payType === p.k && { color: p.c + "AA" }]}>{p.hint}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ══════════ قسم المشتريات ══════════ */}
        {expenseType === "purchase" ? (
          <View style={s.card}>
            <View style={s.purchaseHeader}>
              <TouchableOpacity onPress={selectAll} style={s.selectAllBtn}>
                <Ionicons name="checkmark-done" size={14} color={"#9C27B0"} />
                <Text style={s.selectAllTxt}>تحديد الكل</Text>
              </TouchableOpacity>
              <Text style={s.cardTitle}>طلبات الشراء المعلقة</Text>
            </View>

            {loadingReqs ? (
              <ActivityIndicator color={"#9C27B0"} style={{ marginVertical: 20 }} />
            ) : purchaseReqs.length === 0 ? (
              <View style={s.emptyReqs}>
                <Ionicons name="cart-outline" size={36} color={Colors.textMuted} />
                <Text style={s.emptyReqsTxt}>لا توجد طلبات شراء معلقة</Text>
              </View>
            ) : purchaseReqs.map((req: any) => {
              const isSelected = selectedReqs.has(req.id);
              const prio = PRIORITY_MAP[req.priority ?? "medium"] ?? PRIORITY_MAP.medium;
              return (
                <TouchableOpacity
                  key={req.id}
                  style={[s.reqItem, isSelected && s.reqItemSelected]}
                  onPress={() => toggleReq(req.id)}
                  activeOpacity={0.7}
                >
                  <View style={[s.checkbox, isSelected && s.checkboxChecked]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <View style={s.reqContent}>
                    <View style={s.reqTopRow}>
                      <View style={[s.prioBadge, { backgroundColor: prio.color + "20" }]}>
                        <Text style={[s.prioBadgeTxt, { color: prio.color }]}>{prio.label}</Text>
                      </View>
                      <Text style={s.reqName}>{req.description ?? "طلب شراء"}</Text>
                    </View>
                    {req.quantity && (
                      <Text style={s.reqDetail}>الكمية: {req.quantity}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            {selectedReqs.size > 0 && (
              <View style={s.selectedSummary}>
                <Text style={s.selectedSummaryTxt}>{selectedReqs.size} صنف محدد</Text>
              </View>
            )}

            {/* ── المبلغ الإجمالي ── */}
            <View style={{ marginTop: 14 }}>
              <Text style={s.fieldLabel}>المبلغ الإجمالي (ر.س) *</Text>
              <TextInput
                style={[s.input, s.amtInput]}
                value={purchaseAmount}
                onChangeText={v => setPurchaseAmount(v.replace(/[^0-9.]/g, ""))}
                placeholder="0.00 — يُحسب تلقائياً أو أدخله يدوياً"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                textAlign="right"
              />
              {parsedPurchaseAmt > 0 && (
                <Text style={[s.fieldLabel, { color: Colors.warning, marginTop: 4, fontSize: 12 }]}>
                  {payType === "cash" ? "⬇ ينقص من الصندوق:" : "⬆ يُضاف للديون:"} {formatCurrency(parsedPurchaseAmt)}
                </Text>
              )}
            </View>

            {/* ── اسم المورد عند الدين ── */}
            {payType === "debt" && (
              <View style={{ marginTop: 14 }}>
                <Text style={s.fieldLabel}>اسم المورد / الجهة *</Text>
                <TextInput
                  style={s.input} value={personName} onChangeText={setPersonName}
                  placeholder="اسم المورد..." placeholderTextColor={Colors.textMuted} textAlign="right"
                />
              </View>
            )}

            {/* ── صور اختيارية ── */}
            <View style={s.photosSection}>
              <View style={s.photosSectionHeader}>
                <Ionicons name="images-outline" size={16} color={Colors.textSecondary} />
                <Text style={s.photosSectionTitle}>صور المشتريات — اختياري</Text>
              </View>

              <PhotoPickerBtn
                label="صورة المشتريات"
                photoUri={itemsPhotoUri}
                onPick={(fromCamera) => pickPhoto(setItemsPhotoUri, fromCamera)}
                onClear={() => setItemsPhotoUri(null)}
                color={"#9C27B0"}
              />

              <PhotoPickerBtn
                label="صورة الفاتورة"
                photoUri={invoicePhotoUri}
                onPick={(fromCamera) => pickPhoto(setInvoicePhotoUri, fromCamera)}
                onClear={() => setInvoicePhotoUri(null)}
                color={"#FF9800"}
              />
            </View>
          </View>

        ) : (
          /* ── نموذج الصرف العادي ── */
          <View style={s.card}>
            <Text style={s.fieldLabel}>البيان / الوصف *</Text>
            <TextInput
              style={s.input} value={description} onChangeText={setDescription}
              placeholder="مثال: فاتورة كهرباء، إيجار..." placeholderTextColor={Colors.textMuted} textAlign="right"
            />

            <Text style={[s.fieldLabel, { marginTop: 14 }]}>المبلغ (ر.س) *</Text>
            <TextInput
              style={[s.input, s.amtInput]} value={amount}
              onChangeText={v => setAmount(v.replace(/[^0-9.]/g, ""))}
              placeholder="0.00" placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad" textAlign="right"
            />

            {payType === "debt" && (
              <>
                <Text style={[s.fieldLabel, { marginTop: 14 }]}>اسم الجهة الدائنة *</Text>
                <TextInput
                  style={s.input} value={personName} onChangeText={setPersonName}
                  placeholder="اسم المورد أو الجهة..." placeholderTextColor={Colors.textMuted} textAlign="right"
                />
                <View style={s.infoBox}>
                  <Ionicons name="information-circle" size={15} color={Colors.warning} />
                  <Text style={s.infoTxt}>
                    سيُسجَّل هذا المبلغ كدين مستحق على الشبكة لصالح {personName || "الجهة"}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* ── ملخص الأثر ── */}
        {canSave && (
          <View style={[s.summaryBox, { borderColor: currentType.color + "55" }]}>
            <Text style={[s.summaryTitle, { color: currentType.color }]}>
              {currentType.label} — {payType === "cash" ? "نقد" : "دين"}
            </Text>
            <View style={s.summaryEffects}>
              <View style={s.effectRow}>
                <Ionicons
                  name={payType === "cash" ? "remove-circle" : "add-circle"}
                  size={14} color={payType === "cash" ? Colors.error : Colors.warning}
                />
                <Text style={s.effectTxt}>
                  {payType === "cash" ? "ينقص من الصندوق النقدي" : "يُضاف إلى ديون الشبكة"}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── زر الحفظ ── */}
        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: currentType.color }, (!canSave || saving) && { opacity: 0.4 }]}
          onPress={handleSave} disabled={!canSave || saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={s.saveBtnTxt}>
                  {expenseType === "purchase" ? `تنفيذ شراء ${selectedReqs.size} صنف` : "تأكيد الصرف"}
                </Text>
              </>}
        </TouchableOpacity>

        <View style={{ height: 50 }} />
      </ScrollView>

      <AlertModal
        visible={modal.visible} title={modal.title} message={modal.message} color={modal.color}
        onClose={() => setModal(m => ({ ...m, visible: false }))}
      />

      {/* عرض الصورة مكبّرة */}
      <Modal visible={!!viewImg} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "#000000CC", justifyContent: "center", alignItems: "center" }}
          activeOpacity={1} onPress={() => setViewImg(null)}
        >
          {!!viewImg && (
            <Image source={{ uri: viewImg }} style={{ width: "94%", height: 400, borderRadius: 12 }} resizeMode="contain" />
          )}
          <Text style={{ color: "#fff", marginTop: 12, fontSize: 13 }}>اضغط للإغلاق</Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  content: { padding: 16 },

  sectionLabel: { fontSize: 14, fontWeight: "700", color: Colors.text, textAlign: "right", marginBottom: 10 },

  typeRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 16 },
  typeCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 12,
    alignItems: "center", gap: 6, borderWidth: 1.5, borderColor: Colors.border,
  },
  typeIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  typeCheck: {
    position: "absolute", top: 6, left: 6, width: 18, height: 18,
    borderRadius: 9, justifyContent: "center", alignItems: "center",
  },
  typeLabel: { fontSize: 12, fontWeight: "700", color: Colors.text, textAlign: "center" },
  typeDesc:  { fontSize: 10, color: Colors.textMuted, textAlign: "center" },

  payRow: { flexDirection: "row-reverse", gap: 10, marginBottom: 16 },
  payBtn: {
    flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background, gap: 4,
  },
  payBtnLabel: { fontSize: 15, fontWeight: "700", color: Colors.textSecondary },
  payBtnHint:  { fontSize: 10, color: Colors.textMuted },

  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 14,
  },
  cardTitle:  { fontSize: 14, fontWeight: "700", color: Colors.text, textAlign: "right" },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: 7, fontWeight: "600" },
  input: {
    backgroundColor: Colors.background, borderRadius: 10, padding: 13,
    color: Colors.text, fontSize: 15, borderWidth: 1, borderColor: Colors.border,
  },
  amtInput: { fontSize: 24, fontWeight: "800" },
  infoBox: {
    flexDirection: "row-reverse", gap: 6, alignItems: "flex-start",
    backgroundColor: Colors.warning + "12", borderRadius: 10, padding: 10, marginTop: 10,
  },
  infoTxt: { flex: 1, fontSize: 11, color: Colors.textSecondary, textAlign: "right", lineHeight: 17 },

  purchaseHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  selectAllBtn:   { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  selectAllTxt:   { fontSize: 12, color: "#9C27B0", fontWeight: "700" },

  emptyReqs:    { alignItems: "center", paddingVertical: 30, gap: 10 },
  emptyReqsTxt: { fontSize: 13, color: Colors.textMuted },

  reqItem: {
    flexDirection: "row-reverse", gap: 12, alignItems: "flex-start",
    paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 8,
    backgroundColor: Colors.background,
  },
  reqItemSelected: { borderColor: "#9C27B0", backgroundColor: "#9C27B0" + "0F" },

  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border,
    justifyContent: "center", alignItems: "center", marginTop: 2, flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: "#9C27B0", borderColor: "#9C27B0" },

  reqContent:  { flex: 1, gap: 4 },
  reqTopRow:   { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  reqName:     { fontSize: 14, fontWeight: "700", color: Colors.text, flex: 1, textAlign: "right" },
  prioBadge:   { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  prioBadgeTxt: { fontSize: 10, fontWeight: "700" },
  reqDetail:   { fontSize: 11, color: Colors.textSecondary, textAlign: "right" },

  selectedSummary: {
    backgroundColor: "#9C27B0" + "15", borderRadius: 10, padding: 10, marginTop: 8, alignItems: "center",
  },
  selectedSummaryTxt: { fontSize: 13, fontWeight: "700", color: "#9C27B0" },

  /* قسم الصور */
  photosSection: {
    marginTop: 16, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 14, gap: 12,
  },
  photosSectionHeader: {
    flexDirection: "row-reverse", alignItems: "center", gap: 6, marginBottom: 4,
  },
  photosSectionTitle: {
    fontSize: 13, fontWeight: "700", color: Colors.textSecondary,
  },
  photoBox: { gap: 6 },
  photoBoxLabel: { fontSize: 12, color: Colors.textSecondary, textAlign: "right", fontWeight: "600" },
  photoPickerRow: { flexDirection: "row-reverse", gap: 8 },
  photoPickBtn: {
    flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
    backgroundColor: Colors.background,
  },
  photoPickBtnTxt: { fontSize: 13, fontWeight: "600" },
  photoPreviewWrap: { position: "relative" },
  photoPreview: { width: "100%", height: 120, borderRadius: 10 },
  photoRemoveBtn: {
    position: "absolute", top: 6, left: 6,
    backgroundColor: Colors.surface, borderRadius: 12,
  },

  summaryBox: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1.5, marginBottom: 14, gap: 6,
  },
  summaryTitle:   { fontSize: 13, fontWeight: "700", textAlign: "right" },
  summaryEffects: { gap: 6 },
  effectRow:      { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  effectTxt:      { fontSize: 12, color: Colors.textSecondary },

  saveBtn: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 14,
  },
  saveBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },

  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", alignItems: "center", padding: 30,
  },
  alertBox: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: Colors.border, width: "100%", alignItems: "center", gap: 10,
  },
  alertIconWrap: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center" },
  alertTitle: { fontSize: 17, fontWeight: "bold", color: Colors.text },
  alertMsg: { fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  alertBtn: { borderRadius: 12, paddingHorizontal: 30, paddingVertical: 12, marginTop: 4 },
  alertBtnTxt: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
});
