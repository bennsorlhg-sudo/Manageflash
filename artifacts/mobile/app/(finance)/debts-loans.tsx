import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, TextInput, ActivityIndicator, RefreshControl, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, formatCurrency } from "@/utils/api";

/* ─── ملاحظة التسمية ───────────────────────────────────
 *  تبويب "السلف"  → debtsTable  (عملاء يدينون لنا)
 *  تبويب "الديون" → loansTable  (نحن ندين لجهات)
 * ────────────────────────────────────────────────────── */

export default function DebtsLoansScreen() {
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const { token } = useAuth();

  const [activeTab,  setActiveTab]  = useState<"debts" | "loans">("debts");
  const [search,     setSearch]     = useState("");
  const [showPaid,   setShowPaid]   = useState(false);
  const [debts,      setDebts]      = useState<any[]>([]); /* السلف */
  const [loans,      setLoans]      = useState<any[]>([]); /* الديون */
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* ─── إنشاء سجل جديد ─── */
  const [showCreate,   setShowCreate]   = useState(false);
  const [createName,   setCreateName]   = useState("");
  const [createAmount, setCreateAmount] = useState("");
  const [createNotes,  setCreateNotes]  = useState("");
  const [creating,     setCreating]     = useState(false);
  const [alert,        setAlert]        = useState({ visible: false, title: "", message: "", color: Colors.success });
  const showAlert = (title: string, message: string, color = Colors.success) =>
    setAlert({ visible: true, title, message, color });

  const fetchData = useCallback(async () => {
    try {
      const [d, l] = await Promise.all([apiGet("/debts", token), apiGet("/loans", token)]);
      setDebts(d);
      setLoans(l);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  const handleCreate = useCallback(async () => {
    const amt = parseFloat(createAmount.replace(/[^0-9.]/g, ""));
    if (!createName.trim()) return showAlert("خطأ", "أدخل اسم الشخص", Colors.error);
    if (!amt || amt <= 0) return showAlert("خطأ", "أدخل مبلغاً صحيحاً", Colors.error);
    setCreating(true);
    try {
      const endpoint = activeTab === "debts" ? "/debts" : "/loans";
      await apiPost(endpoint, token, {
        personName: createName.trim(),
        amount: amt,
        notes: createNotes.trim() || undefined,
      });
      setCreateName(""); setCreateAmount(""); setCreateNotes(""); setShowCreate(false);
      await fetchData();
      showAlert(
        activeTab === "debts" ? "تم تسجيل السلفة ✓" : "تم تسجيل الدين ✓",
        `${createName.trim()} — ${formatCurrency(amt)}`
      );
    } catch (e: any) {
      showAlert("خطأ", e?.message ?? "فشل الإنشاء", Colors.error);
    } finally { setCreating(false); }
  }, [activeTab, createName, createAmount, createNotes, token, fetchData]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* القائمة النشطة */
  const rawList = (activeTab === "debts" ? debts : loans) as any[];
  const enriched = rawList.map((item: any) => ({
    ...item,
    remaining: Math.max(0, parseFloat(item.amount) - parseFloat(item.paidAmount)),
  }));
  const filtered = enriched
    .filter((item: any) => {
      const matchSearch = item.personName.includes(search);
      const matchPaid   = showPaid ? true : item.remaining > 0.01;
      return matchSearch && matchPaid;
    })
    .sort((a: any, b: any) => b.remaining - a.remaining);

  const totalRemaining = enriched
    .filter((i: any) => i.remaining > 0.01)
    .reduce((s: number, i: any) => s + i.remaining, 0);

  const tabColor = activeTab === "debts" ? Colors.success : Colors.error;

  if (loading) {
    return (
      <View style={[s.container, s.center, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>السلف والديون</Text>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: tabColor }]}
            onPress={() => setShowCreate(true)}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={s.addBtnTxt}>{activeTab === "debts" ? "سلفة" : "دين"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowPaid(p => !p)} style={s.toggleBtn}>
            <Ionicons name={showPaid ? "eye-off" : "eye"} size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── التبويبات ── */}
      <View style={s.tabs}>
        {([
          { key: "debts", label: "السلف",  sub: "عملاء يدينون لنا",  color: Colors.success },
          { key: "loans", label: "الديون", sub: "نحن ندين لجهات",    color: Colors.error   },
        ] as const).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.tab, activeTab === t.key && { borderColor: t.color, backgroundColor: t.color + "12" }]}
            onPress={() => { setActiveTab(t.key); setSearch(""); }}
          >
            <Text style={[s.tabLabel, activeTab === t.key && { color: t.color }]}>{t.label}</Text>
            <Text style={s.tabSub}>{t.sub}</Text>
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

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
      >
        {/* ── بطاقة الإجمالي ── */}
        <View style={[s.summaryCard, { borderColor: tabColor + "44", backgroundColor: tabColor + "0E" }]}>
          <Text style={s.summaryLabel}>
            {activeTab === "debts" ? "إجمالي السلف المستحقة لنا" : "إجمالي الديون المستحقة علينا"}
          </Text>
          <Text style={[s.summaryVal, { color: tabColor }]}>{formatCurrency(totalRemaining)}</Text>
        </View>

        {/* ── القائمة ── */}
        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="checkmark-circle-outline" size={52} color={Colors.textMuted} />
            <Text style={s.emptyTxt}>لا توجد سجلات</Text>
          </View>
        ) : filtered.map((item: any) => {
          const pct    = Math.min((parseFloat(item.paidAmount) / parseFloat(item.amount)) * 100, 100);
          const isPaid = item.remaining < 0.01;
          const ENTITY_LABELS: Record<string, { label: string; color: string }> = {
            hotspot:     { label: "هوتسبوت",  color: Colors.info    },
            broadband:   { label: "برودباند", color: Colors.primary },
            sales_point: { label: "نقطة بيع", color: Colors.warning },
            supplier:    { label: "مورّد",    color: "#9b59b6"       },
            other:       { label: "أخرى",     color: Colors.textMuted },
          };
          const entityInfo = ENTITY_LABELS[item.entityType ?? "other"] ?? ENTITY_LABELS.other;
          return (
            <View key={item.id} style={[s.card, isPaid && s.cardPaid]}>
              {/* اسم + نوع + متبقي */}
              <View style={s.cardTop}>
                <View style={{ alignItems: "flex-start", gap: 4 }}>
                  {isPaid ? (
                    <View style={s.paidBadge}>
                      <Text style={s.paidBadgeTxt}>مسدد بالكامل</Text>
                    </View>
                  ) : item.entityType ? (
                    <View style={[s.entityBadge, { backgroundColor: entityInfo.color + "20", borderColor: entityInfo.color + "50" }]}>
                      <Text style={[s.entityBadgeTxt, { color: entityInfo.color }]}>{entityInfo.label}</Text>
                    </View>
                  ) : null}
                  <Text style={[s.remaining, { color: isPaid ? Colors.textMuted : tabColor }]}>
                    {formatCurrency(item.remaining)}
                  </Text>
                  <Text style={s.remainingLabel}>المتبقي</Text>
                </View>
                <Text style={s.personName}>{item.personName}</Text>
              </View>

              {/* شريط التقدم */}
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: tabColor }]} />
              </View>

              {/* الإجمالي / المسدد / المتبقي */}
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
                  <Text style={[s.statVal, { color: isPaid ? Colors.success : tabColor }]}>
                    {formatCurrency(item.remaining)}
                  </Text>
                  <Text style={s.statKey}>المتبقي</Text>
                </View>
              </View>

              {/* ملاحظات */}
              {item.notes ? <Text style={s.notes}>{item.notes}</Text> : null}

              {/* زر الإجراء (للمفتوحة فقط) */}
              {!isPaid && (
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: tabColor }]}
                  onPress={() =>
                    router.push(
                      activeTab === "debts"
                        ? "/(finance)/collect"
                        : "/(finance)/collect"
                    )
                  }
                >
                  <Ionicons
                    name={activeTab === "debts" ? "arrow-down-circle" : "arrow-up-circle"}
                    size={16} color="#fff"
                  />
                  <Text style={s.actionBtnTxt}>
                    {activeTab === "debts" ? "تحصيل سلفة" : "سداد دين"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ════ مودال إنشاء سجل جديد ════ */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={[s.modalHeader, { borderBottomColor: tabColor + "44" }]}>
              <TouchableOpacity onPress={() => { setShowCreate(false); setCreateName(""); setCreateAmount(""); setCreateNotes(""); }}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={[s.modalTitle, { color: tabColor }]}>
                {activeTab === "debts" ? "تسجيل سلفة جديدة" : "تسجيل دين جديد"}
              </Text>
            </View>

            <Text style={s.fieldLbl}>
              {activeTab === "debts" ? "اسم العميل (المدين لنا)" : "اسم الجهة الدائنة (ندين لها)"}
            </Text>
            <TextInput
              style={s.fieldIn} value={createName} onChangeText={setCreateName}
              placeholder="أدخل الاسم..." placeholderTextColor={Colors.textMuted} textAlign="right"
            />

            <Text style={[s.fieldLbl, { marginTop: 14 }]}>المبلغ (ر.س) *</Text>
            <TextInput
              style={[s.fieldIn, s.amtIn]} value={createAmount}
              onChangeText={v => setCreateAmount(v.replace(/[^0-9.]/g, ""))}
              placeholder="0.00" placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad" textAlign="right"
            />

            <Text style={[s.fieldLbl, { marginTop: 14 }]}>ملاحظات (اختياري)</Text>
            <TextInput
              style={[s.fieldIn, { height: 60 }]} value={createNotes} onChangeText={setCreateNotes}
              placeholder="أي ملاحظات..." placeholderTextColor={Colors.textMuted}
              textAlign="right" multiline
            />

            {/* أثر العملية */}
            <View style={[s.effectBox, { backgroundColor: tabColor + "10", borderColor: tabColor + "44" }]}>
              <Ionicons name={activeTab === "debts" ? "trending-up" : "trending-down"} size={14} color={tabColor} />
              <Text style={[s.effectTxt, { color: tabColor }]}>
                {activeTab === "debts"
                  ? "سيُضاف إلى قائمة السلف المستحقة لنا"
                  : "سيُضاف إلى قائمة الديون المستحقة علينا"}
              </Text>
            </View>

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: tabColor }, creating && { opacity: 0.5 }]}
              onPress={handleCreate} disabled={creating}
            >
              {creating
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={s.saveBtnTxt}>
                      {activeTab === "debts" ? "حفظ السلفة" : "حفظ الدين"}
                    </Text>
                  </>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ════ مودال التنبيه ════ */}
      <Modal visible={alert.visible} transparent animationType="fade">
        <View style={s.alertOverlay}>
          <View style={s.alertBox}>
            <View style={[s.alertIcon, { backgroundColor: alert.color + "22" }]}>
              <Ionicons
                name={alert.color === Colors.error ? "close-circle" : "checkmark-circle"}
                size={44} color={alert.color}
              />
            </View>
            <Text style={s.alertTitle}>{alert.title}</Text>
            {!!alert.message && <Text style={s.alertMsg}>{alert.message}</Text>}
            <TouchableOpacity
              style={[s.alertBtn, { backgroundColor: alert.color }]}
              onPress={() => setAlert(a => ({ ...a, visible: false }))}
            >
              <Text style={s.alertBtnTxt}>حسناً</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  toggleBtn:   { padding: 4 },

  tabs: { flexDirection: "row-reverse", gap: 10, padding: 16, paddingBottom: 8 },
  tab: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    alignItems: "center", gap: 4, borderWidth: 1.5, borderColor: Colors.border,
  },
  tabLabel: { fontSize: 14, fontWeight: "700", color: Colors.textSecondary },
  tabSub:   { fontSize: 10, color: Colors.textMuted },

  searchWrap: {
    flexDirection: "row-reverse", alignItems: "center", backgroundColor: Colors.surface,
    marginHorizontal: 16, marginBottom: 12, borderRadius: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, paddingVertical: 10, color: Colors.text, fontSize: 14 },

  content: { padding: 16, paddingTop: 4 },

  summaryCard: {
    borderRadius: 14, borderWidth: 1, padding: 16,
    alignItems: "center", marginBottom: 16,
  },
  summaryLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  summaryVal:   { fontSize: 24, fontWeight: "800" },

  empty:    { alignItems: "center", justifyContent: "center", marginTop: 60, gap: 12 },
  emptyTxt: { fontSize: 15, color: Colors.textMuted },

  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: Colors.border, gap: 10,
  },
  cardPaid: { opacity: 0.6 },

  cardTop: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start" },
  personName: { fontSize: 16, fontWeight: "700", color: Colors.text, textAlign: "right" },
  remaining:      { fontSize: 18, fontWeight: "800", textAlign: "left" },
  remainingLabel: { fontSize: 10, color: Colors.textMuted, textAlign: "left" },
  paidBadge:    { backgroundColor: Colors.success + "22", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4 },
  paidBadgeTxt: { fontSize: 10, color: Colors.success, fontWeight: "700" },
  entityBadge:    { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4 },
  entityBadgeTxt: { fontSize: 10, fontWeight: "700" },

  progressBg:   { height: 7, backgroundColor: Colors.background, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },

  statsRow:    { flexDirection: "row-reverse", justifyContent: "space-around" },
  stat:        { alignItems: "center", flex: 1 },
  statVal:     { fontSize: 13, fontWeight: "700", color: Colors.text },
  statKey:     { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 2 },

  notes: { fontSize: 12, color: Colors.textMuted, textAlign: "right", lineHeight: 18 },

  actionBtn: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 11, borderRadius: 10,
  },
  actionBtnTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },

  /* ── زر الإضافة في الهيدر ── */
  addBtn: {
    flexDirection: "row-reverse", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  addBtnTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },

  /* ── مودال الإنشاء ── */
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    marginBottom: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: "800" },
  fieldLbl: { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: 7, fontWeight: "600" },
  fieldIn: {
    backgroundColor: Colors.background, borderRadius: 10, padding: 13,
    color: Colors.text, fontSize: 15, borderWidth: 1, borderColor: Colors.border,
  },
  amtIn: { fontSize: 22, fontWeight: "800" },
  effectBox: {
    flexDirection: "row-reverse", alignItems: "center", gap: 6,
    padding: 10, borderRadius: 10, borderWidth: 1, marginTop: 16, marginBottom: 4,
  },
  effectTxt: { fontSize: 12, fontWeight: "600", flex: 1, textAlign: "right" },
  saveBtn: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 15, borderRadius: 14, marginTop: 18,
  },
  saveBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },

  /* ── مودال التنبيه ── */
  alertOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", alignItems: "center", padding: 28,
  },
  alertBox: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 28,
    width: "100%", maxWidth: 340, alignItems: "center", gap: 12,
  },
  alertIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center" },
  alertTitle: { fontSize: 18, fontWeight: "800", color: Colors.text, textAlign: "center" },
  alertMsg:   { fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  alertBtn:   { paddingHorizontal: 44, paddingVertical: 12, borderRadius: 12, marginTop: 4 },
  alertBtnTxt:{ fontSize: 15, fontWeight: "700", color: "#fff" },
});
