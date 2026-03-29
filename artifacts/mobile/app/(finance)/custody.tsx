import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator, RefreshControl, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, formatCurrency, formatDate } from "@/utils/api";

type CustodyType = "cash" | "cards";

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

export default function CustodyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<"send" | "history">("send");
  const [custodyType, setCustodyType] = useState<CustodyType>("cash");

  // مشترك بين النوعين
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [notes, setNotes] = useState("");

  // History
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Summary
  const [summary, setSummary] = useState({ total: 0, cardsTotal: 0, cashTotal: 0 });

  // Alert
  const [alertVis, setAlertVis] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMsg, setAlertMsg] = useState("");
  const showAlert = (t: string, m = "") => { setAlertTitle(t); setAlertMsg(m); setAlertVis(true); };

  const parsedAmount = parseFloat(amount.replace(/[^0-9.]/g, "")) || 0;
  const isValid = parsedAmount > 0 && recipient.trim().length > 0;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const [data, sum] = await Promise.all([
        apiGet("/custody", token),
        apiGet("/custody/summary", token),
      ]);
      setHistory(data);
      setSummary(sum);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleSend = async () => {
    if (!isValid) { showAlert("خطأ", "أدخل المبلغ واسم المستلم"); return; }
    setSubmitting(true);
    try {
      await apiPost("/custody", token, {
        type: custodyType,
        amount: parsedAmount,
        personName: recipient.trim(),
        notes: notes.trim() || undefined,
      });
      setAmount(""); setRecipient(""); setNotes("");
      await fetchHistory();
      setActiveTab("history");
      showAlert("تم ✓", "تم تسجيل العهدة بنجاح");
    } catch (e: any) {
      showAlert("خطأ", e.message ?? "فشل تسجيل العهدة");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إدارة العهدة</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "history" && styles.tabActive]}
          onPress={() => setActiveTab("history")}
        >
          <Text style={[styles.tabText, activeTab === "history" && styles.tabTextActive]}>السجل</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "send" && styles.tabActive]}
          onPress={() => setActiveTab("send")}
        >
          <Text style={[styles.tabText, activeTab === "send" && styles.tabTextActive]}>إرسال عهدة</Text>
        </TouchableOpacity>
      </View>

      {activeTab === "send" ? (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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

          {/* المبلغ */}
          <View style={styles.card}>
            <Text style={styles.label}>
              {custodyType === "cash" ? "المبلغ النقدي (ر.س)" : "قيمة الكروت (ر.س)"}
            </Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={v => setAmount(v.replace(/[^0-9.]/g, ""))}
              keyboardType="decimal-pad"
              textAlign="right"
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
            />
            {custodyType === "cash" && parsedAmount > 0 && (
              <Text style={styles.hint}>سيُضاف للصندوق النقدي تلقائياً</Text>
            )}
            {custodyType === "cards" && parsedAmount > 0 && (
              <Text style={[styles.hint, { color: Colors.info }]}>سيُضاف لمخزون الكروت</Text>
            )}
          </View>

          {/* المستلم والملاحظات */}
          <View style={styles.card}>
            <Text style={styles.label}>اسم المستلم</Text>
            <TextInput
              style={styles.input}
              value={recipient}
              onChangeText={setRecipient}
              textAlign="right"
              placeholder="أدخل اسم المستلم"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={[styles.label, { marginTop: 14 }]}>ملاحظات (اختياري)</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: "top" }]}
              value={notes}
              onChangeText={setNotes}
              textAlign="right"
              multiline
              placeholder="اختياري..."
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, (!isValid || submitting) && styles.submitBtnDisabled]}
            onPress={handleSend}
            disabled={!isValid || submitting}
          >
            {submitting
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.submitBtnText}>تسجيل العهدة</Text>}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHistory(); }} />}
        >
          {/* ملخص */}
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { borderColor: Colors.primary + "40" }]}>
              <Text style={styles.summaryLabel}>الإجمالي</Text>
              <Text style={[styles.summaryValue, { color: Colors.primary }]}>{formatCurrency(summary.total)}</Text>
            </View>
            <View style={[styles.summaryCard, { borderColor: Colors.info + "40" }]}>
              <Text style={styles.summaryLabel}>الكروت</Text>
              <Text style={[styles.summaryValue, { color: Colors.info }]}>{formatCurrency(summary.cardsTotal)}</Text>
            </View>
            <View style={[styles.summaryCard, { borderColor: Colors.success + "40" }]}>
              <Text style={styles.summaryLabel}>النقد</Text>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>{formatCurrency(summary.cashTotal)}</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
          ) : history.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="briefcase-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>لا توجد سجلات عهدة</Text>
            </View>
          ) : (
            history.map(item => (
              <View key={item.id} style={[styles.historyCard, { borderLeftWidth: 3, borderLeftColor: item.type === "cash" ? Colors.success : Colors.info }]}>
                <View style={styles.historyHeader}>
                  <Text style={[styles.historyAmount, { color: item.type === "cash" ? Colors.success : Colors.info }]}>
                    {formatCurrency(parseFloat(item.amount))}
                  </Text>
                  <Text style={styles.historyName}>{item.toPersonName ?? "—"}</Text>
                </View>
                <View style={styles.historyFooter}>
                  <View style={[styles.typePill, { backgroundColor: item.type === "cash" ? Colors.success + "20" : Colors.info + "20" }]}>
                    <Text style={[styles.typePillText, { color: item.type === "cash" ? Colors.success : Colors.info }]}>
                      {item.type === "cash" ? "نقدي" : "كروت"}
                    </Text>
                  </View>
                  <Text style={styles.historyDate}>{formatDate(item.createdAt)}</Text>
                </View>
                {item.notes && <Text style={styles.historyNotes}>{item.notes}</Text>}
              </View>
            ))
          )}
        </ScrollView>
      )}

      <AlertModal title={alertTitle} msg={alertMsg} visible={alertVis} onClose={() => setAlertVis(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  backButton: { padding: 4 },

  tabs: { flexDirection: "row-reverse", padding: 14, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },
  tabTextActive: { color: "#FFF" },

  content: { padding: 16, paddingTop: 4 },

  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { fontSize: 15, fontWeight: "600", color: Colors.text, marginBottom: 14, textAlign: "right" },

  typeRow: { flexDirection: "row-reverse", gap: 12 },
  typeBtn: { flex: 1, alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, gap: 8 },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeBtnText: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },

  label: { fontSize: 14, color: Colors.textSecondary, textAlign: "right", marginBottom: 8 },
  input: {
    backgroundColor: Colors.background, borderRadius: 12, padding: 14,
    color: Colors.text, borderWidth: 1, borderColor: Colors.border, fontSize: 16,
  },
  amountInput: {
    backgroundColor: Colors.background, borderRadius: 12, padding: 16,
    color: Colors.text, borderWidth: 1, borderColor: Colors.border,
    fontSize: 28, fontWeight: "bold", textAlign: "right",
  },
  hint: { fontSize: 12, color: Colors.textMuted, textAlign: "right", marginTop: 6 },

  submitBtn: { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontSize: 18, fontWeight: "bold", color: "#FFF" },

  summaryRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1 },
  summaryLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 4 },
  summaryValue: { fontSize: 14, fontWeight: "bold" },

  emptyContainer: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },

  historyCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  historyHeader: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 8 },
  historyName: { fontSize: 14, fontWeight: "bold", color: Colors.text },
  historyAmount: { fontSize: 16, fontWeight: "bold" },
  historyFooter: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  historyDate: { fontSize: 11, color: Colors.textMuted },
  typePill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  typePillText: { fontSize: 11, fontWeight: "600" },
  historyNotes: { fontSize: 12, color: Colors.textMuted, marginTop: 6, textAlign: "right" },

  alertOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 30 },
  alertBox: { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border },
  alertTitle: { color: Colors.text, fontSize: 17, fontWeight: "bold", textAlign: "right", marginBottom: 8 },
  alertMsg: { color: Colors.textSecondary, fontSize: 14, textAlign: "right", marginBottom: 16 },
  alertBtn: { backgroundColor: Colors.primary, borderRadius: 10, padding: 12, alignItems: "center" },
  alertBtnText: { color: "#FFF", fontWeight: "bold" },
});
