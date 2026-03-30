import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, RefreshControl, Modal, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPut, apiDelete, formatCurrency, formatDateTime } from "@/utils/api";

const PERIODS   = [{ key: "day", label: "اليوم" }, { key: "week", label: "الأسبوع" }, { key: "month", label: "الشهر" }];
const PAY_TYPES = [{ key: "all", label: "الكل" }, { key: "cash", label: "نقدي" }, { key: "loan", label: "سلفة" }];
const CATS      = [{ key: "all", label: "الكل" }, { key: "hotspot", label: "هوتسبوت" }, { key: "broadband", label: "برودباند" }];

/* ─────────────────────────────────────────────────────
   Alert Modal
───────────────────────────────────────────────────── */
function AlertModal({ visible, title, message, color, onClose }: {
  visible: boolean; title: string; message: string; color: string; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={st.overlay}>
        <View style={st.alertBox}>
          <View style={[st.alertIcon, { backgroundColor: color + "20" }]}>
            <Ionicons name={color === Colors.error ? "close-circle" : "checkmark-circle"} size={40} color={color} />
          </View>
          <Text style={st.alertTitle}>{title}</Text>
          {!!message && <Text style={st.alertMsg}>{message}</Text>}
          <TouchableOpacity style={[st.alertBtn, { backgroundColor: color }]} onPress={onClose}>
            <Text style={st.alertBtnTxt}>حسناً</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────
   Detail Modal
───────────────────────────────────────────────────── */
function DetailModal({ item, onClose }: { item: any | null; onClose: () => void }) {
  if (!item) return null;
  const isCash = (item.paymentType ?? "cash") === "cash";
  const isHot  = item.category === "hotspot";
  return (
    <Modal visible animationType="slide" transparent>
      <View style={st.sheetOverlay}>
        <View style={st.sheet}>
          <View style={st.sheetHdr}>
            <Text style={st.sheetTitle}>تفاصيل البيع</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={Colors.textSecondary} /></TouchableOpacity>
          </View>
          <View style={{ gap: 0 }}>
            <DR label="المبلغ"       value={formatCurrency(parseFloat(item.amount ?? 0))} color={Colors.success} />
            <DR label="البيان"       value={item.description ?? "—"} />
            {item.personName ? <DR label="الاسم / الجهة" value={item.personName} /> : null}
            <DR label="الخدمة"       value={isHot ? "هوتسبوت" : "برودباند"}    color={isHot ? Colors.primary : Colors.info} />
            <DR label="طريقة الدفع"  value={isCash ? "نقدي ✓" : "سلفة ↺"}     color={isCash ? Colors.success : Colors.warning} />
            <DR label="التاريخ"      value={formatDateTime(item.createdAt)} />
          </View>
          <TouchableOpacity style={[st.primaryBtn, { backgroundColor: Colors.primary }]} onPress={onClose}>
            <Text style={st.primaryBtnTxt}>إغلاق</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────
   Edit Modal
───────────────────────────────────────────────────── */
function EditModal({ item, token, onClose, onSuccess, onError }: {
  item: any | null; token: string | null;
  onClose: () => void; onSuccess: () => void; onError: (msg: string) => void;
}) {
  const [personName,   setPersonName]   = useState("");
  const [amount,       setAmount]       = useState("");
  const [category,     setCategory]     = useState<"hotspot" | "broadband">("hotspot");
  const [paymentType,  setPaymentType]  = useState<"cash" | "loan">("cash");
  const [description,  setDescription]  = useState("");
  const [saving,       setSaving]       = useState(false);

  React.useEffect(() => {
    if (item) {
      setPersonName(item.personName ?? "");
      setAmount(String(parseFloat(item.amount ?? 0)));
      setCategory(item.category === "broadband" ? "broadband" : "hotspot");
      setPaymentType((item.paymentType === "loan") ? "loan" : "cash");
      setDescription(item.description ?? "");
    }
  }, [item]);

  if (!item) return null;

  const handleSave = async () => {
    const parsedAmt = parseFloat(amount.replace(/[^0-9.]/g, ""));
    if (!parsedAmt || parsedAmt <= 0) return onError("أدخل مبلغاً صحيحاً");
    setSaving(true);
    try {
      await apiPut(`/transactions/${item.id}`, token, {
        amount: parsedAmt,
        personName: personName.trim() || undefined,
        category,
        paymentType,
        description: description.trim() || undefined,
      });
      onSuccess();
    } catch (e: any) {
      onError(e?.message ?? "فشل التعديل");
    } finally { setSaving(false); }
  };

  return (
    <Modal visible animationType="slide" transparent>
      <View style={st.sheetOverlay}>
        <View style={st.sheet}>
          <View style={st.sheetHdr}>
            <Text style={st.sheetTitle}>تعديل عملية البيع</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={Colors.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>

            <Text style={st.lbl}>الاسم / الجهة</Text>
            <TextInput style={st.inp} value={personName} onChangeText={setPersonName} textAlign="right"
              placeholder="اسم العميل أو الجهة" placeholderTextColor={Colors.textMuted} />

            <Text style={[st.lbl, { marginTop: 14 }]}>نوع الخدمة</Text>
            <View style={st.segRow}>
              {[["hotspot", "هوتسبوت", "wifi"] as const, ["broadband", "برودباند", "globe"] as const].map(([v, l, icon]) => (
                <TouchableOpacity
                  key={v} style={[st.segBtn, category === v && st.segBtnActive]}
                  onPress={() => setCategory(v)}
                >
                  <Ionicons name={icon} size={15} color={category === v ? Colors.primary : Colors.textSecondary} />
                  <Text style={[st.segBtnTxt, category === v && st.segBtnTxtActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[st.lbl, { marginTop: 14 }]}>المبلغ (ر.س)</Text>
            <TextInput style={st.inp} value={amount} onChangeText={setAmount} keyboardType="numeric"
              textAlign="right" placeholder="0" placeholderTextColor={Colors.textMuted} />

            <Text style={[st.lbl, { marginTop: 14 }]}>طريقة الدفع</Text>
            <View style={st.segRow}>
              {([["cash", "نقدي", Colors.success] as const, ["loan", "سلفة", Colors.warning] as const]).map(([v, l, c]) => (
                <TouchableOpacity
                  key={v} style={[st.segBtn, paymentType === v && { borderColor: c, backgroundColor: c + "18" }]}
                  onPress={() => setPaymentType(v)}
                >
                  <Text style={[st.segBtnTxt, paymentType === v && { color: c }]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[st.lbl, { marginTop: 14 }]}>البيان / الملاحظات</Text>
            <TextInput style={[st.inp, { height: 70 }]} value={description} onChangeText={setDescription}
              textAlign="right" multiline placeholder="وصف العملية..." placeholderTextColor={Colors.textMuted} />

            <View style={st.warnBox}>
              <Ionicons name="information-circle" size={15} color={Colors.warning} />
              <Text style={st.warnTxt}>
                {paymentType !== (item.paymentType === "loan" ? "loan" : "cash")
                  ? paymentType === "loan"
                    ? "سيتم تحويل العملية لسلفة وخصم المبلغ من الصندوق"
                    : "سيتم تحويل العملية لنقدي وحذف السلفة المرتبطة وإضافة المبلغ للصندوق"
                  : "سيُعدَّل الفرق تلقائياً على الصندوق أو السلف"}
              </Text>
            </View>

            <TouchableOpacity style={[st.primaryBtn, { backgroundColor: Colors.primary }, saving && { opacity: 0.5 }]}
              onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.primaryBtnTxt}>حفظ التعديل</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────
   Confirm Delete Modal
───────────────────────────────────────────────────── */
function ConfirmDelete({ item, onCancel, onConfirm, deleting }: {
  item: any | null; onCancel: () => void; onConfirm: () => void; deleting: boolean;
}) {
  if (!item) return null;
  const isCash = (item.paymentType ?? "cash") === "cash";
  return (
    <Modal visible animationType="fade" transparent>
      <View style={st.overlay}>
        <View style={st.alertBox}>
          <View style={[st.alertIcon, { backgroundColor: Colors.error + "20" }]}>
            <Ionicons name="trash" size={36} color={Colors.error} />
          </View>
          <Text style={st.alertTitle}>حذف عملية البيع؟</Text>
          <Text style={st.alertMsg}>
            {`سيتم حذف عملية بيع بقيمة `}
            <Text style={{ fontWeight: "800", color: Colors.error }}>{formatCurrency(parseFloat(item.amount ?? 0))}</Text>
            {`\nو${isCash ? "خصم المبلغ من الصندوق النقدي" : "حذف السلفة المرتبطة بها"}.`}
          </Text>
          <View style={st.confirmRow}>
            <TouchableOpacity style={[st.alertBtn, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }]} onPress={onCancel}>
              <Text style={[st.alertBtnTxt, { color: Colors.text }]}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.alertBtn, { backgroundColor: Colors.error, flex: 1 }]} onPress={onConfirm} disabled={deleting}>
              {deleting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.alertBtnTxt}>حذف</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────
   Detail Row helper
───────────────────────────────────────────────────── */
function DR({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={st.drRow}>
      <Text style={[st.drVal, color ? { color, fontWeight: "700" } : {}]}>{value}</Text>
      <Text style={st.drKey}>{label}</Text>
    </View>
  );
}

/* ═══════════════════════════════════════════════════
   الشاشة الرئيسية
═══════════════════════════════════════════════════ */
export default function SalesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [period,       setPeriod]       = useState<"day" | "week" | "month">("month");
  const [payType,      setPayType]      = useState("all");
  const [catType,      setCatType]      = useState("all");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);

  const [viewItem,   setViewItem]   = useState<any>(null);
  const [editItem,   setEditItem]   = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [deleting,   setDeleting]   = useState(false);

  const [alert, setAlert] = useState({ visible: false, title: "", message: "", color: Colors.success });
  const showAlert = (title: string, message: string, color = Colors.success) =>
    setAlert({ visible: true, title, message, color });

  const fetchSales = useCallback(async () => {
    try {
      const data = await apiGet("/transactions?type=sale&limit=500", token);
      setTransactions(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchSales(); }, [fetchSales]));

  const filterByPeriod = (items: any[]) => {
    const now = new Date();
    return items.filter(t => {
      const d = new Date(t.createdAt);
      if (period === "day")  return d.toDateString() === now.toDateString();
      if (period === "week") { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w; }
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  };

  const filtered = filterByPeriod(transactions)
    .filter(t => payType === "all" || (t.paymentType ?? "cash") === payType)
    .filter(t => catType === "all" || t.category === catType);

  const total     = filtered.reduce((s, t) => s + parseFloat(t.amount ?? 0), 0);
  const hotspot   = filtered.filter(t => t.category === "hotspot")  .reduce((s, t) => s + parseFloat(t.amount ?? 0), 0);
  const broadband = filtered.filter(t => t.category === "broadband").reduce((s, t) => s + parseFloat(t.amount ?? 0), 0);
  const cashTotal = filtered.filter(t => (t.paymentType ?? "cash") === "cash").reduce((s, t) => s + parseFloat(t.amount ?? 0), 0);
  const loanTotal = filtered.filter(t => t.paymentType === "loan").reduce((s, t) => s + parseFloat(t.amount ?? 0), 0);

  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      await apiDelete(`/transactions/${deleteItem.id}`, token);
      setDeleteItem(null);
      await fetchSales();
      showAlert("تم الحذف ✓", "تم حذف العملية وتحديث الأرقام تلقائياً");
    } catch (e: any) {
      setDeleteItem(null);
      showAlert("خطأ", e?.message ?? "فشل الحذف", Colors.error);
    } finally { setDeleting(false); }
  };

  const pt = Platform.OS === "web" ? 20 : insets.top;
  const pb = Platform.OS === "web" ? 40 : insets.bottom + 30;

  if (loading) {
    return (
      <View style={[st.container, { paddingTop: pt, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[st.container, { paddingTop: pt }]}>

      {/* ── Header ── */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={st.title}>سجل المبيعات</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ── فلتر الفترة ── */}
      <View style={st.filterRow}>
        {PERIODS.map(p => (
          <TouchableOpacity key={p.key} style={[st.filterBtn, period === p.key && st.filterBtnActive]}
            onPress={() => setPeriod(p.key as any)}>
            <Text style={[st.filterBtnTxt, period === p.key && st.filterBtnTxtActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[st.content, { paddingBottom: pb }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSales(); }} />}
      >

        {/* ── بطاقة الملخص ── */}
        <View style={st.summaryCard}>
          <Text style={st.summaryTitle}>إجمالي {PERIODS.find(p => p.key === period)?.label}</Text>
          <Text style={st.summaryTotal}>{formatCurrency(total)}</Text>
          <View style={st.summaryRow}>
            <View style={st.summaryItem}>
              <Ionicons name="wifi" size={14} color={Colors.primary} />
              <Text style={st.summaryItemLabel}>هوتسبوت</Text>
              <Text style={[st.summaryItemValue, { color: Colors.primary }]}>{formatCurrency(hotspot)}</Text>
            </View>
            <View style={st.summaryDivider} />
            <View style={st.summaryItem}>
              <Ionicons name="globe" size={14} color={Colors.info} />
              <Text style={st.summaryItemLabel}>برودباند</Text>
              <Text style={[st.summaryItemValue, { color: Colors.info }]}>{formatCurrency(broadband)}</Text>
            </View>
          </View>
          <View style={[st.summaryRow, { marginTop: 8, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 }]}>
            <View style={st.summaryItem}>
              <Ionicons name="cash" size={14} color={Colors.success} />
              <Text style={st.summaryItemLabel}>نقدي</Text>
              <Text style={[st.summaryItemValue, { color: Colors.success }]}>{formatCurrency(cashTotal)}</Text>
            </View>
            <View style={st.summaryDivider} />
            <View style={st.summaryItem}>
              <Ionicons name="receipt" size={14} color={Colors.warning} />
              <Text style={st.summaryItemLabel}>سلفة</Text>
              <Text style={[st.summaryItemValue, { color: Colors.warning }]}>{formatCurrency(loanTotal)}</Text>
            </View>
          </View>
        </View>

        {/* ── فلاتر إضافية ── */}
        <View style={st.subFiltersRow}>
          <View style={{ flex: 1 }}>
            <Text style={st.subFilterLabel}>نوع الدفع</Text>
            <View style={st.subFilterBtns}>
              {PAY_TYPES.map(p => (
                <TouchableOpacity key={p.key} style={[st.subBtn, payType === p.key && st.subBtnActive]}
                  onPress={() => setPayType(p.key)}>
                  <Text style={[st.subBtnTxt, payType === p.key && st.subBtnTxtActive]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.subFilterLabel}>الخدمة</Text>
            <View style={st.subFilterBtns}>
              {CATS.map(c => (
                <TouchableOpacity key={c.key} style={[st.subBtn, catType === c.key && st.subBtnActive]}
                  onPress={() => setCatType(c.key)}>
                  <Text style={[st.subBtnTxt, catType === c.key && st.subBtnTxtActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ── قائمة المعاملات ── */}
        {filtered.length === 0 ? (
          <View style={st.empty}>
            <Ionicons name="receipt-outline" size={48} color={Colors.textMuted} />
            <Text style={st.emptyTxt}>لا توجد مبيعات في هذه الفترة</Text>
          </View>
        ) : (
          <>
            <Text style={st.listHeader}>{filtered.length} معاملة</Text>
            {filtered.map(t => {
              const isHot  = t.category === "hotspot";
              const isCash = (t.paymentType ?? "cash") === "cash";
              return (
                <View key={t.id} style={st.txCard}>
                  {/* الوصف + المبلغ */}
                  <View style={st.txTop}>
                    <Text style={st.txDesc} numberOfLines={1}>{t.description}</Text>
                    <Text style={[st.txAmt, { color: Colors.success }]}>
                      {formatCurrency(parseFloat(t.amount ?? 0))}
                    </Text>
                  </View>
                  {t.personName ? <Text style={st.txPerson}>{t.personName}</Text> : null}

                  {/* التاريخ + التاقات */}
                  <View style={st.txFooter}>
                    <Text style={st.txDate}>{formatDateTime(t.createdAt)}</Text>
                    <View style={st.txTags}>
                      <View style={[st.txTag, { backgroundColor: (isHot ? Colors.primary : Colors.info) + "20" }]}>
                        <Ionicons name={isHot ? "wifi" : "globe"} size={11} color={isHot ? Colors.primary : Colors.info} />
                        <Text style={[st.txTagTxt, { color: isHot ? Colors.primary : Colors.info }]}>
                          {isHot ? "هوتسبوت" : "برودباند"}
                        </Text>
                      </View>
                      <View style={[st.txTag, { backgroundColor: (isCash ? Colors.success : Colors.warning) + "20" }]}>
                        <Ionicons name={isCash ? "cash" : "receipt"} size={11} color={isCash ? Colors.success : Colors.warning} />
                        <Text style={[st.txTagTxt, { color: isCash ? Colors.success : Colors.warning }]}>
                          {isCash ? "نقدي" : "سلفة"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* ── أزرار الإجراءات ── */}
                  <View style={st.actionsRow}>
                    <TouchableOpacity style={[st.actionBtn, { borderColor: Colors.primary + "50", backgroundColor: Colors.primary + "12" }]}
                      onPress={() => setViewItem(t)}>
                      <Ionicons name="eye-outline" size={14} color={Colors.primary} />
                      <Text style={[st.actionBtnTxt, { color: Colors.primary }]}>تفاصيل</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[st.actionBtn, { borderColor: Colors.warning + "50", backgroundColor: Colors.warning + "12" }]}
                      onPress={() => setEditItem(t)}>
                      <Ionicons name="create-outline" size={14} color={Colors.warning} />
                      <Text style={[st.actionBtnTxt, { color: Colors.warning }]}>تعديل</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[st.actionBtn, { borderColor: Colors.error + "50", backgroundColor: Colors.error + "12" }]}
                      onPress={() => setDeleteItem(t)}>
                      <Ionicons name="trash-outline" size={14} color={Colors.error} />
                      <Text style={[st.actionBtnTxt, { color: Colors.error }]}>حذف</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* ── Modals ── */}
      <DetailModal item={viewItem} onClose={() => setViewItem(null)} />

      <EditModal
        item={editItem} token={token}
        onClose={() => setEditItem(null)}
        onSuccess={() => { setEditItem(null); fetchSales(); showAlert("تم التعديل ✓", "تم تحديث العملية والأرقام المرتبطة"); }}
        onError={(msg) => { setEditItem(null); showAlert("خطأ", msg, Colors.error); }}
      />

      <ConfirmDelete
        item={deleteItem} deleting={deleting}
        onCancel={() => setDeleteItem(null)}
        onConfirm={handleDelete}
      />

      <AlertModal
        visible={alert.visible} title={alert.title} message={alert.message} color={alert.color}
        onClose={() => setAlert(a => ({ ...a, visible: false }))}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════
   Styles
═══════════════════════════════════════════════════ */
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },

  filterRow: { flexDirection: "row-reverse", padding: 14, gap: 8 },
  filterBtn: {
    flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterBtnTxt: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" },
  filterBtnTxtActive: { color: "#FFF" },

  content: { padding: 14, paddingTop: 0, gap: 8 },

  summaryCard: {
    backgroundColor: Colors.surface, borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: Colors.border, alignItems: "center",
  },
  summaryTitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  summaryTotal: { fontSize: 34, fontWeight: "800", color: Colors.success, marginBottom: 14 },
  summaryRow:   { flexDirection: "row-reverse", width: "100%" },
  summaryItem:  { flex: 1, alignItems: "center", gap: 4 },
  summaryItemLabel: { fontSize: 12, color: Colors.textMuted },
  summaryItemValue: { fontSize: 15, fontWeight: "700" },
  summaryDivider:   { width: 1, backgroundColor: Colors.border },

  subFiltersRow: { flexDirection: "row-reverse", gap: 10 },
  subFilterLabel: { fontSize: 11, color: Colors.textMuted, textAlign: "right", marginBottom: 6 },
  subFilterBtns:  { flexDirection: "row-reverse", gap: 4 },
  subBtn: {
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  subBtnActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  subBtnTxt:    { fontSize: 10, color: Colors.textSecondary, fontWeight: "600" },
  subBtnTxtActive: { color: Colors.primary },

  listHeader: { fontSize: 13, color: Colors.textMuted, textAlign: "right" },
  empty:    { alignItems: "center", marginTop: 50, gap: 12 },
  emptyTxt: { color: Colors.textMuted, fontSize: 14 },

  txCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border, gap: 6,
  },
  txTop:    { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start" },
  txDesc:   { fontSize: 14, color: Colors.text, flex: 1, textAlign: "right" },
  txAmt:    { fontSize: 15, fontWeight: "700", flexShrink: 0 },
  txPerson: { fontSize: 12, color: Colors.textSecondary, textAlign: "right" },
  txFooter: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  txDate:   { fontSize: 11, color: Colors.textMuted },
  txTags:   { flexDirection: "row-reverse", gap: 6 },
  txTag: {
    flexDirection: "row-reverse", alignItems: "center", gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  txTagTxt: { fontSize: 10, fontWeight: "600" },

  /* أزرار إجراءات داخل البطاقة */
  actionsRow: {
    flexDirection: "row-reverse", gap: 8,
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10,
  },
  actionBtn: {
    flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: 8, borderRadius: 9, borderWidth: 1,
  },
  actionBtnTxt: { fontSize: 11, fontWeight: "700" },

  /* Overlay / Modal */
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  alertBox: {
    backgroundColor: Colors.surface, borderRadius: 22, padding: 24,
    width: "100%", maxWidth: 340, alignItems: "center", gap: 12,
  },
  alertIcon:    { width: 68, height: 68, borderRadius: 34, justifyContent: "center", alignItems: "center" },
  alertTitle:   { fontSize: 17, fontWeight: "800", color: Colors.text, textAlign: "center" },
  alertMsg:     { fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  alertBtn:     { paddingVertical: 13, paddingHorizontal: 20, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  alertBtnTxt:  { color: "#fff", fontWeight: "700", fontSize: 14 },
  confirmRow:   { flexDirection: "row-reverse", gap: 10, width: "100%" },

  /* Sheet (slide up) */
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: "92%",
  },
  sheetHdr: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: Colors.text },

  drRow: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border + "60",
  },
  drKey: { fontSize: 13, color: Colors.textMuted },
  drVal: { fontSize: 14, fontWeight: "600", color: Colors.text, textAlign: "right", flex: 1, paddingRight: 8 },

  lbl: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary, textAlign: "right", marginBottom: 8 },
  inp: {
    backgroundColor: Colors.background, borderRadius: 12, padding: 13,
    color: Colors.text, fontSize: 15, borderWidth: 1, borderColor: Colors.border,
  },
  segRow:        { flexDirection: "row-reverse", gap: 8 },
  segBtn:        { flex: 1, paddingVertical: 11, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background },
  segBtnActive:  { borderColor: Colors.primary, backgroundColor: Colors.primary + "18" },
  segBtnTxt:     { fontSize: 13, fontWeight: "700", color: Colors.textSecondary },
  segBtnTxtActive: { color: Colors.primary },

  warnBox: {
    flexDirection: "row-reverse", gap: 6, alignItems: "flex-start",
    backgroundColor: Colors.warning + "15", borderRadius: 10, padding: 12, marginTop: 14,
  },
  warnTxt: { fontSize: 12, color: Colors.warning, textAlign: "right", flex: 1, lineHeight: 18 },

  primaryBtn:    { borderRadius: 14, padding: 15, alignItems: "center", marginTop: 16 },
  primaryBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
