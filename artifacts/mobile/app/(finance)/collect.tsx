import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, Modal, ActivityIndicator, RefreshControl, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Colors } from "@/constants/colors";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, apiPut, formatCurrency, formatDate } from "@/utils/api";

type Tab = "collect" | "pay" | "ops";

const ENTITY_LABELS: Record<string, { label: string; color: string }> = {
  hotspot:     { label: "هوتسبوت",  color: Colors.info    },
  broadband:   { label: "برودباند", color: Colors.primary },
  sales_point: { label: "نقطة بيع", color: Colors.warning },
  supplier:    { label: "مورّد",    color: "#9b59b6"       },
  other:       { label: "أخرى",     color: Colors.textMuted },
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

  const [tab,        setTab]        = useState<Tab>("collect");
  const [debts,      setDebts]      = useState<any[]>([]);
  const [loans,      setLoans]      = useState<any[]>([]);
  const [ops,        setOps]        = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* ─── حالة نافذة التحصيل / السداد ─── */
  const [selected,   setSelected]   = useState<any>(null);
  const [amtInput,   setAmtInput]   = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* ─── حالة نافذة تعديل العملية ─── */
  const [editOp,    setEditOp]    = useState<any>(null);
  const [editAmt,   setEditAmt]   = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [alert, setAlert] = useState({ visible: false, title: "", message: "", color: Colors.success });
  const showAlert = (title: string, message: string, color = Colors.success) =>
    setAlert({ visible: true, title, message, color });

  const fetchAll = useCallback(async () => {
    try {
      const [d, l, o] = await Promise.all([
        apiGet("/debts",              token),
        apiGet("/loans",              token),
        apiGet("/transactions?ops=1&limit=200", token),
      ]);
      setDebts(Array.isArray(d) ? d : []);
      setLoans(Array.isArray(l) ? l : []);
      setOps(Array.isArray(o) ? o : []);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  /* ─── قوائم مُعالَجة ─── */
  const debtList = debts
    .map((d: any) => ({
      ...d,
      remaining: Math.max(0, parseFloat(d.amount ?? "0") - parseFloat(d.paidAmount ?? "0")),
    }))
    .filter((d: any) => d.remaining > 0.01)
    .sort((a: any, b: any) => b.remaining - a.remaining);

  const loanList = loans
    .map((l: any) => ({
      ...l,
      remaining: Math.max(0, parseFloat(l.amount ?? "0") - parseFloat(l.paidAmount ?? "0")),
    }))
    .filter((l: any) => l.remaining > 0.01)
    .sort((a: any, b: any) => b.remaining - a.remaining);

  /* ─── الإجماليات ─── */
  const totalDebtsOwed = debtList.reduce((s: number, d: any) => s + d.remaining, 0);
  const totalLoansOwed = loanList.reduce((s: number, l: any) => s + l.remaining, 0);

  /* ─── تحصيل / سداد ─── */
  const handleSubmit = async () => {
    const amt = parseFloat(amtInput.replace(/[^0-9.]/g, ""));
    if (!amt || amt <= 0) return showAlert("خطأ", "أدخل مبلغاً صحيحاً", Colors.error);
    if (amt > selected.remaining + 0.01) return showAlert("خطأ", "المبلغ أكبر من المتبقي", Colors.error);
    setSubmitting(true);
    try {
      await apiPost("/transactions/collect", token, {
        sourceType: tab === "collect" ? "debt" : "loan",
        sourceId:   selected.id,
        amount:     amt,
        notes:      notesInput.trim() || undefined,
      });
      await fetchAll();
      const label = formatCurrency(amt);
      const msg = tab === "collect"
        ? `تم تحصيل ${label} من ${selected.personName}\n↑ يزيد الصندوق النقدي`
        : `تم سداد ${label} لـ ${selected.personName}\n↓ ينقص من الصندوق النقدي`;
      setSelected(null); setAmtInput(""); setNotesInput("");
      showAlert(tab === "collect" ? "تم التحصيل ✓" : "تم السداد ✓", msg);
    } catch (e: any) {
      showAlert("خطأ", e?.message ?? "فشلت العملية", Colors.error);
    } finally { setSubmitting(false); }
  };

  /* ─── تعديل عملية ─── */
  const openEdit = (op: any) => {
    setEditOp(op);
    setEditAmt(String(parseFloat(op.amount ?? "0")));
    setEditNotes(op.description ?? "");
  };

  const handleEdit = async () => {
    const amt = parseFloat(editAmt.replace(/[^0-9.]/g, ""));
    if (!amt || amt <= 0) return showAlert("خطأ", "أدخل مبلغاً صحيحاً", Colors.error);
    setEditSaving(true);
    try {
      await apiPut(`/transactions/${editOp.id}`, token, {
        amount:      amt,
        description: editNotes.trim() || undefined,
      });
      await fetchAll();
      setEditOp(null);
      showAlert("تم التعديل ✓", `تم تحديث العملية وانعكس الفرق على الحسابات المرتبطة`);
    } catch (e: any) {
      showAlert("خطأ", e?.message ?? "فشل التعديل", Colors.error);
    } finally { setEditSaving(false); }
  };

  const modeColor = tab === "collect" ? Colors.success : Colors.error;

  if (loading) {
    return (
      <View style={[s.container, s.center, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
    { key: "collect", label: "تحصيل سلفة", icon: "arrow-down-circle", color: Colors.success },
    { key: "pay",     label: "سداد دين",   icon: "arrow-up-circle",   color: Colors.error   },
    { key: "ops",     label: "العمليات",   icon: "list-outline",       color: "#9b59b6"       },
  ];

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

      {/* ─── التبويبات ─── */}
      <View style={s.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.tabBtn, tab === t.key && { borderBottomColor: t.color, borderBottomWidth: 2.5 }]}
            onPress={() => { setTab(t.key); setSelected(null); }}
          >
            <Ionicons name={t.icon} size={16} color={tab === t.key ? t.color : Colors.textMuted} />
            <Text style={[s.tabLabel, { color: tab === t.key ? t.color : Colors.textMuted }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ═══════════════════════════════════
          تبويب: تحصيل سلفة
      ═══════════════════════════════════ */}
      {tab === "collect" && (
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor={Colors.primary} />}
        >
          {/* إجمالي السلف */}
          <View style={[s.totalCard, { borderColor: Colors.success + "60", backgroundColor: Colors.success + "0E" }]}>
            <View style={s.totalCardLeft}>
              <Ionicons name="trending-up" size={28} color={Colors.success} />
            </View>
            <View style={s.totalCardRight}>
              <Text style={s.totalCardLabel}>إجمالي السلف المستحقة لنا</Text>
              <Text style={[s.totalCardAmount, { color: Colors.success }]}>
                {formatCurrency(totalDebtsOwed)}
              </Text>
              <Text style={s.totalCardSub}>{debtList.length} سلفة مفتوحة</Text>
            </View>
          </View>

          <Text style={s.sectionTitle}>كشف السلف</Text>

          {debtList.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="checkmark-done-circle-outline" size={56} color={Colors.textMuted} />
              <Text style={s.emptyTxt}>جميع السلف مسددة</Text>
            </View>
          ) : debtList.map((item: any) => {
            const pct = Math.min((parseFloat(item.paidAmount ?? "0") / parseFloat(item.amount ?? "1")) * 100, 100);
            const isSelected = selected?.id === item.id && tab === "collect";
            return (
              <View key={item.id} style={[s.card, isSelected && { borderColor: Colors.success, borderWidth: 1.5 }]}>
                <View style={s.cardTop}>
                  <EntityBadge type={item.entityType} />
                  <Text style={s.personName} numberOfLines={1}>{item.personName}</Text>
                </View>
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
                    <Text style={[s.statVal, { color: Colors.success, fontWeight: "800" }]}>
                      {formatCurrency(item.remaining)}
                    </Text>
                    <Text style={s.statKey}>المتبقي</Text>
                  </View>
                </View>
                <View style={s.progressBg}>
                  <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: Colors.success }]} />
                </View>
                {!!item.notes && <Text style={s.noteText} numberOfLines={1}>{item.notes}</Text>}
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: Colors.success }]}
                  onPress={() => { setSelected(item); setAmtInput(""); setNotesInput(""); }}
                >
                  <Ionicons name="arrow-down" size={16} color="#fff" />
                  <Text style={s.actionBtnTxt}>تحصيل سلفة</Text>
                </TouchableOpacity>
              </View>
            );
          })}
          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {/* ═══════════════════════════════════
          تبويب: سداد دين
      ═══════════════════════════════════ */}
      {tab === "pay" && (
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor={Colors.primary} />}
        >
          {/* إجمالي الديون */}
          <View style={[s.totalCard, { borderColor: Colors.error + "60", backgroundColor: Colors.error + "0E" }]}>
            <View style={s.totalCardLeft}>
              <Ionicons name="trending-down" size={28} color={Colors.error} />
            </View>
            <View style={s.totalCardRight}>
              <Text style={s.totalCardLabel}>إجمالي الديون المستحقة علينا</Text>
              <Text style={[s.totalCardAmount, { color: Colors.error }]}>
                {formatCurrency(totalLoansOwed)}
              </Text>
              <Text style={s.totalCardSub}>{loanList.length} دين مفتوح</Text>
            </View>
          </View>

          <Text style={s.sectionTitle}>كشف الديون</Text>

          {loanList.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="checkmark-done-circle-outline" size={56} color={Colors.textMuted} />
              <Text style={s.emptyTxt}>جميع الديون مسددة</Text>
            </View>
          ) : loanList.map((item: any) => {
            const pct = Math.min((parseFloat(item.paidAmount ?? "0") / parseFloat(item.amount ?? "1")) * 100, 100);
            const isSelected = selected?.id === item.id && tab === "pay";
            return (
              <View key={item.id} style={[s.card, isSelected && { borderColor: Colors.error, borderWidth: 1.5 }]}>
                <View style={s.cardTop}>
                  <EntityBadge type={item.entityType} />
                  <Text style={s.personName} numberOfLines={1}>{item.personName}</Text>
                </View>
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
                    <Text style={[s.statVal, { color: Colors.error, fontWeight: "800" }]}>
                      {formatCurrency(item.remaining)}
                    </Text>
                    <Text style={s.statKey}>المتبقي</Text>
                  </View>
                </View>
                <View style={s.progressBg}>
                  <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: Colors.error }]} />
                </View>
                {!!item.notes && <Text style={s.noteText} numberOfLines={1}>{item.notes}</Text>}
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: Colors.error }]}
                  onPress={() => { setSelected(item); setAmtInput(""); setNotesInput(""); }}
                >
                  <Ionicons name="arrow-up" size={16} color="#fff" />
                  <Text style={s.actionBtnTxt}>سداد دين</Text>
                </TouchableOpacity>
              </View>
            );
          })}
          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {/* ═══════════════════════════════════
          تبويب: العمليات
      ═══════════════════════════════════ */}
      {tab === "ops" && (
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor={Colors.primary} />}
        >
          {ops.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="receipt-outline" size={56} color={Colors.textMuted} />
              <Text style={s.emptyTxt}>لا توجد عمليات</Text>
            </View>
          ) : ops.map((op: any) => {
            const isCollect = op.paymentType === "collect";
            const opColor   = isCollect ? Colors.success : Colors.error;
            const opLabel   = isCollect ? "تحصيل سلفة" : "سداد دين";
            const opIcon: keyof typeof Ionicons.glyphMap = isCollect ? "arrow-down-circle" : "arrow-up-circle";
            return (
              <View key={op.id} style={s.opCard}>
                {/* السطر الأعلى: أيقونة النوع + الاسم + المبلغ */}
                <View style={s.opTop}>
                  <Text style={[s.opAmount, { color: opColor }]}>
                    {isCollect ? "+" : "−"}{formatCurrency(parseFloat(op.amount ?? "0"))}
                  </Text>
                  <View style={[s.opBadge, { backgroundColor: opColor + "18" }]}>
                    <Ionicons name={opIcon} size={13} color={opColor} />
                    <Text style={[s.opBadgeTxt, { color: opColor }]}>{opLabel}</Text>
                  </View>
                  <Text style={s.opName} numberOfLines={1}>{op.personName ?? "—"}</Text>
                </View>

                {/* الوصف والتاريخ */}
                {!!op.description && (
                  <Text style={s.opDesc} numberOfLines={2}>{op.description}</Text>
                )}
                <Text style={s.opDate}>{formatDate(op.createdAt)}</Text>

                {/* زر التعديل */}
                <TouchableOpacity
                  style={s.editBtn}
                  onPress={() => openEdit(op)}
                >
                  <Ionicons name="create-outline" size={15} color={Colors.primary} />
                  <Text style={s.editBtnTxt}>تعديل</Text>
                </TouchableOpacity>
              </View>
            );
          })}
          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {/* ══════════ Modal التحصيل / السداد ══════════ */}
      <Modal visible={!!selected} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={[s.modalHeader, { backgroundColor: modeColor + "18" }]}>
              <Ionicons
                name={tab === "collect" ? "arrow-down-circle" : "arrow-up-circle"}
                size={22} color={modeColor}
              />
              <Text style={[s.modalTitle, { color: modeColor }]}>
                {tab === "collect" ? "تحصيل سلفة" : "سداد دين"}
              </Text>
            </View>

            <View style={s.modalPersonRow}>
              {selected && <EntityBadge type={selected.entityType} />}
              <Text style={s.modalPerson} numberOfLines={1}>{selected?.personName}</Text>
            </View>

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

            <Text style={s.inputLabel}>المبلغ المدفوع (ر.س)</Text>
            <TextInput
              style={[s.modalInput, { borderColor: modeColor + "60" }]}
              value={amtInput}
              onChangeText={v => setAmtInput(v.replace(/[^0-9.]/g, ""))}
              placeholder={`0.00 (أقصى: ${selected ? formatCurrency(selected.remaining) : ""})`}
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad" textAlign="right" autoFocus
            />

            <Text style={s.inputLabel}>ملاحظات (اختياري)</Text>
            <TextInput
              style={[s.modalInput, { minHeight: 56 }]}
              value={notesInput}
              onChangeText={setNotesInput}
              placeholder="أي ملاحظات..."
              placeholderTextColor={Colors.textMuted}
              textAlign="right" multiline
            />

            <View style={[s.effectBox, { backgroundColor: modeColor + "12" }]}>
              <Ionicons
                name={tab === "collect" ? "add-circle" : "remove-circle"}
                size={14} color={modeColor}
              />
              <Text style={[s.effectTxt, { color: modeColor }]}>
                {tab === "collect" ? "يزيد الصندوق النقدي" : "ينقص من الصندوق النقدي"}
              </Text>
            </View>

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

      {/* ══════════ Modal تعديل العملية ══════════ */}
      <Modal visible={!!editOp} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={[s.modalHeader, { backgroundColor: "#9b59b618" }]}>
              <Ionicons name="create-outline" size={22} color="#9b59b6" />
              <Text style={[s.modalTitle, { color: "#9b59b6" }]}>تعديل العملية</Text>
            </View>

            {editOp && (
              <View style={[s.opBadge, { backgroundColor: (editOp.paymentType === "collect" ? Colors.success : Colors.error) + "18", alignSelf: "flex-end" }]}>
                <Text style={[s.opBadgeTxt, { color: editOp.paymentType === "collect" ? Colors.success : Colors.error }]}>
                  {editOp.paymentType === "collect" ? "تحصيل سلفة" : "سداد دين"} — {editOp.personName}
                </Text>
              </View>
            )}

            <Text style={s.inputLabel}>المبلغ الجديد (ر.س)</Text>
            <TextInput
              style={[s.modalInput, { borderColor: "#9b59b660" }]}
              value={editAmt}
              onChangeText={v => setEditAmt(v.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad" textAlign="right" autoFocus
            />

            <Text style={s.inputLabel}>الوصف / الملاحظات</Text>
            <TextInput
              style={[s.modalInput, { minHeight: 56 }]}
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder="وصف العملية..."
              placeholderTextColor={Colors.textMuted}
              textAlign="right" multiline
            />

            <View style={[s.effectBox, { backgroundColor: "#9b59b612" }]}>
              <Ionicons name="information-circle" size={14} color="#9b59b6" />
              <Text style={[s.effectTxt, { color: "#9b59b6" }]}>
                الفرق ينعكس تلقائياً على الصندوق والسلفة / الدين المرتبط
              </Text>
            </View>

            <View style={s.modalBtns}>
              <TouchableOpacity
                style={[s.confirmBtn, { backgroundColor: "#9b59b6" },
                  (editSaving || !editAmt) && { opacity: 0.5 }]}
                onPress={handleEdit} disabled={editSaving || !editAmt}
              >
                {editSaving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.confirmBtnTxt}>حفظ التعديل</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => setEditOp(null)}
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

  /* ─ تبويبات ─ */
  tabRow: {
    flexDirection: "row-reverse",
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tabBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabLabel: { fontSize: 12, fontWeight: "700" },

  /* ─ بطاقة الإجمالي ─ */
  totalCard: {
    flexDirection: "row-reverse", alignItems: "center",
    borderRadius: 16, borderWidth: 1,
    padding: 16, marginBottom: 16, gap: 14,
  },
  totalCardLeft: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#ffffff18",
    justifyContent: "center", alignItems: "center",
  },
  totalCardRight: { flex: 1, gap: 3 },
  totalCardLabel:  { fontSize: 12, color: Colors.textSecondary, textAlign: "right" },
  totalCardAmount: { fontSize: 24, fontWeight: "900", textAlign: "right" },
  totalCardSub:    { fontSize: 11, color: Colors.textMuted, textAlign: "right" },

  sectionTitle: {
    fontSize: 14, fontWeight: "700", color: Colors.textSecondary,
    textAlign: "right", marginBottom: 10,
  },

  content: { paddingHorizontal: 16, paddingTop: 16 },

  empty: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyTxt: { fontSize: 16, color: Colors.textSecondary, fontWeight: "600" },

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

  /* ─ بطاقة العملية ─ */
  opCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border, gap: 6,
  },
  opTop: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  opName: { flex: 1, fontSize: 14, fontWeight: "700", color: Colors.text, textAlign: "right" },
  opAmount: { fontSize: 16, fontWeight: "800" },
  opBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  opBadgeTxt: { fontSize: 11, fontWeight: "700" },
  opDesc: { fontSize: 12, color: Colors.textSecondary, textAlign: "right" },
  opDate: { fontSize: 11, color: Colors.textMuted, textAlign: "right" },
  editBtn: {
    flexDirection: "row-reverse", alignItems: "center", gap: 5,
    alignSelf: "flex-end",
    backgroundColor: Colors.primary + "15",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
  },
  editBtnTxt: { fontSize: 13, fontWeight: "600", color: Colors.primary },

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
  modalTitle: { fontSize: 16, fontWeight: "800" },
  modalPersonRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  modalPerson: { flex: 1, fontSize: 15, fontWeight: "700", color: Colors.text, textAlign: "right" },

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
  effectTxt: { fontSize: 12, fontWeight: "600", flex: 1, textAlign: "right" },

  modalBtns:  { flexDirection: "row-reverse", gap: 10 },
  confirmBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  confirmBtnTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
  cancelBtn: {
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
