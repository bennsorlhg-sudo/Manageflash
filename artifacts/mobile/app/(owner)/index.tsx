import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, RefreshControl, Modal, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Colors as StaticColors } from "@/constants/colors";
import { useColors } from "@/context/ThemeContext";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, apiPatch, apiDelete, formatCurrency, formatDate, DENOMINATIONS, CARD_PRICES } from "@/utils/api";

/* ─────────────────────────────────────────────────────
   بطاقة KPI
───────────────────────────────────────────────────── */
function KPICard({
  title, value, icon, color, subtitle,
}: {
  title: string; value: number;
  icon: keyof typeof Ionicons.glyphMap; color: string; subtitle?: string;
}) {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
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
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
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
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
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
  const Colors = useColors();
  const { isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* ─── الأرقام الست ─── */
  const [totalCustody, setTotalCustody] = useState(0);
  const [cashBalance,  setCashBalance]  = useState(0);
  const [cardsValue,   setCardsValue]   = useState(0);
  const [agentCustody, setAgentCustody] = useState(0);
  const [totalLoans,   setTotalLoans]   = useState(0);
  const [totalDebts,   setTotalDebts]   = useState(0);

  /* ─── المهام ─── */
  const [tasks, setTasks] = useState<any[]>([]);

  /* ─── Modals ─── */
  const [showCustodyModal, setShowCustodyModal] = useState(false);
  const [showTaskModal,    setShowTaskModal]    = useState(false);

  /* ─── Alert ─── */
  const [alert, setAlert] = useState({ visible: false, title: "", message: "", color: Colors.success });
  const showAlert = (title: string, message: string, color = Colors.success) =>
    setAlert({ visible: true, title, message, color });

  const fetchData = useCallback(async () => {
    try {
      const [summary, taskList] = await Promise.all([
        apiGet("/finances/summary", token),
        apiGet("/tasks", token),
      ]);
      setTotalCustody(summary.totalCustody ?? 0);
      setCashBalance(summary.cashBalance   ?? 0);
      setCardsValue(summary.cardsValue     ?? 0);
      setAgentCustody(summary.agentCustody ?? 0);
      setTotalLoans(summary.totalLoans     ?? 0);
      setTotalDebts(summary.totalDebts ?? summary.totalOwed ?? 0);
      const active = Array.isArray(taskList)
        ? taskList.filter((t: any) => t.status !== "completed" && t.status !== "cancelled")
        : [];
      setTasks(active);
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
        {/* زر تبديل الوضع الليلي / النهاري */}
        <TouchableOpacity
          onPress={toggleTheme}
          activeOpacity={0.75}
          style={styles.themeBtn}
        >
          <Ionicons
            name={isDark ? "sunny" : "moon"}
            size={22}
            color={isDark ? "#F9A825" : "#5C6BC0"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 50 : insets.bottom + 30 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
        }
      >

        {/* ══════════════════════════════════════════════
            6 بطاقات KPI
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
            المتابعة
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
            الإجراءات
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

        {/* ══════════════════════════════════════════════
            قائمة المهام
        ══════════════════════════════════════════════ */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionDot, { backgroundColor: Colors.info }]} />
          <Text style={styles.sectionTitle}>المهام ({tasks.length})</Text>
        </View>

        {tasks.length === 0 ? (
          <View style={styles.emptyTasks}>
            <Ionicons name="checkmark-done-circle-outline" size={38} color={Colors.textMuted} />
            <Text style={styles.emptyTasksTxt}>لا توجد مهام نشطة</Text>
          </View>
        ) : (
          tasks.map(task => (
            <OwnerTaskCard
              key={task.id}
              task={task}
              onDone={async () => {
                try {
                  await apiPatch(`/tasks/${task.id}`, token, { status: "completed" });
                  setTasks(prev => prev.filter(t => t.id !== task.id));
                } catch {}
              }}
              onDelete={async () => {
                try {
                  await apiDelete(`/tasks/${task.id}`, token);
                  setTasks(prev => prev.filter(t => t.id !== task.id));
                } catch {}
              }}
            />
          ))
        )}

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
   Modal إضافة عهدة
═══════════════════════════════════════════════════ */
function AddCustodyModal({ visible, token, onClose, onSuccess, onError, insets }: {
  visible: boolean; token: string | null;
  onClose: () => void; onSuccess: () => Promise<void>;
  onError: (msg: string) => void; insets: any;
}) {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const [type,         setType]         = useState<"cash" | "cards">("cash");
  const [amount,       setAmount]       = useState("");
  const [denomination, setDenomination] = useState(1000);
  const [cardCount,    setCardCount]    = useState("");
  const [cardsAmount,  setCardsAmount]  = useState("");
  const [notes,        setNotes]        = useState("");
  const [saving,       setSaving]       = useState(false);

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

            {type === "cards" && (
              <>
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
   بطاقة مهمة عند المالك
═══════════════════════════════════════════════════ */
const ROLE_COLOR_MAP: Record<string, string> = {
  finance_manager: StaticColors.success,
  supervisor:      StaticColors.info,
  tech_engineer:   StaticColors.warning,
};
const ROLE_LABEL: Record<string, string> = {
  finance_manager: "مسؤول مالي",
  supervisor:      "مشرف",
  tech_engineer:   "مهندس فني",
};

function OwnerTaskCard({ task, onDone, onDelete }: {
  task: any; onDone: () => void; onDelete: () => void;
}) {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const color = ROLE_COLOR_MAP[task.targetRole] ?? Colors.primary;
  return (
    <View style={[styles.taskCard, { borderColor: color + "40" }]}>
      <View style={styles.taskTop}>
        <View style={[styles.taskRoleBadge, { backgroundColor: color + "20" }]}>
          <Text style={[styles.taskRoleTxt, { color }]}>{ROLE_LABEL[task.targetRole] ?? task.targetRole}</Text>
        </View>
        {task.targetPersonName ? (
          <Text style={styles.taskPersonName}>{task.targetPersonName}</Text>
        ) : null}
      </View>
      <Text style={styles.taskDesc} numberOfLines={3}>{task.description}</Text>
      <Text style={styles.taskDate}>{formatDate(task.createdAt)}</Text>
      <View style={styles.taskActions}>
        <TouchableOpacity style={styles.taskDeleteBtn} onPress={onDelete}>
          <Ionicons name="trash-outline" size={16} color={Colors.error} />
          <Text style={[styles.taskBtnTxt, { color: Colors.error }]}>حذف</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.taskDoneBtn, { backgroundColor: Colors.success + "18", borderColor: Colors.success + "60" }]} onPress={onDone}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
          <Text style={[styles.taskBtnTxt, { color: Colors.success }]}>تم التنفيذ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════
   Modal إضافة مهمة — مع أسماء الفريق
═══════════════════════════════════════════════════ */
function AddTaskModal({ visible, token, onClose, onSuccess, onError }: {
  visible: boolean; token: string | null;
  onClose: () => void; onSuccess: () => void; onError: (msg: string) => void;
}) {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const [members,     setMembers]     = useState<{ id: number; name: string; role: string }[]>([]);
  const [selectedId,  setSelectedId]  = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    if (visible) {
      apiGet("/users", token)
        .then((data: any) => {
          const list = Array.isArray(data) ? data : (data.users ?? []);
          const team = list.filter((u: any) => u.role !== "owner" && u.isActive !== false);
          setMembers(team);
          if (team.length > 0 && selectedId === null) setSelectedId(team[0].id);
        })
        .catch(() => {});
    }
  }, [visible]);

  const selectedMember = members.find(m => m.id === selectedId);

  const handleSubmit = async () => {
    if (!description.trim()) return onError("يرجى كتابة وصف المهمة");
    if (!selectedMember) return onError("يرجى اختيار شخص");
    setSaving(true);
    try {
      await apiPost("/tasks", token, {
        title: description.slice(0, 80),
        description,
        targetRole: selectedMember.role,
        assignedToId: selectedMember.id,
        assignedByRole: "owner",
      });
      setDescription("");
      setSelectedId(null);
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

          <Text style={styles.fieldLabel}>اختر الشخص المسؤول</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            <View style={{ flexDirection: "row-reverse", gap: 8, paddingBottom: 4 }}>
              {members.map(m => {
                const color = ROLE_COLOR_MAP[m.role] ?? Colors.primary;
                const active = selectedId === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.memberBtn, active && { borderColor: color, backgroundColor: color + "18" }]}
                    onPress={() => setSelectedId(m.id)}
                  >
                    <View style={[styles.memberIcon, { backgroundColor: color + "22" }]}>
                      <Ionicons name="person" size={14} color={color} />
                    </View>
                    <View>
                      <Text style={[styles.memberName, active && { color }]}>{m.name}</Text>
                      <Text style={styles.memberRole}>{ROLE_LABEL[m.role] ?? m.role}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

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
   Styles Factory
═══════════════════════════════════════════════════ */
import type { ThemeColors } from "@/constants/colors";

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    center:    { justifyContent: "center", alignItems: "center" },

    header: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    headerTitle: { fontSize: 18, fontWeight: "bold", color: C.text },
    themeBtn: {
      width: 38, height: 38, borderRadius: 12,
      alignItems: "center", justifyContent: "center",
      backgroundColor: C.surfaceElevated,
      borderWidth: 1, borderColor: C.border,
    },
    content: { padding: 14, gap: 14 },

    /* KPI */
    kpiGrid: { gap: 10 },
    kpiRow:  { flexDirection: "row-reverse", gap: 10 },
    kpiCard: {
      flex: 1, backgroundColor: C.surface,
      borderRadius: 14, borderWidth: 1.5,
      padding: 14, gap: 6, alignItems: "flex-end",
    },
    kpiTop:   { flexDirection: "row-reverse", alignItems: "center", gap: 8, width: "100%" },
    kpiIcon:  { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    kpiTitle: { flex: 1, fontSize: 12, fontWeight: "600", color: C.textSecondary, textAlign: "right" },
    kpiValue: { fontSize: 18, fontWeight: "800", textAlign: "right" },
    kpiSub:   { fontSize: 10, color: C.textMuted, textAlign: "right" },

    /* Section */
    sectionHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
    sectionDot:    { width: 4, height: 18, borderRadius: 2 },
    sectionTitle:  { fontSize: 15, fontWeight: "700", color: C.text },

    /* Actions */
    actionsBlock: { gap: 10 },
    actionRow:    { flexDirection: "row-reverse", gap: 10 },
    actionBtn: {
      flex: 1, backgroundColor: C.surface,
      borderRadius: 14, borderWidth: 1,
      paddingVertical: 14, alignItems: "center", gap: 8,
    },
    actionIcon:  { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    actionLabel: { fontSize: 12, fontWeight: "700", color: C.text, textAlign: "center" },

    /* Modal */
    modalOverlay: {
      flex: 1, backgroundColor: C.overlay,
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, maxHeight: "90%",
    },
    modalHeader: {
      flexDirection: "row-reverse", justifyContent: "space-between",
      alignItems: "center", marginBottom: 20,
    },
    modalTitle: { fontSize: 18, fontWeight: "800", color: C.text },

    fieldLabel: { fontSize: 13, fontWeight: "600", color: C.textSecondary, textAlign: "right", marginBottom: 8 },
    fieldInput: {
      backgroundColor: C.inputBackground, borderRadius: 12, padding: 13,
      color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.inputBorder,
    },

    segRow: { flexDirection: "row-reverse", gap: 8 },
    segBtn: {
      flex: 1, paddingVertical: 11, flexDirection: "row-reverse",
      alignItems: "center", justifyContent: "center", gap: 6,
      borderRadius: 10, borderWidth: 1.5,
      borderColor: C.border, backgroundColor: C.inputBackground,
    },
    segBtnActive:    { borderColor: C.primary, backgroundColor: C.primary + "18" },
    segBtnTxt:       { fontSize: 13, fontWeight: "700", color: C.textSecondary },
    segBtnTxtActive: { color: C.primary },

    denomBtn: {
      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.inputBackground,
      alignItems: "center", gap: 2,
    },
    denomBtnActive:    { borderColor: C.primary, backgroundColor: C.primary + "18" },
    denomBtnTxt:       { fontSize: 13, fontWeight: "700", color: C.textSecondary },
    denomBtnTxtActive: { color: C.primary },
    denomPrice:        { fontSize: 10, color: C.textMuted },
    denomPriceActive:  { color: C.primary },

    amountLabelRow: {
      flexDirection: "row-reverse", justifyContent: "space-between",
      alignItems: "center", marginTop: 16,
    },
    amountHint: { fontSize: 11, color: C.textMuted, fontStyle: "italic" },

    saveBtn: {
      backgroundColor: C.primary, borderRadius: 14,
      padding: 15, alignItems: "center", marginTop: 20,
    },
    saveBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },

    /* Task cards */
    emptyTasks:    { alignItems: "center", paddingVertical: 20, gap: 8 },
    emptyTasksTxt: { fontSize: 14, color: C.textMuted },
    taskCard: {
      backgroundColor: C.surface, borderRadius: 14, borderWidth: 1.5,
      padding: 14, gap: 8,
    },
    taskTop:        { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
    taskRoleBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    taskRoleTxt:    { fontSize: 12, fontWeight: "700" },
    taskPersonName: { fontSize: 13, fontWeight: "700", color: C.text },
    taskDesc:       { fontSize: 14, color: C.text, textAlign: "right", lineHeight: 20 },
    taskDate:       { fontSize: 11, color: C.textMuted, textAlign: "right" },
    taskActions:    { flexDirection: "row-reverse", gap: 8, marginTop: 4 },
    taskDoneBtn: {
      flex: 1, flexDirection: "row-reverse", alignItems: "center",
      justifyContent: "center", gap: 6, paddingVertical: 9,
      borderRadius: 10, borderWidth: 1,
    },
    taskDeleteBtn: {
      flexDirection: "row-reverse", alignItems: "center",
      justifyContent: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 9,
      borderRadius: 10, borderWidth: 1, borderColor: C.error + "50",
      backgroundColor: C.error + "10",
    },
    taskBtnTxt: { fontSize: 13, fontWeight: "700" },

    /* Member selection */
    memberBtn: {
      flexDirection: "row-reverse", alignItems: "center", gap: 8,
      paddingHorizontal: 12, paddingVertical: 10,
      borderRadius: 12, borderWidth: 1.5, borderColor: C.border,
      backgroundColor: C.inputBackground,
    },
    memberIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    memberName: { fontSize: 13, fontWeight: "700", color: C.text, textAlign: "right" },
    memberRole: { fontSize: 11, color: C.textMuted, textAlign: "right" },

    /* Alert */
    alertOverlay: {
      flex: 1, backgroundColor: C.overlay,
      justifyContent: "center", alignItems: "center", padding: 24,
    },
    alertBox: {
      backgroundColor: C.surface, borderRadius: 20, padding: 28,
      width: "100%", maxWidth: 340, alignItems: "center", gap: 12,
    },
    alertIconWrap: { width: 68, height: 68, borderRadius: 34, justifyContent: "center", alignItems: "center" },
    alertTitle:    { fontSize: 17, fontWeight: "800", color: C.text, textAlign: "center" },
    alertMsg:      { fontSize: 13, color: C.textSecondary, textAlign: "center" },
    alertBtn:      { paddingVertical: 13, paddingHorizontal: 32, borderRadius: 12 },
    alertBtnTxt:   { color: "#fff", fontWeight: "700", fontSize: 15 },
  });
}
