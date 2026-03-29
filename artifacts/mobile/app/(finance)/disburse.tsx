import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, formatCurrency } from "@/utils/api";

const EXPENSE_TYPES = [
  { key: "daily",    label: "مصروف يومي",    icon: "today-outline" as const },
  { key: "monthly",  label: "التزام شهري",    icon: "calendar-outline" as const },
  { key: "purchase", label: "مشتريات",        icon: "cart-outline" as const },
  { key: "salary",   label: "راتب",           icon: "people-outline" as const },
];

export default function DisburseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [expenseType, setExpenseType] = useState<"daily" | "monthly" | "purchase" | "salary">("daily");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "debt">("cash");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [personName, setPersonName] = useState(""); // ← اسم المستلم (للدين)
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    apiGet("/expense-templates", token).then(setTemplates).catch(() => {});
  }, [token]);

  const isValid = !!amount && parseFloat(amount) > 0 && !!description &&
    (paymentMethod === "cash" || !!personName);

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      await apiPost("/transactions/disburse", token, {
        expenseType,
        paymentType: paymentMethod,
        amount: parseFloat(amount),
        description,
        personName: paymentMethod === "debt" ? personName : undefined,
      });
      setShowResult(true);
    } catch {} finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAmount(""); setDescription(""); setPersonName("");
    setPaymentMethod("cash"); setExpenseType("daily");
    setShowResult(false);
  };

  /* ─── شاشة النجاح ─── */
  if (showResult) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={72} color={Colors.error} />
        </View>
        <Text style={styles.successTitle}>تمت عملية الصرف</Text>
        <Text style={styles.successDesc}>{description}</Text>
        <Text style={[styles.successAmount, { color: Colors.error }]}>{formatCurrency(parseFloat(amount))}</Text>
        <View style={[styles.badge, { backgroundColor: paymentMethod === "cash" ? Colors.error + "20" : Colors.warning + "20" }]}>
          <Ionicons
            name={paymentMethod === "cash" ? "cash" : "receipt"}
            size={14}
            color={paymentMethod === "cash" ? Colors.error : Colors.warning}
          />
          <Text style={[styles.badgeText, { color: paymentMethod === "cash" ? Colors.error : Colors.warning }]}>
            {paymentMethod === "cash" ? "نقدي — خُصم من الصندوق" : `دين على ${personName}`}
          </Text>
        </View>
        <View style={styles.successActions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={resetForm}>
            <Text style={styles.primaryBtnText}>صرف جديد</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>العودة</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>صرف</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ─── نوع المصروف ─── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>نوع المصروف</Text>
          <View style={styles.typeGrid}>
            {EXPENSE_TYPES.map(et => (
              <TouchableOpacity
                key={et.key}
                style={[styles.typeBtn, expenseType === et.key && styles.typeBtnActive]}
                onPress={() => setExpenseType(et.key as any)}
              >
                <Ionicons name={et.icon} size={18} color={expenseType === et.key ? "#FFF" : Colors.textSecondary} />
                <Text style={[styles.typeBtnText, expenseType === et.key && styles.typeBtnTextActive]}>{et.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ─── القوالب ─── */}
        {templates.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>قوالب سريعة</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: "row-reverse" }}>
              {templates.map(t => (
                <TouchableOpacity
                  key={t.id} style={styles.chip}
                  onPress={() => {
                    setDescription(t.name);
                    if (t.amount) setAmount(String(t.amount));
                  }}
                >
                  <Text style={styles.chipText}>{t.name}</Text>
                  {t.amount && <Text style={styles.chipSub}>{formatCurrency(parseFloat(t.amount))}</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ─── طريقة الدفع ─── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>طريقة الدفع</Text>
          <View style={styles.payRow}>
            {([
              { val: "cash", label: "نقدي", icon: "cash-outline", color: Colors.error, hint: "يُخصم من الصندوق" },
              { val: "debt", label: "دين",  icon: "receipt-outline", color: Colors.warning, hint: "لا يُخصم حالياً" },
            ] as any[]).map(p => (
              <TouchableOpacity
                key={p.val}
                style={[styles.payBtn, paymentMethod === p.val && { backgroundColor: p.color + "18", borderColor: p.color }]}
                onPress={() => setPaymentMethod(p.val)}
              >
                <Ionicons name={p.icon} size={24} color={paymentMethod === p.val ? p.color : Colors.textSecondary} />
                <Text style={[styles.payBtnLabel, paymentMethod === p.val && { color: p.color }]}>{p.label}</Text>
                <Text style={styles.payBtnHint}>{p.hint}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ─── البيانات ─── */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>البيان / الوصف *</Text>
          <TextInput
            style={styles.input}
            placeholder="مثال: فاتورة كهرباء، إيجار شبكة..."
            placeholderTextColor={Colors.textMuted}
            value={description}
            onChangeText={setDescription}
            textAlign="right"
          />

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>المبلغ (ر.س) *</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor={Colors.textMuted}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            textAlign="right"
          />

          {/* حقل اسم المستلم — يظهر فقط عند الدين */}
          {paymentMethod === "debt" && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>اسم المستلم (الدائن) *</Text>
              <TextInput
                style={styles.input}
                placeholder="من صرفنا له..."
                placeholderTextColor={Colors.textMuted}
                value={personName}
                onChangeText={setPersonName}
                textAlign="right"
              />
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={16} color={Colors.warning} />
                <Text style={styles.infoText}>سيُسجَّل هذا المبلغ كدين مستحق على الشبكة لصالح {personName || "المستلم"}</Text>
              </View>
            </>
          )}
        </View>

        {/* ─── ملخص ─── */}
        {amount && parseFloat(amount) > 0 && (
          <View style={[styles.summaryCard, { borderColor: paymentMethod === "cash" ? Colors.error + "44" : Colors.warning + "44" }]}>
            <Text style={styles.summaryLabel}>إجمالي الصرف</Text>
            <Text style={[styles.summaryAmount, { color: paymentMethod === "cash" ? Colors.error : Colors.warning }]}>
              {formatCurrency(parseFloat(amount))}
            </Text>
            <Text style={styles.summaryMethod}>
              {paymentMethod === "cash" ? "نقدي — سيُخصم من الصندوق" : "دين — لن يُخصم من الصندوق"}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, !isValid && { opacity: 0.45 }]}
          onPress={handleSubmit}
          disabled={loading || !isValid}
        >
          {loading
            ? <ActivityIndicator color="#FFF" />
            : <>
                <Ionicons name="arrow-up-circle" size={20} color="#FFF" />
                <Text style={styles.submitBtnText}>تأكيد الصرف</Text>
              </>}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  content: { padding: 18 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.border,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: Colors.text, textAlign: "right", marginBottom: 14 },
  typeGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  typeBtn: {
    flexDirection: "row-reverse", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeBtnText: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" },
  typeBtnTextActive: { color: "#FFF" },
  chip: {
    backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border, alignItems: "center",
  },
  chipText: { fontSize: 13, color: Colors.text },
  chipSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  payRow: { flexDirection: "row-reverse", gap: 12 },
  payBtn: {
    flex: 1, backgroundColor: Colors.background, borderRadius: 12, padding: 14,
    alignItems: "center", borderWidth: 1.5, borderColor: Colors.border, gap: 6,
  },
  payBtnLabel: { fontSize: 15, fontWeight: "bold", color: Colors.textSecondary },
  payBtnHint: { fontSize: 10, color: Colors.textMuted },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: 8, fontWeight: "600" },
  input: {
    backgroundColor: Colors.background, borderRadius: 10, padding: 12,
    color: Colors.text, fontSize: 15, borderWidth: 1, borderColor: Colors.border,
  },
  infoBox: {
    flexDirection: "row-reverse", gap: 6, alignItems: "flex-start",
    backgroundColor: Colors.warning + "12", borderRadius: 10, padding: 10, marginTop: 10,
  },
  infoText: { flex: 1, fontSize: 12, color: Colors.textSecondary, textAlign: "right", lineHeight: 18 },
  summaryCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
    alignItems: "center", borderWidth: 1.5, marginBottom: 16,
  },
  summaryLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  summaryAmount: { fontSize: 28, fontWeight: "800" },
  summaryMethod: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  submitBtn: {
    backgroundColor: Colors.error, borderRadius: 14, paddingVertical: 16,
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8,
  },
  submitBtnText: { fontSize: 17, fontWeight: "bold", color: "#FFF" },

  /* ─── Success ─── */
  successIcon: { marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: "bold", color: Colors.text, marginBottom: 8 },
  successDesc: { fontSize: 15, color: Colors.textSecondary, marginBottom: 4, textAlign: "center" },
  successAmount: { fontSize: 34, fontWeight: "800", marginBottom: 14 },
  badge: {
    flexDirection: "row-reverse", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginBottom: 30,
  },
  badgeText: { fontSize: 13, fontWeight: "600" },
  successActions: { width: "100%", gap: 12, paddingHorizontal: 20 },
  primaryBtn: { backgroundColor: Colors.error, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  secondaryBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  secondaryBtnText: { color: Colors.text, fontSize: 15, fontWeight: "600" },
});
