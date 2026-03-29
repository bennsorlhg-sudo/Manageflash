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

/* ─── مودال تأكيد ─── */
function ConfirmModal({ visible, title, message, color, onClose }: {
  visible: boolean; title: string; message: string; color: string; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.alertOverlay}>
        <View style={styles.alertBox}>
          <View style={[styles.alertIcon, { backgroundColor: color + "20" }]}>
            <Ionicons name={color === Colors.error ? "close-circle" : "checkmark-circle"} size={40} color={color} />
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
function Field({ label, value, onChange, placeholder, keyboard, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboard?: any; hint?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value} onChangeText={onChange}
        placeholder={placeholder ?? ""} placeholderTextColor={Colors.textMuted}
        keyboardType={keyboard ?? "default"} textAlign="right"
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

/* ─── بطاقة مندوب قابلة للاختيار ─── */
function AgentPickerCard({ agent, selected, onPress }: {
  agent: { agentName: string; remaining: number; totalSent: number; totalReceived: number };
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.agentPickCard, selected && styles.agentPickCardSel]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* أيقونة الاختيار */}
      <View style={[styles.agentPickRadio, selected && { borderColor: Colors.success, backgroundColor: Colors.success }]}>
        {selected && <Ionicons name="checkmark" size={12} color="#fff" />}
      </View>

      {/* اسم المندوب + المتبقي */}
      <View style={{ flex: 1 }}>
        <View style={styles.agentPickRow}>
          <Text style={[styles.agentPickRemaining, { color: Colors.warning }]}>
            (عليه {formatCurrency(agent.remaining)})
          </Text>
          <Text style={styles.agentPickName}>{agent.agentName}</Text>
        </View>
        {/* شريط تقدم صغير */}
        <View style={styles.agentPickBar}>
          <View style={[
            styles.agentPickBarFill,
            { width: `${Math.min(100, agent.totalSent > 0 ? ((agent.totalSent - agent.remaining) / agent.totalSent) * 100 : 0)}%` as any }
          ]} />
        </View>
      </View>
    </TouchableOpacity>
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
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [recCash,     setRecCash]     = useState("");
  const [recCards,    setRecCards]    = useState("");
  const [recNotes,    setRecNotes]    = useState("");
  const [receiving,   setReceiving]   = useState(false);

  /* ─── قائمة العهد ─── */
  const [agents,     setAgents]     = useState<any[]>([]);
  const [listLoad,   setListLoad]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /* ─── مودال نتيجة ─── */
  const [modal, setModal] = useState({ visible: false, title: "", message: "", color: Colors.success });
  const showOk = (title: string, msg: string, color = Colors.success) =>
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

  /* عند تغيير التبويب: امسح الاختيار */
  useEffect(() => {
    if (tab !== "receive") {
      setSelectedAgent(null);
      setRecCash(""); setRecCards(""); setRecNotes("");
    }
  }, [tab]);

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
        agentName: sendAgent.trim(), amount,
        notes: sendNotes.trim() || undefined,
      });
      setSendAgent(""); setSendAmount(""); setSendNotes("");
      await fetchAgents();
      showOk("تم تسليم العهدة ✓",
        `تم تسليم ${formatCurrency(amount)} كروت للمندوب ${sendAgent.trim()}\nتم تحديث العهدة عند المندوبين`);
    } catch (e: any) {
      showOk("خطأ", e?.message ?? "فشل التسليم", Colors.error);
    } finally { setSending(false); }
  };

  /* ═══════════════════════════════════════════
     استلام عهدة
  ═══════════════════════════════════════════ */
  const handleReceive = async () => {
    const cash  = parseFloat(recCash.replace(/[^0-9.]/g, ""))  || 0;
    const cards = parseFloat(recCards.replace(/[^0-9.]/g, "")) || 0;
    if (!selectedAgent)            return showOk("خطأ", "اختر المندوب من القائمة أعلاه", Colors.error);
    if (cash <= 0 && cards <= 0)   return showOk("خطأ", "أدخل مبلغ النقد أو قيمة الكروت المرتجعة", Colors.error);
    setReceiving(true);
    try {
      await apiPost("/custody/receive", token, {
        agentName:     selectedAgent,
        cashReceived:  cash  > 0 ? cash  : undefined,
        cardsReturned: cards > 0 ? cards : undefined,
        notes: recNotes.trim() || undefined,
      });
      const parts: string[] = [];
      if (cash  > 0) parts.push(`${formatCurrency(cash)} نقد → أُضيف للصندوق`);
      if (cards > 0) parts.push(`${formatCurrency(cards)} كروت مرتجعة`);
      const agentName = selectedAgent;
      setSelectedAgent(null); setRecCash(""); setRecCards(""); setRecNotes("");
      await fetchAgents();
      showOk("تم الاستلام ✓", `من المندوب: ${agentName}\n${parts.join("\n")}\nتم خصم المبلغ من عهدة المندوبين`);
    } catch (e: any) {
      showOk("خطأ", e?.message ?? "فشل الاستلام", Colors.error);
    } finally { setReceiving(false); }
  };

  /* ══════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════ */
  const sendValid = !!sendAgent.trim() && parseFloat(sendAmount || "0") > 0;
  const recValid  = !!selectedAgent && (parseFloat(recCash || "0") > 0 || parseFloat(recCards || "0") > 0);
  const selectedAgentData = agents.find(a => a.agentName === selectedAgent);

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
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={18} color={Colors.warning} />
            <Text style={styles.infoText}>
              تسليم كروت للمندوب يُنقص من إجمالي الكروت ويُضيف للعهدة عند المندوبين
            </Text>
          </View>

          <View style={styles.card}>
            <Field label="اسم المندوب *" value={sendAgent} onChange={setSendAgent} placeholder="مثال: مشعل" />
            <Field
              label="قيمة الكروت المُسلَّمة (ر.س) *"
              value={sendAmount}
              onChange={v => setSendAmount(v.replace(/[^0-9.]/g, ""))}
              placeholder="0" keyboard="decimal-pad"
              hint="يُدخَل المبلغ الإجمالي مباشرة"
            />
            <Field label="ملاحظات (اختياري)" value={sendNotes} onChange={setSendNotes} placeholder="أي ملاحظات..." />
          </View>

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
            onPress={handleSend} disabled={!sendValid || sending}
          >
            {sending ? <ActivityIndicator color="#FFF" /> : (
              <>
                <Ionicons name="arrow-up-circle" size={20} color="#FFF" />
                <Text style={styles.submitBtnText}>تسليم العهدة</Text>
              </>
            )}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ══════════════ استلام عهدة ══════════════ */}
      {tab === "receive" && (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* ─ شرح ─ */}
          <View style={[styles.infoCard, { borderColor: Colors.success + "40", backgroundColor: Colors.success + "0E" }]}>
            <Ionicons name="information-circle" size={18} color={Colors.success} />
            <Text style={styles.infoText}>
              النقد المستلم يُضاف للصندوق ويُنقص من عهدة المندوبين. الكروت المرتجعة تُنقص العهدة أيضاً.
            </Text>
          </View>

          {/* ─ اختر المندوب ─ */}
          <Text style={styles.sectionLabel}>اختر المندوب *</Text>

          {listLoad ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
          ) : agents.length === 0 ? (
            <View style={styles.noAgentsBox}>
              <Ionicons name="checkmark-circle" size={36} color={Colors.success} />
              <Text style={styles.noAgentsText}>لا توجد عهد مفتوحة</Text>
              <Text style={styles.noAgentsHint}>سلّم عهدة لمندوب أولاً</Text>
            </View>
          ) : (
            <View style={styles.agentPickList}>
              {agents.map((a, i) => (
                <AgentPickerCard
                  key={`${a.agentName}-${i}`}
                  agent={a}
                  selected={selectedAgent === a.agentName}
                  onPress={() => setSelectedAgent(prev => prev === a.agentName ? null : a.agentName)}
                />
              ))}
            </View>
          )}

          {/* ─ تفاصيل الاستلام ─ */}
          {selectedAgent && (
            <>
              <View style={styles.card}>
                {/* نقد */}
                <View style={styles.receiveSection}>
                  <View style={styles.receiveSectionHeader}>
                    <Ionicons name="cash" size={16} color={Colors.success} />
                    <Text style={[styles.receiveSectionTitle, { color: Colors.success }]}>النقد المستلم (ر.س)</Text>
                  </View>
                  <TextInput
                    style={styles.fieldInput}
                    value={recCash}
                    onChangeText={v => setRecCash(v.replace(/[^0-9.]/g, ""))}
                    placeholder="0 — اتركه فارغاً إن لم يكن هناك نقد"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad" textAlign="right"
                  />
                  {parseFloat(recCash || "0") > 0 && (
                    <Text style={[styles.fieldHint, { color: Colors.success }]}>
                      ✓ يُضاف للصندوق النقدي ويُنقص من عهدة المندوبين
                    </Text>
                  )}
                </View>

                {/* كروت */}
                <View style={styles.receiveSection}>
                  <View style={styles.receiveSectionHeader}>
                    <Ionicons name="card" size={16} color={Colors.info} />
                    <Text style={[styles.receiveSectionTitle, { color: Colors.info }]}>الكروت المرتجعة (ر.س)</Text>
                  </View>
                  <TextInput
                    style={styles.fieldInput}
                    value={recCards}
                    onChangeText={v => setRecCards(v.replace(/[^0-9.]/g, ""))}
                    placeholder="0 — اتركه فارغاً إن لم تكن هناك كروت"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad" textAlign="right"
                  />
                  {parseFloat(recCards || "0") > 0 && (
                    <Text style={[styles.fieldHint, { color: Colors.info }]}>
                      ✓ تُضاف لإجمالي الكروت وتُنقص من عهدة المندوبين
                    </Text>
                  )}
                </View>

                <Field label="ملاحظات (اختياري)" value={recNotes} onChange={setRecNotes} placeholder="أي ملاحظات..." />
              </View>

              {/* ملخص الأثر */}
              {recValid && (
                <View style={[styles.summaryBox, { borderColor: Colors.success + "55" }]}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>المندوب</Text>
                    <Text style={styles.summaryValue}>{selectedAgent}</Text>
                  </View>
                  {selectedAgentData && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>إجمالي عهدته</Text>
                      <Text style={[styles.summaryValue, { color: Colors.warning }]}>
                        {formatCurrency(selectedAgentData.remaining)}
                      </Text>
                    </View>
                  )}
                  {parseFloat(recCash || "0") > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>نقد مستلم → الصندوق</Text>
                      <Text style={[styles.summaryValue, { color: Colors.success }]}>
                        + {formatCurrency(parseFloat(recCash))}
                      </Text>
                    </View>
                  )}
                  {parseFloat(recCards || "0") > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>كروت مرتجعة → الكروت</Text>
                      <Text style={[styles.summaryValue, { color: Colors.info }]}>
                        + {formatCurrency(parseFloat(recCards))}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, marginTop: 4 }]}>
                    <Text style={styles.summaryLabel}>ينقص من عهدة المندوبين</Text>
                    <Text style={[styles.summaryValue, { color: Colors.error }]}>
                      − {formatCurrency(parseFloat(recCash || "0") + parseFloat(recCards || "0"))}
                    </Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: Colors.success }, (!recValid || receiving) && { opacity: 0.45 }]}
                onPress={handleReceive} disabled={!recValid || receiving}
              >
                {receiving ? <ActivityIndicator color="#FFF" /> : (
                  <>
                    <Ionicons name="arrow-down-circle" size={20} color="#FFF" />
                    <Text style={styles.submitBtnText}>تأكيد الاستلام من {selectedAgent}</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

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

                    <View style={styles.progressWrap}>
                      <View style={[styles.progressBar, { width: `${Math.min(100, pct)}%` as any }]} />
                    </View>

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

                    <TouchableOpacity
                      style={styles.quickReceiveBtn}
                      onPress={() => {
                        setSelectedAgent(a.agentName);
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

      <ConfirmModal
        visible={modal.visible} title={modal.title} message={modal.message} color={modal.color}
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

  tabBar: { flexDirection: "row-reverse", padding: 12, gap: 8 },
  tab: {
    flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tabText: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },

  content: { padding: 16 },

  infoCard: {
    flexDirection: "row-reverse", alignItems: "flex-start", gap: 8,
    backgroundColor: Colors.warning + "12", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.warning + "40", marginBottom: 14,
  },
  infoText: { flex: 1, fontSize: 12, color: Colors.textSecondary, textAlign: "right", lineHeight: 18 },

  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: Colors.border, gap: 2,
  },

  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: 7, fontWeight: "600" },
  fieldInput: {
    backgroundColor: Colors.background, borderRadius: 10, padding: 13,
    color: Colors.text, fontSize: 15, borderWidth: 1, borderColor: Colors.border,
  },
  fieldHint: { fontSize: 11, color: Colors.textMuted, textAlign: "right", marginTop: 5 },

  /* ─── Agent Picker (receive tab) ─── */
  sectionLabel: {
    fontSize: 14, fontWeight: "700", color: Colors.text,
    textAlign: "right", marginBottom: 10,
  },
  noAgentsBox: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 30,
    alignItems: "center", gap: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 14,
  },
  noAgentsText: { fontSize: 15, fontWeight: "700", color: Colors.text },
  noAgentsHint: { fontSize: 12, color: Colors.textMuted },

  agentPickList: { gap: 8, marginBottom: 14 },
  agentPickCard: {
    flexDirection: "row-reverse", alignItems: "center", gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  agentPickCardSel: {
    borderColor: Colors.success, backgroundColor: Colors.success + "0C",
  },
  agentPickRadio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: Colors.border, justifyContent: "center", alignItems: "center",
  },
  agentPickRow: {
    flexDirection: "row-reverse", alignItems: "center",
    justifyContent: "space-between", marginBottom: 6,
  },
  agentPickName: { fontSize: 15, fontWeight: "700", color: Colors.text },
  agentPickRemaining: { fontSize: 13, fontWeight: "600" },
  agentPickBar: {
    height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: "hidden",
  },
  agentPickBarFill: {
    height: "100%", backgroundColor: Colors.success + "80", borderRadius: 2,
  },

  receiveSection: { marginBottom: 14 },
  receiveSectionHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 6, marginBottom: 8 },
  receiveSectionTitle: { fontSize: 13, fontWeight: "700" },

  /* ─── Summary ─── */
  summaryBox: {
    backgroundColor: Colors.surface + "CC", borderRadius: 14, padding: 14,
    borderWidth: 1.5, marginBottom: 16, gap: 8,
  },
  summaryRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { fontSize: 13, color: Colors.textSecondary },
  summaryValue: { fontSize: 14, fontWeight: "700", color: Colors.text },
  effectRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  effectItem: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  effectText: { fontSize: 11, fontWeight: "600" },

  submitBtn: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 15, borderRadius: 14,
  },
  submitBtnText: { color: "#FFF", fontSize: 15, fontWeight: "800" },

  /* ─── List tab ─── */
  listCount: {
    fontSize: 13, color: Colors.textMuted, textAlign: "right",
    marginBottom: 12, fontWeight: "600",
  },
  agentCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  agentHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 12, marginBottom: 12 },
  agentAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + "25",
    justifyContent: "center", alignItems: "center",
  },
  agentAvatarText: { fontSize: 18, fontWeight: "800", color: Colors.primary },
  agentInfo: { flex: 1 },
  agentName: { fontSize: 16, fontWeight: "700", color: Colors.text, textAlign: "right" },
  agentSub: { fontSize: 11, color: Colors.textMuted, textAlign: "right" },
  agentRemaining: { alignItems: "flex-end" },
  agentRemainingLabel: { fontSize: 11, color: Colors.textMuted },
  agentRemainingValue: { fontSize: 16, fontWeight: "800", color: Colors.warning },

  progressWrap: {
    height: 6, backgroundColor: Colors.border, borderRadius: 3,
    overflow: "hidden", marginBottom: 12,
  },
  progressBar: { height: "100%", backgroundColor: Colors.success, borderRadius: 3 },

  agentDetails: { flexDirection: "row-reverse", gap: 8, marginBottom: 12 },
  agentDetailItem: { flex: 1, alignItems: "flex-end" },
  agentDetailLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  agentDetailValue: { fontSize: 14, fontWeight: "700" },

  quickReceiveBtn: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.success + "15", borderWidth: 1, borderColor: Colors.success + "40",
  },
  quickReceiveBtnText: { fontSize: 13, fontWeight: "700", color: Colors.success },

  emptyBox: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  emptyHint: { fontSize: 13, color: Colors.textMuted },

  /* ─── Alert Modal ─── */
  alertOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  alertBox: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 28,
    width: "100%", maxWidth: 340, alignItems: "center", gap: 12,
  },
  alertIcon: { width: 70, height: 70, borderRadius: 35, justifyContent: "center", alignItems: "center" },
  alertTitle: { fontSize: 18, fontWeight: "800", color: Colors.text, textAlign: "center" },
  alertMsg: { fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  alertBtn: { paddingHorizontal: 40, paddingVertical: 12, borderRadius: 12, marginTop: 4 },
  alertBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
