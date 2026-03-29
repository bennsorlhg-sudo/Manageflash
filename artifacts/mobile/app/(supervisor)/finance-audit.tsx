import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Platform, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, formatCurrency } from "@/utils/api";

export default function FinanceAuditScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [systemValues, setSystemValues] = useState({ cash: 0, cards: 0, total: 0 });
  const [actualCash, setActualCash] = useState("");
  const [actualCards, setActualCards] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState({ visible: false, title: "", message: "", color: Colors.success, goBack: false });
  const showModal = (title: string, message: string, color = Colors.error, goBack = false) =>
    setModal({ visible: true, title, message, color, goBack });

  const fetchSystemData = useCallback(async () => {
    try {
      const [cashBox, summary] = await Promise.all([
        apiGet("/cash-box", token),
        apiGet("/dashboard/summary", token).catch(() => ({ totalCardsValue: 0 })),
      ]);
      const cash = cashBox.balance ?? 0;
      const cards = summary.totalCardsValue ?? 0;
      setSystemValues({ cash, cards, total: cash + cards });
    } catch {} finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchSystemData(); }, [fetchSystemData]);

  const actualCashNum = parseFloat(actualCash) || 0;
  const actualCardsNum = parseFloat(actualCards) || 0;
  const actualTotal = actualCashNum + actualCardsNum;

  const cashDiff = actualCashNum - systemValues.cash;
  const cardsDiff = actualCardsNum - systemValues.cards;
  const totalDiff = actualTotal - systemValues.total;

  const diffColor = (diff: number) =>
    diff === 0 ? Colors.success : diff > 0 ? Colors.warning : Colors.error;

  const diffLabel = (diff: number) =>
    diff === 0 ? "متطابق" : diff > 0 ? `زيادة ${formatCurrency(Math.abs(diff))}` : `نقص ${formatCurrency(Math.abs(diff))}`;

  const handleSubmit = async () => {
    if (!actualCash && !actualCards) {
      showModal("خطأ", "أدخل القيم الفعلية للنقد أو الكروت على الأقل");
      return;
    }
    setSubmitting(true);
    try {
      showModal("تم حفظ الجرد", `الفرق الإجمالي: ${diffLabel(totalDiff)}`, Colors.success, true);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.roles.supervisor} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>جرد المالي</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* القيم المرجعية */}
        <Text style={styles.sectionTitle}>القيم في النظام</Text>
        <View style={styles.refGrid}>
          <View style={styles.refCard}>
            <Text style={styles.refLabel}>النقد</Text>
            <Text style={[styles.refValue, { color: Colors.success }]}>{formatCurrency(systemValues.cash)}</Text>
          </View>
          <View style={styles.refCard}>
            <Text style={styles.refLabel}>الكروت</Text>
            <Text style={[styles.refValue, { color: Colors.info }]}>{formatCurrency(systemValues.cards)}</Text>
          </View>
          <View style={[styles.refCard, { width: "100%" }]}>
            <Text style={styles.refLabel}>الإجمالي</Text>
            <Text style={[styles.refValue, { color: Colors.warning }]}>{formatCurrency(systemValues.total)}</Text>
          </View>
        </View>

        {/* الإدخال الفعلي */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>القيم الفعلية (من العد)</Text>
        <View style={styles.card}>
          <Text style={styles.label}>النقد الفعلي (ر.س)</Text>
          <TextInput
            style={styles.input} value={actualCash} onChangeText={setActualCash}
            keyboardType="numeric" textAlign="right" placeholder="0.00"
            placeholderTextColor={Colors.textMuted}
          />
          {actualCash !== "" && (
            <Text style={[styles.diffText, { color: diffColor(cashDiff) }]}>
              {diffLabel(cashDiff)}
            </Text>
          )}

          <Text style={[styles.label, { marginTop: 16 }]}>قيمة الكروت الفعلية (ر.س)</Text>
          <TextInput
            style={styles.input} value={actualCards} onChangeText={setActualCards}
            keyboardType="numeric" textAlign="right" placeholder="0.00"
            placeholderTextColor={Colors.textMuted}
          />
          {actualCards !== "" && (
            <Text style={[styles.diffText, { color: diffColor(cardsDiff) }]}>
              {diffLabel(cardsDiff)}
            </Text>
          )}
        </View>

        {/* الملخص */}
        {(actualCash !== "" || actualCards !== "") && (
          <View style={[styles.summaryCard, { borderColor: diffColor(totalDiff) + "55" }]}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>الإجمالي الفعلي</Text>
              <Text style={[styles.summaryValue, { color: Colors.text }]}>{formatCurrency(actualTotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>إجمالي النظام</Text>
              <Text style={[styles.summaryValue, { color: Colors.textSecondary }]}>{formatCurrency(systemValues.total)}</Text>
            </View>
            <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, marginTop: 4 }]}>
              <Text style={styles.summaryLabel}>الفرق</Text>
              <Text style={[styles.summaryValue, { color: diffColor(totalDiff) }]}>{diffLabel(totalDiff)}</Text>
            </View>
          </View>
        )}

        {/* ملاحظات */}
        <View style={styles.card}>
          <Text style={styles.label}>ملاحظات الجرد</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: "top" }]}
            value={notes} onChangeText={setNotes} textAlign="right" multiline
            placeholder="أي ملاحظات حول الجرد..." placeholderTextColor={Colors.textMuted}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit} disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.submitBtnText}>تأكيد الجرد</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={modal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Ionicons name={modal.color === Colors.success ? "checkmark-circle" : "alert-circle"} size={48} color={modal.color} />
            <Text style={styles.modalTitle}>{modal.title}</Text>
            {modal.message ? <Text style={styles.modalMsg}>{modal.message}</Text> : null}
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: modal.color }]}
              onPress={() => { setModal(m => ({ ...m, visible: false })); if (modal.goBack) router.back(); }}
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
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  content: { padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "bold", color: Colors.text, textAlign: "right", marginBottom: 12 },
  refGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 },
  refCard: { flex: 1, minWidth: "45%", backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "flex-end" },
  refLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  refValue: { fontSize: 16, fontWeight: "bold" },
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  label: { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: 8 },
  input: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, color: Colors.text, borderWidth: 1, borderColor: Colors.border, fontSize: 16 },
  diffText: { fontSize: 13, fontWeight: "600", textAlign: "right", marginTop: 6 },
  summaryCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1 },
  summaryRow: { flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 6 },
  summaryLabel: { fontSize: 14, color: Colors.textSecondary },
  summaryValue: { fontSize: 16, fontWeight: "bold" },
  submitBtn: { backgroundColor: Colors.roles.supervisor, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginBottom: 12 },
  submitBtnText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 30 },
  modalBox: { backgroundColor: Colors.surface, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border, width: "100%", alignItems: "center", gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: "bold", color: Colors.text },
  modalMsg: { fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  modalBtn: { borderRadius: 12, paddingHorizontal: 30, paddingVertical: 12, marginTop: 4 },
  modalBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
});
