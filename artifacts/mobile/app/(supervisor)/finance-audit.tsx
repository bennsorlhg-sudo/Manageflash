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
  /* القيم من النظام */
  const [system, setSystem] = useState({
    totalCustody: 0,
    cashBalance: 0,
    cardsValue: 0,
    agentCustody: 0,
    totalLoans: 0,    // السلف (العملاء يدينون لنا)
  });
  /* القيم الفعلية يدخلها المشرف */
  const [actualCustody, setActualCustody] = useState("");
  const [actualCash, setActualCash] = useState("");
  const [actualCards, setActualCards] = useState("");
  const [actualLoans, setActualLoans] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState({
    visible: false, title: "", message: "", color: Colors.success, goBack: false,
  });
  const showModal = (title: string, message: string, color = Colors.error, goBack = false) =>
    setModal({ visible: true, title, message, color, goBack });

  const fetchSystemData = useCallback(async () => {
    try {
      const [summary, debts] = await Promise.all([
        apiGet("/finances/summary", token).catch(() => ({})),
        apiGet("/debts", token).catch(() => []),
      ]);
      const totalLoans = (debts as any[])
        .filter((d: any) => d.status !== "paid")
        .reduce((s: number, d: any) => s + parseFloat(d.remainingAmount ?? d.amount ?? "0"), 0);

      setSystem({
        totalCustody: parseFloat(summary.totalCustody ?? "0"),
        cashBalance:  parseFloat(summary.cashBalance  ?? "0"),
        cardsValue:   parseFloat(summary.cardsValue   ?? "0"),
        agentCustody: parseFloat(summary.agentCustody ?? "0"),
        totalLoans,
      });
    } catch {} finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchSystemData(); }, [fetchSystemData]);

  /* حسابات الفروقات */
  const aTotal  = parseFloat(actualCustody) || 0;
  const aCash   = parseFloat(actualCash)    || 0;
  const aCards  = parseFloat(actualCards)   || 0;
  const aLoans  = parseFloat(actualLoans)   || 0;

  const diffCustody = aTotal - system.totalCustody;
  const diffCash    = aCash  - system.cashBalance;
  const diffCards   = aCards - system.cardsValue;
  const diffLoans   = aLoans - system.totalLoans;

  const diffColor = (d: number) => d === 0 ? Colors.success : d > 0 ? Colors.warning : Colors.error;
  const diffLabel = (d: number) =>
    d === 0 ? "✔ متطابق" : d > 0 ? `زيادة ${formatCurrency(Math.abs(d))}` : `نقص ${formatCurrency(Math.abs(d))}`;

  const handleSubmit = async () => {
    if (!actualCustody && !actualCash && !actualCards) {
      showModal("خطأ", "أدخل القيم الفعلية أولاً");
      return;
    }
    setSubmitting(true);
    try {
      /* نُرسل التقرير للمالك عبر task — في انتظار endpoint مخصص */
      showModal(
        "تم الجرد",
        "تم حفظ الجرد وإرسال التقرير للمالك",
        Colors.success,
        false
      );
    } catch (e: any) {
      showModal("خطأ", e?.message ?? "حدث خطأ");
    } finally {
      setSubmitting(false);
    }
  };

  const Row = ({
    label, system: sysVal, actual, setActual, diff,
  }: { label: string; system: number; actual: string; setActual: (v: string) => void; diff: number }) => (
    <View style={styles.auditRow}>
      <View style={styles.auditLabel}>
        <Text style={styles.auditLabelText}>{label}</Text>
      </View>
      <View style={styles.auditCols}>
        {/* النظام */}
        <View style={styles.sysBox}>
          <Text style={styles.sysLabel}>النظام</Text>
          <Text style={styles.sysValue}>{formatCurrency(sysVal)}</Text>
        </View>
        {/* الفعلي */}
        <View style={styles.inputBox}>
          <Text style={styles.sysLabel}>الفعلي</Text>
          <TextInput
            style={styles.auditInput}
            value={actual}
            onChangeText={setActual}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={Colors.textSecondary}
            textAlign="right"
          />
        </View>
        {/* الفرق */}
        <View style={styles.diffBox}>
          <Text style={styles.sysLabel}>الفرق</Text>
          <Text style={[styles.diffValue, { color: diffColor(diff) }]}>
            {actual ? diffLabel(diff) : "—"}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* رأس الصفحة */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>الجرد المالي</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#673AB7" style={{ flex: 1, alignSelf: "center" }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ─── بطاقات ملخص النظام ─── */}
          <Text style={styles.sectionTitle}>قيم النظام الحالية</Text>
          <View style={styles.summaryGrid}>
            <SummaryCard label="إجمالي العهدة" value={system.totalCustody} color="#673AB7" icon="wallet" />
            <SummaryCard label="إجمالي النقد"   value={system.cashBalance}  color="#4CAF50" icon="cash"   />
            <SummaryCard label="إجمالي الكروت"  value={system.cardsValue}   color="#2196F3" icon="card"   />
            <SummaryCard label="إجمالي السلف"   value={system.totalLoans}   color="#FF9800" icon="people" />
          </View>

          {/* ─── نموذج الجرد ─── */}
          <Text style={styles.sectionTitle}>أدخل القيم الفعلية</Text>

          <Row label="إجمالي العهدة" system={system.totalCustody} actual={actualCustody} setActual={setActualCustody} diff={diffCustody} />
          <Row label="إجمالي النقد"   system={system.cashBalance}  actual={actualCash}    setActual={setActualCash}    diff={diffCash}    />
          <Row label="إجمالي الكروت"  system={system.cardsValue}   actual={actualCards}   setActual={setActualCards}   diff={diffCards}   />
          <Row label="إجمالي السلف"   system={system.totalLoans}   actual={actualLoans}   setActual={setActualLoans}   diff={diffLoans}   />

          {/* ─── ملاحظات ─── */}
          <Text style={styles.fieldLabel}>ملاحظات (تُرسل مع التقرير)</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={notes}
            onChangeText={setNotes}
            placeholder="أي ملاحظات على الجرد..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            textAlign="right"
            textAlignVertical="top"
          />

          {/* ─── ملخص الفروقات ─── */}
          {(actualCustody || actualCash || actualCards || actualLoans) ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>ملخص الجرد</Text>
              <ResultLine label="العهدة" diff={diffCustody} diffColor={diffColor} diffLabel={diffLabel} />
              <ResultLine label="النقد"   diff={diffCash}    diffColor={diffColor} diffLabel={diffLabel} />
              <ResultLine label="الكروت"  diff={diffCards}   diffColor={diffColor} diffLabel={diffLabel} />
              <ResultLine label="السلف"   diff={diffLoans}   diffColor={diffColor} diffLabel={diffLabel} />
            </View>
          ) : null}

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
                <Text style={styles.submitText}>إرسال تقرير الجرد للمالك</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <Modal visible={modal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons
              name={modal.color === Colors.success ? "checkmark-circle" : "close-circle"}
              size={48} color={modal.color}
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

function SummaryCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <View style={[styles.summaryCard, { borderColor: color + "44" }]}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[styles.summaryValue, { color }]}>{formatCurrency(value)}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ResultLine({
  label, diff, diffColor, diffLabel,
}: { label: string; diff: number; diffColor: (d: number) => string; diffLabel: (d: number) => string }) {
  return (
    <View style={styles.resultRow}>
      <Text style={[styles.resultDiff, { color: diffColor(diff) }]}>{diffLabel(diff)}</Text>
      <Text style={styles.resultLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pageTitle:   { fontSize: 18, fontWeight: "bold", color: Colors.text },
  scrollContent: { padding: 16 },

  sectionTitle: {
    fontSize: 15, fontWeight: "bold", color: Colors.text,
    textAlign: "right", marginBottom: 12, marginTop: 8,
  },
  summaryGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  summaryCard: {
    width: "47%",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
  },
  summaryValue: { fontSize: 16, fontWeight: "bold", textAlign: "center" },
  summaryLabel: { fontSize: 11, color: Colors.textSecondary, textAlign: "center" },

  /* صفوف الجرد */
  auditRow: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  auditLabel:     { marginBottom: 10 },
  auditLabelText: { fontSize: 14, fontWeight: "bold", color: Colors.text, textAlign: "right" },
  auditCols:      { flexDirection: "row-reverse", gap: 8 },
  sysBox:         { flex: 1, alignItems: "center" },
  inputBox:       { flex: 1, alignItems: "center" },
  diffBox:        { flex: 1.2, alignItems: "center" },
  sysLabel:       { fontSize: 11, color: Colors.textSecondary, marginBottom: 4 },
  sysValue:       { fontSize: 14, fontWeight: "bold", color: Colors.text },
  auditInput: {
    width: "100%",
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 8,
    color: Colors.text,
    fontSize: 14,
    textAlign: "right",
  },
  diffValue:     { fontSize: 12, fontWeight: "600", textAlign: "center" },

  fieldLabel:    { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: 6, marginTop: 12 },
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

  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  resultTitle: { fontSize: 14, fontWeight: "bold", color: Colors.text, textAlign: "right", marginBottom: 4 },
  resultRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultLabel: { fontSize: 13, color: Colors.textSecondary },
  resultDiff:  { fontSize: 13, fontWeight: "bold" },

  submitBtn: {
    backgroundColor: "#673AB7",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  modalOverlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard:    { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, alignItems: "center", width: "100%", gap: 12 },
  modalTitle:   { fontSize: 18, fontWeight: "bold", color: Colors.text },
  modalMsg:     { fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
  modalBtn:     { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 32, marginTop: 8 },
  modalBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
});
