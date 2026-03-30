import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPut, apiDelete, formatCurrency, DENOMINATIONS, CARD_PRICES } from "@/utils/api";

/* ─── helpers ─── */
function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}  ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

interface CustodyRecord {
  id: number;
  type: "cash" | "cards";
  amount: string;
  denomination?: number | null;
  card_count?: number | null;
  notes?: string | null;
  created_at: string;
}

/* ─────────────────────────────────────────────────────
   Alert Modal
───────────────────────────────────────────────────── */
function AlertModal({ visible, title, message, color, onClose }: {
  visible: boolean; title: string; message: string; color: string; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.alertBox}>
          <View style={[styles.alertIconWrap, { backgroundColor: color + "20" }]}>
            <Ionicons
              name={color === Colors.error ? "close-circle" : "checkmark-circle"}
              size={40} color={color}
            />
          </View>
          <Text style={styles.alertTitle}>{title}</Text>
          {!!message && <Text style={styles.alertMsg}>{message}</Text>}
          <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: color }]} onPress={onClose}>
            <Text style={styles.confirmBtnTxt}>حسناً</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────
   Confirm Delete Modal
───────────────────────────────────────────────────── */
function ConfirmModal({ visible, record, onCancel, onConfirm, deleting }: {
  visible: boolean; record: CustodyRecord | null;
  onCancel: () => void; onConfirm: () => void; deleting: boolean;
}) {
  if (!record) return null;
  const isCard = record.type === "cards";
  const amt = parseFloat(record.amount || "0");
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.alertBox}>
          <View style={[styles.alertIconWrap, { backgroundColor: Colors.error + "20" }]}>
            <Ionicons name="trash" size={36} color={Colors.error} />
          </View>
          <Text style={styles.alertTitle}>حذف العهدة؟</Text>
          <Text style={styles.alertMsg}>
            سيتم حذف عهدة {isCard ? "كروت" : "نقد"} بقيمة{" "}
            <Text style={{ fontWeight: "800", color: Colors.error }}>{formatCurrency(amt)}</Text>
            {"\n"}وعكس تأثيرها على {isCard ? "إجمالي الكروت" : "الصندوق النقدي"} تلقائياً.
          </Text>
          <View style={styles.confirmRow}>
            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }]} onPress={onCancel}>
              <Text style={[styles.confirmBtnTxt, { color: Colors.text }]}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: Colors.error, flex: 1 }]} onPress={onConfirm} disabled={deleting}>
              {deleting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.confirmBtnTxt}>حذف</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────
   View Detail Modal
───────────────────────────────────────────────────── */
function ViewModal({ visible, record, onClose }: {
  visible: boolean; record: CustodyRecord | null; onClose: () => void;
}) {
  if (!record) return null;
  const isCard = record.type === "cards";
  const amt = parseFloat(record.amount || "0");
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.alertBox, { gap: 0 }]}>
          <View style={[styles.alertIconWrap, { backgroundColor: (isCard ? Colors.info : Colors.success) + "20", marginBottom: 12 }]}>
            <Ionicons name={isCard ? "card" : "cash"} size={34} color={isCard ? Colors.info : Colors.success} />
          </View>
          <Text style={[styles.alertTitle, { marginBottom: 16 }]}>تفاصيل العهدة</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailVal}>{isCard ? "كروت" : "نقد"}</Text>
            <Text style={styles.detailKey}>النوع</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailVal, { color: Colors.warning, fontWeight: "800" }]}>{formatCurrency(amt)}</Text>
            <Text style={styles.detailKey}>القيمة</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailVal}>{formatDate(record.created_at)}</Text>
            <Text style={styles.detailKey}>التاريخ</Text>
          </View>
          {record.notes ? (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailVal}>{record.notes}</Text>
                <Text style={styles.detailKey}>ملاحظات</Text>
              </View>
            </>
          ) : null}

          <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: Colors.primary, marginTop: 20 }]} onPress={onClose}>
            <Text style={styles.confirmBtnTxt}>إغلاق</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────
   Edit Modal
───────────────────────────────────────────────────── */
function EditModal({ visible, record, token, onClose, onSuccess, onError }: {
  visible: boolean; record: CustodyRecord | null; token: string | null;
  onClose: () => void; onSuccess: () => void; onError: (msg: string) => void;
}) {
  const [amount,      setAmount]      = useState("");
  const [denomination,setDenomination]= useState(1000);
  const [cardCount,   setCardCount]   = useState("");
  const [cardsAmount, setCardsAmount] = useState("");
  const [notes,       setNotes]       = useState("");
  const [saving,      setSaving]      = useState(false);

  React.useEffect(() => {
    if (record && visible) {
      const amt = parseFloat(record.amount || "0");
      if (record.type === "cash") {
        setAmount(String(amt));
      } else {
        setCardsAmount(String(amt));
        setCardCount("");
        if (record.denomination) setDenomination(record.denomination);
      }
      setNotes(record.notes ?? "");
    }
  }, [record, visible]);

  const autoCalc = (count: string, denom: number) => {
    const n = parseInt(count || "0");
    if (n > 0) setCardsAmount(String((CARD_PRICES[denom] ?? denom) * n));
  };

  if (!record) return null;
  const isCard = record.type === "cards";

  const handleSave = async () => {
    const parsedAmt = isCard
      ? parseFloat(cardsAmount.replace(/[^0-9.]/g, ""))
      : parseFloat(amount.replace(/[^0-9.]/g, ""));
    if (!parsedAmt || parsedAmt <= 0) return onError("أدخل قيمة صحيحة");
    setSaving(true);
    try {
      await apiPut(`/custody/${record.id}`, token, { amount: parsedAmt, notes: notes.trim() || undefined });
      onSuccess();
    } catch (e: any) {
      onError(e?.message ?? "فشل التعديل");
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.slideOverlay}>
        <View style={styles.slideSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>تعديل العهدة</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[styles.typeBadge, { backgroundColor: (isCard ? Colors.info : Colors.success) + "20" }]}>
              <Ionicons name={isCard ? "card" : "cash"} size={16} color={isCard ? Colors.info : Colors.success} />
              <Text style={[styles.typeBadgeTxt, { color: isCard ? Colors.info : Colors.success }]}>
                {isCard ? "عهدة كروت" : "عهدة نقد"}
              </Text>
            </View>

            {isCard ? (
              <>
                <Text style={styles.fieldLabel}>الفئة</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                    {DENOMINATIONS.map(d => (
                      <TouchableOpacity
                        key={d}
                        style={[styles.denomBtn, denomination === d && styles.denomBtnActive]}
                        onPress={() => { setDenomination(d); autoCalc(cardCount, d); }}
                      >
                        <Text style={[styles.denomBtnTxt, denomination === d && styles.denomBtnTxtActive]}>{d}</Text>
                        <Text style={[styles.denomPrice, denomination === d && { color: Colors.primary }]}>{CARD_PRICES[d]}﷼</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>العدد (اختياري)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={cardCount}
                  onChangeText={v => { setCardCount(v); autoCalc(v, denomination); }}
                  keyboardType="numeric"
                  textAlign="right"
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                />
                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>المبلغ الإجمالي (ر.س)</Text>
                <TextInput
                  style={[styles.fieldInput, { borderColor: Colors.primary + "80" }]}
                  value={cardsAmount}
                  onChangeText={setCardsAmount}
                  keyboardType="numeric"
                  textAlign="right"
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                />
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>المبلغ (ر.س)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  textAlign="right"
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                />
              </>
            )}

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>ملاحظات (اختياري)</Text>
            <TextInput
              style={[styles.fieldInput, { height: 70 }]}
              value={notes}
              onChangeText={setNotes}
              textAlign="right"
              multiline
              placeholder="أي ملاحظات..."
              placeholderTextColor={Colors.textMuted}
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnTxt}>حفظ التعديل</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   الشاشة الرئيسية — سجل العهد
═══════════════════════════════════════════════════ */
export default function CustodyLogScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [records,    setRecords]    = useState<CustodyRecord[]>([]);
  const [total,      setTotal]      = useState(0);
  const [cashTotal,  setCashTotal]  = useState(0);
  const [cardsTotal, setCardsTotal] = useState(0);

  const [viewRecord,    setViewRecord]    = useState<CustodyRecord | null>(null);
  const [editRecord,    setEditRecord]    = useState<CustodyRecord | null>(null);
  const [deleteRecord,  setDeleteRecord]  = useState<CustodyRecord | null>(null);
  const [deleting,      setDeleting]      = useState(false);

  const [alert, setAlert] = useState({ visible: false, title: "", message: "", color: Colors.success });
  const showAlert = (title: string, message: string, color = Colors.success) =>
    setAlert({ visible: true, title, message, color });

  const fetchData = useCallback(async () => {
    try {
      const data = await apiGet("/custody/owner-log", token);
      setRecords(data.records ?? []);
      setTotal(data.total ?? 0);
      setCashTotal(data.cashTotal ?? 0);
      setCardsTotal(data.cardsTotal ?? 0);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const handleDelete = async () => {
    if (!deleteRecord) return;
    setDeleting(true);
    try {
      await apiDelete(`/custody/${deleteRecord.id}`, token);
      setDeleteRecord(null);
      await fetchData();
      showAlert("تم الحذف ✓", "تم حذف العهدة وعكس تأثيرها تلقائياً");
    } catch (e: any) {
      setDeleteRecord(null);
      showAlert("خطأ", e?.message ?? "فشل الحذف", Colors.error);
    } finally { setDeleting(false); }
  };

  const pt = Platform.OS === "web" ? 20 : insets.top;
  const pb = Platform.OS === "web" ? 40 : insets.bottom + 20;

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: pt, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.warning} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: pt }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>سجل العهد</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: pb }]}
        showsVerticalScrollIndicator={false}
        onStartShouldSetResponder={() => {
          if (refreshing) return false;
          setRefreshing(true);
          fetchData();
          return false;
        }}
      >

        {/* ── إجمالي العهد ── */}
        <View style={styles.totalsCard}>
          <Text style={styles.totalsLabel}>إجمالي العهد المضافة للمسؤول المالي</Text>
          <Text style={styles.totalsValue}>{formatCurrency(total)}</Text>
          <View style={styles.totalsRow}>
            <View style={styles.totalsPill}>
              <Ionicons name="cash" size={13} color={Colors.success} />
              <Text style={[styles.totalsPillTxt, { color: Colors.success }]}>نقد: {formatCurrency(cashTotal)}</Text>
            </View>
            <View style={styles.totalsPill}>
              <Ionicons name="card" size={13} color={Colors.info} />
              <Text style={[styles.totalsPillTxt, { color: Colors.info }]}>كروت: {formatCurrency(cardsTotal)}</Text>
            </View>
          </View>
        </View>

        {/* ── قائمة السجلات ── */}
        {records.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="archive-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTxt}>لا توجد عهد مسجّلة</Text>
          </View>
        ) : (
          records.map((rec) => {
            const isCard = rec.type === "cards";
            const amt = parseFloat(rec.amount || "0");
            const color = isCard ? Colors.info : Colors.success;
            return (
              <View key={rec.id} style={styles.recordCard}>

                {/* ── رأس السجل ── */}
                <View style={styles.recordTop}>
                  <View style={[styles.recordTypeBadge, { backgroundColor: color + "18" }]}>
                    <Ionicons name={isCard ? "card" : "cash"} size={14} color={color} />
                    <Text style={[styles.recordTypeTxt, { color }]}>{isCard ? "كروت" : "نقد"}</Text>
                  </View>
                  <Text style={[styles.recordAmount, { color: Colors.warning }]}>{formatCurrency(amt)}</Text>
                </View>

                {/* ── التاريخ والملاحظات ── */}
                <View style={styles.recordMeta}>
                  <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.recordDate}>{formatDate(rec.created_at)}</Text>
                </View>
                {rec.notes ? (
                  <Text style={styles.recordNotes} numberOfLines={2}>{rec.notes}</Text>
                ) : null}

                {/* ── أزرار الإجراءات ── */}
                <View style={styles.recordActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: Colors.primary + "15", borderColor: Colors.primary + "40" }]}
                    onPress={() => setViewRecord(rec)}
                  >
                    <Ionicons name="eye-outline" size={15} color={Colors.primary} />
                    <Text style={[styles.actionBtnTxt, { color: Colors.primary }]}>عرض</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: Colors.warning + "15", borderColor: Colors.warning + "40" }]}
                    onPress={() => setEditRecord(rec)}
                  >
                    <Ionicons name="create-outline" size={15} color={Colors.warning} />
                    <Text style={[styles.actionBtnTxt, { color: Colors.warning }]}>تعديل</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: Colors.error + "15", borderColor: Colors.error + "40" }]}
                    onPress={() => setDeleteRecord(rec)}
                  >
                    <Ionicons name="trash-outline" size={15} color={Colors.error} />
                    <Text style={[styles.actionBtnTxt, { color: Colors.error }]}>حذف</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Modals ── */}
      <ViewModal
        visible={!!viewRecord}
        record={viewRecord}
        onClose={() => setViewRecord(null)}
      />

      <EditModal
        visible={!!editRecord}
        record={editRecord}
        token={token}
        onClose={() => setEditRecord(null)}
        onSuccess={() => {
          setEditRecord(null);
          fetchData();
          showAlert("تم التعديل ✓", "تم تحديث العهدة والأرصدة المرتبطة بها");
        }}
        onError={(msg) => {
          setEditRecord(null);
          showAlert("خطأ", msg, Colors.error);
        }}
      />

      <ConfirmModal
        visible={!!deleteRecord}
        record={deleteRecord}
        onCancel={() => setDeleteRecord(null)}
        onConfirm={handleDelete}
        deleting={deleting}
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
const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn:     { width: 40, height: 40, justifyContent: "center", alignItems: "flex-end" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: Colors.text },

  content: { padding: 14, gap: 12 },

  /* Totals Card */
  totalsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.warning + "40",
    padding: 20,
    alignItems: "center",
    gap: 6,
  },
  totalsLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: "600", textAlign: "center" },
  totalsValue: { fontSize: 32, fontWeight: "800", color: Colors.warning, textAlign: "center" },
  totalsRow:   { flexDirection: "row-reverse", gap: 12, marginTop: 4, flexWrap: "wrap", justifyContent: "center" },
  totalsPill:  {
    flexDirection: "row-reverse", gap: 5, alignItems: "center",
    backgroundColor: Colors.background, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  totalsPillTxt: { fontSize: 12, fontWeight: "700" },

  /* Record Card */
  recordCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 10,
  },
  recordTop: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recordTypeBadge: {
    flexDirection: "row-reverse", gap: 5, alignItems: "center",
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  recordTypeTxt: { fontSize: 13, fontWeight: "700" },
  recordAmount:  { fontSize: 20, fontWeight: "800" },
  recordMeta:    { flexDirection: "row-reverse", gap: 5, alignItems: "center" },
  recordDate:    { fontSize: 11, color: Colors.textMuted },
  recordNotes:   { fontSize: 12, color: Colors.textSecondary, textAlign: "right", fontStyle: "italic" },

  recordActions: {
    flexDirection: "row-reverse",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  actionBtn: {
    flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 9, borderRadius: 10, borderWidth: 1,
  },
  actionBtnTxt: { fontSize: 12, fontWeight: "700" },

  /* Empty */
  emptyBox: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTxt: { fontSize: 14, color: Colors.textMuted, fontWeight: "600" },

  /* Overlay/Modal */
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  alertBox: {
    backgroundColor: Colors.surface, borderRadius: 22,
    padding: 24, width: "100%", maxWidth: 340,
    alignItems: "center", gap: 12,
  },
  alertIconWrap: { width: 68, height: 68, borderRadius: 34, justifyContent: "center", alignItems: "center" },
  alertTitle:    { fontSize: 17, fontWeight: "800", color: Colors.text, textAlign: "center" },
  alertMsg:      { fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  confirmRow:    { flexDirection: "row-reverse", gap: 10, width: "100%", marginTop: 6 },
  confirmBtn:    { paddingVertical: 13, paddingHorizontal: 20, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  confirmBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },

  /* Detail row */
  detailRow:     { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", width: "100%", paddingVertical: 4 },
  detailKey:     { fontSize: 12, color: Colors.textMuted, fontWeight: "600" },
  detailVal:     { fontSize: 14, color: Colors.text, fontWeight: "700", textAlign: "right", flex: 1 },
  detailDivider: { height: 1, backgroundColor: Colors.border, width: "100%", marginVertical: 4 },

  /* Slide Sheet (Edit) */
  slideOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  slideSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: "92%",
  },
  sheetHeader: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "center", marginBottom: 20,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: Colors.text },

  typeBadge: {
    flexDirection: "row-reverse", gap: 6, alignItems: "center",
    alignSelf: "flex-end", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 16,
  },
  typeBadgeTxt: { fontSize: 13, fontWeight: "700" },

  fieldLabel: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary, textAlign: "right", marginBottom: 8 },
  fieldInput: {
    backgroundColor: Colors.background, borderRadius: 12, padding: 13,
    color: Colors.text, fontSize: 15, borderWidth: 1, borderColor: Colors.border,
  },
  denomBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background,
    alignItems: "center", gap: 2,
  },
  denomBtnActive:    { borderColor: Colors.primary, backgroundColor: Colors.primary + "18" },
  denomBtnTxt:       { fontSize: 13, fontWeight: "700", color: Colors.textSecondary },
  denomBtnTxtActive: { color: Colors.primary },
  denomPrice:        { fontSize: 10, color: Colors.textMuted },

  saveBtn: {
    backgroundColor: Colors.warning, borderRadius: 14,
    padding: 15, alignItems: "center", marginTop: 20,
  },
  saveBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
