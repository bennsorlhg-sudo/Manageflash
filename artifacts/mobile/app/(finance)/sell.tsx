import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiPost, DENOMINATIONS, CARD_PRICES, formatCurrency } from "@/utils/api";

export default function SellScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [sellType, setSellType] = useState<"cards" | "broadband">("cards");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "loan">("cash");
  const [denomination, setDenomination] = useState<number>(500);
  const [quantity, setQuantity] = useState("1");
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);

  const unitPrice = CARD_PRICES[denomination] ?? denomination;
  const totalAmount = unitPrice * (parseInt(quantity) || 0);

  const handleSubmit = async () => {
    if (!customerName || !quantity || parseInt(quantity) < 1) {
      Alert.alert("خطأ", "يرجى إدخال اسم المستلم والكمية");
      return;
    }
    setLoading(true);
    try {
      const result = await apiPost("/transactions/sell", token, {
        cardType: sellType, denomination, quantity: parseInt(quantity),
        paymentType: paymentMethod, customerName,
      });
      setLastSale(result);
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "فشل البيع");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={80} color={Colors.success} />
        </View>
        <Text style={styles.successTitle}>تمت عملية البيع بنجاح</Text>
        <Text style={styles.successSub}>
          {sellType === "cards" ? "كروت هوت سبوت" : "باقات برودباند"} — {customerName}
        </Text>
        <Text style={styles.successAmount}>{formatCurrency(lastSale?.totalAmount ?? totalAmount)}</Text>
        <Text style={styles.successDetail}>
          {quantity} × {denomination} ريال @ {formatCurrency(unitPrice)} / الكرت
        </Text>
        <View style={[styles.badge, { backgroundColor: paymentMethod === "cash" ? Colors.success + "22" : Colors.info + "22" }]}>
          <Text style={[styles.badgeText, { color: paymentMethod === "cash" ? Colors.success : Colors.info }]}>
            {paymentMethod === "cash" ? "نقدي — أُضيف للصندوق" : "سلفة — سُجل كمديونية"}
          </Text>
        </View>
        <View style={styles.successActions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => { setSubmitted(false); setCustomerName(""); setQuantity("1"); }}>
            <Text style={styles.primaryBtnText}>بيع جديد</Text>
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
        <Text style={styles.headerTitle}>بيع</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* نوع البيع */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>نوع البيع</Text>
          <View style={styles.segmentedControl}>
            {(["cards", "broadband"] as const).map(t => (
              <TouchableOpacity key={t} style={[styles.segment, sellType === t && styles.segmentActive]} onPress={() => setSellType(t)}>
                <Ionicons name={t === "cards" ? "card-outline" : "wifi-outline"} size={20} color={sellType === t ? "#FFF" : Colors.textSecondary} />
                <Text style={[styles.segmentText, sellType === t && styles.segmentTextActive]}>
                  {t === "cards" ? "كروت" : "برودباند"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* الفئة */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>الفئة (ريال)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.denomRow}>
            {DENOMINATIONS.map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.denomChip, denomination === d && styles.denomChipActive]}
                onPress={() => setDenomination(d)}
              >
                <Text style={[styles.denomChipText, denomination === d && styles.denomChipTextActive]}>{d}</Text>
                <Text style={[styles.denomPrice, denomination === d && { color: "#FFF" }]}>
                  {CARD_PRICES[d] ?? d}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.priceInfo}>
            <Text style={styles.priceLabel}>السعر الفعلي للكرت:</Text>
            <Text style={styles.priceValue}>{formatCurrency(unitPrice)}</Text>
          </View>
        </View>

        {/* طريقة الدفع */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>طريقة الدفع</Text>
          <View style={styles.paymentRow}>
            {(["cash", "loan"] as const).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.paymentBtn, paymentMethod === m && styles.paymentBtnActive, { borderColor: m === "cash" ? Colors.success : Colors.info }]}
                onPress={() => setPaymentMethod(m)}
              >
                <Ionicons name={m === "cash" ? "cash-outline" : "trending-up-outline"} size={24} color={paymentMethod === m ? (m === "cash" ? Colors.success : Colors.info) : Colors.textSecondary} />
                <Text style={[styles.paymentBtnText, paymentMethod === m && { color: m === "cash" ? Colors.success : Colors.info }]}>
                  {m === "cash" ? "نقدي" : "سلفة"}
                </Text>
                {paymentMethod === m && <Text style={styles.paymentHint}>{m === "cash" ? "يُضاف للصندوق" : "يُسجل كمديونية"}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* البيانات */}
        <View style={styles.card}>
          <Text style={styles.label}>اسم المستلم / المشترك</Text>
          <TextInput
            style={styles.input} placeholder="أدخل الاسم"
            placeholderTextColor={Colors.textMuted} value={customerName}
            onChangeText={setCustomerName} textAlign="right"
          />
          <Text style={[styles.label, { marginTop: 16 }]}>الكمية</Text>
          <TextInput
            style={styles.input} placeholder="1"
            placeholderTextColor={Colors.textMuted} value={quantity}
            onChangeText={v => setQuantity(v.replace(/[^0-9]/g, ""))}
            keyboardType="numeric" textAlign="right"
          />
        </View>

        {/* ملخص */}
        {parseInt(quantity) > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>الإجمالي</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalAmount)}</Text>
            <Text style={styles.summaryDetail}>{quantity} كرت × {formatCurrency(unitPrice)}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, (loading || !customerName || parseInt(quantity) < 1) && styles.submitBtnDisabled]}
          onPress={handleSubmit} disabled={loading || !customerName || parseInt(quantity) < 1}
        >
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>تأكيد البيع</Text>}
        </TouchableOpacity>
      </ScrollView>
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
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  backButton: { padding: 4 },
  content: { padding: 20 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text, marginBottom: 16, textAlign: "right" },
  segmentedControl: { flexDirection: "row-reverse", backgroundColor: Colors.background, borderRadius: 12, padding: 4 },
  segment: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 10, gap: 8 },
  segmentActive: { backgroundColor: Colors.primary },
  segmentText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  segmentTextActive: { color: "#FFF" },
  denomRow: { flexDirection: "row-reverse", gap: 8, paddingBottom: 8 },
  denomChip: {
    alignItems: "center", paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  denomChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  denomChipText: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  denomChipTextActive: { color: "#FFF" },
  denomPrice: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  priceInfo: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  priceLabel: { fontSize: 14, color: Colors.textSecondary },
  priceValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.primaryLight },
  paymentRow: { flexDirection: "row-reverse", gap: 12 },
  paymentBtn: { flex: 1, backgroundColor: Colors.background, borderRadius: 12, padding: 16, alignItems: "center", borderWidth: 2, borderColor: "transparent" },
  paymentBtnActive: { backgroundColor: Colors.surfaceElevated },
  paymentBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.textSecondary, marginTop: 8 },
  paymentHint: { fontSize: 10, color: Colors.textMuted, marginTop: 4 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginBottom: 8, textAlign: "right" },
  input: {
    backgroundColor: Colors.background, borderRadius: 12, padding: 14,
    color: Colors.text, fontSize: 16, fontFamily: "Inter_500Medium",
    borderWidth: 1, borderColor: Colors.border,
  },
  summaryCard: {
    backgroundColor: Colors.primary + "15", borderRadius: 16, padding: 20,
    alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: Colors.primary + "33",
  },
  summaryLabel: { fontSize: 13, color: Colors.textSecondary },
  summaryValue: { fontSize: 32, fontFamily: "Inter_800ExtraBold", color: Colors.primaryLight, marginVertical: 4 },
  summaryDetail: { fontSize: 12, color: Colors.textMuted },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 10 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF" },
  successIcon: { marginBottom: 24 },
  successTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 8, textAlign: "center" },
  successSub: { fontSize: 16, color: Colors.textSecondary, marginBottom: 4, textAlign: "center" },
  successAmount: { fontSize: 32, fontFamily: "Inter_800ExtraBold", color: Colors.primaryLight, marginBottom: 4 },
  successDetail: { fontSize: 13, color: Colors.textMuted, marginBottom: 16 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 32 },
  badgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  successActions: { width: "100%", gap: 12 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  secondaryBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  secondaryBtnText: { color: Colors.text, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  surfaceElevated: { backgroundColor: Colors.surfaceElevated },
});
