import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, Alert, ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, formatCurrency, formatDate, DENOMINATIONS, CARD_PRICES } from "@/utils/api";

type CustodyType = "cash" | "cards";

export default function CustodyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<"send" | "history">("send");
  const [custodyType, setCustodyType] = useState<CustodyType>("cash");

  // Cash send
  const [cashAmount, setCashAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [notes, setNotes] = useState("");

  // Cards send
  const [denomination, setDenomination] = useState(500);
  const [quantity, setQuantity] = useState("1");

  // History
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const totalCardsValue = (CARD_PRICES[denomination] ?? denomination) * (parseInt(quantity) || 0);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet("/custody", token);
      setHistory(data);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleSend = async () => {
    const value = custodyType === "cash"
      ? parseFloat(cashAmount)
      : totalCardsValue;

    if (!value || value <= 0) { Alert.alert("خطأ", "أدخل قيمة صحيحة"); return; }
    if (!recipient) { Alert.alert("خطأ", "أدخل اسم المستلم"); return; }

    setSubmitting(true);
    try {
      await apiPost("/custody", token, {
        type: custodyType,
        amount: value,
        personName: recipient,
        denomination: custodyType === "cards" ? denomination : undefined,
        quantity: custodyType === "cards" ? parseInt(quantity) : undefined,
        notes,
      });
      setCashAmount(""); setRecipient(""); setNotes(""); setQuantity("1");
      await fetchHistory();
      setActiveTab("history");
      Alert.alert("تم", "تم تسجيل العهدة بنجاح");
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إدارة العهدة</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === "history" && styles.tabActive]} onPress={() => setActiveTab("history")}>
          <Text style={[styles.tabText, activeTab === "history" && styles.tabTextActive]}>السجل</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === "send" && styles.tabActive]} onPress={() => setActiveTab("send")}>
          <Text style={[styles.tabText, activeTab === "send" && styles.tabTextActive]}>إرسال عهدة</Text>
        </TouchableOpacity>
      </View>

      {activeTab === "send" ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* نوع العهدة */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>نوع العهدة</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, custodyType === "cash" && styles.typeBtnActive]}
                onPress={() => setCustodyType("cash")}
              >
                <Ionicons name="cash-outline" size={22} color={custodyType === "cash" ? "#FFF" : Colors.textSecondary} />
                <Text style={[styles.typeBtnText, custodyType === "cash" && { color: "#FFF" }]}>نقدية</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, custodyType === "cards" && styles.typeBtnActive]}
                onPress={() => setCustodyType("cards")}
              >
                <Ionicons name="card-outline" size={22} color={custodyType === "cards" ? "#FFF" : Colors.textSecondary} />
                <Text style={[styles.typeBtnText, custodyType === "cards" && { color: "#FFF" }]}>كروت</Text>
              </TouchableOpacity>
            </View>
          </View>

          {custodyType === "cash" && (
            <View style={styles.card}>
              <Text style={styles.label}>المبلغ النقدي (ر.س)</Text>
              <TextInput
                style={styles.input} value={cashAmount}
                onChangeText={setCashAmount} keyboardType="numeric"
                textAlign="right" placeholder="0.00" placeholderTextColor={Colors.textMuted}
              />
            </View>
          )}

          {custodyType === "cards" && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>الفئة (ريال)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.denomRow}>
                {DENOMINATIONS.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.denomChip, denomination === d && styles.denomChipActive]}
                    onPress={() => setDenomination(d)}
                  >
                    <Text style={[styles.denomText, denomination === d && { color: "#FFF" }]}>{d}</Text>
                    <Text style={[styles.denomPrice, denomination === d && { color: "#FFF99" }]}>
                      {CARD_PRICES[d] ?? d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={[styles.label, { marginTop: 16 }]}>الكمية</Text>
              <TextInput
                style={styles.input} value={quantity}
                onChangeText={v => setQuantity(v.replace(/[^0-9]/g, ""))}
                keyboardType="numeric" textAlign="right" placeholder="1"
                placeholderTextColor={Colors.textMuted}
              />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>القيمة الإجمالية:</Text>
                <Text style={styles.totalValue}>{formatCurrency(totalCardsValue)}</Text>
              </View>
            </View>
          )}

          {/* المستلم والملاحظات */}
          <View style={styles.card}>
            <Text style={styles.label}>اسم المستلم</Text>
            <TextInput
              style={styles.input} value={recipient}
              onChangeText={setRecipient} textAlign="right"
              placeholder="أدخل اسم المستلم" placeholderTextColor={Colors.textMuted}
            />
            <Text style={[styles.label, { marginTop: 12 }]}>ملاحظات</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: "top" }]}
              value={notes} onChangeText={setNotes}
              textAlign="right" multiline
              placeholder="اختياري..." placeholderTextColor={Colors.textMuted}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSend} disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.submitBtnText}>تسجيل العهدة</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHistory(); }} />}
        >
          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
          ) : history.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="briefcase-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>لا توجد سجلات عهدة</Text>
            </View>
          ) : (
            history.map(item => (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyName}>{item.personName}</Text>
                  <Text style={[styles.historyAmount, { color: Colors.warning }]}>
                    {formatCurrency(parseFloat(item.amount))}
                  </Text>
                </View>
                <View style={styles.historyFooter}>
                  <Text style={styles.historyDate}>{formatDate(item.createdAt)}</Text>
                  <View style={[styles.typePill, { backgroundColor: item.type === "cash" ? Colors.success + "22" : Colors.info + "22" }]}>
                    <Text style={[styles.typePillText, { color: item.type === "cash" ? Colors.success : Colors.info }]}>
                      {item.type === "cash" ? "نقدية" : `كروت ${item.denomination ?? ""}`}
                    </Text>
                  </View>
                </View>
                {item.notes && <Text style={styles.historyNotes}>{item.notes}</Text>}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  backButton: { padding: 4 },
  tabs: { flexDirection: "row-reverse", padding: 16, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  tabTextActive: { color: "#FFF" },
  content: { padding: 16, paddingTop: 4 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text, marginBottom: 14, textAlign: "right" },
  typeRow: { flexDirection: "row-reverse", gap: 12 },
  typeBtn: { flex: 1, alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, gap: 8 },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  label: { fontSize: 14, color: Colors.textSecondary, textAlign: "right", marginBottom: 8 },
  input: { backgroundColor: Colors.background, borderRadius: 12, padding: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.border, fontSize: 16 },
  denomRow: { flexDirection: "row-reverse", gap: 8, paddingBottom: 4 },
  denomChip: { alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  denomChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  denomText: { fontSize: 14, fontWeight: "bold", color: Colors.text },
  denomPrice: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  totalRow: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  totalLabel: { fontSize: 14, color: Colors.textSecondary },
  totalValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.warning },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  submitBtnText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF" },
  emptyContainer: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
  historyCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  historyHeader: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 8 },
  historyName: { fontSize: 14, fontWeight: "bold", color: Colors.text },
  historyAmount: { fontSize: 15, fontFamily: "Inter_700Bold" },
  historyFooter: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  historyDate: { fontSize: 11, color: Colors.textMuted },
  typePill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  typePillText: { fontSize: 11, fontWeight: "600" },
  historyNotes: { fontSize: 12, color: Colors.textMuted, marginTop: 6, textAlign: "right" },
});
