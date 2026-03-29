import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, Modal, ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, formatCurrency } from "@/utils/api";

/* ─── نوع العملية:
 *   "collect" = تحصيل سلفة  (عميل يدفع لنا) → debtsTable (sourceType="debt") → +cashbox
 *   "pay"     = سداد دين     (نحن ندفع لجهة) → loansTable (sourceType="loan") → -cashbox
 */
type Mode = "collect" | "pay";

function AlertModal({ visible, title, message, color, onClose }: {
  visible: boolean; title: string; message: string; color: string; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.alertBox}>
          <View style={[s.alertIconWrap, { backgroundColor: color + "22" }]}>
            <Ionicons
              name={color === Colors.error ? "close-circle" : "checkmark-circle"}
              size={48} color={color}
            />
          </View>
          <Text style={s.alertTitle}>{title}</Text>
          {!!message && <Text style={s.alertMsg}>{message}</Text>}
          <TouchableOpacity style={[s.alertBtn, { backgroundColor: color }]} onPress={onClose}>
            <Text style={s.alertBtnTxt}>حسناً</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function CollectScreen() {
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const { token } = useAuth();

  const [mode,     setMode]     = useState<Mode>("collect");
  const [search,   setSearch]   = useState("");
  const [debts,    setDebts]    = useState<any[]>([]); /* السلف — عملاء يدينون لنا */
  const [loans,    setLoans]    = useState<any[]>([]); /* الديون — نحن ندين لجهات */
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [amtInput, setAmtInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alert,    setAlert]    = useState({ visible: false, title: "", message: "", color: Colors.success });

  const showAlert = (title: string, message: string, color = Colors.success) =>
    setAlert({ visible: true, title, message, color });

  const fetchData = useCallback(async () => {
    try {
      const [d, l] = await Promise.all([apiGet("/debts", token), apiGet("/loans", token)]);
      setDebts(d.filter((x: any) => x.status !== "paid"));
      setLoans(l.filter((x: any) => x.status !== "paid"));
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* قائمة حسب الوضع */
  const rawList = mode === "collect" ? debts : loans;
  const list = rawList
    .map((item: any) => ({
      ...item,
      remaining: Math.max(0, parseFloat(item.amount) - parseFloat(item.paidAmount)),
    }))
    .filter((item: any) => item.remaining > 0.01 && item.personName.includes(search))
    .sort((a: any, b: any) => b.remaining - a.remaining);

  const handleSubmit = async () => {
    const amt = parseFloat(amtInput.replace(/[^0-9.]/g, ""));
    if (!amt || amt <= 0) return showAlert("خطأ", "أدخل مبلغاً صحيحاً", Colors.error);
    if (amt > selected.remaining + 0.01) return showAlert("خطأ", "المبلغ أكبر من المتبقي", Colors.error);

    setSubmitting(true);
    try {
      await apiPost("/transactions/collect", token, {
        sourceType: mode === "collect" ? "debt" : "loan",
        sourceId:   selected.id,
        amount:     amt,
      });
      await fetchData();
      const label = mode === "collect"
        ? `تم تحصيل ${formatCurrency(amt)} من ${selected.personName}\n← يزيد الصندوق النقدي`
        : `تم سداد ${formatCurrency(amt)} لـ ${selected.personName}\n← ينقص من الصندوق النقدي`;
      showAlert(mode === "collect" ? "تم التحصيل ✓" : "تم السداد ✓", label);
      setSelected(null);
      setAmtInput("");
    } catch (e: any) {
      showAlert("خطأ", e?.message ?? "فشلت العملية", Colors.error);
    } finally {
      setSubmitting(false); }
  };

  const modeColor = mode === "collect" ? Colors.success : Colors.error;

  if (loading) {
    return (
      <View style={[s.container, s.center, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>تحصيل</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ── اختيار الوضع ── */}
      <View style={s.modeRow}>
        {([
          { key: "collect", label: "تحصيل سلف",  icon: "arrow-down-circle" as const, color: Colors.success,
            sub: "عملاء يدينون لنا" },
          { key: "pay",     label: "سداد دين",    icon: "arrow-up-circle"   as const, color: Colors.error,
            sub: "نحن ندين لجهات" },
        ] as const).map(m => (
          <TouchableOpacity
            key={m.key}
            style={[s.modeCard, mode === m.key && { borderColor: m.color, backgroundColor: m.color + "12" }]}
            onPress={() => { setMode(m.key); setSearch(""); }}
          >
            <Ionicons name={m.icon} size={28} color={mode === m.key ? m.color : Colors.textMuted} />
            <Text style={[s.modeLabel, mode === m.key && { color: m.color }]}>{m.label}</Text>
            <Text style={s.modeSub}>{m.sub}</Text>
            {mode === m.key && (
              <View style={[s.modeCheck, { backgroundColor: m.color }]}>
                <Ionicons name="checkmark" size={11} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── بحث ── */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput} placeholder="بحث بالاسم..."
          placeholderTextColor={Colors.textMuted} value={search}
          onChangeText={setSearch} textAlign="right"
        />
        <Ionicons name="search" size={18} color={Colors.textMuted} style={{ marginLeft: 8 }} />
      </View>

      {/* ── القائمة ── */}
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
      >
        {list.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={52} color={Colors.textMuted} />
            <Text style={s.emptyTxt}>لا توجد سجلات مفتوحة</Text>
          </View>
        ) : list.map((item: any) => {
          const pct = Math.min((parseFloat(item.paidAmount) / parseFloat(item.amount)) * 100, 100);
          return (
            <View key={item.id} style={s.card}>
              {/* اسم + متبقي */}
              <View style={s.cardTop}>
                <Text style={[s.remaining, { color: modeColor }]}>{formatCurrency(item.remaining)}</Text>
                <Text style={s.personName}>{item.personName}</Text>
              </View>

              {/* شريط التقدم */}
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: modeColor }]} />
              </View>

              {/* إجمالي / مسدد / متبقي */}
              <View style={s.statsRow}>
                <View style={s.stat}>
                  <Text style={s.statVal}>{formatCurrency(parseFloat(item.amount))}</Text>
                  <Text style={s.statKey}>الإجمالي</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.stat}>
                  <Text style={s.statVal}>{formatCurrency(parseFloat(item.paidAmount))}</Text>
                  <Text style={s.statKey}>المسدد</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.stat}>
                  <Text style={[s.statVal, { color: modeColor }]}>{formatCurrency(item.remaining)}</Text>
                  <Text style={s.statKey}>المتبقي</Text>
                </View>
              </View>

              {/* زر الإجراء */}
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: modeColor }]}
                onPress={() => { setSelected(item); setAmtInput(""); }}
              >
                <Ionicons name={mode === "collect" ? "arrow-down" : "arrow-up"} size={16} color="#fff" />
                <Text style={s.actionBtnTxt}>{mode === "collect" ? "تحصيل سلفة" : "سداد دين"}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Modal الإدخال ── */}
      <Modal visible={!!selected} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={[s.modalTitle, { color: modeColor }]}>
              {mode === "collect" ? "تحصيل سلفة" : "سداد دين"}
            </Text>
            <Text style={s.modalPerson}>{selected?.personName}</Text>

            {/* ملخص */}
            <View style={s.modalSummary}>
              <View style={s.summaryItem}>
                <Text style={s.summaryVal}>{selected && formatCurrency(parseFloat(selected.amount))}</Text>
                <Text style={s.summaryKey}>الإجمالي</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={s.summaryVal}>{selected && formatCurrency(parseFloat(selected.paidAmount))}</Text>
                <Text style={s.summaryKey}>المسدد</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: modeColor }]}>
                  {selected && formatCurrency(selected.remaining)}
                </Text>
                <Text style={s.summaryKey}>المتبقي</Text>
              </View>
            </View>

            {/* حقل المبلغ */}
            <Text style={s.inputLabel}>المبلغ المدفوع (ر.س)</Text>
            <TextInput
              style={s.modalInput} value={amtInput}
              onChangeText={v => setAmtInput(v.replace(/[^0-9.]/g, ""))}
              placeholder="0.00" placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad" textAlign="right" autoFocus
            />

            {/* الأثر */}
            <View style={[s.effectBox, { backgroundColor: modeColor + "12" }]}>
              <Ionicons
                name={mode === "collect" ? "add-circle" : "remove-circle"}
                size={14} color={modeColor}
              />
              <Text style={[s.effectTxt, { color: modeColor }]}>
                {mode === "collect" ? "يزيد الصندوق النقدي" : "ينقص من الصندوق النقدي"}
              </Text>
            </View>

            {/* أزرار */}
            <View style={s.modalBtns}>
              <TouchableOpacity
                style={[s.confirmBtn, { backgroundColor: modeColor }, submitting && { opacity: 0.5 }]}
                onPress={handleSubmit} disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.confirmBtnTxt}>تأكيد</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => { setSelected(null); setAmtInput(""); }}
              >
                <Text style={s.cancelBtnTxt}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AlertModal
        visible={alert.visible} title={alert.title} message={alert.message} color={alert.color}
        onClose={() => { setAlert(a => ({ ...a, visible: false })); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center:    { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: Colors.text },

  modeRow: { flexDirection: "row-reverse", gap: 10, padding: 16, paddingBottom: 8 },
  modeCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    alignItems: "center", gap: 4, borderWidth: 1.5, borderColor: Colors.border,
  },
  modeLabel: { fontSize: 14, fontWeight: "700", color: Colors.textSecondary, textAlign: "center" },
  modeSub:   { fontSize: 10, color: Colors.textMuted, textAlign: "center" },
  modeCheck: {
    position: "absolute", top: 8, left: 8, width: 20, height: 20,
    borderRadius: 10, justifyContent: "center", alignItems: "center",
  },

  searchWrap: {
    flexDirection: "row-reverse", alignItems: "center", backgroundColor: Colors.surface,
    marginHorizontal: 16, marginBottom: 12, borderRadius: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, paddingVertical: 10, color: Colors.text, fontSize: 14 },

  content: { padding: 16, paddingTop: 4 },
  empty: { alignItems: "center", justifyContent: "center", marginTop: 60, gap: 12 },
  emptyTxt: { fontSize: 15, color: Colors.textMuted },

  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: Colors.border, gap: 10,
  },
  cardTop: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  personName: { fontSize: 15, fontWeight: "700", color: Colors.text },
  remaining:  { fontSize: 16, fontWeight: "800" },

  progressBg:   { height: 7, backgroundColor: Colors.background, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },

  statsRow:    { flexDirection: "row-reverse", justifyContent: "space-around" },
  stat:        { alignItems: "center", flex: 1 },
  statVal:     { fontSize: 13, fontWeight: "700", color: Colors.text },
  statKey:     { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 2 },

  actionBtn: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 11, borderRadius: 10,
  },
  actionBtnTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  modalBox: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12,
  },
  modalTitle:  { fontSize: 20, fontWeight: "800", textAlign: "center" },
  modalPerson: { fontSize: 15, color: Colors.textSecondary, textAlign: "center" },

  modalSummary: {
    flexDirection: "row-reverse", justifyContent: "space-around",
    backgroundColor: Colors.background, borderRadius: 12, padding: 14,
  },
  summaryItem:   { alignItems: "center", flex: 1 },
  summaryVal:    { fontSize: 14, fontWeight: "700", color: Colors.text },
  summaryKey:    { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  inputLabel: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary, textAlign: "right" },
  modalInput: {
    backgroundColor: Colors.background, borderRadius: 12, padding: 16,
    color: Colors.text, fontSize: 22, fontWeight: "800", borderWidth: 1, borderColor: Colors.border,
  },

  effectBox: { flexDirection: "row-reverse", alignItems: "center", gap: 6, borderRadius: 10, padding: 10 },
  effectTxt: { fontSize: 12, fontWeight: "600" },

  modalBtns:    { flexDirection: "row-reverse", gap: 10, marginTop: 4 },
  confirmBtn:   { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  confirmBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancelBtn:    { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  cancelBtnTxt: { fontSize: 16, color: Colors.textSecondary },

  /* Alert */
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  alertBox: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 28,
    width: "100%", maxWidth: 340, alignItems: "center", gap: 12,
  },
  alertIconWrap: { width: 76, height: 76, borderRadius: 38, justifyContent: "center", alignItems: "center" },
  alertTitle:    { fontSize: 18, fontWeight: "800", color: Colors.text, textAlign: "center" },
  alertMsg:      { fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  alertBtn:      { paddingHorizontal: 44, paddingVertical: 12, borderRadius: 12, marginTop: 4 },
  alertBtnTxt:   { fontSize: 15, fontWeight: "700", color: "#fff" },
});
