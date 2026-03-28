import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, formatCurrency } from "@/utils/api";

export default function DisburseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [expenseType, setExpenseType] = useState<"daily" | "monthly" | "purchase">("daily");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "debt">("cash");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => {
    apiGet("/expense-templates", token).then(setTemplates).catch(() => {});
  }, [token]);

  const handleSubmit = async () => {
    if (!amount || !description) return;
    setLoading(true);
    try {
      await apiPost("/transactions/disburse", token, {
        expenseType, paymentType: paymentMethod,
        amount: parseFloat(amount), description,
      });
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "فشل الصرف");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="checkmark-circle" size={80} color={Colors.error} />
        <Text style={styles.successTitle}>تمت عملية الصرف بنجاح</Text>
        <Text style={styles.successSub}>{description}</Text>
        <Text style={styles.successAmount}>{formatCurrency(parseFloat(amount))}</Text>
        <View style={[styles.badge, { backgroundColor: paymentMethod === "cash" ? Colors.error + "22" : Colors.warning + "22" }]}>
          <Text style={[styles.badgeText, { color: paymentMethod === "cash" ? Colors.error : Colors.warning }]}>
            {paymentMethod === "cash" ? "نقدي — خُصم من الصندوق" : "دين — سُجل كدين مستحق"}
          </Text>
        </View>
        <View style={styles.successActions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => { setSubmitted(false); setAmount(""); setDescription(""); }}>
            <Text style={styles.primaryBtnText}>صرف جديد</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>العودة للرئيسية</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>صرف</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* نوع المصروف */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>نوع المصروف</Text>
          <View style={styles.typeGrid}>
            {([["daily", "مصروف يومي"], ["monthly", "التزام شهري"], ["purchase", "مشتريات"]] as [string, string][]).map(([val, label]) => (
              <TouchableOpacity
                key={val} style={[styles.typeBtn, expenseType === val && styles.typeBtnActive]}
                onPress={() => setExpenseType(val as any)}
              >
                <Text style={[styles.typeBtnText, expenseType === val && styles.typeBtnTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* القوالب */}
        {templates.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>قوالب سريعة</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: "row-reverse" }}>
              {templates.map(t => (
                <TouchableOpacity
                  key={t.id} style={styles.templateChip}
                  onPress={() => { setDescription(t.name); if (t.amount) setAmount(String(t.amount)); }}
                >
                  <Text style={styles.templateChipText}>{t.name}</Text>
                  {t.amount && <Text style={styles.templateChipAmount}>{formatCurrency(parseFloat(t.amount))}</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* طريقة الدفع */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>طريقة الدفع</Text>
          <View style={styles.paymentRow}>
            {([["cash", "نقدي", "cash-outline", Colors.error, "يُخصم من الصندوق"], ["debt", "دين", "receipt-outline", Colors.warning, "لا يُخصم حالياً"]] as any[]).map(([val, label, icon, color, hint]) => (
              <TouchableOpacity
                key={val}
                style={[styles.paymentBtn, paymentMethod === val && styles.paymentBtnActive, { borderColor: color }]}
                onPress={() => setPaymentMethod(val)}
              >
                <Ionicons name={icon} size={24} color={paymentMethod === val ? color : Colors.textSecondary} />
                <Text style={[styles.paymentBtnText, paymentMethod === val && { color }]}>{label}</Text>
                {paymentMethod === val && <Text style={styles.paymentHint}>{hint}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* البيانات */}
        <View style={styles.card}>
          <Text style={styles.label}>الوصف / البيان</Text>
          <TextInput
            style={styles.input} placeholder="مثال: فاتورة كهرباء، إيجار..."
            placeholderTextColor={Colors.textMuted} value={description}
            onChangeText={setDescription} textAlign="right"
          />
          <Text style={[styles.label, { marginTop: 16 }]}>المبلغ (ر.س)</Text>
          <TextInput
            style={styles.input} placeholder="0.00"
            placeholderTextColor={Colors.textMuted} value={amount}
            onChangeText={setAmount} keyboardType="numeric" textAlign="right"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (loading || !amount || !description) && styles.submitBtnDisabled]}
          onPress={handleSubmit} disabled={loading || !amount || !description}
        >
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>تأكيد الصرف</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { alignItems: "center", justifyContent: "center", padding: 20 },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  backButton: { padding: 4 },
  content: { padding: 20 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text, marginBottom: 16, textAlign: "right" },
  typeGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  typeBtnTextActive: { color: "#FFF" },
  templateChip: { backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  templateChipText: { fontSize: 13, color: Colors.text },
  templateChipAmount: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  paymentRow: { flexDirection: "row-reverse", gap: 12 },
  paymentBtn: { flex: 1, backgroundColor: Colors.background, borderRadius: 12, padding: 16, alignItems: "center", borderWidth: 2, borderColor: "transparent" },
  paymentBtnActive: { backgroundColor: Colors.surfaceElevated },
  paymentBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.textSecondary, marginTop: 8 },
  paymentHint: { fontSize: 10, color: Colors.textMuted, marginTop: 4 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginBottom: 8, textAlign: "right" },
  input: { backgroundColor: Colors.background, borderRadius: 12, padding: 14, color: Colors.text, fontSize: 16, borderWidth: 1, borderColor: Colors.border },
  submitBtn: { backgroundColor: Colors.error, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 10 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF" },
  successTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 8, textAlign: "center", marginTop: 20 },
  successSub: { fontSize: 16, color: Colors.textSecondary, marginBottom: 4, textAlign: "center" },
  successAmount: { fontSize: 32, fontFamily: "Inter_800ExtraBold", color: Colors.error, marginBottom: 16 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 32 },
  badgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  successActions: { width: "100%", gap: 12 },
  primaryBtn: { backgroundColor: Colors.error, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  secondaryBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  secondaryBtnText: { color: Colors.text, fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
