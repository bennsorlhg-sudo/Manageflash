import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Platform,
  TouchableOpacity, Dimensions, ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import { apiGet, apiPut, formatCurrency } from "@/utils/api";

const { width } = Dimensions.get("window");

export default function FinanceDashboard() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cashBalance, setCashBalance] = useState(0);
  const [totalLoans, setTotalLoans] = useState(0);
  const [totalDebts, setTotalDebts] = useState(0);
  const [totalCustody, setTotalCustody] = useState(0);
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);
  const [updatingReq, setUpdatingReq] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [cashData, loans, debts, custody, reqs] = await Promise.all([
        apiGet("/cash-box", token),
        apiGet("/loans", token),
        apiGet("/debts", token),
        apiGet("/custody", token),
        apiGet("/purchase-requests", token),
      ]);

      setCashBalance(cashData.balance ?? 0);
      setTotalLoans(loans.filter((l: any) => l.status !== "paid")
        .reduce((s: number, l: any) => s + parseFloat(l.amount) - parseFloat(l.paidAmount), 0));
      setTotalDebts(debts.filter((d: any) => d.status !== "paid")
        .reduce((s: number, d: any) => s + parseFloat(d.amount) - parseFloat(d.paidAmount), 0));
      setTotalCustody(custody.reduce((s: number, c: any) => s + parseFloat(c.amount ?? "0"), 0));
      setPurchaseRequests(reqs.filter((r: any) => r.status === "pending"));
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRequestAction = async (id: number, status: "approved" | "rejected") => {
    setUpdatingReq(id);
    try {
      await apiPut(`/purchase-requests/${id}`, token, { status });
      setPurchaseRequests(prev => prev.filter(r => r.id !== id));
    } catch {} finally {
      setUpdatingReq(null);
    }
  };

  const KPIBox = ({ title, value, icon, color, fullWidth = false }: {
    title: string; value: number; icon: keyof typeof Ionicons.glyphMap;
    color: string; fullWidth?: boolean;
  }) => (
    <View style={[styles.kpiCard, fullWidth ? styles.kpiFullWidth : styles.kpiHalfWidth, { borderColor: color + "33" }]}>
      <View style={styles.kpiHeader}>
        <View style={[styles.kpiIconContainer, { backgroundColor: color + "15" }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={styles.kpiTitle}>{title}</Text>
      </View>
      <Text style={[styles.kpiValue, { color }]}>{formatCurrency(value)}</Text>
    </View>
  );

  const ActionButton = ({ label, icon, onPress, color, small = false }: {
    label: string; icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void; color: string; small?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.actionButton, small ? styles.actionButtonSmall : styles.actionButtonLarge, { borderColor: color + "44" }]}
      onPress={onPress} activeOpacity={0.7}
    >
      <View style={[styles.actionIconContainer, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon} size={small ? 20 : 24} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/(finance)/profile")}>
          <Ionicons name="person-circle-outline" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>المسؤول المالي — {user?.name}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
      >
        <View style={styles.kpiContainer}>
          <KPIBox title="الصندوق النقدي" value={cashBalance} icon="wallet" color={Colors.success} fullWidth />
          <View style={styles.row}>
            <KPIBox title="السلف (لنا)" value={totalLoans} icon="trending-up" color={Colors.warning} />
            <KPIBox title="الديون (علينا)" value={totalDebts} icon="trending-down" color={Colors.error} />
          </View>
          <View style={styles.row}>
            <KPIBox title="إجمالي العهدة" value={totalCustody} icon="briefcase" color={Colors.info} />
            <KPIBox title="صافي الحساب" value={cashBalance + totalLoans - totalDebts} icon="calculator" color="#9C27B0" />
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <View style={styles.row}>
            <ActionButton label="صرف" icon="arrow-up-circle" color={Colors.error} onPress={() => router.push("/(finance)/disburse")} small />
            <ActionButton label="تحصيل" icon="arrow-down-circle" color={Colors.success} onPress={() => router.push("/(finance)/collect")} small />
            <ActionButton label="بيع" icon="cart" color={Colors.info} onPress={() => router.push("/(finance)/sell")} small />
          </View>
          <View style={styles.row}>
            <ActionButton label="إدارة العهدة" icon="briefcase" color="#673AB7" onPress={() => router.push("/(finance)/custody")} />
            <ActionButton label="نقاط البيع" icon="location" color="#009688" onPress={() => router.push("/(finance)/sales-points")} />
          </View>
          <View style={styles.row}>
            <ActionButton label="المصاريف" icon="receipt" color="#FF5722" onPress={() => router.push("/(finance)/expenses")} small />
            <ActionButton label="ديون/سلف" icon="people" color="#795548" onPress={() => router.push("/(finance)/debts-loans")} small />
            <ActionButton label="المبيعات" icon="trending-up" color="#4CAF50" onPress={() => router.push("/(finance)/sales")} small />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>قائمة المشتريات المطلوبة</Text>
          {purchaseRequests.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{purchaseRequests.length}</Text>
            </View>
          )}
        </View>

        {purchaseRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={32} color={Colors.success} />
            <Text style={styles.emptyText}>لا توجد طلبات شراء معلقة</Text>
          </View>
        ) : (
          purchaseRequests.map((req) => (
            <View key={req.id} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <View style={styles.requestMainInfo}>
                  <Text style={styles.requestDescription}>{req.description}</Text>
                  {req.notes && <Text style={styles.requestSubText}>{req.notes}</Text>}
                </View>
                {req.amount && <Text style={styles.requestAmount}>{formatCurrency(parseFloat(req.amount))}</Text>}
              </View>
              <View style={styles.requestFooter}>
                <Text style={styles.requestDate}>
                  {new Date(req.createdAt).toLocaleDateString("ar-SA")}
                </Text>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.reqBtn, styles.reqBtnApprove]}
                    onPress={() => handleRequestAction(req.id, "approved")}
                    disabled={updatingReq === req.id}
                  >
                    <Text style={styles.reqBtnText}>موافقة</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.reqBtn, styles.reqBtnReject]}
                    onPress={() => handleRequestAction(req.id, "rejected")}
                    disabled={updatingReq === req.id}
                  >
                    <Text style={styles.reqBtnText}>رفض</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "right" },
  content: { padding: 16 },
  kpiContainer: { gap: 12, marginBottom: 24 },
  row: { flexDirection: "row-reverse", gap: 12 },
  kpiCard: {
    backgroundColor: Colors.surface, borderRadius: 16,
    padding: 16, borderWidth: 1, justifyContent: "center",
  },
  kpiFullWidth: { width: "100%" },
  kpiHalfWidth: { flex: 1 },
  kpiHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 8 },
  kpiIconContainer: { padding: 6, borderRadius: 8 },
  kpiTitle: { fontSize: 13, color: Colors.textSecondary, fontFamily: "Inter_500Medium" },
  kpiValue: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "right" },
  actionsContainer: { gap: 12, marginBottom: 32 },
  actionButton: {
    backgroundColor: Colors.surface, borderRadius: 16,
    padding: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 8,
  },
  actionButtonSmall: { flex: 1 },
  actionButtonLarge: { flex: 1, paddingVertical: 16 },
  actionIconContainer: { padding: 10, borderRadius: 12 },
  actionLabel: { fontSize: 12, color: Colors.text, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  sectionHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  badge: { backgroundColor: Colors.warning + "33", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 12, color: Colors.warning, fontWeight: "bold" },
  emptyCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 24,
    alignItems: "center", gap: 12, borderWidth: 1, borderColor: Colors.border,
  },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
  requestCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 12,
  },
  requestHeader: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 12 },
  requestMainInfo: { flex: 1, alignItems: "flex-end" },
  requestDescription: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text, textAlign: "right" },
  requestSubText: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  requestAmount: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.primaryLight },
  requestFooter: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12,
  },
  requestDate: { fontSize: 11, color: Colors.textMuted },
  requestActions: { flexDirection: "row-reverse", gap: 8 },
  reqBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 },
  reqBtnApprove: { backgroundColor: Colors.success + "22" },
  reqBtnReject: { backgroundColor: Colors.error + "22" },
  reqBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.text },
});
