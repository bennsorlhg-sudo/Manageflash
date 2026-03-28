import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

const CARD_PRICES: Record<string, number> = {
  "200": 180, "300": 270, "500": 450, "1000": 900,
  "2000": 1800, "3000": 2700, "5000": 5000, "9000": 9000,
};
const DENOMINATIONS = ["200", "300", "500", "1000", "2000", "3000", "5000", "9000"];

interface DashboardData {
  ownerName: string;
  cashBalance: number;
  totalCustody: number;
  totalLoans: number;
  totalCardValue: number;
  totalSalesPoints: number;
  hotspotCount: number;
  broadbandCount: number;
}

export default function OwnerDashboard() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showCustodyModal, setShowCustodyModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/summary", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const onRefresh = () => { setRefreshing(true); fetchDashboard(); };

  const fmt = (n: number) => n.toLocaleString("ar-SA") + " ﷼";

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={styles.header}>
        <View style={styles.logoMini}>
          <Ionicons name="flash" size={22} color={Colors.primary} />
        </View>
        <View>
          <Text style={styles.greeting}>مالك الشبكة</Text>
          <Text style={styles.userName}>فهد الهندي</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 90 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingWrap}><ActivityIndicator color={Colors.primary} size="large" /></View>
        ) : (
          <>
            {/* Primary: Cash Balance */}
            <View style={[styles.primaryCard, { borderLeftColor: Colors.primary }]}>
              <View style={styles.primaryCardInner}>
                <View>
                  <Text style={styles.primaryLabel}>النقد في صندوق المسؤول المالي</Text>
                  <Text style={styles.primaryValue}>{fmt(data?.cashBalance ?? 0)}</Text>
                </View>
                <View style={styles.primaryIcon}>
                  <Ionicons name="wallet" size={32} color={Colors.primary} />
                </View>
              </View>
            </View>

            {/* Summary Cards */}
            <View style={styles.cardsRow}>
              <SummaryCard icon="layers" label="إجمالي العهدة" value={fmt(data?.totalCustody ?? 0)} color={Colors.warning} />
              <SummaryCard icon="trending-up" label="إجمالي السلف" value={fmt(data?.totalLoans ?? 0)} color={Colors.error} />
            </View>
            <View style={styles.cardsRow}>
              <SummaryCard icon="card" label="إجمالي الكروت" value={fmt(data?.totalCardValue ?? 0)} color={Colors.success} />
              <SummaryCard icon="storefront" label="نقاط البيع" value={String(data?.totalSalesPoints ?? 0)} color={Colors.roles.supervisor} />
            </View>

            {/* Network Summary */}
            <View style={styles.networkRow}>
              <View style={styles.networkCard}>
                <Ionicons name="wifi" size={18} color={Colors.primary} />
                <Text style={styles.networkValue}>{data?.hotspotCount ?? 0}</Text>
                <Text style={styles.networkLabel}>هوتسبوت</Text>
              </View>
              <View style={[styles.networkCard, styles.networkCardRight]}>
                <Ionicons name="radio" size={18} color={Colors.success} />
                <Text style={styles.networkValue}>{data?.broadbandCount ?? 0}</Text>
                <Text style={styles.networkLabel}>برودباند</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <Text style={styles.sectionTitle}>الإجراءات</Text>
            <View style={styles.actionsGrid}>
              <ActionBtn icon="gift" label="إضافة عهدة" color={Colors.warning} onPress={() => setShowCustodyModal(true)} />
              <ActionBtn icon="add-circle" label="إضافة مهمة" color={Colors.primary} onPress={() => setShowTaskModal(true)} />
              <ActionBtn icon="people" label="إدارة الفريق" color={Colors.roles.supervisor} onPress={() => router.push("/(owner)/team")} />
              <ActionBtn icon="wifi" label="الشبكة" color={Colors.success} onPress={() => router.push("/(owner)/network")} />
            </View>

            <Text style={styles.sectionTitle}>التقارير</Text>
            <View style={styles.reportsRow}>
              <ReportBtn icon="bar-chart" label="المبيعات" color={Colors.success} onPress={() => router.push({ pathname: "/(owner)/report", params: { type: "sales" } })} />
              <ReportBtn icon="receipt" label="المصروفات" color={Colors.error} onPress={() => router.push({ pathname: "/(owner)/report", params: { type: "expenses" } })} />
              <ReportBtn icon="trending-up" label="الربح" color={Colors.primary} onPress={() => router.push({ pathname: "/(owner)/report", params: { type: "profit" } })} />
            </View>
          </>
        )}
      </ScrollView>

      <AddCustodyModal visible={showCustodyModal} token={token} onClose={() => setShowCustodyModal(false)} onSuccess={() => { setShowCustodyModal(false); fetchDashboard(); }} insets={insets} />
      <AddTaskModal visible={showTaskModal} token={token} onClose={() => setShowTaskModal(false)} onSuccess={() => { setShowTaskModal(false); }} insets={insets} />
    </View>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <View style={[styles.summaryCard, { borderTopColor: color }]}>
      <View style={[styles.summaryIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ActionBtn({ icon, label, color, onPress }: { icon: any; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.actionIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ReportBtn({ icon, label, color, onPress }: { icon: any; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.reportBtn} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={styles.reportLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function AddCustodyModal({ visible, token, onClose, onSuccess, insets }: { visible: boolean; token: string | null; onClose: () => void; onSuccess: () => void; insets: any }) {
  const [type, setType] = useState<"cash" | "cards">("cash");
  const [amount, setAmount] = useState("");
  const [denomination, setDenomination] = useState("1000");
  const [cardCount, setCardCount] = useState("");
  const [toRole, setToRole] = useState<"finance_manager" | "supervisor">("finance_manager");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const calculatedValue = type === "cards" && cardCount ? (CARD_PRICES[denomination] ?? 0) * parseInt(cardCount || "0") : 0;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const body = type === "cash"
        ? { type, amount: parseFloat(amount), toRole, notes }
        : { type, denomination: parseInt(denomination), cardCount: parseInt(cardCount), toRole, notes };
      const res = await fetch("/api/custody", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        Alert.alert("تم", "تم إضافة العهدة بنجاح");
        onSuccess();
        setAmount(""); setCardCount(""); setNotes("");
      } else {
        const err = await res.json();
        Alert.alert("خطأ", err.error ?? "فشل إضافة العهدة");
      }
    } catch {
      Alert.alert("خطأ", "فشل الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="pageSheet">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.textSecondary} /></TouchableOpacity>
            <Text style={styles.modalTitle}>إضافة عهدة</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalForm}>
              {/* Type */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>نوع العهدة</Text>
                <View style={styles.segmented}>
                  {["cash", "cards"].map((t) => (
                    <TouchableOpacity key={t} style={[styles.segBtn, type === t && styles.segBtnActive]} onPress={() => setType(t as any)}>
                      <Text style={[styles.segBtnText, type === t && styles.segBtnTextActive]}>{t === "cash" ? "نقد" : "كروت"}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {type === "cash" ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>المبلغ (ريال)</Text>
                  <TextInput style={styles.fieldInput} value={amount} onChangeText={setAmount} keyboardType="numeric" textAlign="right" placeholder="0" placeholderTextColor={Colors.textMuted} />
                </View>
              ) : (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>فئة الكرت</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                        {DENOMINATIONS.map((d) => (
                          <TouchableOpacity key={d} style={[styles.denomBtn, denomination === d && styles.denomBtnActive]} onPress={() => setDenomination(d)}>
                            <Text style={[styles.denomBtnText, denomination === d && styles.denomBtnTextActive]}>{d}</Text>
                            <Text style={[styles.denomPrice, denomination === d && styles.denomPriceActive]}>{CARD_PRICES[d]}﷼</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>عدد الكروت</Text>
                    <TextInput style={styles.fieldInput} value={cardCount} onChangeText={setCardCount} keyboardType="numeric" textAlign="right" placeholder="0" placeholderTextColor={Colors.textMuted} />
                  </View>
                  {calculatedValue > 0 && (
                    <View style={styles.calcRow}>
                      <Text style={styles.calcLabel}>القيمة المحتسبة:</Text>
                      <Text style={styles.calcValue}>{calculatedValue.toLocaleString("ar-SA")} ﷼</Text>
                    </View>
                  )}
                </>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>الجهة المستلمة</Text>
                <View style={styles.segmented}>
                  {[{ v: "finance_manager", l: "المسؤول المالي" }, { v: "supervisor", l: "المشرف" }].map((opt) => (
                    <TouchableOpacity key={opt.v} style={[styles.segBtn, toRole === opt.v && styles.segBtnActive]} onPress={() => setToRole(opt.v as any)}>
                      <Text style={[styles.segBtnText, toRole === opt.v && styles.segBtnTextActive]}>{opt.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>ملاحظات (اختياري)</Text>
                <TextInput style={[styles.fieldInput, { height: 80 }]} value={notes} onChangeText={setNotes} textAlign="right" multiline placeholder="أي ملاحظات..." placeholderTextColor={Colors.textMuted} />
              </View>

              <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSubmit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>تأكيد إضافة العهدة</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function AddTaskModal({ visible, token, onClose, onSuccess, insets }: { visible: boolean; token: string | null; onClose: () => void; onSuccess: () => void; insets: any }) {
  const [targetRole, setTargetRole] = useState<"finance_manager" | "supervisor" | "tech_engineer">("finance_manager");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const roles = [
    { v: "finance_manager", l: "المسؤول المالي" },
    { v: "supervisor", l: "المشرف" },
    { v: "tech_engineer", l: "المهندس الفني" },
  ];

  const handleSubmit = async () => {
    if (!description.trim()) { Alert.alert("تنبيه", "يرجى كتابة وصف المهمة"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ targetRole, description, assignedByRole: "owner" }),
      });
      if (res.ok) {
        Alert.alert("تم", "تم إضافة المهمة بنجاح");
        onSuccess();
        setDescription("");
      } else {
        Alert.alert("خطأ", "فشل إضافة المهمة");
      }
    } catch {
      Alert.alert("خطأ", "فشل الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="pageSheet">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.textSecondary} /></TouchableOpacity>
            <Text style={styles.modalTitle}>إضافة مهمة</Text>
          </View>
          <View style={styles.modalForm}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>الجهة المستهدفة</Text>
              <View style={styles.roleOptions}>
                {roles.map((r) => (
                  <TouchableOpacity key={r.v} style={[styles.roleOption, targetRole === r.v && styles.roleOptionActive]} onPress={() => setTargetRole(r.v as any)}>
                    <Text style={[styles.roleOptionText, targetRole === r.v && styles.roleOptionTextActive]}>{r.l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>وصف المهمة</Text>
              <TextInput style={[styles.fieldInput, { height: 120 }]} value={description} onChangeText={setDescription} textAlign="right" multiline placeholder="اكتب وصف المهمة..." placeholderTextColor={Colors.textMuted} />
            </View>
            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSubmit} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>إضافة المهمة</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  greeting: { fontSize: 12, color: Colors.textSecondary, fontFamily: "Inter_400Regular", textAlign: "right" },
  userName: { fontSize: 20, color: Colors.text, fontFamily: "Inter_700Bold", textAlign: "right" },
  logoMini: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  loadingWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  primaryCard: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    borderLeftWidth: 4, padding: 20,
  },
  primaryCardInner: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  primaryLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "right", marginBottom: 6 },
  primaryValue: { fontSize: 32, fontFamily: "Inter_700Bold", color: Colors.primary, textAlign: "right" },
  primaryIcon: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: Colors.primary + "22", alignItems: "center", justifyContent: "center",
  },
  cardsRow: { flexDirection: "row", gap: 10 },
  summaryCard: {
    flex: 1, backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    borderTopWidth: 3, padding: 14, gap: 6, alignItems: "flex-end",
  },
  summaryIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  summaryValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "right" },
  networkRow: {
    flexDirection: "row", gap: 10,
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 14,
  },
  networkCard: { flex: 1, alignItems: "center", gap: 4 },
  networkCardRight: { borderRightWidth: 1, borderRightColor: Colors.border },
  networkValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  networkLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "right" },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionBtn: {
    flex: 1, minWidth: "45%", backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    padding: 16, alignItems: "center", gap: 10,
  },
  actionIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.text, textAlign: "center" },
  reportsRow: { flexDirection: "row", gap: 10 },
  reportBtn: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 16,
    alignItems: "center", gap: 8,
  },
  reportLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.text },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 16, maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  modalForm: { padding: 20, gap: 16 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary, textAlign: "right" },
  fieldInput: {
    backgroundColor: Colors.inputBackground, borderWidth: 1, borderColor: Colors.inputBorder,
    borderRadius: 10, paddingHorizontal: 14, height: 48,
    color: Colors.text, fontFamily: "Inter_400Regular", fontSize: 15,
  },
  segmented: { flexDirection: "row-reverse", borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: "center", backgroundColor: Colors.inputBackground },
  segBtnActive: { backgroundColor: Colors.primary },
  segBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  segBtnTextActive: { color: "#fff" },
  denomBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: Colors.inputBackground, borderWidth: 1, borderColor: Colors.border, alignItems: "center",
  },
  denomBtnActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  denomBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  denomBtnTextActive: { color: Colors.primary },
  denomPrice: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  denomPriceActive: { color: Colors.primary },
  calcRow: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    backgroundColor: Colors.primary + "11", borderRadius: 10, padding: 12,
  },
  calcLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  calcValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.primary },
  roleOptions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  roleOption: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: Colors.inputBackground, borderWidth: 1, borderColor: Colors.border,
  },
  roleOptionActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  roleOptionText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  roleOptionTextActive: { color: Colors.primary },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    height: 52, alignItems: "center", justifyContent: "center", marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
