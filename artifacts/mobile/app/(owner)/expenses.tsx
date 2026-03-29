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
import { apiGet, formatCurrency, formatDate, formatDateTime } from "@/utils/api";

const PAYMENT_TYPE_LABELS: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  cash: { label: "نقد",  color: Colors.error,   icon: "cash"    },
  debt: { label: "دين",  color: Colors.warning, icon: "receipt" },
  loan: { label: "سلفة", color: Colors.info,    icon: "time"    },
};

const FILTERS = [{ key: "day", label: "اليوم" }, { key: "week", label: "الأسبوع" }, { key: "month", label: "الشهر" }];

export default function OwnerExpensesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [filter,       setFilter]       = useState<"day" | "week" | "month">("month");
  const [detailItem,   setDetailItem]   = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const txs = await apiGet("/transactions?type=expense&limit=500", token);
      setTransactions(Array.isArray(txs) ? txs : []);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── فلترة الفترة الزمنية ─── */
  const filterByPeriod = (items: any[]) => {
    const now = new Date();
    return items.filter(t => {
      const d = new Date(t.createdAt);
      if (filter === "day")  return d.toDateString() === now.toDateString();
      if (filter === "week") { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w; }
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  };

  const filtered     = filterByPeriod(transactions);
  const totalExpense = filtered.reduce((s, t) => s + parseFloat(t.amount ?? 0), 0);
  const cashTotal    = filtered.filter(t => t.paymentType === "cash").reduce((s, t) => s + parseFloat(t.amount ?? 0), 0);
  const debtTotal    = filtered.filter(t => t.paymentType === "debt").reduce((s, t) => s + parseFloat(t.amount ?? 0), 0);

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center", paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
        <ActivityIndicator size="large" color={Colors.error} />
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
        <Text style={s.title}>سجل المصاريف</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── فلتر الفترة ── */}
      <View style={s.filterRow}>
        {FILTERS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[s.filterBtn, filter === p.key && s.filterBtnActive]}
            onPress={() => setFilter(p.key as any)}
          >
            <Text style={[s.filterBtnTxt, filter === p.key && s.filterBtnTxtActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── بطاقات الملخص ── */}
      <View style={s.summaryRow}>
        <View style={s.summaryCard}>
          <Text style={s.summaryLbl}>الإجمالي</Text>
          <Text style={[s.summaryVal, { color: Colors.error }]}>{formatCurrency(totalExpense)}</Text>
        </View>
        <View style={s.summaryCard}>
          <Text style={s.summaryLbl}>نقداً</Text>
          <Text style={[s.summaryVal, { color: Colors.error }]}>{formatCurrency(cashTotal)}</Text>
        </View>
        <View style={s.summaryCard}>
          <Text style={s.summaryLbl}>ديناً</Text>
          <Text style={[s.summaryVal, { color: Colors.warning }]}>{formatCurrency(debtTotal)}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: Platform.OS === "web" ? 40 : insets.bottom + 30 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
      >
        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="receipt-outline" size={48} color={Colors.textMuted} />
            <Text style={s.emptyTxt}>لا توجد مصاريف في هذه الفترة</Text>
          </View>
        ) : (
          <>
            <Text style={s.listHeader}>{filtered.length} مصروف</Text>
            {filtered.map(tx => {
              const pt = PAYMENT_TYPE_LABELS[tx.paymentType ?? "cash"] ?? PAYMENT_TYPE_LABELS.cash;
              return (
                <TouchableOpacity key={tx.id} style={s.txCard} onPress={() => setDetailItem(tx)} activeOpacity={0.8}>
                  {/* الوصف + المبلغ */}
                  <View style={s.txTop}>
                    <Text style={[s.txAmt, { color: Colors.error }]}>
                      {formatCurrency(parseFloat(tx.amount ?? 0))}
                    </Text>
                    <Text style={s.txDesc} numberOfLines={2}>{tx.description}</Text>
                  </View>

                  {/* الجهة */}
                  {tx.personName && (
                    <Text style={s.txPerson}>{tx.personName}</Text>
                  )}

                  {/* طريقة الدفع + التاريخ */}
                  <View style={s.txFooter}>
                    <Text style={s.txDate}>{formatDate(tx.createdAt)}</Text>
                    <View style={[s.ptBadge, { backgroundColor: pt.color + "18" }]}>
                      <Ionicons name={pt.icon} size={11} color={pt.color} />
                      <Text style={[s.ptBadgeTxt, { color: pt.color }]}>{pt.label}</Text>
                    </View>
                  </View>

                  {/* زر التفاصيل */}
                  <TouchableOpacity style={s.detailBtn} onPress={() => setDetailItem(tx)}>
                    <Ionicons name="information-circle-outline" size={13} color={Colors.primary} />
                    <Text style={s.detailBtnTxt}>تفاصيل</Text>
                  </TouchableOpacity>
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
              <Text style={s.modalTitle}>تفاصيل المصروف</Text>
              <TouchableOpacity onPress={() => setDetailItem(null)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {detailItem && (() => {
              const pt = PAYMENT_TYPE_LABELS[detailItem.paymentType ?? "cash"] ?? PAYMENT_TYPE_LABELS.cash;
              return (
                <View style={{ gap: 10 }}>
                  <DetailRow
                    label="المبلغ"
                    value={formatCurrency(parseFloat(detailItem.amount ?? 0))}
                    color={Colors.error}
                  />
                  <DetailRow label="البيان" value={detailItem.description ?? "—"} />
                  {detailItem.personName && (
                    <DetailRow label="الجهة" value={detailItem.personName} />
                  )}
                  <View style={s.detailRow}>
                    <View style={[s.ptBadge, { backgroundColor: pt.color + "18" }]}>
                      <Ionicons name={pt.icon} size={11} color={pt.color} />
                      <Text style={[s.ptBadgeTxt, { color: pt.color }]}>{pt.label}</Text>
                    </View>
                    <Text style={s.detailKey}>طريقة الدفع</Text>
                  </View>
                  <DetailRow label="التاريخ" value={formatDateTime(detailItem.createdAt)} />
                  {detailItem.notes && (
                    <DetailRow label="ملاحظات" value={detailItem.notes} />
                  )}
                </View>
              );
            })()}
            <TouchableOpacity
              style={[s.closeBtn, { backgroundColor: Colors.error }]}
              onPress={() => setDetailItem(null)}
            >
              <Text style={s.closeBtnTxt}>إغلاق</Text>
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
  filterBtnActive: { backgroundColor: Colors.error, borderColor: Colors.error },
  filterBtnTxt:    { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" },
  filterBtnTxtActive: { color: "#FFF" },

  summaryRow: { flexDirection: "row-reverse", paddingHorizontal: 14, gap: 8, marginBottom: 4 },
  summaryCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 4,
  },
  summaryLbl: { fontSize: 11, color: Colors.textMuted },
  summaryVal: { fontSize: 15, fontWeight: "800" },

  content: { padding: 14, paddingTop: 10, gap: 6 },
  listHeader: { fontSize: 13, color: Colors.textMuted, textAlign: "right", marginBottom: 4 },
  empty: { alignItems: "center", marginTop: 50, gap: 12 },
  emptyTxt: { color: Colors.textMuted, fontSize: 14 },

  txCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  txTop: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  txDesc: { fontSize: 14, color: Colors.text, flex: 1, textAlign: "right" },
  txAmt:  { fontSize: 15, fontWeight: "700", flexShrink: 0 },
  txPerson: { fontSize: 12, color: Colors.textSecondary, textAlign: "right", marginBottom: 4 },
  txFooter: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "center", marginTop: 6,
  },
  txDate: { fontSize: 11, color: Colors.textMuted },
  ptBadge: {
    flexDirection: "row-reverse", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7,
  },
  ptBadgeTxt: { fontSize: 11, fontWeight: "700" },
  detailBtn: {
    flexDirection: "row-reverse", alignItems: "center", gap: 4,
    marginTop: 8, alignSelf: "flex-end",
  },
  detailBtnTxt: { fontSize: 12, color: Colors.primary, fontWeight: "600" },

  /* Modal */
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 24, gap: 14,
  },
  modalHeader: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: Colors.text },
  detailRow: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border + "60",
  },
  detailKey: { fontSize: 13, color: Colors.textSecondary },
  detailVal: { fontSize: 14, fontWeight: "600", color: Colors.text },
  closeBtn:    { borderRadius: 12, padding: 14, alignItems: "center", marginTop: 4 },
  closeBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
