import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, TextInput, ActivityIndicator, RefreshControl, Alert, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, apiDelete, formatCurrency, formatDate } from "@/utils/api";

const TYPE_LABELS: Record<string, string> = {
  daily: "يومي", monthly: "شهري", purchase: "مشتريات",
};

export default function ExpensesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<"history" | "templates" | "obligations">("history");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"day" | "week" | "month">("month");

  // Template modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateAmount, setNewTemplateAmount] = useState("");

  // Obligation modal
  const [showObligModal, setShowObligModal] = useState(false);
  const [newOblig, setNewOblig] = useState({ name: "", amount: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [txs, tmpl, oblig] = await Promise.all([
        apiGet("/transactions?type=expense&limit=200", token),
        apiGet("/expense-templates", token),
        apiGet("/obligations", token),
      ]);
      setTransactions(txs);
      setTemplates(tmpl);
      setObligations(oblig);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filterByPeriod = (items: any[]) => {
    const now = new Date();
    return items.filter(t => {
      const d = new Date(t.createdAt);
      if (filter === "day") return d.toDateString() === now.toDateString();
      if (filter === "week") {
        const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
        return d >= weekAgo;
      }
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  };

  const filtered = filterByPeriod(transactions);
  const totalExpenses = filtered.reduce((s, t) => s + parseFloat(t.amount), 0);

  const addTemplate = async () => {
    if (!newTemplateName) return;
    setSaving(true);
    try {
      const t = await apiPost("/expense-templates", token, {
        name: newTemplateName,
        amount: newTemplateAmount ? parseFloat(newTemplateAmount) : undefined,
      });
      setTemplates(prev => [...prev, t]);
      setShowTemplateModal(false);
      setNewTemplateName(""); setNewTemplateAmount("");
    } catch (e: any) { Alert.alert("خطأ", e.message); }
    finally { setSaving(false); }
  };

  const deleteTemplate = async (id: number) => {
    try {
      await apiDelete(`/expense-templates/${id}`, token);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (e: any) { Alert.alert("خطأ", e.message); }
  };

  const addObligation = async () => {
    if (!newOblig.name || !newOblig.amount) { Alert.alert("خطأ", "أدخل الاسم والمبلغ"); return; }
    setSaving(true);
    try {
      const o = await apiPost("/obligations", token, {
        name: newOblig.name, amount: parseFloat(newOblig.amount), notes: newOblig.notes,
      });
      setObligations(prev => [...prev, o]);
      setShowObligModal(false);
      setNewOblig({ name: "", amount: "", notes: "" });
    } catch (e: any) { Alert.alert("خطأ", e.message); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>المصاريف</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabRow}>
        {(["history", "templates", "obligations"] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === "history" ? "السجل" : t === "templates" ? "القوالب" : "الالتزامات"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "history" && (
        <>
          <View style={styles.filterRow}>
            {(["day", "week", "month"] as const).map(p => (
              <TouchableOpacity key={p} style={[styles.filterBtn, filter === p && styles.filterBtnActive]} onPress={() => setFilter(p)}>
                <Text style={[styles.filterBtnText, filter === p && styles.filterBtnTextActive]}>
                  {p === "day" ? "اليوم" : p === "week" ? "الأسبوع" : "الشهر"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.summaryBar}>
            <Text style={styles.summaryLabel}>الإجمالي</Text>
            <Text style={[styles.summaryValue, { color: Colors.error }]}>{formatCurrency(totalExpenses)}</Text>
          </View>
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
          >
            {filtered.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>لا توجد مصاريف في هذه الفترة</Text>
              </View>
            ) : filtered.map(t => (
              <View key={t.id} style={styles.txCard}>
                <View style={styles.txHeader}>
                  <Text style={styles.txDesc}>{t.description}</Text>
                  <Text style={[styles.txAmount, { color: Colors.error }]}>{formatCurrency(parseFloat(t.amount))}</Text>
                </View>
                <View style={styles.txFooter}>
                  <Text style={styles.txDate}>{formatDate(t.createdAt)}</Text>
                  {t.subType && (
                    <Text style={styles.txType}>{TYPE_LABELS[t.subType] ?? t.subType}</Text>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {activeTab === "templates" && (
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity style={styles.addTemplateBtn} onPress={() => setShowTemplateModal(true)}>
            <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.addTemplateBtnText}>إضافة قالب جديد</Text>
          </TouchableOpacity>
          {templates.map(t => (
            <View key={t.id} style={styles.templateCard}>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={styles.templateName}>{t.name}</Text>
                {t.amount && <Text style={styles.templateAmount}>{formatCurrency(parseFloat(t.amount))}</Text>}
              </View>
              <TouchableOpacity onPress={() => deleteTemplate(t.id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}
          {templates.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="documents-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>لا توجد قوالب. أضف قالباً للبدء.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {activeTab === "obligations" && (
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity style={styles.addTemplateBtn} onPress={() => setShowObligModal(true)}>
            <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.addTemplateBtnText}>إضافة التزام شهري</Text>
          </TouchableOpacity>
          {obligations.map(o => (
            <View key={o.id} style={styles.obligCard}>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.obligName}>{o.name}</Text>
                {o.notes && <Text style={styles.obligNotes}>{o.notes}</Text>}
              </View>
              <Text style={[styles.obligAmount, { color: Colors.error }]}>
                {formatCurrency(parseFloat(o.amount))} / شهر
              </Text>
            </View>
          ))}
          {obligations.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>لا توجد التزامات شهرية</Text>
            </View>
          )}
          <View style={styles.obligSummary}>
            <Text style={styles.obligSummaryLabel}>مجموع الالتزامات الشهرية</Text>
            <Text style={[styles.obligSummaryValue, { color: Colors.error }]}>
              {formatCurrency(obligations.reduce((s, o) => s + parseFloat(o.amount), 0))}
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Template Modal */}
      <Modal visible={showTemplateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>قالب مصروف جديد</Text>
            <Text style={styles.label}>الاسم</Text>
            <TextInput style={styles.input} value={newTemplateName} onChangeText={setNewTemplateName} textAlign="right" placeholder="مثال: إيجار المكتب" placeholderTextColor={Colors.textMuted} />
            <Text style={[styles.label, { marginTop: 12 }]}>المبلغ (اختياري)</Text>
            <TextInput style={styles.input} value={newTemplateAmount} onChangeText={setNewTemplateAmount} textAlign="right" placeholder="0.00" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.saveBtn} onPress={addTemplate} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>حفظ</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowTemplateModal(false)}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Obligation Modal */}
      <Modal visible={showObligModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>التزام شهري جديد</Text>
            <Text style={styles.label}>الاسم</Text>
            <TextInput style={styles.input} value={newOblig.name} onChangeText={v => setNewOblig(o => ({ ...o, name: v }))} textAlign="right" placeholder="مثال: إيجار المكتب" placeholderTextColor={Colors.textMuted} />
            <Text style={[styles.label, { marginTop: 12 }]}>المبلغ الشهري (ر.س)</Text>
            <TextInput style={styles.input} value={newOblig.amount} onChangeText={v => setNewOblig(o => ({ ...o, amount: v }))} textAlign="right" placeholder="0.00" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
            <Text style={[styles.label, { marginTop: 12 }]}>ملاحظات</Text>
            <TextInput style={styles.input} value={newOblig.notes} onChangeText={v => setNewOblig(o => ({ ...o, notes: v }))} textAlign="right" placeholder="اختياري" placeholderTextColor={Colors.textMuted} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.saveBtn} onPress={addObligation} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>حفظ</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowObligModal(false)}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  backButton: { padding: 4 },
  tabRow: { flexDirection: "row-reverse", paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 13, color: Colors.textSecondary, fontFamily: "Inter_600SemiBold" },
  tabTextActive: { color: "#FFF" },
  filterRow: { flexDirection: "row-reverse", paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  filterBtnActive: { backgroundColor: Colors.error + "22", borderColor: Colors.error },
  filterBtnText: { fontSize: 12, color: Colors.textSecondary },
  filterBtnTextActive: { color: Colors.error, fontWeight: "bold" },
  summaryBar: { flexDirection: "row-reverse", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  summaryLabel: { fontSize: 14, color: Colors.textSecondary },
  summaryValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  content: { padding: 16, paddingTop: 8 },
  txCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  txHeader: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 6 },
  txDesc: { fontSize: 14, color: Colors.text, flex: 1, textAlign: "right" },
  txAmount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  txFooter: { flexDirection: "row-reverse", justifyContent: "space-between" },
  txDate: { fontSize: 11, color: Colors.textMuted },
  txType: { fontSize: 11, color: Colors.textMuted },
  addTemplateBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.primary + "66", marginBottom: 16 },
  addTemplateBtnText: { color: Colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  templateCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  templateName: { fontSize: 14, fontWeight: "bold", color: Colors.text },
  templateAmount: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  deleteBtn: { padding: 8 },
  obligCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  obligName: { fontSize: 14, fontWeight: "bold", color: Colors.text },
  obligNotes: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  obligAmount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  obligSummary: { marginTop: 16, padding: 16, backgroundColor: Colors.error + "11", borderRadius: 12, borderWidth: 1, borderColor: Colors.error + "33", flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  obligSummaryLabel: { fontSize: 14, color: Colors.textSecondary },
  obligSummaryValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyContainer: { alignItems: "center", marginTop: 40, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
  label: { fontSize: 14, color: Colors.textSecondary, textAlign: "right", marginBottom: 8 },
  input: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: Colors.text, textAlign: "center", marginBottom: 16 },
  modalActions: { flexDirection: "row-reverse", gap: 12, marginTop: 20 },
  saveBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 10, padding: 14, alignItems: "center" },
  saveBtnText: { color: "#FFF", fontWeight: "bold" },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 14, alignItems: "center" },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: "bold" },
});
