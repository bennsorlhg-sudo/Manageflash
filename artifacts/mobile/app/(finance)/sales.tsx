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

/* ─── ثوابت ─── */
type Period = "day" | "week" | "month" | "custom";

const PERIODS: { key: Period; label: string }[] = [
  { key: "month",  label: "الشهر"  },
  { key: "week",   label: "الأسبوع" },
  { key: "day",    label: "اليوم"  },
  { key: "custom", label: "تحديد"  },
];
const CAT_FILTERS   = [{ key: "all", label: "الكل" }, { key: "hotspot", label: "هوتسبوت" }, { key: "broadband", label: "برودباند" }];
const PAY_FILTERS   = [{ key: "all", label: "الكل" }, { key: "cash",    label: "نقد"      }, { key: "loan",      label: "سلفة"     }];

/* ─── مساعد: مكون صف تفاصيل ─── */
function DR({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={st.drRow}>
      <Text style={[st.drVal, color ? { color, fontWeight: "700" } : {}]}>{value}</Text>
      <Text style={st.drKey}>{label}</Text>
    </View>
  );
}

/* ─── Modal تنبيه ─── */
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

/* ─── Modal تفاصيل ─── */
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
            <DR label="الخدمة"       value={isHot ? "هوتسبوت" : "برودباند"} color={isHot ? Colors.primary : Colors.info} />
            <DR label="طريقة الدفع"  value={isCash ? "نقدي ✓" : "سلفة ↺"}  color={isCash ? Colors.success : Colors.warning} />
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

/* ─── Modal تعديل ─── */
function EditModal({ item, token, onClose, onSuccess, onError }: {
  item: any | null; token: string | null;
  onClose: () => void; onSuccess: () => void; onError: (msg: string) => void;
}) {
  const [personName,  setPersonName]  = useState("");
  const [amount,      setAmount]      = useState("");
  const [category,    setCategory]    = useState<"hotspot" | "broadband">("hotspot");
  const [paymentType, setPaymentType] = useState<"cash" | "loan">("cash");
  const [description, setDescription] = useState("");
  const [saving,      setSaving]      = useState(false);

  React.useEffect(() => {
    if (item) {
      setPersonName(item.personName ?? "");
      setAmount(String(parseFloat(item.amount ?? 0)));
      setCategory(item.category === "broadband" ? "broadband" : "hotspot");
      setPaymentType(item.paymentType === "loan" ? "loan" : "cash");
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
        amount: parsedAmt, personName: personName.trim() || undefined,
        category, paymentType, description: description.trim() || undefined,
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
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={st.lbl}>الاسم / الجهة</Text>
            <TextInput style={st.inp} value={personName} onChangeText={setPersonName} textAlign="right"
              placeholder="اسم العميل" placeholderTextColor={Colors.textMuted} />

            <Text style={[st.lbl, { marginTop: 14 }]}>نوع الخدمة</Text>
            <View style={st.segRow}>
              {([["hotspot","هوتسبوت","wifi"],["broadband","برودباند","globe"]] as const).map(([v,l,icon]) => (
                <TouchableOpacity key={v} style={[st.segBtn, category === v && st.segBtnActive]} onPress={() => setCategory(v)}>
                  <Ionicons name={icon} size={15} color={category === v ? Colors.primary : Colors.textSecondary} />
                  <Text style={[st.segBtnTxt, category === v && st.segBtnTxtActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[st.lbl, { marginTop: 14 }]}>المبلغ (ر.س)</Text>
            <TextInput style={st.inp} value={amount} onChangeText={setAmount}
              keyboardType="decimal-pad" textAlign="right" placeholder="0" placeholderTextColor={Colors.textMuted} />

            <Text style={[st.lbl, { marginTop: 14 }]}>طريقة الدفع</Text>
            <View style={st.segRow}>
              {([["cash","نقدي",Colors.success],["loan","سلفة",Colors.warning]] as const).map(([v,l,c]) => (
                <TouchableOpacity key={v}
                  style={[st.segBtn, paymentType === v && { borderColor: c, backgroundColor: c + "18" }]}
                  onPress={() => setPaymentType(v)}>
                  <Text style={[st.segBtnTxt, paymentType === v && { color: c }]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[st.lbl, { marginTop: 14 }]}>البيان / الملاحظات</Text>
            <TextInput style={[st.inp, { height: 70 }]} value={description} onChangeText={setDescription}
              textAlign="right" multiline placeholder="وصف العملية..." placeholderTextColor={Colors.textMuted} />

            <View style={st.warnBox}>
              <Ionicons name="information-circle" size={15} color={Colors.warning} />
              <Text style={st.warnTxt}>سيُعدَّل الفرق تلقائياً على الصندوق أو السلف</Text>
            </View>

            <TouchableOpacity
              style={[st.primaryBtn, { backgroundColor: Colors.primary }, saving && { opacity: 0.5 }]}
              onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.primaryBtnTxt}>حفظ التعديل</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Modal تأكيد الحذف ─── */
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
            <TouchableOpacity
              style={[st.alertBtn, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }]}
              onPress={onCancel}>
              <Text style={[st.alertBtnTxt, { color: Colors.text }]}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.alertBtn, { backgroundColor: Colors.error, flex: 1 }]}
              onPress={onConfirm} disabled={deleting}>
              {deleting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.alertBtnTxt}>حذف</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   الشاشة الرئيسية
═══════════════════════════════════════════════════ */
export default function SalesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [period,       setPeriod]       = useState<Period>("month");
  const [fromDate,     setFromDate]     = useState(""); /* YYYY-MM-DD */
  const [toDate,       setToDate]       = useState("");
  const [catType,      setCatType]      = useState("all");
  const [payType,      setPayType]      = useState("all");
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
      /* جلب المبيعات — نستثني تحصيل السلف (paymentType=collect) لأنها في العمليات */
      const data = await apiGet("/transactions?type=sale&limit=500", token);
      const all  = Array.isArray(data) ? data : [];
      setTransactions(all.filter((t: any) => t.paymentType !== "collect"));
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchSales(); }, [fetchSales]));

  /* ─── فلترة بالفترة ─── */
  const filterByPeriod = (items: any[]) => {
    const now = new Date();
    return items.filter(t => {
      const d = new Date(t.createdAt);
      if (period === "day")   return d.toDateString() === now.toDateString();
      if (period === "week")  { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w; }
      if (period === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (period === "custom") {
        const from = fromDate ? new Date(fromDate + "T00:00:00") : null;
        const to   = toDate   ? new Date(toDate   + "T23:59:59") : null;
        if (from && d < from) return false;
        if (to   && d > to)   return false;
        return true;
      }
      return true;
    });
  };

  /* ─── البيانات المُعالَجة ─── */
  const periodItems = filterByPeriod(transactions);

  /* ملخص الفترة (بصرف النظر عن فلاتر الخدمة/الدفع) */
  const bbCash  = periodItems.filter(t => t.category === "broadband" && (t.paymentType ?? "cash") === "cash").reduce((s,t) => s + parseFloat(t.amount ?? 0), 0);
  const bbLoan  = periodItems.filter(t => t.category === "broadband" && t.paymentType === "loan").reduce((s,t) => s + parseFloat(t.amount ?? 0), 0);
  const hotCash = periodItems.filter(t => t.category === "hotspot"   && (t.paymentType ?? "cash") === "cash").reduce((s,t) => s + parseFloat(t.amount ?? 0), 0);
  const hotLoan = periodItems.filter(t => t.category === "hotspot"   && t.paymentType === "loan").reduce((s,t) => s + parseFloat(t.amount ?? 0), 0);
  const totalPeriod = bbCash + bbLoan + hotCash + hotLoan;

  /* القائمة النهائية بعد كل الفلاتر */
  const filtered = periodItems
    .filter(t => catType === "all" || t.category === catType)
    .filter(t => payType === "all" || (t.paymentType ?? "cash") === payType);

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

  const periodLabel = PERIODS.find(p => p.key === period)?.label ?? "";

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
      <View style={st.periodRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[st.periodBtn, period === p.key && st.periodBtnActive]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[st.periodBtnTxt, period === p.key && st.periodBtnTxtActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── تحديد تاريخ مخصص ── */}
      {period === "custom" && (
        <View style={st.dateRow}>
          <View style={st.dateField}>
            <Text style={st.dateLabel}>إلى</Text>
            <TextInput
              style={st.dateInput}
              value={toDate}
              onChangeText={setToDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
              textAlign="right"
            />
          </View>
          <Ionicons name="arrow-back" size={16} color={Colors.textMuted} />
          <View style={st.dateField}>
            <Text style={st.dateLabel}>من</Text>
            <TextInput
              style={st.dateInput}
              value={fromDate}
              onChangeText={setFromDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
              textAlign="right"
            />
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[st.content, { paddingBottom: pb }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSales(); }} />}
      >

        {/* ══ لوحة الملخص ══ */}
        <View style={st.summaryCard}>

          {/* الإجمالي */}
          <Text style={st.summaryLabel}>إجمالي {periodLabel}</Text>
          <Text style={st.summaryTotal}>{formatCurrency(totalPeriod)}</Text>

          {/* 2×2 شبكة: برودباند | هوتسبوت */}
          <View style={st.summaryGrid}>

            {/* برودباند */}
            <View style={[st.summaryCell, { borderColor: Colors.info + "40", backgroundColor: Colors.info + "08" }]}>
              <View style={st.summaryCellHdr}>
                <Ionicons name="globe" size={13} color={Colors.info} />
                <Text style={[st.summaryCellTitle, { color: Colors.info }]}>برودباند</Text>
              </View>
              <View style={st.summaryCellRow}>
                <Text style={st.summaryCellKey}>نقد</Text>
                <Text style={[st.summaryCellVal, { color: Colors.success }]}>{formatCurrency(bbCash)}</Text>
              </View>
              <View style={st.summaryCellRow}>
                <Text style={st.summaryCellKey}>سلفة</Text>
                <Text style={[st.summaryCellVal, { color: Colors.warning }]}>{formatCurrency(bbLoan)}</Text>
              </View>
              <View style={[st.summaryCellRow, { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 4, marginTop: 2 }]}>
                <Text style={[st.summaryCellKey, { fontWeight: "700" }]}>المجموع</Text>
                <Text style={[st.summaryCellVal, { color: Colors.info, fontWeight: "800" }]}>{formatCurrency(bbCash + bbLoan)}</Text>
              </View>
            </View>

            {/* هوتسبوت */}
            <View style={[st.summaryCell, { borderColor: Colors.primary + "40", backgroundColor: Colors.primary + "08" }]}>
              <View style={st.summaryCellHdr}>
                <Ionicons name="wifi" size={13} color={Colors.primary} />
                <Text style={[st.summaryCellTitle, { color: Colors.primary }]}>هوتسبوت</Text>
              </View>
              <View style={st.summaryCellRow}>
                <Text style={st.summaryCellKey}>نقد</Text>
                <Text style={[st.summaryCellVal, { color: Colors.success }]}>{formatCurrency(hotCash)}</Text>
              </View>
              <View style={st.summaryCellRow}>
                <Text style={st.summaryCellKey}>سلفة</Text>
                <Text style={[st.summaryCellVal, { color: Colors.warning }]}>{formatCurrency(hotLoan)}</Text>
              </View>
              <View style={[st.summaryCellRow, { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 4, marginTop: 2 }]}>
                <Text style={[st.summaryCellKey, { fontWeight: "700" }]}>المجموع</Text>
                <Text style={[st.summaryCellVal, { color: Colors.primary, fontWeight: "800" }]}>{formatCurrency(hotCash + hotLoan)}</Text>
              </View>
            </View>

          </View>
        </View>

        {/* ══ فلاتر الخدمة والدفع ══ */}
        <View style={st.filtersRow}>
          <View style={st.filterGroup}>
            <Text style={st.filterGroupLabel}>نوع الخدمة</Text>
            <View style={st.filterGroupBtns}>
              {CAT_FILTERS.map(c => (
                <TouchableOpacity
                  key={c.key}
                  style={[st.subBtn, catType === c.key && st.subBtnActive]}
                  onPress={() => setCatType(c.key)}
                >
                  <Text style={[st.subBtnTxt, catType === c.key && st.subBtnTxtActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={st.filtersDivider} />
          <View style={st.filterGroup}>
            <Text style={st.filterGroupLabel}>نوع الدفع</Text>
            <View style={st.filterGroupBtns}>
              {PAY_FILTERS.map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[st.subBtn, payType === p.key && st.subBtnActive]}
                  onPress={() => setPayType(p.key)}
                >
                  <Text style={[st.subBtnTxt, payType === p.key && st.subBtnTxtActive]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ══ قائمة المعاملات ══ */}
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
                  <View style={st.txTop}>
                    <Text style={st.txDesc} numberOfLines={1}>{t.description}</Text>
                    <Text style={[st.txAmt, { color: Colors.success }]}>
                      {formatCurrency(parseFloat(t.amount ?? 0))}
                    </Text>
                  </View>
                  {t.personName ? <Text style={st.txPerson}>{t.personName}</Text> : null}
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
                  <View style={st.actionsRow}>
                    <TouchableOpacity
                      style={[st.actionBtn, { borderColor: Colors.primary + "50", backgroundColor: Colors.primary + "12" }]}
                      onPress={() => setViewItem(t)}>
                      <Ionicons name="eye-outline" size={14} color={Colors.primary} />
                      <Text style={[st.actionBtnTxt, { color: Colors.primary }]}>تفاصيل</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[st.actionBtn, { borderColor: Colors.warning + "50", backgroundColor: Colors.warning + "12" }]}
                      onPress={() => setEditItem(t)}>
                      <Ionicons name="create-outline" size={14} color={Colors.warning} />
                      <Text style={[st.actionBtnTxt, { color: Colors.warning }]}>تعديل</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[st.actionBtn, { borderColor: Colors.error + "50", backgroundColor: Colors.error + "12" }]}
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
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },

  /* ─ فلتر الفترة ─ */
  periodRow: {
    flexDirection: "row-reverse", paddingHorizontal: 14, paddingVertical: 10, gap: 6,
  },
  periodBtn: {
    flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  periodBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  periodBtnTxt:    { fontSize: 12, color: Colors.textSecondary, fontWeight: "600" },
  periodBtnTxtActive: { color: "#FFF" },

  /* ─ تاريخ مخصص ─ */
  dateRow: {
    flexDirection: "row-reverse", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingBottom: 10,
  },
  dateField: { flex: 1 },
  dateLabel: { fontSize: 11, color: Colors.textMuted, textAlign: "right", marginBottom: 4 },
  dateInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, color: Colors.text,
    fontSize: 13, backgroundColor: Colors.surface,
  },

  content: { padding: 14, paddingTop: 0, gap: 10 },

  /* ─ ملخص ─ */
  summaryCard: {
    backgroundColor: Colors.surface, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: Colors.border, gap: 10,
  },
  summaryLabel: { fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  summaryTotal: { fontSize: 32, fontWeight: "800", color: Colors.success, textAlign: "center" },

  summaryGrid: { flexDirection: "row-reverse", gap: 10 },
  summaryCell: {
    flex: 1, borderRadius: 12, borderWidth: 1, padding: 10, gap: 5,
  },
  summaryCellHdr: { flexDirection: "row-reverse", alignItems: "center", gap: 5, marginBottom: 4 },
  summaryCellTitle: { fontSize: 12, fontWeight: "700" },
  summaryCellRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  summaryCellKey: { fontSize: 11, color: Colors.textMuted },
  summaryCellVal: { fontSize: 12, fontWeight: "700", color: Colors.text },

  /* ─ فلاتر ─ */
  filtersRow: {
    flexDirection: "row-reverse", backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    padding: 12, gap: 8, alignItems: "flex-start",
  },
  filterGroup:     { flex: 1 },
  filterGroupLabel:{ fontSize: 11, color: Colors.textMuted, textAlign: "right", marginBottom: 6 },
  filterGroupBtns: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 4 },
  filtersDivider:  { width: 1, backgroundColor: Colors.border, marginVertical: 4, alignSelf: "stretch" },
  subBtn: {
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  subBtnActive:    { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  subBtnTxt:       { fontSize: 11, color: Colors.textSecondary, fontWeight: "600" },
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
  txTag:    { flexDirection: "row-reverse", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  txTagTxt: { fontSize: 10, fontWeight: "600" },
  actionsRow: {
    flexDirection: "row-reverse", gap: 8,
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10,
  },
  actionBtn: {
    flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: 8, borderRadius: 9, borderWidth: 1,
  },
  actionBtnTxt: { fontSize: 11, fontWeight: "700" },

  /* ─ Overlay / Modal ─ */
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
  confirmRow:   { flexDirection: "row-reverse", gap: 10, width: "100%" },
  alertBtn:     { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  alertBtnTxt:  { color: "#fff", fontSize: 14, fontWeight: "700" },

  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: "90%", gap: 14,
  },
  sheetHdr: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: Colors.text },

  drRow: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  drKey: { fontSize: 13, color: Colors.textMuted },
  drVal: { fontSize: 14, color: Colors.text, fontWeight: "600", textAlign: "left", flex: 1, marginRight: 12 },

  lbl: { fontSize: 13, color: Colors.textSecondary, textAlign: "right" },
  inp: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    color: Colors.text, fontSize: 14, backgroundColor: Colors.background,
  },
  segRow: { flexDirection: "row-reverse", gap: 8 },
  segBtn: {
    flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 9, borderRadius: 9,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  segBtnActive:    { borderColor: Colors.primary, backgroundColor: Colors.primary + "18" },
  segBtnTxt:       { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" },
  segBtnTxtActive: { color: Colors.primary },

  warnBox: {
    flexDirection: "row-reverse", gap: 6, alignItems: "center",
    backgroundColor: Colors.warning + "15", borderRadius: 8, padding: 10,
  },
  warnTxt: { fontSize: 12, color: Colors.warning, flex: 1, textAlign: "right" },

  primaryBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 6 },
  primaryBtnTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
