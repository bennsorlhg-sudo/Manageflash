import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, TextInput, Linking, ActivityIndicator, RefreshControl, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, apiPatch, formatCurrency, formatDate } from "@/utils/api";

interface SalesPoint {
  id: number;
  name: string;
  ownerName: string;
  phoneNumber: string;
  location: string;
  oldDebt: string;
  notes: string | null;
  createdAt: string;
}

interface LoanEntry {
  id: number;
  direction: "sent" | "received";
  amount: string;
  notes: string | null;
  recordedAt: string;
}

const EMPTY_FORM = { name: "", ownerName: "", phoneNumber: "", location: "", oldDebt: "", notes: "" };

export default function SalesPointsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [points, setPoints] = useState<SalesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  /* ─── مودال إضافة/تعديل نقطة بيع ─── */
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SalesPoint | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  /* ─── مودال القروض ─── */
  const [showLoans, setShowLoans] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<SalesPoint | null>(null);
  const [loans, setLoans] = useState<LoanEntry[]>([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const [loanAmount, setLoanAmount] = useState("");
  const [loanDir, setLoanDir] = useState<"sent" | "received">("sent");
  const [loanNote, setLoanNote] = useState("");
  const [addingLoan, setAddingLoan] = useState(false);

  const fetchPoints = useCallback(async () => {
    try {
      const data = await apiGet("/sales-points", token);
      setPoints(data);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchPoints(); }, [fetchPoints]);

  const filtered = points.filter(p =>
    !search || p.name.includes(search) || p.ownerName.includes(search) ||
    p.phoneNumber.includes(search) || p.location.includes(search)
  );

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (p: SalesPoint) => {
    setEditing(p);
    setForm({ name: p.name, ownerName: p.ownerName, phoneNumber: p.phoneNumber, location: p.location, oldDebt: p.oldDebt, notes: p.notes ?? "" });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.ownerName || !form.phoneNumber || !form.location) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await apiPatch(`/sales-points/${editing.id}`, token, form);
        setPoints(prev => prev.map(p => p.id === editing.id ? updated : p));
      } else {
        const created = await apiPost("/sales-points", token, { ...form, oldDebt: form.oldDebt || "0" });
        setPoints(prev => [created, ...prev]);
      }
      setShowForm(false);
    } catch {} finally { setSaving(false); }
  };

  const openLoans = async (p: SalesPoint) => {
    setSelectedPoint(p);
    setLoans([]);
    setLoanAmount(""); setLoanNote("");
    setShowLoans(true);
    setLoansLoading(true);
    try {
      const data = await apiGet(`/sales-points/${p.id}/loans`, token);
      setLoans(data);
    } catch {} finally { setLoansLoading(false); }
  };

  const handleAddLoan = async () => {
    if (!loanAmount || !selectedPoint) return;
    setAddingLoan(true);
    try {
      const entry = await apiPost(`/sales-points/${selectedPoint.id}/loans`, token, {
        direction: loanDir, amount: loanAmount, notes: loanNote || null,
      });
      setLoans(prev => [...prev, entry]);
      setLoanAmount(""); setLoanNote("");
    } catch {} finally { setAddingLoan(false); }
  };

  const loanBalance = loans.reduce((bal, l) => {
    const amt = parseFloat(l.amount);
    return l.direction === "sent" ? bal + amt : bal - amt;
  }, selectedPoint ? parseFloat(selectedPoint.oldDebt ?? "0") : 0);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>نقاط البيع</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* ─── Search ─── */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput} value={search} onChangeText={setSearch}
          placeholder="بحث..." placeholderTextColor={Colors.textMuted} textAlign="right"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPoints(); }} />}
      >
        <Text style={styles.countText}>{filtered.length} نقطة بيع</Text>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="storefront-outline" size={60} color={Colors.textMuted} />
            <Text style={styles.emptyText}>{points.length === 0 ? "لا توجد نقاط بيع مسجلة" : "لا توجد نتائج"}</Text>
            {points.length === 0 && (
              <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
                <Text style={styles.emptyBtnText}>إضافة نقطة بيع</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : filtered.map(p => (
          <View key={p.id} style={styles.card}>
            {/* اسم + ديون */}
            <View style={styles.cardTop}>
              <View style={styles.cardInfo}>
                <Text style={styles.pointName}>{p.name}</Text>
                <Text style={styles.ownerName}>{p.ownerName}</Text>
              </View>
              {parseFloat(p.oldDebt) > 0 ? (
                <View style={styles.debtBadge}>
                  <Text style={styles.debtLabel}>ديون قديمة</Text>
                  <Text style={styles.debtValue}>{formatCurrency(parseFloat(p.oldDebt))}</Text>
                </View>
              ) : (
                <View style={[styles.debtBadge, { backgroundColor: Colors.success + "15" }]}>
                  <Text style={[styles.debtLabel, { color: Colors.success }]}>لا ديون</Text>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            {/* تواصل */}
            <View style={styles.contactRow}>
              <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL(`tel:${p.phoneNumber}`)}>
                <Ionicons name="call" size={16} color={Colors.success} />
                <Text style={styles.contactText}>{p.phoneNumber}</Text>
              </TouchableOpacity>
              <View style={styles.contactBtn}>
                <Ionicons name="location" size={16} color={Colors.info} />
                <Text style={styles.contactText} numberOfLines={1}>{p.location}</Text>
              </View>
            </View>

            {p.notes ? (
              <Text style={styles.noteText}>{p.notes}</Text>
            ) : null}

            {/* أزرار */}
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.actionChip} onPress={() => openLoans(p)}>
                <Ionicons name="cash" size={14} color={Colors.warning} />
                <Text style={[styles.actionChipText, { color: Colors.warning }]}>القروض</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionChip} onPress={() => openEdit(p)}>
                <Ionicons name="pencil" size={14} color={Colors.info} />
                <Text style={[styles.actionChipText, { color: Colors.info }]}>تعديل</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ══ مودال الإضافة/التعديل ══ */}
      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editing ? "تعديل نقطة بيع" : "إضافة نقطة بيع"}</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              {[
                { key: "name", label: "اسم النقطة *", placeholder: "نقطة بيع الشمال" },
                { key: "ownerName", label: "اسم المالك *", placeholder: "أحمد محمد" },
                { key: "phoneNumber", label: "رقم الهاتف *", placeholder: "07X XXXX XXX", keyboard: "phone-pad" },
                { key: "location", label: "الموقع *", placeholder: "حي الشفاء، شارع 5" },
                { key: "oldDebt", label: "الديون القديمة", placeholder: "0", keyboard: "numeric" },
                { key: "notes", label: "ملاحظات", placeholder: "أي ملاحظات..." },
              ].map(f => (
                <View key={f.key} style={styles.field}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={(form as any)[f.key]}
                    onChangeText={v => setForm(prev => ({ ...prev, [f.key]: v }))}
                    placeholder={f.placeholder}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType={(f as any).keyboard ?? "default"}
                    textAlign="right"
                  />
                </View>
              ))}

              <TouchableOpacity
                style={[styles.saveBtn, (saving || !form.name || !form.ownerName || !form.phoneNumber || !form.location) && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={saving || !form.name || !form.ownerName || !form.phoneNumber || !form.location}
              >
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>{editing ? "حفظ التعديلات" : "إضافة"}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══ مودال القروض ══ */}
      <Modal visible={showLoans} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowLoans(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{selectedPoint?.name} — القروض</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              {/* رصيد */}
              <View style={[styles.balanceCard, { borderColor: loanBalance > 0 ? Colors.warning + "55" : Colors.success + "55" }]}>
                <Text style={styles.balanceLabel}>الرصيد الحالي</Text>
                <Text style={[styles.balanceValue, { color: loanBalance > 0 ? Colors.warning : Colors.success }]}>
                  {formatCurrency(Math.abs(loanBalance))}
                </Text>
                <Text style={styles.balanceSub}>{loanBalance > 0 ? "مستحق علينا" : loanBalance < 0 ? "مستحق له" : "لا ديون"}</Text>
              </View>

              {/* إضافة قرض */}
              <View style={styles.addLoanCard}>
                <Text style={styles.addLoanTitle}>إضافة حركة</Text>
                <View style={styles.dirRow}>
                  {([["sent", "كروت مرسلة", Colors.warning], ["received", "مبالغ مستردة", Colors.success]] as any[]).map(([val, label, color]) => (
                    <TouchableOpacity
                      key={val}
                      style={[styles.dirBtn, loanDir === val && { backgroundColor: color + "22", borderColor: color }]}
                      onPress={() => setLoanDir(val)}
                    >
                      <Text style={[styles.dirBtnText, loanDir === val && { color }]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.fieldInput} value={loanAmount} onChangeText={setLoanAmount}
                  placeholder="المبلغ" placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric" textAlign="right"
                />
                <TextInput
                  style={[styles.fieldInput, { marginTop: 8 }]} value={loanNote} onChangeText={setLoanNote}
                  placeholder="ملاحظة (اختياري)" placeholderTextColor={Colors.textMuted} textAlign="right"
                />
                <TouchableOpacity
                  style={[styles.saveBtn, { marginTop: 12 }, (addingLoan || !loanAmount) && { opacity: 0.5 }]}
                  onPress={handleAddLoan} disabled={addingLoan || !loanAmount}
                >
                  {addingLoan ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>تسجيل</Text>}
                </TouchableOpacity>
              </View>

              {/* سجل الحركات */}
              {loansLoading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
              ) : loans.length === 0 ? (
                <Text style={styles.noLoansText}>لا توجد حركات مسجلة</Text>
              ) : (
                <>
                  <Text style={styles.loansTitle}>سجل الحركات</Text>
                  {[...loans].reverse().map(l => (
                    <View key={l.id} style={styles.loanRow}>
                      <View>
                        <Text style={[styles.loanAmount, { color: l.direction === "sent" ? Colors.warning : Colors.success }]}>
                          {l.direction === "sent" ? "+" : "-"} {formatCurrency(parseFloat(l.amount))}
                        </Text>
                        {l.notes ? <Text style={styles.loanNote}>{l.notes}</Text> : null}
                      </View>
                      <Text style={styles.loanDate}>{formatDate(l.recordedAt)}</Text>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  backBtn: { padding: 4 },
  addBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center" },
  searchRow: {
    flexDirection: "row-reverse", alignItems: "center", margin: 14,
    backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  content: { paddingHorizontal: 14 },
  countText: { fontSize: 12, color: Colors.textMuted, textAlign: "right", marginBottom: 10 },
  empty: { alignItems: "center", marginTop: 80, gap: 14 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: "#FFF", fontWeight: "bold" },
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: Colors.border,
  },
  cardTop: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  cardInfo: { flex: 1, alignItems: "flex-end", gap: 4 },
  pointName: { fontSize: 16, fontWeight: "bold", color: Colors.text },
  ownerName: { fontSize: 13, color: Colors.textSecondary },
  debtBadge: { backgroundColor: Colors.warning + "15", borderRadius: 10, padding: 8, alignItems: "center", minWidth: 90 },
  debtLabel: { fontSize: 10, color: Colors.warning, marginBottom: 2 },
  debtValue: { fontSize: 13, fontWeight: "bold", color: Colors.warning },
  divider: { height: 1, backgroundColor: Colors.border, marginBottom: 12 },
  contactRow: { flexDirection: "row-reverse", gap: 12, marginBottom: 8 },
  contactBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 6, flex: 1 },
  contactText: { fontSize: 13, color: Colors.text, flex: 1, textAlign: "right" },
  noteText: { fontSize: 12, color: Colors.textMuted, textAlign: "right", marginTop: 6, fontStyle: "italic" },
  cardActions: { flexDirection: "row-reverse", gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  actionChip: {
    flexDirection: "row-reverse", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border,
  },
  actionChipText: { fontSize: 12, fontWeight: "600" },

  /* ─── Modal ─── */
  modalOverlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%" },
  modalHeader: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: Colors.text },
  modalContent: { padding: 20, gap: 4 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: 6 },
  fieldInput: {
    backgroundColor: Colors.surface, borderRadius: 10, padding: 12, fontSize: 14,
    color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#FFF", fontSize: 15, fontWeight: "bold" },

  /* ─── Loans Modal ─── */
  balanceCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16, alignItems: "center",
    borderWidth: 1.5, marginBottom: 16,
  },
  balanceLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  balanceValue: { fontSize: 28, fontWeight: "800" },
  balanceSub: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  addLoanCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  addLoanTitle: { fontSize: 14, fontWeight: "bold", color: Colors.text, textAlign: "right", marginBottom: 10 },
  dirRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 10 },
  dirBtn: {
    flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  dirBtnText: { fontSize: 12, color: Colors.textSecondary, fontWeight: "600" },
  noLoansText: { textAlign: "center", color: Colors.textMuted, marginTop: 20, fontSize: 14 },
  loansTitle: { fontSize: 14, fontWeight: "bold", color: Colors.text, textAlign: "right", marginBottom: 10 },
  loanRow: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start",
    backgroundColor: Colors.surface, borderRadius: 10, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  loanAmount: { fontSize: 15, fontWeight: "bold" },
  loanNote: { fontSize: 11, color: Colors.textMuted, textAlign: "right", marginTop: 2 },
  loanDate: { fontSize: 11, color: Colors.textMuted },
});
