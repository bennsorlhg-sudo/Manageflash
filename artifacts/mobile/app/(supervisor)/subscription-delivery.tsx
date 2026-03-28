import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, formatCurrency, formatDate, DENOMINATIONS, CARD_PRICES } from "@/utils/api";

export default function SubscriptionDeliveryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();

  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [cardType, setCardType] = useState<"hotspot" | "broadband">("hotspot");
  const [denomination, setDenomination] = useState(500);
  const [quantity, setQuantity] = useState("1");
  const [recipientName, setRecipientName] = useState("");
  const [notes, setNotes] = useState("");

  const totalValue = (CARD_PRICES[denomination] ?? denomination) * (parseInt(quantity) || 0);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await apiGet("/subscription-deliveries", token);
      setHistory(data);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleSubmit = async () => {
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) { Alert.alert("خطأ", "أدخل كمية صحيحة"); return; }
    if (!recipientName) { Alert.alert("خطأ", "أدخل اسم مستلم الكروت"); return; }

    setSubmitting(true);
    try {
      await apiPost("/subscription-deliveries", token, {
        engineerName: user?.name ?? "المشرف",
        cardType,
        denomination,
        cardCount: qty,
        deliveredToName: recipientName,
        notes,
      });
      setQuantity("1"); setRecipientName(""); setNotes("");
      await fetchHistory();
      setActiveTab("history");
      Alert.alert("تم", `تم تسجيل تسليم ${qty} كرت بقيمة ${formatCurrency(totalValue)}`);
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>تسليم قيمة الاشتراكات</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {[
          { key: "new", label: "تسليم جديد" },
          { key: "history", label: `السجل (${history.length})` },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key as any)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "new" ? (
        <ScrollView contentContainerStyle={styles.content}>
          {/* نوع الكرت */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>نوع الكرت</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, cardType === "hotspot" && styles.typeBtnActive]}
                onPress={() => setCardType("hotspot")}
              >
                <Ionicons name="wifi" size={20} color={cardType === "hotspot" ? "#FFF" : Colors.textSecondary} />
                <Text style={[styles.typeBtnText, cardType === "hotspot" && { color: "#FFF" }]}>هوت سبوت</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, cardType === "broadband" && styles.typeBtnActive]}
                onPress={() => setCardType("broadband")}
              >
                <Ionicons name="globe" size={20} color={cardType === "broadband" ? "#FFF" : Colors.textSecondary} />
                <Text style={[styles.typeBtnText, cardType === "broadband" && { color: "#FFF" }]}>باقات</Text>
              </TouchableOpacity>
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
                  <Text style={[styles.denomText, denomination === d && { color: "#FFF" }]}>{d}</Text>
                  <Text style={[styles.denomPrice, denomination === d && { color: "rgba(255,255,255,0.7)" }]}>
                    {CARD_PRICES[d] ?? d} ر.س
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* الكمية والمستلم */}
          <View style={styles.card}>
            <Text style={styles.label}>الكمية</Text>
            <TextInput
              style={styles.input} value={quantity}
              onChangeText={v => setQuantity(v.replace(/[^0-9]/g, ""))}
              keyboardType="numeric" textAlign="right" placeholder="1"
              placeholderTextColor={Colors.textMuted}
            />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>إجمالي القيمة:</Text>
              <Text style={styles.totalValue}>{formatCurrency(totalValue)}</Text>
            </View>

            <Text style={[styles.label, { marginTop: 16 }]}>تسليم إلى (المسؤول المالي)</Text>
            <TextInput
              style={styles.input} value={recipientName}
              onChangeText={setRecipientName} textAlign="right"
              placeholder="اسم المسؤول المالي" placeholderTextColor={Colors.textMuted}
            />

            <Text style={[styles.label, { marginTop: 12 }]}>ملاحظات</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: "top" }]}
              value={notes} onChangeText={setNotes} textAlign="right" multiline
              placeholder="اختياري..." placeholderTextColor={Colors.textMuted}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit} disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.submitBtnText}>تأكيد التسليم</Text>
            }
          </TouchableOpacity>

          <View style={{ height: 40 }} />
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
              <Ionicons name="receipt-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>لا يوجد سجل تسليم</Text>
            </View>
          ) : (
            history.map(item => (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyEngineer}>{item.engineerName ?? "—"}</Text>
                  <Text style={[styles.historyAmount, { color: Colors.success }]}>
                    {formatCurrency(parseFloat(item.totalValue ?? 0))}
                  </Text>
                </View>
                <View style={styles.historyRow}>
                  <Text style={styles.historyDetail}>
                    {item.cardCount} كرت × {item.denomination} ريال
                  </Text>
                  <Text style={styles.historyType}>
                    {item.cardType === "hotspot" ? "هوت سبوت" : "باقات"}
                  </Text>
                </View>
                {item.deliveredToName && (
                  <Text style={styles.historyDetail}>إلى: {item.deliveredToName}</Text>
                )}
                <Text style={styles.historyDate}>{formatDate(item.createdAt)}</Text>
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
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  tabs: { flexDirection: "row-reverse", padding: 14, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.roles.supervisor, borderColor: Colors.roles.supervisor },
  tabText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  tabTextActive: { color: "#FFF" },
  content: { padding: 14, paddingTop: 4 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { fontSize: 14, fontWeight: "bold", color: Colors.text, textAlign: "right", marginBottom: 12 },
  typeRow: { flexDirection: "row-reverse", gap: 10 },
  typeBtn: { flex: 1, flexDirection: "row-reverse", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  typeBtnActive: { backgroundColor: Colors.roles.supervisor, borderColor: Colors.roles.supervisor },
  typeBtnText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  denomRow: { flexDirection: "row-reverse", gap: 8, paddingBottom: 4 },
  denomChip: { alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  denomChipActive: { backgroundColor: Colors.roles.supervisor, borderColor: Colors.roles.supervisor },
  denomText: { fontSize: 14, fontWeight: "bold", color: Colors.text },
  denomPrice: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  label: { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: 8 },
  input: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  totalRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  totalLabel: { fontSize: 14, color: Colors.textSecondary },
  totalValue: { fontSize: 18, fontWeight: "bold", color: Colors.success },
  submitBtn: { backgroundColor: Colors.roles.supervisor, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  submitBtnText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  emptyContainer: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
  historyCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  historyHeader: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 6 },
  historyEngineer: { fontSize: 14, fontWeight: "bold", color: Colors.text },
  historyAmount: { fontSize: 15, fontWeight: "bold" },
  historyRow: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 4 },
  historyDetail: { fontSize: 12, color: Colors.textSecondary, textAlign: "right" },
  historyType: { fontSize: 11, color: Colors.textMuted },
  historyDate: { fontSize: 11, color: Colors.textMuted, textAlign: "right", marginTop: 6 },
});
