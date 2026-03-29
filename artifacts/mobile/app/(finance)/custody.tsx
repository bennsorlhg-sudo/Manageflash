import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator, RefreshControl, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, formatCurrency, formatDate } from "@/utils/api";

/* ─── مودال تأكيد بسيط (بديل عن Alert) ─── */
function ConfirmModal({
  visible, title, message, color, onClose,
}: { visible: boolean; title: string; message: string; color: string; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.alertOverlay}>
        <View style={styles.alertBox}>
          <View style={[styles.alertIcon, { backgroundColor: color + "20" }]}>
            <Ionicons name="checkmark-circle" size={40} color={color} />
          </View>
          <Text style={styles.alertTitle}>{title}</Text>
          {message ? <Text style={styles.alertMsg}>{message}</Text> : null}
          <TouchableOpacity style={[styles.alertBtn, { backgroundColor: color }]} onPress={onClose}>
            <Text style={styles.alertBtnText}>حسناً</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ─── حقل إدخال موحّد ─── */
function Field({
  label, value, onChange, placeholder, keyboard, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboard?: any; hint?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value} onChangeText={onChange}
        placeholder={placeholder ?? ""}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboard ?? "default"}
        textAlign="right"
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

type Tab = "send" | "receive" | "list";

export default function CustodyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [tab, setTab] = useState<Tab>("send");

  /* ─── تسليم عهدة ─── */
  const [sendAgent,  setSendAgent]  = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendNotes,  setSendNotes]  = useState("");
  const [sending,    setSending]    = useState(false);

  /* ─── استلام عهدة ─── */
  const [recAgent,    setRecAgent]    = useState("");
  const [recCash,     setRecCash]     = useState("");
  const [recCards,    setRecCards]    = useState("");
  const [recNotes,    setRecNotes]    = useState("");
  const [receiving,   setReceiving]   = useState(false);

  /* ─── قائمة العهد ─── */
  const [agents,    setAgents]    = useState<any[]>([]);
  const [listLoad,  setListLoad]  = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /* ─── مودال نتيجة ─── */
  const [modal, setModal] = useState({ visible: false, title: "", message: "", color: Colors.success });

  const showOk  = (title: string, msg: string, color = Colors.success) =>
    setModal({ visible: true, title, message: msg, color });

  const fetchAgents = useCallback(async () => {
    setListLoad(true);
    try {
      const data = await apiGet("/custody/agents", token);
      setAgents(Array.isArray(data) ? data : []);
    } catch {} finally {
      setListLoad(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  /* ═══════════════════════════════════════════
     تسليم عهدة
  ═══════════════════════════════════════════ */
  const handleSend = async () => {
    const amount = parseFloat(sendAmount.replace(/[^0-9.]/g, "")) || 0;
    if (!sendAgent.trim()) return showOk("خطأ", "أدخل اسم المندوب", Colors.error);
    if (amount <= 0)       return showOk("خطأ", "أدخل قيمة الكروت", Colors.error);
    setSending(true);
    try {
      await apiPost("/custody/send", token, {
        agentName: sendAgent.trim(),
        amount,
        notes: sendNotes.trim() || undefined,
      });
      setSendAgent(""); setSendAmount(""); setSendNotes("");
      await fetchAgents();
      showOk(
        "تم تسليم العهدة ✓",
        `تم تسليم ${formatCurrency(amount)} كروت للمندوب ${sendAgent.trim()}\nتم تحديث العهدة عند المندوبين`
      );
    } catch (e: any) {
      showOk("خطأ", e?.message ?? "فشل التسليم", Colors.error);
    } finally {
      setSending(false);
    }
  };

  /* ═══════════════════════════════════════════
     استلام عهدة
  ═══════════════════════════════════════════ */
  const handleReceive = async () => {
    const cash  = parseFloat(recCash.replace(/[^0-9.]/g, ""))  || 0;
    const cards = parseFloat(recCards.replace(/[^0-9.]/g, "")) || 0;
    if (!recAgent.trim())      return showOk("خطأ", "أدخل اسم المندوب", Colors.error);
    if (cash <= 0 && cards <= 0) return showOk("خطأ", "أدخل مبلغ النقد أو قيمة الكروت المرتجعة", Colors.error);
    setReceiving(true);
    try {
      await apiPost("/custody/receive", token, {
        agentName:     recAgent.trim(),
        cashReceived:  cash  > 0 ? cash  : undefined,
        cardsReturned: cards > 0 ? cards : undefined,
        notes: recNotes.trim() || undefined,
      });
      const parts: string[] = [];
      if (cash  > 0) parts.push(`${formatCurrency(cash)} نقد → أُضيف للصندوق`);
      if (cards > 0) parts.push(`${formatCurrency(cards)} كروت مرتجعة`);
      setRecAgent(""); setRecCash(""); setRecCards(""); setRecNotes("");
      await fetchAgents();
      showOk("تم الاستلام ✓", `من المندوب ${recAgent.trim()}\n${parts.join("\n")}`);
    } catch (e: any) {
      showOk("خطأ", e?.message ?? "فشل الاستلام", Colors.error);
    } finally {
      setReceiving(false);
    }
  };

  /* ══════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════ */
  const sendValid = !!sendAgent.trim() && parseFloat(sendAmount || "0") > 0;
  const recValid  = !!recAgent.trim() && (parseFloat(recCash || "0") > 0 || parseFloat(recCards || "0") > 0);

  const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
    { key: "send",    label: "تسليم",       icon: "arrow-up-circle",   color: Colors.warning },
    { key: "receive", label: "استلام",       icon: "arrow-down-circle", color: Colors.success },
    { key: "list",    label: "قائمة العهد", icon: "list",              color: Colors.info    },
  ];

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إدارة العهدة</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ─── Tabs ─── */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && { backgroundColor: t.color + "20", borderColor: t.color }]}
            onPress={() => setTab(t.key)}
          >
            <Ionicons name={t.icon} size={18} color={tab === t.key ? t.color : Colors.textSecondary} />
            <Text style={[styles.tabText, tab === t.key && { color: t.color }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ══════════════ تسليم عهدة ══════════════ */}
      {tab === "send" && (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* بطاقة شرح */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={18} color={Colors.warning} />
            <Text style={styles.infoText}>
              تسليم كروت للمندوب يُنقص من إجمالي الكروت ويُضيف للعهدة عند المندوبين
            </Text>
          </View>

          <View style={styles.card}>
            <Field
              label="اسم المندوب *"
              value={sendAgent}
              onChange={setSendAgent}
              placeholder="مثال: مشعل"
            />
            <Field
              label="قيمة الكروت المُسلَّمة (ر.س) *"
              value={sendAmount}
              onChange={v => setSendAmount(v.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              keyboard="decimal-pad"
              hint="يُدخَل المبلغ الإجمالي مباشرة بدون تحديد الفئات"
            />
            <Field
              label="ملاحظات (اختياري)"
              value={sendNotes}
              onChange={setSendNotes}
              placeholder="أي ملاحظات..."
            />
          </View>

          {/* ملخص */}
          {sendValid && (
            <View style={[styles.summaryBox, { borderColor: Colors.warning + "55" }]}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>المندوب</Text>
                <Text style={styles.summaryValue}>{sendAgent}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>قيمة الكروت</Text>
                <Text style={[styles.summaryValue, { color: Colors.warning }]}>
                  {formatCurrency(parseFloat(sendAmount))}
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.effectRow]}>
                <View style={styles.effectItem}>
                  <Ionicons name="arrow-down" size={12} color={Colors.error} />
                  <Text style={[styles.effectText, { color: Colors.error }]}>إجمالي الكروت</Text>
                </View>
                <View style={styles.effectItem}>
                  <Ionicons name="arrow-up" size={12} color={Colors.warning} />
                  <Text style={[styles.effectText, { color: Colors.warning }]}>عهدة المندوبين</Text>
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: Colors.warning }, (!sendValid || sending) && { opacity: 0.45 }]}
            onPress={handleSend}
            disabled={!sendValid || sending}
          >
            {sending
              ? <ActivityIndicator color="#FFF" />
              : <>
                  <Ionicons name="arrow-up-circle" size={20} color="#FFF" />
                  <Text style={styles.submitBtnText}>تسليم العهدة</Text>
                </>}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ══════════════ استلام عهدة ══════════════ */}
      {tab === "receive" && (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* بطاقة شرح */}
          <View style={[styles.infoCard, { borderColor: Colors.success + "40" }]}>
            <Ionicons name="information-circle" size={18} color={Colors.success} />
            <Text style={styles.infoText}>
              النقد المستلم يُضاف للصندوق ويُسجَّل كمبيعات. الكروت المرتجعة تُضاف لإجمالي الكروت.
              وكلاهما يُنقص العهدة عند المندوبين.
            </Text>
          </View>

          <View style={styles.card}>
            <Field
              label="اسم المندوب *"
              value={recAgent}
              onChange={setRecAgent}
              placeholder="مثال: مشعل"
            />

            {/* نقد */}
            <View style={styles.receiveSection}>
              <View style={styles.receiveSectionHeader}>
                <Ionicons name="cash" size={16} color={Colors.success} />
                <Text style={[styles.receiveSectionTitle, { color: Colors.success }]}>النقد المستلم</Text>
              </View>
              <TextInput
                style={styles.fieldInput}
                value={recCash}
                onChangeText={v => setRecCash(v.replace(/[^0-9.]/g, ""))}
                placeholder="0 — اتركه فارغاً إن لم يكن هناك نقد"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                textAlign="right"
              />
              {parseFloat(recCash || "0") > 0 && (
                <Text style={[styles.fieldHint, { color: Colors.success }]}>
                  ✓ يُضاف للصندوق النقدي + يُسجَّل كمبيعات
                </Text>
              )}
            </View>

            {/* كروت */}
            <View style={styles.receiveSection}>
              <View style={styles.receiveSectionHeader}>
                <Ionicons name="card" size={16} color={Colors.info} />
                <Text style={[styles.receiveSectionTitle, { color: Colors.info }]}>الكروت المرتجعة</Text>
              </View>
              <TextInput
                style={styles.fieldInput}
                value={recCards}
                onChangeText={v => setRecCards(v.replace(/[^0-9.]/g, ""))}
                placeholder="0 — اتركه فارغاً إن لم تكن هناك كروت"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                textAlign="right"
              />
              {parseFloat(recCards || "0") > 0 && (
                <Text style={[styles.fieldHint, { color: Colors.info }]}>
                  ✓ تُضاف لإجمالي الكروت لدى المسؤول المالي
                </Text>
              )}
            </View>

            <Field
              label="ملاحظات (اختياري)"
              value={recNotes}
              onChange={setRecNotes}
              placeholder="أي ملاحظات..."
            />
          </View>

          {/* ملخص الأثر */}
          {recValid && (
            <View style={[styles.summaryBox, { borderColor: Colors.success + "55" }]}>
              <Text style={[styles.summaryValue, { textAlign: "right", marginBottom: 8 }]}>
                من المندوب: {recAgent}
              </Text>
              {parseFloat(recCash || "0") > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>نقد مستلم</Text>
                  <Text style={[styles.summaryValue, { color: Colors.success }]}>
                    {formatCurrency(parseFloat(recCash))}
                  </Text>
                </View>
              )}
              {parseFloat(recCards || "0") > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>كروت مرتجعة</Text>
                  <Text style={[styles.summaryValue, { color: Colors.info }]}>
                    {formatCurrency(parseFloat(recCards))}
                  </Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>ينقص من عهدة المندوبين</Text>
                <Text style={[styles.summaryValue, { color: Colors.error }]}>
                  {formatCurrency((parseFloat(recCash || "0") + parseFloat(recCards || "0")))}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: Colors.success }, (!recValid || receiving) && { opacity: 0.45 }]}
            onPress={handleReceive}
            disabled={!recValid || receiving}
          >
            {receiving
              ? <ActivityIndicator color="#FFF" />
              : <>
                  <Ionicons name="arrow-down-circle" size={20} color="#FFF" />
                  <Text style={styles.submitBtnText}>تأكيد الاستلام</Text>
                </>}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ══════════════ قائمة العهد ══════════════ */}
      {tab === "list" && (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAgents(); }} />}
        >
          {listLoad ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 60 }} />
          ) : agents.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="checkmark-circle" size={60} color={Colors.success} />
              <Text style={styles.emptyTitle}>لا توجد عهد مفتوحة</Text>
              <Text style={styles.emptyHint}>جميع العهد تم تصفيتها بالكامل</Text>
            </View>
          ) : (
            <>
              <Text style={styles.listCount}>{agents.length} عهدة مفتوحة</Text>
              {agents.map((a, idx) => {
                const pct = a.totalSent > 0 ? ((a.totalSent - a.remaining) / a.totalSent) * 100 : 0;
                return (
                  <View key={`${a.agentName}-${idx}`} style={styles.agentCard}>
                    {/* رأس البطاقة */}
                    <View style={styles.agentHeader}>
                      <View style={styles.agentAvatar}>
                        <Text style={styles.agentAvatarText}>{a.agentName?.charAt(0) ?? "م"}</Text>
                      </View>
                      <View style={styles.agentInfo}>
                        <Text style={styles.agentName}>{a.agentName}</Text>
                        <Text style={styles.agentSub}>عهدة مفتوحة</Text>
                      </View>
                      <View style={styles.agentRemaining}>
                        <Text style={styles.agentRemainingLabel}>المتبقي</Text>
                        <Text style={styles.agentRemainingValue}>{formatCurrency(a.remaining)}</Text>
                      </View>
                    </View>

                    {/* شريط التقدم */}
                    <View style={styles.progressWrap}>
                      <View style={[styles.progressBar, { width: `${Math.min(100, pct)}%` as any }]} />
                    </View>

                    {/* تفاصيل */}
                    <View style={styles.agentDetails}>
                      <View style={styles.agentDetailItem}>
                        <Text style={styles.agentDetailLabel}>إجمالي المُسلَّم</Text>
                        <Text style={[styles.agentDetailValue, { color: Colors.warning }]}>
                          {formatCurrency(a.totalSent)}
                        </Text>
                      </View>
                      <View style={styles.agentDetailItem}>
                        <Text style={styles.agentDetailLabel}>المستلم حتى الآن</Text>
                        <Text style={[styles.agentDetailValue, { color: Colors.success }]}>
                          {formatCurrency(a.totalReceived)}
                        </Text>
                      </View>
                    </View>

                    {/* زر استلام سريع */}
                    <TouchableOpacity
                      style={styles.quickReceiveBtn}
                      onPress={() => {
                        setRecAgent(a.agentName);
                        setTab("receive");
                      }}
                    >
                      <Ionicons name="arrow-down-circle" size={16} color={Colors.success} />
                      <Text style={styles.quickReceiveBtnText}>استلام من {a.agentName}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ─── مودال النتيجة ─── */}
      <ConfirmModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        color={modal.color}
        onClose={() => setModal(m => ({ ...m, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: Colors.text },

  /* Tabs */
  tabBar: { flexDirection: "row-reverse", padding: 12, gap: 8 },
  tab: {
    flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tabText: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },

  content: { padding: 16 },

  /* Info */
  infoCard: {
    flexDirection: "row-reverse", alignItems: "flex-start", gap: 8,
    backgroundColor: Colors.warning + "12", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.warning + "40", marginBottom: 14,
  },
  infoText: { flex: 1, fontSize: 12, color: Colors.textSecondary, textAlign: "right", lineHeight: 18 },

  /* Card */
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: Colors.border, gap: 2,
  },

  /* Field */
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: 7, fontWeight: "600" },
  fieldInput: {
    backgroundColor: Colors.background, borderRadius: 10, padding: 13,
    color: Colors.text, fontSize: 15, borderWidth: 1, borderColor: Colors.border,
  },
  fieldHint: { fontSize: 11, color: Colors.textMuted, textAlign: "right", marginTop: 5 },

  /* Receive sections */
  receiveSection: { marginBottom: 16 },
  receiveSectionHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 6, marginBottom: 8 },
  receiveSectionTitle: { fontSize: 14, fontWeight: "700" },

  /* Summary */
  summaryBox: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1.5, marginBottom: 14,
  },
  summaryRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingVertical: 5 },
  summaryLabel: { fontSize: 13, color: Colors.textSecondary },
  summaryValue: { fontSize: 15, fontWeight: "700", color: Colors.text },
  effectRow: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, marginTop: 4 },
  effectItem: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  effectText: { fontSize: 11, fontWeight: "600" },

  /* Submit */
  submitBtn: {
    borderRadius: 14, paddingVertical: 15,
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8,
  },
  submitBtnText: { fontSize: 17, fontWeight: "bold", color: "#FFF" },

  /* Agent List */
  listCount: { fontSize: 12, color: Colors.textMuted, textAlign: "right", marginBottom: 12 },
  agentCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: Colors.border,
  },
  agentHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 12, marginBottom: 12 },
  agentAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.warning + "25",
    justifyContent: "center", alignItems: "center",
  },
  agentAvatarText: { fontSize: 20, fontWeight: "bold", color: Colors.warning },
  agentInfo: { flex: 1, alignItems: "flex-end" },
  agentName: { fontSize: 16, fontWeight: "bold", color: Colors.text },
  agentSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  agentRemaining: { alignItems: "flex-start" },
  agentRemainingLabel: { fontSize: 10, color: Colors.textMuted },
  agentRemainingValue: { fontSize: 18, fontWeight: "800", color: Colors.error },

  progressWrap: {
    height: 5, backgroundColor: Colors.border, borderRadius: 3, marginBottom: 12, overflow: "hidden",
  },
  progressBar: { height: "100%", backgroundColor: Colors.success, borderRadius: 3 },

  agentDetails: { flexDirection: "row-reverse", gap: 8, marginBottom: 12 },
  agentDetailItem: {
    flex: 1, backgroundColor: Colors.background, borderRadius: 10, padding: 10, alignItems: "center",
  },
  agentDetailLabel: { fontSize: 10, color: Colors.textMuted, marginBottom: 4 },
  agentDetailValue: { fontSize: 14, fontWeight: "700" },

  quickReceiveBtn: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 9, borderRadius: 10,
    backgroundColor: Colors.success + "15", borderWidth: 1, borderColor: Colors.success + "40",
  },
  quickReceiveBtnText: { fontSize: 13, fontWeight: "600", color: Colors.success },

  /* Empty */
  emptyBox: { alignItems: "center", marginTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", color: Colors.text },
  emptyHint: { fontSize: 13, color: Colors.textMuted },

  /* Alert Modal */
  alertOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 30 },
  alertBox: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: Colors.border, width: "100%", alignItems: "center", gap: 10,
  },
  alertIcon: { width: 70, height: 70, borderRadius: 35, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  alertTitle: { fontSize: 17, fontWeight: "bold", color: Colors.text, textAlign: "center" },
  alertMsg: { fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  alertBtn: { borderRadius: 12, paddingHorizontal: 30, paddingVertical: 12, marginTop: 4 },
  alertBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
});
