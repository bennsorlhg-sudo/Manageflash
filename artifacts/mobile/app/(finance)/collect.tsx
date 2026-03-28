import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, Modal, ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, formatCurrency } from "@/utils/api";

export default function CollectScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<"loans" | "debts">("loans");
  const [search, setSearch] = useState("");
  const [loans, setLoans] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [amountInput, setAmountInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [l, d] = await Promise.all([apiGet("/loans", token), apiGet("/debts", token)]);
      setLoans(l.filter((x: any) => x.status !== "paid"));
      setDebts(d.filter((x: any) => x.status !== "paid"));
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const list = (activeTab === "loans" ? loans : debts)
    .filter(item => item.personName.includes(search))
    .map(item => ({
      ...item,
      remaining: parseFloat(item.amount) - parseFloat(item.paidAmount),
    }))
    .sort((a, b) => b.remaining - a.remaining);

  const handleAction = async () => {
    const amt = parseFloat(amountInput);
    if (!amt || amt <= 0) { Alert.alert("خطأ", "أدخل مبلغاً صحيحاً"); return; }
    setSubmitting(true);
    try {
      await apiPost("/transactions/collect", token, {
        sourceType: activeTab === "loans" ? "debt" : "loan",
        sourceId: selectedEntity.id,
        amount: amt,
      });
      await fetchData();
      setSelectedEntity(null);
      setAmountInput("");
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    } finally {
      setSubmitting(false);
    }
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
        <Text style={styles.headerTitle}>تحصيل</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabs}>
        {(["loans", "debts"] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === "loans" ? "تحصيل سلفة" : "سداد دين"}
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
        {list.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={48} color={Colors.success} />
            <Text style={styles.emptyText}>لا توجد سجلات</Text>
          </View>
        ) : list.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.entityName}>{item.personName}</Text>
              <Text style={[styles.remainingText, { color: activeTab === "loans" ? Colors.success : Colors.error }]}>
                متبقي: {formatCurrency(item.remaining)}
              </Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, {
                  width: `${Math.min((parseFloat(item.paidAmount) / parseFloat(item.amount)) * 100, 100)}%` as any,
                  backgroundColor: activeTab === "loans" ? Colors.success : Colors.error,
                }]} />
              </View>
              <View style={styles.progressInfo}>
                <Text style={styles.progressText}>الإجمالي: {formatCurrency(parseFloat(item.amount))}</Text>
                <Text style={styles.progressText}>المدفوع: {formatCurrency(parseFloat(item.paidAmount))}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: activeTab === "loans" ? Colors.success : Colors.error }]}
              onPress={() => { setSelectedEntity(item); setAmountInput(""); }}
            >
              <Text style={styles.actionBtnText}>{activeTab === "loans" ? "تحصيل" : "سداد"}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!selectedEntity} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{activeTab === "loans" ? "تحصيل سلفة" : "سداد دين"}</Text>
            <Text style={styles.modalEntity}>{selectedEntity?.personName}</Text>
            <View style={styles.modalSummary}>
              <Text style={styles.modalSummaryText}>المتبقي: {selectedEntity && formatCurrency(selectedEntity.remaining)}</Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>المبلغ</Text>
              <TextInput
                style={styles.input} placeholder="0.00"
                placeholderTextColor={Colors.textMuted} value={amountInput}
                onChangeText={setAmountInput} keyboardType="numeric" textAlign="right"
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: activeTab === "loans" ? Colors.success : Colors.error }]}
                onPress={handleAction} disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalBtnText}>تأكيد</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setSelectedEntity(null)}>
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
  header: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  backButton: { padding: 4 },
  tabs: { flexDirection: "row-reverse", paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  tabTextActive: { color: "#FFF" },
  searchContainer: {
    flexDirection: "row-reverse", alignItems: "center",
    marginHorizontal: 20, marginBottom: 16, backgroundColor: Colors.surface,
    borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border,
  },
  searchIcon: { marginLeft: 8 },
  searchInput: { flex: 1, paddingVertical: 10, color: Colors.text, fontSize: 14 },
  content: { padding: 20, paddingTop: 0 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 12 },
  entityName: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  remainingText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  progressContainer: { marginBottom: 16 },
  progressBarBg: { height: 8, backgroundColor: Colors.background, borderRadius: 4, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 4 },
  progressInfo: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 8 },
  progressText: { fontSize: 11, color: Colors.textMuted },
  actionBtn: { borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  actionBtnText: { color: "#FFF", fontSize: 14, fontFamily: "Inter_700Bold" },
  emptyContainer: { alignItems: "center", justifyContent: "center", marginTop: 60, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalContent: { backgroundColor: Colors.surface, borderRadius: 20, padding: 24, width: "100%", maxWidth: 400 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "center", marginBottom: 8 },
  modalEntity: { fontSize: 16, color: Colors.textSecondary, textAlign: "center", marginBottom: 16 },
  modalSummary: { backgroundColor: Colors.background, padding: 12, borderRadius: 12, marginBottom: 20, alignItems: "center" },
  modalSummaryText: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.primaryLight },
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginBottom: 8, textAlign: "right" },
  input: { backgroundColor: Colors.background, borderRadius: 12, padding: 14, color: Colors.text, fontSize: 16, borderWidth: 1, borderColor: Colors.border },
  modalActions: { flexDirection: "row-reverse", gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  modalBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  modalBtnCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  modalBtnTextCancel: { color: Colors.textSecondary, fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
