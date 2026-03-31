import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, Modal, ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Colors } from "@/constants/colors";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, formatCurrency } from "@/utils/api";

type Mode = "collect" | "pay";

const ENTITY_LABELS: Record<string, { label: string; color: string }> = {
  hotspot:     { label: "هوتسبوت",   color: Colors.info    },
  broadband:   { label: "برودباند",  color: Colors.primary },
  sales_point: { label: "نقطة بيع",  color: Colors.warning },
  supplier:    { label: "مورّد",     color: "#9b59b6"       },
  other:       { label: "أخرى",      color: Colors.textMuted },
};

function EntityBadge({ type }: { type?: string | null }) {
  const info = ENTITY_LABELS[type ?? "other"] ?? ENTITY_LABELS.other;
  return (
    <View style={[badge.wrap, { backgroundColor: info.color + "20", borderColor: info.color + "50" }]}>
      <Text style={[badge.txt, { color: info.color }]}>{info.label}</Text>
    </View>
  );
}
const badge = StyleSheet.create({
  wrap: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  txt:  { fontSize: 11, fontWeight: "700" },
});

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
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const { token } = useAuth();

  const [mode,       setMode]       = useState<Mode>("collect");
  const [search,     setSearch]     = useState("");
  const [debts,      setDebts]      = useState<any[]>([]);
  const [loans,      setLoans]      = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,   setSelected]   = useState<any>(null);
  const [amtInput,   setAmtInput]   = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState({ visible: false, title: "", message: "", color: Colors.success });

  const showAlert = (title: string, message: string, color = Colors.success) =>
    setAlert({ visible: true, title, message, color });

  const fetchData = useCallback(async () => {
    try {
      const [d, l] = await Promise.all([apiGet("/debts", token), apiGet("/loans", token)]);
      setDebts(Array.isArray(d) ? d : []);
      setLoans(Array.isArray(l) ? l : []);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  /* القائمة الحالية حسب الوضع */
  const rawList = mode === "collect" ? debts : loans;
  const list = rawList
    .map((item: any) => ({
      ...item,
      remaining: Math.max(0, parseFloat(item.amount ?? "0") - parseFloat(item.paidAmount ?? "0")),
    }))
    .filter((item: any) => item.remaining > 0.01 && (item.personName ?? "").includes(search))
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
        notes:      notesInput.trim() || undefined,
      });
      await fetchData();
      const personLabel = selected.personName;
      const amtLabel    = formatCurrency(amt);
      const msg = mode === "collect"
        ? `تم تحصيل ${amtLabel} من ${personLabel}\n↑ يزيد الصندوق النقدي`
        : `تم سداد ${amtLabel} لـ ${personLabel}\n↓ ينقص من الصندوق النقدي`;
      setSelected(null); setAmtInput(""); setNotesInput("");
      showAlert(mode === "collect" ? "تم التحصيل ✓" : "تم السداد ✓", msg);
    } catch (e: any) {
      showAlert("خطأ", e?.message ?? "فشلت العملية", Colors.error);
    } finally { setSubmitting(false); }
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

      {/* ─── Header ─── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>تحصيل</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ─── اختيار الوضع ─── */}
      <View style={s.modeRow}>
        {([
          { key: "collect", label: "تحصيل سلفة",  icon: "arrow-down-circle"  as const, color: Colors.success, sub: "عملاء يدينون لنا" },
          { key: "pay",     label: "سداد دين",     icon: "arrow-up-circle"    as const, color: Colors.error,   sub: "نحن ندين لجهات"  },
        ] as const).map(m => (
          <TouchableOpacity
            key={m.key}
            style={[s.modeCard, mode === m.key && { borderColor: m.color, backgroundColor: m.color + "12" }]}
            onPress={() => { setMode(m.key); setSearch(""); setSelected(null); }}
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

      {/* ─── بحث ─── */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput} placeholder="بحث بالاسم..."
          placeholderTextColor={Colors.textMuted}
          value={search} onChangeText={setSearch} textAlign="right"
        />
        <Ionicons name="search" size={18} color={Colors.textMuted} style={{ marginLeft: 8 }} />
      </View>

      {/* ─── القائمة ─── */}
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={Colors.primary} />}
      >
        {list.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={56} color={Colors.textMuted} />
            <Text style={s.emptyTxt}>لا توجد سجلات مفتوحة</Text>
            <Text style={s.emptySub}>
              {mode === "collect" ? "جميع السلف مسددة" : "جميع الديون مسددة"}
            </Text>
          </View>
        ) : list.map((item: any) => {
          const pct     = Math.min((parseFloat(item.paidAmount ?? "0") / parseFloat(item.amount ?? "1")) * 100, 100);
          const isSelected = selected?.id === item.id;
          return (
            <View key={item.id} style={[s.card, isSelected && { borderColor: modeColor, borderWidth: 1.5 }]}>
              {/* الصف الأعلى: الاسم + النوع */}
              <View style={s.cardTop}>
                <EntityBadge type={item.entityType} />
                <Text style={s.personName} numberOfLines={1}>{item.personName}</Text>
              </View>

              {/* الإحصائيات */}
              <View style={s.statsRow}>
                <View style={s.stat}>
                  <Text style={s.statVal}>{formatCurrency(parseFloat(item.amount ?? "0"))}</Text>
                  <Text style={s.statKey}>الإجمالي</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.stat}>
                  <Text style={s.statVal}>{formatCurrency(parseFloat(item.paidAmount ?? "0"))}</Text>
                  <Text style={s.statKey}>المسدد</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.stat}>
                  <Text style={[s.statVal, { color: modeColor, fontWeight: "800" }]}>
                    {formatCurrency(item.remaining)}
                  </Text>
                  <Text style={s.statKey}>المتبقي</Text>
                </View>
              </View>

              {/* شريط التقدم */}
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: modeColor }]} />
              </View>

              {/* ملاحظة إن وجدت */}
              {!!item.notes && (
                <Text style={s.noteText} numberOfLines={1}>{item.notes}</Text>
              )}

              {/* زر الإجراء */}
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: modeColor }]}
                onPress={() => { setSelected(item); setAmtInput(""); setNotesInput(""); }}
              >
                <Ionicons name={mode === "collect" ? "arrow-down" : "arrow-up"} size={16} color="#fff" />
                <Text style={s.actionBtnTxt}>
                  {mode === "collect" ? "تحصيل سلفة" : "سداد دين"}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ══════════════════════ Modal التحصيل / السداد ══════════════════════ */}
      <Modal visible={!!selected} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>

            {/* العنوان */}
            <View style={[s.modalHeader, { backgroundColor: modeColor + "18" }]}>
              <Ionicons
                name={mode === "collect" ? "arrow-down-circle" : "arrow-up-circle"}
                size={22} color={modeColor}
              />
              <Text style={[s.modalTitle, { color: modeColor }]}>
                {mode === "collect" ? "تحصيل سلفة" : "سداد دين"}
              </Text>
            </View>

            {/* اسم الجهة + النوع */}
            <View style={s.modalPersonRow}>
              {selected && <EntityBadge type={selected.entityType} />}
              <Text style={s.modalPerson} numberOfLines={1}>{selected?.personName}</Text>
            </View>

            {/* ملخص: إجمالي / مسدد / متبقي */}
            <View style={s.modalSummary}>
              <View style={s.summaryItem}>
                <Text style={s.summaryVal}>
                  {selected && formatCurrency(parseFloat(selected.amount ?? "0"))}
                </Text>
                <Text style={s.summaryKey}>الإجمالي</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={s.summaryVal}>
                  {selected && formatCurrency(parseFloat(selected.paidAmount ?? "0"))}
                </Text>
                <Text style={s.summaryKey}>المسدد</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: modeColor, fontWeight: "800" }]}>
                  {selected && formatCurrency(selected.remaining)}
                </Text>
                <Text style={s.summaryKey}>المتبقي</Text>
              </View>
            </View>

            {/* حقل المبلغ */}
            <Text style={s.inputLabel}>المبلغ المدفوع (ر.س)</Text>
            <TextInput
              style={[s.modalInput, { borderColor: modeColor + "60" }]}
              value={amtInput}
              onChangeText={v => setAmtInput(v.replace(/[^0-9.]/g, ""))}
              placeholder={`0.00 (أقصى: ${selected ? formatCurrency(selected.remaining) : ""})`}
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad" textAlign="right" autoFocus
            />

            {/* حقل الملاحظات */}
            <Text style={s.inputLabel}>ملاحظات (اختياري)</Text>
            <TextInput
              style={[s.modalInput, { minHeight: 56 }]}
              value={notesInput}
              onChangeText={setNotesInput}
              placeholder="أي ملاحظات على العملية..."
              placeholderTextColor={Colors.textMuted}
              textAlign="right" multiline
            />

            {/* الأثر على الصندوق */}
            <View style={[s.effectBox, { backgroundColor: modeColor + "12" }]}>
              <Ionicons
                name={mode === "collect" ? "add-circle" : "remove-circle"}
                size={14} color={modeColor}
              />
              <Text style={[s.effectTxt, { color: modeColor }]}>
                {mode === "collect" ? "يزيد الصندوق النقدي" : "ينقص من الصندوق النقدي"}
              </Text>
            </View>

            {/* الأزرار */}
            <View style={s.modalBtns}>
              <TouchableOpacity
                style={[s.confirmBtn, { backgroundColor: modeColor },
                  (submitting || !amtInput) && { opacity: 0.5 }]}
                onPress={handleSubmit} disabled={submitting || !amtInput}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.confirmBtnTxt}>حفظ</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => { setSelected(null); setAmtInput(""); setNotesInput(""); }}
              >
                <Text style={s.cancelBtnTxt}>إلغاء</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      <AlertModal
        visible={alert.visible} title={alert.title} message={alert.message} color={alert.color}
        onClose={() => setAlert(a => ({ ...a, visible: false }))}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center:    { justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: Colors.text },

  modeRow: { flexDirection: "row-reverse", gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  modeCard: {
    flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface, padding: 14, alignItems: "center", gap: 4,
  },
  modeLabel: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary },
  modeSub:   { fontSize: 10, color: Colors.textMuted },
  modeCheck: {
    position: "absolute", top: 8, left: 8, width: 18, height: 18,
    borderRadius: 9, justifyContent: "center", alignItems: "center",
  },

  searchWrap: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: Colors.surface, borderRadius: 10,
    paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border, height: 44,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14 },

  content: { paddingHorizontal: 16, paddingTop: 4 },

  empty: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyTxt: { fontSize: 16, color: Colors.textSecondary, fontWeight: "600" },
  emptySub:  { fontSize: 13, color: Colors.textMuted },

  card: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border, gap: 8,
  },
  cardTop: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  personName: { flex: 1, fontSize: 15, fontWeight: "700", color: Colors.text, textAlign: "right" },

  statsRow: { flexDirection: "row-reverse", justifyContent: "space-between" },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statVal: { fontSize: 14, fontWeight: "700", color: Colors.text },
  statKey: { fontSize: 10, color: Colors.textMuted },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  progressBg:   { height: 5, backgroundColor: Colors.border, borderRadius: 3 },
  progressFill: { height: "100%", borderRadius: 3 },

  noteText: { fontSize: 11, color: Colors.textMuted, textAlign: "right" },

  actionBtn: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 6, borderRadius: 10, paddingVertical: 10,
  },
  actionBtnTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },

  /* ── Modal ── */
  modalOverlay: { flex: 1, backgroundColor: "#00000080", justifyContent: "flex-end" },
  modalBox: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, gap: 12,
  },
  modalHeader: {
    flexDirection: "row-reverse", alignItems: "center", gap: 8,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  modalTitle:     { fontSize: 16, fontWeight: "800" },
  modalPersonRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  modalPerson:    { flex: 1, fontSize: 15, fontWeight: "700", color: Colors.text, textAlign: "right" },

  modalSummary: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    backgroundColor: Colors.background, borderRadius: 12, padding: 12,
  },
  summaryItem:   { flex: 1, alignItems: "center", gap: 2 },
  summaryVal:    { fontSize: 14, fontWeight: "700", color: Colors.text },
  summaryKey:    { fontSize: 10, color: Colors.textMuted },
  summaryDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  inputLabel:  { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: -6 },
  modalInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    color: Colors.text, fontSize: 15, textAlign: "right",
    backgroundColor: Colors.background,
  },

  effectBox: { flexDirection: "row-reverse", alignItems: "center", gap: 6, borderRadius: 8, padding: 10 },
  effectTxt: { fontSize: 12, fontWeight: "600" },

  modalBtns:  { flexDirection: "row-reverse", gap: 10 },
  confirmBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  confirmBtnTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
  cancelBtn:  {
    flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center",
    backgroundColor: Colors.border,
  },
  cancelBtnTxt: { fontSize: 15, fontWeight: "700", color: Colors.textSecondary },

  /* Alert */
  overlay: { flex: 1, backgroundColor: "#00000080", justifyContent: "center", alignItems: "center" },
  alertBox: {
    backgroundColor: Colors.surface, borderRadius: 20,
    padding: 24, alignItems: "center", gap: 10, width: 300,
  },
  alertIconWrap: { borderRadius: 40, padding: 12 },
  alertTitle:    { fontSize: 18, fontWeight: "800", color: Colors.text },
  alertMsg:      { fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  alertBtn:      { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 40, marginTop: 4 },
  alertBtnTxt:   { color: "#fff", fontSize: 15, fontWeight: "700" },
});
