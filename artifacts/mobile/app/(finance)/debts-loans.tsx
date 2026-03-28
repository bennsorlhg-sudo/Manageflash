import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, TextInput, ActivityIndicator, RefreshControl, Modal, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, formatCurrency } from "@/utils/api";

export default function DebtsLoansScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<"loans" | "debts">("loans");
  const [search, setSearch] = useState("");
  const [loans, setLoans] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [l, d] = await Promise.all([apiGet("/loans", token), apiGet("/debts", token)]);
      setLoans(l); setDebts(d);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const list = (activeTab === "loans" ? loans : debts)
    .filter((item: any) => item.personName.includes(search))
    .map((item: any) => ({
      ...item,
      remaining: parseFloat(item.amount) - parseFloat(item.paidAmount),
    }))
    .sort((a: any, b: any) => b.remaining - a.remaining);

  const totalRemaining = list.reduce((s: number, i: any) => s + i.remaining, 0);

  const handleAdd = async () => {
    if (!newName || !newAmount) { Alert.alert("خطأ", "أدخل الاسم والمبلغ"); return; }
    setAdding(true);
    try {
      const path = activeTab === "loans" ? "/loans" : "/debts";
      await apiPost(path, token, { personName: newName, amount: parseFloat(newAmount), notes: newNotes });
      await fetchData();
      setShowAddModal(false);
      setNewName(""); setNewAmount(""); setNewNotes("");
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  const color = activeTab === "loans" ? Colors.success : Colors.error;

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ديون / سلف</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addBtn}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {(["loans", "debts"] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === "loans" ? `السلف (لنا) ${loans.length}` : `الديون (علينا) ${debts.length}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput} placeholder="بحث بالاسم..."
          placeholderTextColor={Colors.textMuted} value={search}
          onChangeText={setSearch} textAlign="right"
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
      >
        <View style={[styles.summaryIndicator, { backgroundColor: color + "15", borderColor: color + "33" }]}>
          <Text style={styles.summaryLabel}>
            {activeTab === "loans" ? "إجمالي السلف المستحقة لنا" : "إجمالي الديون المستحقة علينا"}
          </Text>
          <Text style={[styles.summaryValue, { color }]}>{formatCurrency(totalRemaining)}</Text>
        </View>

        {list.map((item: any) => (
          <View key={item.id} style={[styles.card, item.status === "paid" && styles.cardPaid]}>
            <View style={styles.cardHeader}>
              <View style={styles.nameRow}>
                <Text style={styles.entityName}>{item.personName}</Text>
                {item.status === "paid" && (
                  <View style={styles.paidBadge}><Text style={styles.paidBadgeText}>مسدد</Text></View>
                )}
              </View>
              <Text style={[styles.remainingText, { color }]}>{formatCurrency(item.remaining)}</Text>
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, {
                  width: `${Math.min((parseFloat(item.paidAmount) / parseFloat(item.amount)) * 100, 100)}%` as any,
                  backgroundColor: color,
                }]} />
              </View>
              <View style={styles.progressInfo}>
                <Text style={styles.progressText}>الإجمالي: {formatCurrency(parseFloat(item.amount))}</Text>
                <Text style={styles.progressText}>المدفوع: {formatCurrency(parseFloat(item.paidAmount))}</Text>
              </View>
            </View>
            {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
          </View>
        ))}

        {list.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>لا توجد سجلات</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {activeTab === "loans" ? "إضافة سلفة جديدة" : "إضافة دين جديد"}
            </Text>
            <Text style={styles.label}>الاسم</Text>
            <TextInput style={styles.input} value={newName} onChangeText={setNewName} textAlign="right" placeholder="الاسم" placeholderTextColor={Colors.textMuted} />
            <Text style={[styles.label, { marginTop: 12 }]}>المبلغ (ر.س)</Text>
            <TextInput style={styles.input} value={newAmount} onChangeText={setNewAmount} textAlign="right" placeholder="0.00" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
            <Text style={[styles.label, { marginTop: 12 }]}>ملاحظات</Text>
            <TextInput style={styles.input} value={newNotes} onChangeText={setNewNotes} textAlign="right" placeholder="اختياري" placeholderTextColor={Colors.textMuted} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: color }]} onPress={handleAdd} disabled={adding}>
                {adding ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalBtnText}>إضافة</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalBtnTextCancel}>إلغاء</Text>
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
  addBtn: { padding: 4 },
  tabs: { flexDirection: "row-reverse", padding: 16, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  tabTextActive: { color: "#FFF" },
  searchContainer: { flexDirection: "row-reverse", alignItems: "center", marginHorizontal: 20, marginBottom: 16, backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border },
  searchIcon: { marginLeft: 8 },
  searchInput: { flex: 1, paddingVertical: 10, color: Colors.text, fontSize: 14 },
  content: { padding: 20, paddingTop: 0 },
  summaryIndicator: { padding: 20, borderRadius: 16, alignItems: "center", marginBottom: 20, borderWidth: 1 },
  summaryLabel: { fontSize: 14, color: Colors.textSecondary, marginBottom: 4 },
  summaryValue: { fontSize: 24, fontFamily: "Inter_800ExtraBold" },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  cardPaid: { opacity: 0.6 },
  cardHeader: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 12 },
  nameRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  entityName: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  paidBadge: { backgroundColor: Colors.success + "22", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  paidBadgeText: { fontSize: 11, color: Colors.success },
  remainingText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  progressContainer: { marginBottom: 4 },
  progressBarBg: { height: 8, backgroundColor: Colors.background, borderRadius: 4, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 4 },
  progressInfo: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 8 },
  progressText: { fontSize: 11, color: Colors.textMuted },
  notes: { fontSize: 12, color: Colors.textMuted, marginTop: 8, textAlign: "right" },
  emptyContainer: { alignItems: "center", justifyContent: "center", marginTop: 60, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "center", marginBottom: 20 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginBottom: 8, textAlign: "right" },
  input: { backgroundColor: Colors.background, borderRadius: 12, padding: 14, color: Colors.text, fontSize: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 4 },
  modalActions: { flexDirection: "row-reverse", gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  modalBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  modalBtnCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  modalBtnTextCancel: { color: Colors.textSecondary, fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
