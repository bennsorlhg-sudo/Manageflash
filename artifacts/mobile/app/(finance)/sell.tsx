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

/* ─── Alert Modal ─── */
function AlertModal({ title, msg, visible, onClose }: { title: string; msg: string; visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.alertOverlay}>
        <View style={styles.alertBox}>
          <Text style={styles.alertTitle}>{title}</Text>
          {msg ? <Text style={styles.alertMsg}>{msg}</Text> : null}
          <TouchableOpacity style={styles.alertBtn} onPress={onClose}>
            <Text style={styles.alertBtnText}>حسناً</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function SellScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [sellType, setSellType] = useState<"cards" | "broadband">("cards");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "loan">("cash");
  const [amount, setAmount] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);

  const [alertVis, setAlertVis] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMsg, setAlertMsg] = useState("");
  const showAlert = (t: string, m = "") => { setAlertTitle(t); setAlertMsg(m); setAlertVis(true); };

  const parsedAmount = parseFloat(amount.replace(/[^0-9.]/g, "")) || 0;
  const isValid = customerName.trim().length > 0 && parsedAmount > 0;

  const handleSubmit = async () => {
    if (!isValid) { showAlert("خطأ", "يرجى إدخال اسم المستلم والمبلغ"); return; }
    setLoading(true);
    try {
      const result = await apiPost("/transactions/sell", token, {
        cardType: sellType,
        amount: parsedAmount,
        paymentType: paymentMethod,
        customerName: customerName.trim(),
        notes: notes.trim() || undefined,
      });
      setLastSale(result);
      setSubmitted(true);
    } catch (e: any) {
      showAlert("خطأ", e.message ?? "فشلت عملية البيع");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSubmitted(false);
    setCustomerName("");
    setAmount("");
    setNotes("");
    setPaymentMethod("cash");
    setSellType("cards");
    setLastSale(null);
  };

  /* ─── Success Screen ─── */
  if (submitted) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={80} color={Colors.success} />
        </View>
        <Text style={styles.successTitle}>تمت عملية البيع بنجاح</Text>
        <Text style={styles.successSub}>
          {sellType === "cards" ? "كروت هوتسبوت" : "باقات برودباند"} — {customerName}
        </Text>
        <Text style={styles.successAmount}>{formatCurrency(lastSale?.amount ?? parsedAmount)}</Text>
        <View style={[
          styles.badge,
          { backgroundColor: paymentMethod === "cash" ? Colors.success + "22" : Colors.info + "22" }
        ]}>
          <Text style={[styles.badgeText, { color: paymentMethod === "cash" ? Colors.success : Colors.info }]}>
            {paymentMethod === "cash" ? "نقدي — أُضيف للصندوق" : "سلفة — سُجل كمديونية"}
          </Text>
        </View>
        <View style={styles.successActions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={reset}>
            <Text style={styles.primaryBtnText}>بيع جديد</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>العودة للرئيسية</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ─── Main Form ─── */
  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>بيع</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* نوع البيع */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>نوع البيع</Text>
          <View style={styles.segmentedControl}>
            {(["cards", "broadband"] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.segment, sellType === t && styles.segmentActive]}
                onPress={() => setSellType(t)}
              >
                <Ionicons
                  name={t === "cards" ? "card-outline" : "wifi-outline"}
                  size={20}
                  color={sellType === t ? "#FFF" : Colors.textSecondary}
                />
                <Text style={[styles.segmentText, sellType === t && styles.segmentTextActive]}>
                  {t === "cards" ? "كروت" : "برودباند"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* طريقة الدفع */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>طريقة الدفع</Text>
          <View style={styles.paymentRow}>
            {(["cash", "loan"] as const).map(m => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.paymentBtn,
                  paymentMethod === m && styles.paymentBtnActive,
                  { borderColor: m === "cash" ? Colors.success : Colors.info },
                ]}
                onPress={() => setPaymentMethod(m)}
              >
                <Ionicons
                  name={m === "cash" ? "cash-outline" : "trending-up-outline"}
                  size={24}
                  color={paymentMethod === m ? (m === "cash" ? Colors.success : Colors.info) : Colors.textSecondary}
                />
                <Text style={[styles.paymentBtnText, paymentMethod === m && { color: m === "cash" ? Colors.success : Colors.info }]}>
                  {m === "cash" ? "نقدي" : "سلفة"}
                </Text>
                {paymentMethod === m && (
                  <Text style={styles.paymentHint}>{m === "cash" ? "يُضاف للصندوق" : "يُسجل كمديونية"}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* البيانات */}
        <View style={styles.card}>
          <Text style={styles.label}>اسم المستلم / المشترك</Text>
          <TextInput
            style={styles.input}
            placeholder="أدخل الاسم"
            placeholderTextColor={Colors.textMuted}
            value={customerName}
            onChangeText={setCustomerName}
            textAlign="right"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>المبلغ (ريال)</Text>
          <TextInput
            style={[styles.input, styles.amountInput]}
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            value={amount}
            onChangeText={v => setAmount(v.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            textAlign="right"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>ملاحظات (اختياري)</Text>
          <TextInput
            style={[styles.input, { height: 70, textAlignVertical: "top" }]}
            placeholder="أي تفاصيل إضافية..."
            placeholderTextColor={Colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            textAlign="right"
            multiline
          />
        </View>

        {/* ملخص */}
        {parsedAmount > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>إجمالي المبلغ</Text>
            <Text style={styles.summaryValue}>{formatCurrency(parsedAmount)}</Text>
            <Text style={styles.summaryDetail}>
              {sellType === "cards" ? "كروت هوتسبوت" : "باقات برودباند"} ·{" "}
              {paymentMethod === "cash" ? "نقدي" : "سلفة"}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, (!isValid || loading) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!isValid || loading}
        >
          {loading
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.submitBtnText}>تأكيد البيع</Text>}
        </TouchableOpacity>
      </ScrollView>

      <AlertModal title={alertTitle} msg={alertMsg} visible={alertVis} onClose={() => setAlertVis(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { alignItems: "center", justifyContent: "center", padding: 20 },
  header: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  backButton: { padding: 4 },
  content: { padding: 20, gap: 4 },

  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.border,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: Colors.text, marginBottom: 16, textAlign: "right" },

  segmentedControl: { flexDirection: "row-reverse", backgroundColor: Colors.background, borderRadius: 12, padding: 4 },
  segment: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 10, gap: 8 },
  segmentActive: { backgroundColor: Colors.primary },
  segmentText: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },
  segmentTextActive: { color: "#FFF" },

  paymentRow: { flexDirection: "row-reverse", gap: 12 },
  paymentBtn: {
    flex: 1, backgroundColor: Colors.background, borderRadius: 12,
    padding: 16, alignItems: "center", borderWidth: 2, borderColor: "transparent",
  },
  paymentBtnActive: { backgroundColor: Colors.surfaceElevated },
  paymentBtnText: { fontSize: 14, fontWeight: "bold", color: Colors.textSecondary, marginTop: 8 },
  paymentHint: { fontSize: 10, color: Colors.textMuted, marginTop: 4 },

  label: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary, marginBottom: 8, textAlign: "right" },
  input: {
    backgroundColor: Colors.background, borderRadius: 12, padding: 14,
    color: Colors.text, fontSize: 16, borderWidth: 1, borderColor: Colors.border,
  },
  amountInput: { fontSize: 24, fontWeight: "bold", color: Colors.text, paddingVertical: 16 },

  summaryCard: {
    backgroundColor: Colors.primary + "15", borderRadius: 16, padding: 20,
    alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: Colors.primary + "33",
  },
  summaryLabel: { fontSize: 13, color: Colors.textSecondary },
  summaryValue: { fontSize: 36, fontWeight: "800", color: Colors.primaryLight, marginVertical: 6 },
  summaryDetail: { fontSize: 12, color: Colors.textMuted },

  submitBtn: { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 4, marginBottom: 20 },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontSize: 18, fontWeight: "bold", color: "#FFF" },

  successIcon: { marginBottom: 24 },
  successTitle: { fontSize: 24, fontWeight: "bold", color: Colors.text, marginBottom: 8, textAlign: "center" },
  successSub: { fontSize: 16, color: Colors.textSecondary, marginBottom: 4, textAlign: "center" },
  successAmount: { fontSize: 36, fontWeight: "800", color: Colors.primaryLight, marginBottom: 16 },
  badge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginBottom: 32 },
  badgeText: { fontSize: 13, fontWeight: "600" },
  successActions: { width: "100%", gap: 12 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  secondaryBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  secondaryBtnText: { color: Colors.text, fontSize: 16, fontWeight: "600" },

  alertOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 30 },
  alertBox: { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border },
  alertTitle: { color: Colors.text, fontSize: 17, fontWeight: "bold", textAlign: "right", marginBottom: 8 },
  alertMsg: { color: Colors.textSecondary, fontSize: 14, textAlign: "right", marginBottom: 16 },
  alertBtn: { backgroundColor: Colors.primary, borderRadius: 10, padding: 12, alignItems: "center" },
  alertBtnText: { color: "#FFF", fontWeight: "bold" },
  surfaceElevated: { backgroundColor: Colors.surfaceElevated },
});
