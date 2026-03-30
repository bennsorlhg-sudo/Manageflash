import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, RefreshControl, Modal, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, formatCurrency, DENOMINATIONS, CARD_PRICES } from "@/utils/api";

/* ─────────────────────────────────────────────────────
   بطاقة KPI — نفس تصميم المسؤول المالي
───────────────────────────────────────────────────── */
function KPICard({
  title, value, icon, color, subtitle,
}: {
  title: string; value: number;
  icon: keyof typeof Ionicons.glyphMap; color: string; subtitle?: string;
}) {
  return (
    <View style={[styles.kpiCard, { borderColor: color + "40" }]}>
      <View style={styles.kpiTop}>
        <View style={[styles.kpiIcon, { backgroundColor: color + "1E" }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={styles.kpiTitle} numberOfLines={1}>{title}</Text>
      </View>
      <Text style={[styles.kpiValue, { color }]}>{formatCurrency(value)}</Text>
      {subtitle ? <Text style={styles.kpiSub}>{subtitle}</Text> : null}
    </View>
  );
}

/* ─────────────────────────────────────────────────────
   Alert Modal
───────────────────────────────────────────────────── */
function AlertModal({ visible, title, message, color, onClose }: {
  visible: boolean; title: string; message: string; color: string; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.alertOverlay}>
        <View style={styles.alertBox}>
          <View style={[styles.alertIconWrap, { backgroundColor: color + "20" }]}>
            <Ionicons
              name={color === Colors.error ? "close-circle" : "checkmark-circle"}
              size={40} color={color}
            />
          </View>
          <Text style={styles.alertTitle}>{title}</Text>
          {!!message && <Text style={styles.alertMsg}>{message}</Text>}
          <TouchableOpacity style={[styles.alertBtn, { backgroundColor: color }]} onPress={onClose}>
            <Text style={styles.alertBtnTxt}>حسناً</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────
   زر إجراء
───────────────────────────────────────────────────── */
function ActionBtn({ label, icon, onPress, color }: {
  label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; color: string;
}) {
  return (
    <TouchableOpacity style={[styles.actionBtn, { borderColor: color + "40" }]} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.actionIcon, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ═══════════════════════════════════════════════════
   الواجهة الرئيسية للمالك
═══════════════════════════════════════════════════ */
export default function OwnerDashboard() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const router = useRouter();

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* ─── الأرقام الست ─── */
  const [totalCustody, setTotalCustody] = useState(0);
  const [cashBalance,  setCashBalance]  = useState(0);
  const [cardsValue,   setCardsValue]   = useState(0);
  const [agentCustody, setAgentCustody] = useState(0);
  const [totalLoans,   setTotalLoans]   = useState(0);
  const [totalDebts,   setTotalDebts]   = useState(0);

  /* ─── Modals ─── */
  const [showCustodyModal, setShowCustodyModal] = useState(false);
  const [showTaskModal,    setShowTaskModal]    = useState(false);

  /* ─── Alert ─── */
  const [alert, setAlert] = useState({ visible: false, title: "", message: "", color: Colors.success });
  const showAlert = (title: string, message: string, color = Colors.success) =>
    setAlert({ visible: true, title, message, color });

  const fetchData = useCallback(async () => {
    try {
      const summary = await apiGet("/finances/summary", token);
      setTotalCustody(summary.totalCustody ?? 0);
      setCashBalance(summary.cashBalance   ?? 0);
      setCardsValue(summary.cardsValue     ?? 0);
      setAgentCustody(summary.agentCustody ?? 0);
      setTotalLoans(summary.totalLoans     ?? 0);
      setTotalDebts(summary.totalDebts ?? summary.totalOwed ?? 0);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/(owner)/profile")}>
          <Ionicons name="person-circle-outline" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>لوحة المالك — {user?.name}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 50 : insets.bottom + 30 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
        }
      >

        {/* ══════════════════════════════════════════════
            6 بطاقات KPI — نفس المسؤول المالي
        ══════════════════════════════════════════════ */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiRow}>
            <KPICard title="إجمالي العهدة"  value={totalCustody}  icon="briefcase"    color={Colors.primary}  subtitle="ما سلّمه المالك للمسؤول المالي" />
            <KPICard title="الصندوق النقدي" value={cashBalance}   icon="wallet"        color={Colors.success}  subtitle="النقد الفعلي" />
          </View>
          <View style={styles.kpiRow}>
            <KPICard title="إجمالي الكروت" value={cardsValue}    icon="card"          color={Colors.info}     subtitle="قيمة إجمالية" />
            <KPICard title="عند المندوبين" value={agentCustody}  icon="people"        color="#9C27B0"          subtitle="كروت مسلّمة" />
          </View>
          <View style={styles.kpiRow}>
            <KPICard title="السلف"          value={totalLoans}    icon="trending-up"   color={Colors.warning}  subtitle="مبيعات بسلفة" />
            <KPICard title="الديون"         value={totalDebts}    icon="trending-down" color={Colors.error}    subtitle="التزامات الشبكة" />
          </View>
        </View>

        {/* ══════════════════════════════════════════════
            التقارير والمتابعة
        ══════════════════════════════════════════════ */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionDot, { backgroundColor: Colors.success }]} />
          <Text style={styles.sectionTitle}>المتابعة</Text>
        </View>

        <View style={styles.actionsBlock}>
          <View style={styles.actionRow}>
            <ActionBtn
              label="المبيعات"   icon="bar-chart"   color={Colors.success}
              onPress={() => router.push("/(owner)/sales")}
            />
            <ActionBtn
              label="المصروفات"  icon="receipt"     color={Colors.error}
              onPress={() => router.push("/(owner)/expenses")}
            />
            <ActionBtn
              label="سجل العهد"  icon="archive"     color={Colors.warning}
              onPress={() => router.push("/(owner)/custody-log")}
            />
          </View>
          <View style={styles.actionRow}>
            <ActionBtn
              label="الربح"      icon="trending-up" color={Colors.primary}
              onPress={() => router.push({ pathname: "/(owner)/report", params: { type: "profit" } })}
            />
          </View>
        </View>

        {/* ══════════════════════════════════════════════
            إجراءات
        ══════════════════════════════════════════════ */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionDot, { backgroundColor: Colors.warning }]} />
          <Text style={styles.sectionTitle}>الإجراءات</Text>
        </View>

        <View style={styles.actionsBlock}>
          <View style={styles.actionRow}>
            <ActionBtn
              label="إضافة عهدة" icon="gift"        color={Colors.warning}
              onPress={() => setShowCustodyModal(true)}
            />
            <ActionBtn
              label="إضافة مهمة" icon="add-circle"  color={Colors.primary}
              onPress={() => setShowTaskModal(true)}
            />
            <ActionBtn
              label="الفريق"     icon="people"      color={Colors.roles.supervisor}
              onPress={() => router.push("/(owner)/team")}
            />
          </View>
        </View>

      </ScrollView>

      {/* ── Modal العهدة ── */}
      <AddCustodyModal
        visible={showCustodyModal}
        token={token}
        onClose={() => setShowCustodyModal(false)}
        onSuccess={async () => {
          setShowCustodyModal(false);
          await fetchData();
          showAlert("تم ✓", "تم إضافة العهدة بنجاح");
        }}
        onError={(msg) => showAlert("خطأ", msg, Colors.error)}
        insets={insets}
      />

      {/* ── Modal المهمة ── */}
      <AddTaskModal
        visible={showTaskModal}
        token={token}
        onClose={() => setShowTaskModal(false)}
        onSuccess={() => {
          setShowTaskModal(false);
          showAlert("تم ✓", "تم إضافة المهمة بنجاح");
        }}
        onError={(msg) => showAlert("خطأ", msg, Colors.error)}
      />

      {/* ── Alert ── */}
      <AlertModal
        visible={alert.visible} title={alert.title} message={alert.message} color={alert.color}
        onClose={() => setAlert(a => ({ ...a, visible: false }))}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════
   Modal إضافة عهدة — مُصلح بالكامل
═══════════════════════════════════════════════════ */
function AddCustodyModal({ visible, token, onClose, onSuccess, onError, insets }: {
  visible: boolean; token: string | null;
  onClose: () => void; onSuccess: () => Promise<void>;
  onError: (msg: string) => void; insets: any;
}) {
  const [type,         setType]         = useState<"cash" | "cards">("cash");
  const [amount,       setAmount]       = useState("");        /* نقد */
  const [denomination, setDenomination] = useState(1000);     /* فئة الكرت */
  const [cardCount,    setCardCount]    = useState("");        /* عدد الكروت */
  const [cardsAmount,  setCardsAmount]  = useState("");        /* مبلغ الكروت (يدوي أو تلقائي) */
  const [notes,        setNotes]        = useState("");
  const [saving,       setSaving]       = useState(false);

  /* ─── حساب تلقائي عند تغيير الفئة أو العدد ─── */
  const autoCalc = (count: string, denom: number) => {
    const n = parseInt(count || "0");
    if (n > 0) {
      const val = (CARD_PRICES[denom] ?? denom) * n;
      setCardsAmount(String(val));
    }
  };

  const handleDenominationChange = (d: number) => {
    setDenomination(d);
    autoCalc(cardCount, d);
  };

  const handleCardCountChange = (v: string) => {
    setCardCount(v);
    autoCalc(v, denomination);
  };

  const handleSubmit = async () => {
    if (type === "cash") {
      const parsedAmt = parseFloat(amount.replace(/[^0-9.]/g, ""));
      if (!parsedAmt || parsedAmt <= 0) return onError("أدخل مبلغاً صحيحاً");
      setSaving(true);
      try {
        await apiPost("/custody", token, { type: "cash", amount: parsedAmt, notes: notes.trim() || undefined });
        setAmount(""); setNotes("");
        await onSuccess();
      } catch (e: any) {
        onError(e?.message ?? "فشل إضافة العهدة");
      } finally { setSaving(false); }

    } else {
      const parsedAmt = parseFloat(cardsAmount.replace(/[^0-9.]/g, ""));
      if (!parsedAmt || parsedAmt <= 0) return onError("أدخل مبلغاً أو عدداً صحيحاً للكروت");
      setSaving(true);
      try {
        await apiPost("/custody", token, { type: "cards", amount: parsedAmt, notes: notes.trim() || undefined });
        setCardCount(""); setCardsAmount(""); setNotes("");
        await onSuccess();
      } catch (e: any) {
        onError(e?.message ?? "فشل إضافة العهدة");
      } finally { setSaving(false); }
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>إضافة عهدة</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>

            {/* ── نوع العهدة ── */}
            <Text style={styles.fieldLabel}>نوع العهدة</Text>
            <View style={styles.segRow}>
              {([["cards", "كروت"], ["cash", "نقد"]] as const).map(([v, l]) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.segBtn, type === v && styles.segBtnActive]}
                  onPress={() => setType(v)}
                >
                  <Ionicons
                    name={v === "cards" ? "card" : "cash"}
                    size={16}
                    color={type === v ? Colors.primary : Colors.textSecondary}
                  />
                  <Text style={[styles.segBtnTxt, type === v && styles.segBtnTxtActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ══════ نقد ══════ */}
            {type === "cash" && (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>المبلغ (ر.س)</Text>
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

            {/* ══════ كروت ══════ */}
            {type === "cards" && (
              <>
                {/* الفئة */}
                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>الفئة</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                    {DENOMINATIONS.map(d => (
                      <TouchableOpacity
                        key={d}
                        style={[styles.denomBtn, denomination === d && styles.denomBtnActive]}
                        onPress={() => handleDenominationChange(d)}
                      >
                        <Text style={[styles.denomBtnTxt, denomination === d && styles.denomBtnTxtActive]}>{d}</Text>
                        <Text style={[styles.denomPrice, denomination === d && styles.denomPriceActive]}>
                          {CARD_PRICES[d]}﷼
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* العدد */}
                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>العدد</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={cardCount}
                  onChangeText={handleCardCountChange}
                  keyboardType="numeric"
                  textAlign="right"
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                />

                {/* المبلغ — يدوي أو تلقائي */}
                <View style={styles.amountLabelRow}>
                  <Text style={styles.amountHint}>
                    {cardCount && parseInt(cardCount) > 0 ? "محسوب تلقائياً — يمكن التعديل" : "أدخل المبلغ يدوياً"}
                  </Text>
                  <Text style={styles.fieldLabel}>المبلغ (ر.س)</Text>
                </View>
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
            )}

            {/* ملاحظات */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>ملاحظات (اختياري)</Text>
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
              onPress={handleSubmit}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnTxt}>تأكيد إضافة العهدة</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   Modal إضافة مهمة
═══════════════════════════════════════════════════ */
function AddTaskModal({ visible, token, onClose, onSuccess, onError }: {
  visible: boolean; token: string | null;
  onClose: () => void; onSuccess: () => void; onError: (msg: string) => void;
}) {
  const [targetRole,  setTargetRole]  = useState<"finance_manager" | "supervisor" | "tech_engineer">("finance_manager");
  const [description, setDescription] = useState("");
  const [saving,      setSaving]      = useState(false);

  const roles = [
    { v: "finance_manager" as const, l: "المسؤول المالي" },
    { v: "supervisor"      as const, l: "المشرف"          },
    { v: "tech_engineer"   as const, l: "المهندس الفني"   },
  ];

  const handleSubmit = async () => {
    if (!description.trim()) return onError("يرجى كتابة وصف المهمة");
    setSaving(true);
    try {
      await apiPost("/tasks", token, {
        title: description.slice(0, 80),
        description,
        targetRole,
        assignedByRole: "owner",
      });
      setDescription("");
      onSuccess();
    } catch (e: any) {
      onError(e?.message ?? "فشل إضافة المهمة");
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>إضافة مهمة</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>الجهة المستهدفة</Text>
          <View style={styles.segRow}>
            {roles.map(r => (
              <TouchableOpacity
                key={r.v}
                style={[styles.segBtn, targetRole === r.v && styles.segBtnActive]}
                onPress={() => setTargetRole(r.v)}
              >
                <Text style={[styles.segBtnTxt, targetRole === r.v && styles.segBtnTxtActive]}>{r.l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>وصف المهمة</Text>
          <TextInput
            style={[styles.fieldInput, { height: 110 }]}
            value={description}
            onChangeText={setDescription}
            textAlign="right"
            multiline
            placeholder="اكتب وصف المهمة..."
            placeholderTextColor={Colors.textMuted}
          />

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnTxt}>إضافة المهمة</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   Styles
═══════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center:    { justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: Colors.text },
  content: { padding: 14, gap: 14 },

  /* KPI */
  kpiGrid: { gap: 10 },
  kpiRow:  { flexDirection: "row-reverse", gap: 10 },
  kpiCard: {
    flex: 1, backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1.5,
    padding: 14, gap: 6, alignItems: "flex-end",
  },
  kpiTop: { flexDirection: "row-reverse", alignItems: "center", gap: 8, width: "100%" },
  kpiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  kpiTitle: { flex: 1, fontSize: 12, fontWeight: "600", color: Colors.textSecondary, textAlign: "right" },
  kpiValue: { fontSize: 18, fontWeight: "800", textAlign: "right" },
  kpiSub:   { fontSize: 10, color: Colors.textMuted, textAlign: "right" },

  /* Section */
  sectionHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  sectionDot:    { width: 4, height: 18, borderRadius: 2 },
  sectionTitle:  { fontSize: 15, fontWeight: "700", color: Colors.text },

  /* Actions */
  actionsBlock: { gap: 10 },
  actionRow:    { flexDirection: "row-reverse", gap: 10 },
  actionBtn: {
    flex: 1, backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1,
    paddingVertical: 14, alignItems: "center", gap: 8,
  },
  actionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 12, fontWeight: "700", color: Colors.text, textAlign: "center" },

  /* Modal */
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "center", marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: Colors.text },

  fieldLabel: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary, textAlign: "right", marginBottom: 8 },
  fieldInput: {
    backgroundColor: Colors.background, borderRadius: 12, padding: 13,
    color: Colors.text, fontSize: 15, borderWidth: 1, borderColor: Colors.border,
  },

  segRow: { flexDirection: "row-reverse", gap: 8 },
  segBtn: {
    flex: 1, paddingVertical: 11, flexDirection: "row-reverse",
    alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: 10, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.background,
  },
  segBtnActive:    { borderColor: Colors.primary, backgroundColor: Colors.primary + "18" },
  segBtnTxt:       { fontSize: 13, fontWeight: "700", color: Colors.textSecondary },
  segBtnTxtActive: { color: Colors.primary },

  denomBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background,
    alignItems: "center", gap: 2,
  },
  denomBtnActive:    { borderColor: Colors.primary, backgroundColor: Colors.primary + "18" },
  denomBtnTxt:       { fontSize: 13, fontWeight: "700", color: Colors.textSecondary },
  denomBtnTxtActive: { color: Colors.primary },
  denomPrice:        { fontSize: 10, color: Colors.textMuted },
  denomPriceActive:  { color: Colors.primary },

  amountLabelRow: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "center", marginTop: 16,
  },
  amountHint: { fontSize: 11, color: Colors.textMuted, fontStyle: "italic" },

  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    padding: 15, alignItems: "center", marginTop: 20,
  },
  saveBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },

  /* Alert */
  alertOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  alertBox: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 28,
    width: "100%", maxWidth: 340, alignItems: "center", gap: 12,
  },
  alertIconWrap: { width: 68, height: 68, borderRadius: 34, justifyContent: "center", alignItems: "center" },
  alertTitle:    { fontSize: 17, fontWeight: "800", color: Colors.text, textAlign: "center" },
  alertMsg:      { fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  alertBtn:      { paddingVertical: 13, paddingHorizontal: 32, borderRadius: 12 },
  alertBtnTxt:   { color: "#fff", fontWeight: "700", fontSize: 15 },
});
