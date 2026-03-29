import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiPost, formatCurrency } from "@/utils/api";

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

type SaleType = "cards" | "broadband";
type PayType  = "cash" | "loan";

export default function SellScreen() {
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const { token } = useAuth();

  const [step,       setStep]       = useState<1 | 2>(1);
  const [saleType,   setSaleType]   = useState<SaleType>("cards");
  const [customer,   setCustomer]   = useState("");
  const [amount,     setAmount]     = useState("");
  const [payType,    setPayType]    = useState<PayType>("cash");
  const [notes,      setNotes]      = useState("");
  const [saving,     setSaving]     = useState(false);
  const [modal,      setModal]      = useState({ visible: false, title: "", message: "", color: Colors.success });

  const showMsg = (title: string, message: string, color = Colors.success) =>
    setModal({ visible: true, title, message, color });

  const reset = () => {
    setStep(1); setCustomer(""); setAmount(""); setPayType("cash"); setNotes("");
  };

  const parsedAmt = parseFloat(amount.replace(/[^0-9.]/g, "")) || 0;
  const canSave   = !!customer.trim() && parsedAmt > 0;

  const handleSave = async () => {
    if (!canSave) return showMsg("خطأ", "أدخل اسم العميل والمبلغ", Colors.error);
    setSaving(true);
    try {
      await apiPost("/transactions/sell", token, {
        cardType: saleType,
        amount: parsedAmt,
        customerName: customer.trim(),
        paymentType: payType,
        notes: notes.trim() || undefined,
      });

      const typeLabel = saleType === "cards" ? "كروت هوتسبوت" : "برودباند";
      const payLabel  = payType  === "cash"  ? "نقد" : "سلفة";
      let effectLines = "";
      if (saleType === "cards") {
        effectLines  = payType === "cash"
          ? "← ينقص من إجمالي الكروت\n← يزيد الصندوق النقدي"
          : "← ينقص من إجمالي الكروت\n← يزيد السلف";
      } else {
        effectLines  = payType === "cash"
          ? "← يُسجَّل ضمن العهدة\n← يزيد الصندوق النقدي"
          : "← يُسجَّل ضمن العهدة\n← يزيد السلف";
      }

      showMsg(
        "تم تسجيل البيع ✓",
        `${typeLabel} — ${payLabel}\n${formatCurrency(parsedAmt)}\nإلى: ${customer.trim()}\n\n${effectLines}`,
      );
      reset();
    } catch (e: any) {
      showMsg("خطأ في البيع", e?.message ?? "فشل تسجيل البيع", Colors.error);
    } finally {
      setSaving(false);
    }
  };

  /* ── الألوان حسب النوع ── */
  const typeColor = saleType === "cards" ? Colors.info : "#9C27B0";

  return (
    <View style={[s.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => { if (step === 2) setStep(1); else router.back(); }}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>بيع</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        {/* ══ الخطوة 1: اختيار النوع ══ */}
        <Text style={s.sectionLabel}>نوع البيع</Text>
        <View style={s.typeRow}>
          {([
            { key: "cards",     label: "كروت هوتسبوت", icon: "card"  as const, color: Colors.info,  desc: "كروت إنترنت هوتسبوت" },
            { key: "broadband", label: "برودباند",      icon: "wifi"  as const, color: "#9C27B0",    desc: "اشتراكات برودباند"   },
          ] as const).map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.typeCard, saleType === t.key && { borderColor: t.color, backgroundColor: t.color + "12" }]}
              onPress={() => setSaleType(t.key)}
              activeOpacity={0.8}
            >
              <View style={[s.typeIconWrap, { backgroundColor: t.color + "20" }]}>
                <Ionicons name={t.icon} size={26} color={t.color} />
              </View>
              {saleType === t.key && (
                <View style={[s.typeCheck, { backgroundColor: t.color }]}>
                  <Ionicons name="checkmark" size={11} color="#fff" />
                </View>
              )}
              <Text style={[s.typeLabel, saleType === t.key && { color: t.color }]}>{t.label}</Text>
              <Text style={s.typeDesc}>{t.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ══ نموذج البيع ══ */}
        <View style={s.card}>
          {/* اسم العميل */}
          <Text style={s.fieldLabel}>
            {saleType === "cards" ? "اسم الجهة / العميل" : "اسم العميل"} *
          </Text>
          <TextInput
            style={s.input} value={customer} onChangeText={setCustomer}
            placeholder="أدخل الاسم" placeholderTextColor={Colors.textMuted} textAlign="right"
          />

          {/* المبلغ */}
          <Text style={[s.fieldLabel, { marginTop: 14 }]}>المبلغ (ر.س) *</Text>
          <TextInput
            style={[s.input, s.amtInput]} value={amount}
            onChangeText={v => setAmount(v.replace(/[^0-9.]/g, ""))}
            placeholder="0" placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad" textAlign="right"
          />

          {/* طريقة الدفع */}
          <Text style={[s.fieldLabel, { marginTop: 14 }]}>طريقة الدفع *</Text>
          <View style={s.payRow}>
            {([
              { k: "cash", label: "نقد",  icon: "cash"  as const, c: Colors.success, hint: "يزيد الصندوق"  },
              { k: "loan", label: "سلفة", icon: "time"  as const, c: Colors.warning, hint: "يُسجَّل كسلفة" },
            ] as const).map(p => (
              <TouchableOpacity
                key={p.k}
                style={[s.payBtn, payType === p.k && { borderColor: p.c, backgroundColor: p.c + "18" }]}
                onPress={() => setPayType(p.k)}
              >
                <Ionicons name={p.icon} size={20} color={payType === p.k ? p.c : Colors.textSecondary} />
                <Text style={[s.payBtnTxt, payType === p.k && { color: p.c, fontWeight: "700" }]}>{p.label}</Text>
                <Text style={[s.payBtnHint, payType === p.k && { color: p.c + "BB" }]}>{p.hint}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ملاحظات */}
          <Text style={[s.fieldLabel, { marginTop: 14 }]}>ملاحظات (اختياري)</Text>
          <TextInput
            style={s.input} value={notes} onChangeText={setNotes}
            placeholder="أي ملاحظات..." placeholderTextColor={Colors.textMuted} textAlign="right"
          />
        </View>

        {/* ── ملخص الأثر ── */}
        {canSave && (
          <View style={[s.summaryBox, { borderColor: typeColor + "55" }]}>
            <Text style={[s.summaryTitle, { color: typeColor }]}>
              {saleType === "cards" ? "بيع كروت هوتسبوت" : "بيع باقة برودباند"}
              {" — "}{payType === "cash" ? "نقد" : "سلفة"}
            </Text>
            <View style={s.summaryAmtRow}>
              <Text style={s.summaryName}>{customer}</Text>
              <Text style={[s.summaryAmt, { color: typeColor }]}>{formatCurrency(parsedAmt)}</Text>
            </View>
            <View style={s.divider} />
            {/* الآثار */}
            {saleType === "cards" && (
              <View style={s.effectRow}>
                <Ionicons name="remove-circle" size={14} color={Colors.error} />
                <Text style={s.effectTxt}>ينقص من إجمالي الكروت</Text>
              </View>
            )}
            <View style={s.effectRow}>
              <Ionicons name="add-circle" size={14} color={payType === "cash" ? Colors.success : Colors.warning} />
              <Text style={s.effectTxt}>
                {payType === "cash" ? "يزيد الصندوق النقدي" : "يزيد السلف (مبلغ مستحق التحصيل)"}
              </Text>
            </View>
          </View>
        )}

        {/* ── زر الحفظ ── */}
        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: typeColor }, (!canSave || saving) && { opacity: 0.4 }]}
          onPress={handleSave} disabled={!canSave || saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={s.saveBtnTxt}>حفظ البيع</Text>
              </>}
        </TouchableOpacity>

        <View style={{ height: 50 }} />
      </ScrollView>

      <AlertModal
        visible={modal.visible} title={modal.title} message={modal.message} color={modal.color}
        onClose={() => setModal(m => ({ ...m, visible: false }))}
      />
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

  typeRow: { flexDirection: "row-reverse", gap: 10, marginBottom: 16 },
  typeCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    alignItems: "center", gap: 8, borderWidth: 1.5, borderColor: Colors.border,
  },
  typeIconWrap: { width: 52, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  typeCheck: {
    position: "absolute", top: 8, left: 8, width: 20, height: 20,
    borderRadius: 10, justifyContent: "center", alignItems: "center",
  },
  typeLabel: { fontSize: 13, fontWeight: "700", color: Colors.text, textAlign: "center" },
  typeDesc:  { fontSize: 11, color: Colors.textMuted, textAlign: "center" },

  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 14,
  },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: 7, fontWeight: "600" },
  input: {
    backgroundColor: Colors.background, borderRadius: 10, padding: 13,
    color: Colors.text, fontSize: 15, borderWidth: 1, borderColor: Colors.border,
  },
  amtInput: { fontSize: 24, fontWeight: "800" },

  payRow: { flexDirection: "row-reverse", gap: 8 },
  payBtn: {
    flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background, gap: 4,
  },
  payBtnTxt:  { fontSize: 14, color: Colors.textSecondary },
  payBtnHint: { fontSize: 10, color: Colors.textMuted },

  summaryBox: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1.5, marginBottom: 14, gap: 8,
  },
  summaryTitle:  { fontSize: 13, fontWeight: "700", textAlign: "right" },
  summaryAmtRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  summaryName:   { fontSize: 13, color: Colors.textSecondary },
  summaryAmt:    { fontSize: 18, fontWeight: "800" },
  divider:       { height: 1, backgroundColor: Colors.border },
  effectRow:     { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  effectTxt:     { fontSize: 12, color: Colors.textSecondary },

  saveBtn: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 14,
  },
  saveBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },

  /* modal */
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  alertBox: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 28,
    width: "100%", maxWidth: 340, alignItems: "center", gap: 12,
  },
  alertIconWrap: { width: 76, height: 76, borderRadius: 38, justifyContent: "center", alignItems: "center" },
  alertTitle:    { fontSize: 18, fontWeight: "800", color: Colors.text, textAlign: "center" },
  alertMsg:      { fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  alertBtn:      { paddingHorizontal: 44, paddingVertical: 12, borderRadius: 12, marginTop: 4 },
  alertBtnTxt:   { fontSize: 15, fontWeight: "700", color: "#fff" },
});
