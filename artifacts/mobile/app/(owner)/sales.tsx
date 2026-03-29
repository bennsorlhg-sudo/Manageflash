import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, RefreshControl, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiGet, formatCurrency, formatDateTime } from "@/utils/api";

const PERIODS   = [{ key: "day", label: "اليوم" }, { key: "week", label: "الأسبوع" }, { key: "month", label: "الشهر" }];
const PAY_TYPES = [{ key: "all", label: "الكل" }, { key: "cash", label: "نقدي" }, { key: "loan", label: "سلفة" }];
const CATS      = [{ key: "all", label: "الكل" }, { key: "hotspot", label: "هوتسبوت" }, { key: "broadband", label: "برودباند" }];

export default function OwnerSalesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [period,       setPeriod]       = useState<"day" | "week" | "month">("month");
  const [payType,      setPayType]      = useState("all");
  const [catType,      setCatType]      = useState("all");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [detailItem,   setDetailItem]   = useState<any>(null);

  const fetchSales = useCallback(async () => {
    try {
      const data = await apiGet("/transactions?type=sale&limit=500", token);
      setTransactions(Array.isArray(data) ? data : []);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  /* ─── فلترة ─── */
  const filterByPeriod = (items: any[]) => {
    const now = new Date();
    return items.filter(t => {
      const d = new Date(t.createdAt);
      if (period === "day")  return d.toDateString() === now.toDateString();
      if (period === "week") { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w; }
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  };

  const filtered  = filterByPeriod(transactions)
    .filter(t => payType === "all" || (t.paymentType ?? "cash") === payType)
    .filter(t => catType === "all" || t.category === catType);

  const total     = filtered.reduce((s, t) => s + parseFloat(t.amount ?? 0), 0);
  const hotspot   = filtered.filter(t => t.category === "hotspot")  .reduce((s, t) => s + parseFloat(t.amount ?? 0), 0);
  const broadband = filtered.filter(t => t.category === "broadband").reduce((s, t) => s + parseFloat(t.amount ?? 0), 0);
  const cashTotal = filtered.filter(t => (t.paymentType ?? "cash") === "cash").reduce((s, t) => s + parseFloat(t.amount ?? 0), 0);
  const loanTotal = filtered.filter(t => t.paymentType === "loan").reduce((s, t) => s + parseFloat(t.amount ?? 0), 0);

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center", paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
        <ActivityIndicator size="large" color={Colors.success} />
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-forward" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>سجل المبيعات</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── فلتر الفترة ── */}
      <View style={s.filterRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[s.filterBtn, period === p.key && s.filterBtnActive]}
            onPress={() => setPeriod(p.key as any)}
          >
            <Text style={[s.filterBtnTxt, period === p.key && s.filterBtnTxtActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: Platform.OS === "web" ? 40 : insets.bottom + 30 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSales(); }} />}
      >

        {/* ── بطاقة الملخص ── */}
        <View style={s.summaryCard}>
          <Text style={s.summaryTitle}>إجمالي {PERIODS.find(p => p.key === period)?.label}</Text>
          <Text style={s.summaryTotal}>{formatCurrency(total)}</Text>

          {/* هوتسبوت / برودباند */}
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Ionicons name="wifi" size={14} color={Colors.primary} />
              <Text style={s.summaryItemLabel}>هوتسبوت</Text>
              <Text style={[s.summaryItemValue, { color: Colors.primary }]}>{formatCurrency(hotspot)}</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Ionicons name="globe" size={14} color={Colors.info} />
              <Text style={s.summaryItemLabel}>برودباند</Text>
              <Text style={[s.summaryItemValue, { color: Colors.info }]}>{formatCurrency(broadband)}</Text>
            </View>
          </View>

          {/* نقدي / سلفة */}
          <View style={[s.summaryRow, { marginTop: 8, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 }]}>
            <View style={s.summaryItem}>
              <Ionicons name="cash" size={14} color={Colors.success} />
              <Text style={s.summaryItemLabel}>نقدي</Text>
              <Text style={[s.summaryItemValue, { color: Colors.success }]}>{formatCurrency(cashTotal)}</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Ionicons name="receipt" size={14} color={Colors.warning} />
              <Text style={s.summaryItemLabel}>سلفة</Text>
              <Text style={[s.summaryItemValue, { color: Colors.warning }]}>{formatCurrency(loanTotal)}</Text>
            </View>
          </View>
        </View>

        {/* ── فلاتر إضافية ── */}
        <View style={s.subFiltersRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.subFilterLabel}>نوع الدفع</Text>
            <View style={s.subFilterBtns}>
              {PAY_TYPES.map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[s.subBtn, payType === p.key && s.subBtnActive]}
                  onPress={() => setPayType(p.key)}
                >
                  <Text style={[s.subBtnTxt, payType === p.key && s.subBtnTxtActive]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.subFilterLabel}>الخدمة</Text>
            <View style={s.subFilterBtns}>
              {CATS.map(c => (
                <TouchableOpacity
                  key={c.key}
                  style={[s.subBtn, catType === c.key && s.subBtnActive]}
                  onPress={() => setCatType(c.key)}
                >
                  <Text style={[s.subBtnTxt, catType === c.key && s.subBtnTxtActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ── قائمة المعاملات ── */}
        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="receipt-outline" size={48} color={Colors.textMuted} />
            <Text style={s.emptyTxt}>لا توجد مبيعات في هذه الفترة</Text>
          </View>
        ) : (
          <>
            <Text style={s.listHeader}>{filtered.length} معاملة</Text>
            {filtered.map(t => {
              const isHotspot = t.category === "hotspot";
              const isCash    = (t.paymentType ?? "cash") === "cash";
              return (
                <TouchableOpacity key={t.id} style={s.txCard} onPress={() => setDetailItem(t)} activeOpacity={0.8}>
                  {/* الوصف + المبلغ */}
                  <View style={s.txTop}>
                    <Text style={s.txDesc} numberOfLines={2}>{t.description}</Text>
                    <Text style={[s.txAmt, { color: Colors.success }]}>
                      {formatCurrency(parseFloat(t.amount ?? 0))}
                    </Text>
                  </View>

                  {/* الاسم */}
                  {t.personName && t.personName !== t.description && (
                    <Text style={s.txPerson}>{t.personName}</Text>
                  )}

                  {/* التاريخ + التاقات */}
                  <View style={s.txFooter}>
                    <Text style={s.txDate}>{formatDateTime(t.createdAt)}</Text>
                    <View style={s.txTags}>
                      <View style={[s.txTag, { backgroundColor: (isHotspot ? Colors.primary : Colors.info) + "20" }]}>
                        <Ionicons name={isHotspot ? "wifi" : "globe"} size={11} color={isHotspot ? Colors.primary : Colors.info} />
                        <Text style={[s.txTagTxt, { color: isHotspot ? Colors.primary : Colors.info }]}>
                          {isHotspot ? "هوتسبوت" : "برودباند"}
                        </Text>
                      </View>
                      <View style={[s.txTag, { backgroundColor: (isCash ? Colors.success : Colors.warning) + "20" }]}>
                        <Ionicons name={isCash ? "cash" : "receipt"} size={11} color={isCash ? Colors.success : Colors.warning} />
                        <Text style={[s.txTagTxt, { color: isCash ? Colors.success : Colors.warning }]}>
                          {isCash ? "نقدي" : "سلفة"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

      </ScrollView>

      {/* ── Modal التفاصيل ── */}
      <Modal visible={!!detailItem} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>تفاصيل البيع</Text>
              <TouchableOpacity onPress={() => setDetailItem(null)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {detailItem && (() => {
              const isHotspot = detailItem.category === "hotspot";
              const isCash    = (detailItem.paymentType ?? "cash") === "cash";
              return (
                <View style={{ gap: 12 }}>
                  <DetailRow label="المبلغ"     value={formatCurrency(parseFloat(detailItem.amount ?? 0))} color={Colors.success} />
                  <DetailRow label="البيان"     value={detailItem.description ?? "—"} />
                  {detailItem.personName && <DetailRow label="الاسم" value={detailItem.personName} />}
                  <DetailRow
                    label="الخدمة"
                    value={isHotspot ? "هوتسبوت" : "برودباند"}
                    color={isHotspot ? Colors.primary : Colors.info}
                  />
                  <DetailRow
                    label="طريقة الدفع"
                    value={isCash ? "نقدي" : "سلفة"}
                    color={isCash ? Colors.success : Colors.warning}
                  />
                  <DetailRow label="التاريخ" value={formatDateTime(detailItem.createdAt)} />
                  {detailItem.notes && <DetailRow label="ملاحظات" value={detailItem.notes} />}
                </View>
              );
            })()}
            <TouchableOpacity
              style={[s.modalCloseBtn, { backgroundColor: Colors.success }]}
              onPress={() => setDetailItem(null)}
            >
              <Text style={s.modalCloseBtnTxt}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={s.detailRow}>
      <Text style={[s.detailVal, color ? { color } : {}]}>{value}</Text>
      <Text style={s.detailKey}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "bold", color: Colors.text },

  filterRow: { flexDirection: "row-reverse", padding: 14, gap: 8 },
  filterBtn: {
    flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  filterBtnActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  filterBtnTxt:   { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" },
  filterBtnTxtActive: { color: "#FFF" },

  content: { padding: 14, paddingTop: 0, gap: 6 },

  summaryCard: {
    backgroundColor: Colors.surface, borderRadius: 18, padding: 18,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center",
  },
  summaryTitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  summaryTotal: { fontSize: 34, fontWeight: "800", color: Colors.success, marginBottom: 14 },
  summaryRow:  { flexDirection: "row-reverse", width: "100%" },
  summaryItem: { flex: 1, alignItems: "center", gap: 4 },
  summaryItemLabel: { fontSize: 12, color: Colors.textMuted },
  summaryItemValue: { fontSize: 15, fontWeight: "700" },
  summaryDivider:   { width: 1, backgroundColor: Colors.border },

  subFiltersRow: { flexDirection: "row-reverse", gap: 10, marginBottom: 8 },
  subFilterLabel: { fontSize: 11, color: Colors.textMuted, textAlign: "right", marginBottom: 6 },
  subFilterBtns:  { flexDirection: "row-reverse", gap: 4 },
  subBtn: {
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  subBtnActive: { backgroundColor: Colors.success + "22", borderColor: Colors.success },
  subBtnTxt:    { fontSize: 10, color: Colors.textSecondary, fontWeight: "600" },
  subBtnTxtActive: { color: Colors.success },

  listHeader: { fontSize: 13, color: Colors.textMuted, textAlign: "right", marginBottom: 6 },
  empty: { alignItems: "center", marginTop: 50, gap: 12 },
  emptyTxt: { color: Colors.textMuted, fontSize: 14 },

  txCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  txTop: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 4,
  },
  txDesc:   { fontSize: 14, color: Colors.text, flex: 1, textAlign: "right" },
  txAmt:    { fontSize: 15, fontWeight: "700", flexShrink: 0 },
  txPerson: { fontSize: 12, color: Colors.textSecondary, textAlign: "right", marginBottom: 4 },
  txFooter: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "center", marginTop: 8,
  },
  txDate:   { fontSize: 11, color: Colors.textMuted },
  txTags:   { flexDirection: "row-reverse", gap: 6 },
  txTag: {
    flexDirection: "row-reverse", alignItems: "center", gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  txTagTxt: { fontSize: 10, fontWeight: "600" },

  /* Modal */
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 24, gap: 16,
  },
  modalHeader: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: Colors.text },
  detailRow:  {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border + "80",
  },
  detailKey: { fontSize: 13, color: Colors.textSecondary },
  detailVal: { fontSize: 14, fontWeight: "600", color: Colors.text },
  modalCloseBtn:    { borderRadius: 12, padding: 14, alignItems: "center", marginTop: 4 },
  modalCloseBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
