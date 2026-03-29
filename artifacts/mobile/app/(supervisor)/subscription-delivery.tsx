import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, formatCurrency, formatDate } from "@/utils/api";

type Tab = "new" | "history";

export default function SubscriptionDeliveryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("new");
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const [modal, setModal] = useState({ visible: false, title: "", message: "", color: Colors.success, goBack: false });
  const showModal = (title: string, message: string, color = Colors.error, goBack = false) =>
    setModal({ visible: true, title, message, color, goBack });

  const fetchHistory = useCallback(async () => {
    try {
      const data = await apiGet("/subscription-deliveries", token);
      setHistory((data as any[]).filter((d: any) => d.cardType === "cash_delivery"));
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const totalDelivered = history.reduce((s, d) => s + parseFloat(d.totalValue ?? "0"), 0);

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      showModal("خطأ", "أدخل مبلغاً صحيحاً أكبر من الصفر");
      return;
    }

    setSubmitting(true);
    try {
      await apiPost("/subscription-deliveries/to-finance", token, {
        amount: parsedAmount,
        notes: notes.trim() || null,
      });
      setAmount("");
      setNotes("");
      showModal("تم التسليم", `تم تسليم ${formatCurrency(parsedAmount)} للمسؤول المالي بنجاح`, Colors.success, false);
      fetchHistory();
    } catch (e: any) {
      showModal("خطأ", e?.message ?? "حدث خطأ أثناء التسليم");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* ── رأس الصفحة ── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>تسليم قيمة الاشتراكات</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ── ملخص الإجمالي ── */}
      <View style={styles.summaryCard}>
        <Ionicons name="cash" size={28} color="#00BCD4" />
        <View style={{ alignItems: "flex-end", flex: 1, marginRight: 12 }}>
          <Text style={styles.summaryLabel}>إجمالي ما تم تسليمه</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalDelivered)}</Text>
        </View>
      </View>

      {/* ── تبويب ── */}
      <View style={styles.tabRow}>
        {(["new", "history"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === "new" ? "تسليم جديد" : "السجل"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          activeTab === "history"
            ? <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHistory(); }} />
            : undefined
        }
      >
        {activeTab === "new" ? (
          /* ───── نموذج التسليم ───── */
          <View>
            <Text style={styles.formNote}>
              أدخل المبلغ النقدي الذي جمعته من الاشتراكات (هوتسبوت / برودباند)
              وستسلّمه الآن للمسؤول المالي.
            </Text>

            <Text style={styles.fieldLabel}>المبلغ (ريال)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="decimal-pad"
              textAlign="right"
            />

            <Text style={styles.fieldLabel}>ملاحظات (اختياري)</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={notes}
              onChangeText={setNotes}
              placeholder="مثال: اشتراكات يناير..."
              placeholderTextColor={Colors.textSecondary}
              multiline
              textAlign="right"
              textAlignVertical="top"
            />

            {/* معاينة */}
            {!!parseFloat(amount) && (
              <View style={styles.previewCard}>
                <View style={styles.previewRow}>
                  <Text style={styles.previewValue}>{formatCurrency(parseFloat(amount) || 0)}</Text>
                  <Text style={styles.previewLabel}>المبلغ المسلَّم</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={[styles.previewValue, { color: Colors.success }]}>المسؤول المالي</Text>
                  <Text style={styles.previewLabel}>يُضاف إلى</Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={styles.submitText}>تسليم المبلغ</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          /* ───── السجل ───── */
          loading ? (
            <ActivityIndicator size="large" color="#00BCD4" style={{ marginTop: 40 }} />
          ) : history.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="document-text-outline" size={40} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>لا توجد تسليمات سابقة</Text>
            </View>
          ) : (
            history.map((d) => (
              <View key={d.id} style={styles.historyCard}>
                <View style={styles.historyRow}>
                  <Text style={styles.historyAmount}>{formatCurrency(parseFloat(d.totalValue ?? "0"))}</Text>
                  <View>
                    <Text style={styles.historyDate}>{formatDate(d.createdAt)}</Text>
                    <Text style={styles.historyTo}>➜ {d.deliveredToName}</Text>
                  </View>
                </View>
                {!!d.notes && <Text style={styles.historyNotes}>{d.notes}</Text>}
              </View>
            ))
          )
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── مودال ── */}
      <Modal visible={modal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons
              name={modal.color === Colors.success ? "checkmark-circle" : "close-circle"}
              size={48}
              color={modal.color}
            />
            <Text style={styles.modalTitle}>{modal.title}</Text>
            <Text style={styles.modalMsg}>{modal.message}</Text>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: modal.color }]}
              onPress={() => {
                setModal((m) => ({ ...m, visible: false }));
                if (modal.goBack) router.back();
              }}
            >
              <Text style={styles.modalBtnText}>حسناً</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pageTitle: { fontSize: 18, fontWeight: "bold", color: Colors.text },

  summaryCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#00BCD422",
    margin: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#00BCD444",
  },
  summaryLabel: { fontSize: 13, color: Colors.textSecondary, textAlign: "right" },
  summaryValue: { fontSize: 22, fontWeight: "bold", color: "#00BCD4", textAlign: "right" },

  tabRow: { flexDirection: "row-reverse", marginHorizontal: 16, marginBottom: 8 },
  tab: {
    flex: 1, paddingVertical: 10, alignItems: "center",
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabActive:     { borderBottomColor: "#00BCD4" },
  tabText:       { fontSize: 14, color: Colors.textSecondary },
  tabTextActive: { color: "#00BCD4", fontWeight: "bold" },

  scrollContent: { padding: 16 },

  formNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "right",
    marginBottom: 16,
    lineHeight: 20,
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 10,
  },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputMulti: { height: 80 },

  previewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  previewRow:  { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  previewLabel: { fontSize: 13, color: Colors.textSecondary },
  previewValue: { fontSize: 16, fontWeight: "bold", color: Colors.text },

  submitBtn: {
    backgroundColor: "#00BCD4",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  historyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  historyRow:   { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  historyAmount: { fontSize: 18, fontWeight: "bold", color: "#00BCD4" },
  historyDate:  { fontSize: 12, color: Colors.textSecondary, textAlign: "right" },
  historyTo:    { fontSize: 12, color: Colors.success, textAlign: "right" },
  historyNotes: { fontSize: 12, color: Colors.textSecondary, textAlign: "right", marginTop: 6 },

  emptyBox: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },

  modalOverlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard:    { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, alignItems: "center", width: "100%", gap: 12 },
  modalTitle:   { fontSize: 18, fontWeight: "bold", color: Colors.text },
  modalMsg:     { fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
  modalBtn:     { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 32, marginTop: 8 },
  modalBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
});
