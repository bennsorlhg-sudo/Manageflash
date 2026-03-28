import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, formatDate } from "@/utils/api";

const FILTERS = [
  { key: "all", label: "الكل" },
  { key: "pending", label: "جديدة" },
  { key: "in_progress", label: "جاري" },
  { key: "completed", label: "مكتملة" },
];

const STATUS_INFO: Record<string, { bg: string; color: string; label: string }> = {
  pending:     { bg: Colors.statusLight.ready,            color: Colors.status.ready,            label: "جديدة" },
  in_progress: { bg: Colors.statusLight.active_incomplete, color: Colors.status.active_incomplete, label: "جاري التنفيذ" },
  completed:   { bg: Colors.statusLight.active,           color: Colors.status.active,           label: "مكتملة" },
};

export default function TaskTrackingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [filter, setFilter] = useState("all");
  const [tasks, setTasks] = useState<any[]>([]);
  const [repairTickets, setRepairTickets] = useState<any[]>([]);
  const [installTickets, setInstallTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSource, setActiveSource] = useState<"tasks" | "repair" | "install">("tasks");

  const fetchAll = useCallback(async () => {
    try {
      const [t, r, i] = await Promise.all([
        apiGet("/tasks", token),
        apiGet("/tickets/repair", token),
        apiGet("/tickets/installation", token),
      ]);
      setTasks(t);
      setRepairTickets(r);
      setInstallTickets(i);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getItems = () => {
    if (activeSource === "repair") return repairTickets;
    if (activeSource === "install") return installTickets;
    return tasks;
  };

  const filtered = getItems().filter(item => {
    if (filter === "all") return true;
    const status = item.status ?? "";
    if (filter === "pending") return ["pending", "new"].includes(status);
    if (filter === "in_progress") return status === "in_progress";
    if (filter === "completed") return ["completed", "archived"].includes(status);
    return true;
  });

  const getStatusInfo = (status: string) => {
    const normalized = status === "new" ? "pending" : status === "archived" ? "completed" : status;
    return STATUS_INFO[normalized] ?? { bg: Colors.surfaceElevated, color: Colors.textSecondary, label: status };
  };

  const getItemTitle = (item: any) => {
    if (activeSource === "repair") return `صيانة: ${item.serviceNumber ?? item.clientName ?? "—"}`;
    if (activeSource === "install") return `تركيب: ${item.clientName ?? "—"}`;
    return item.title ?? "مهمة";
  };

  const getItemSub = (item: any) => {
    if (activeSource === "repair") return item.problemDescription ?? item.serviceType;
    if (activeSource === "install") return item.address ?? item.serviceType;
    return item.targetPersonName ?? item.targetRole;
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.roles.supervisor} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>متابعة المهام</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* مصدر البيانات */}
      <View style={styles.sourceRow}>
        {[
          { key: "tasks", label: `المهام (${tasks.length})` },
          { key: "repair", label: `صيانة (${repairTickets.length})` },
          { key: "install", label: `تركيب (${installTickets.length})` },
        ].map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.sourceBtn, activeSource === s.key && styles.sourceBtnActive]}
            onPress={() => setActiveSource(s.key as any)}
          >
            <Text style={[styles.sourceBtnText, activeSource === s.key && styles.sourceBtnTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* فلتر الحالة */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterBtnText, filter === f.key && styles.filterBtnTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} />}
      >
        <Text style={styles.countText}>{filtered.length} عنصر</Text>
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>لا توجد عناصر في هذا الفلتر</Text>
          </View>
        ) : filtered.map(item => {
          const si = getStatusInfo(item.status);
          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{getItemTitle(item)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: si.bg }]}>
                  <Text style={[styles.statusText, { color: si.color }]}>{si.label}</Text>
                </View>
              </View>
              {getItemSub(item) && (
                <Text style={styles.cardSub}>{getItemSub(item)}</Text>
              )}
              {item.assignedToName && (
                <Text style={styles.cardSub}>المهندس: {item.assignedToName}</Text>
              )}
              <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  sourceRow: { flexDirection: "row-reverse", padding: 12, gap: 8 },
  sourceBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  sourceBtnActive: { backgroundColor: Colors.roles.supervisor + "22", borderColor: Colors.roles.supervisor },
  sourceBtnText: { fontSize: 11, color: Colors.textSecondary },
  sourceBtnTextActive: { color: Colors.roles.supervisor, fontWeight: "bold" },
  filterRow: { flexDirection: "row-reverse", paddingHorizontal: 12, gap: 8 },
  filterBtn: { flex: 1, paddingVertical: 7, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterBtnText: { fontSize: 11, color: Colors.textSecondary },
  filterBtnTextActive: { color: "#FFF", fontWeight: "bold" },
  content: { padding: 14 },
  countText: { color: Colors.textMuted, fontSize: 12, textAlign: "right", marginBottom: 8 },
  emptyContainer: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: "bold", color: Colors.text, textAlign: "right" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "bold" },
  cardSub: { fontSize: 12, color: Colors.textSecondary, textAlign: "right", marginBottom: 2 },
  cardDate: { fontSize: 11, color: Colors.textMuted, textAlign: "right", marginTop: 6 },
});
