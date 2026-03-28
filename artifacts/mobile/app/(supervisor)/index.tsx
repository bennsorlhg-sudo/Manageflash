import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";
import { apiGet } from "@/utils/api";

export default function SupervisorDashboard() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    pending_tasks: 0, in_progress_tasks: 0,
    hotspot_count: 0, broadband_count: 0,
    repair_tickets: 0, install_tickets: 0,
    purchase_requests: 0,
  });
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [recentTasks, setRecentTasks] = useState<any[]>([]);

  const today = new Date().toLocaleDateString("ar-EG", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const fetchData = useCallback(async () => {
    try {
      const [tasks, hotspot, broadband, reqs] = await Promise.all([
        apiGet("/tasks?targetRole=tech_engineer", token),
        apiGet("/network/hotspot-points", token),
        apiGet("/network/broadband-points", token),
        apiGet("/purchase-requests", token),
      ]);

      setStats({
        pending_tasks: tasks.filter((t: any) => t.status === "pending").length,
        in_progress_tasks: tasks.filter((t: any) => t.status === "in_progress").length,
        hotspot_count: hotspot.length,
        broadband_count: broadband.length,
        repair_tickets: tasks.filter((t: any) => t.type === "repair").length,
        install_tickets: tasks.filter((t: any) => t.type === "installation").length,
        purchase_requests: reqs.filter((r: any) => r.status === "pending").length,
      });
      setPendingRequests(reqs.filter((r: any) => r.status === "pending").slice(0, 3));
      setRecentTasks(tasks.filter((t: any) => t.status !== "completed").slice(0, 3));
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const renderButton = (label: string, icon: string, onPress: () => void, color = Colors.primaryLight) => (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <View style={[styles.iconCircle, { borderColor: color + "44" }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={styles.buttonLabel}>{label}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.roles.supervisor} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
      >
        {/* رأس الصفحة */}
        <View style={styles.header}>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.welcomeText}>المشرف — {user?.name}</Text>
            <Text style={styles.dateText}>{today}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/(supervisor)/profile")}>
            <Ionicons name="person-circle" size={40} color={Colors.roles.supervisor} />
          </TouchableOpacity>
        </View>

        {/* مؤشر الشبكة */}
        <View style={styles.networkRow}>
          <View style={[styles.networkCard, { borderColor: Colors.primary + "44" }]}>
            <Ionicons name="wifi" size={22} color={Colors.primary} />
            <Text style={[styles.networkCount, { color: Colors.primary }]}>{stats.hotspot_count}</Text>
            <Text style={styles.networkLabel}>هوتسبوت</Text>
          </View>
          <View style={[styles.networkCard, { borderColor: Colors.info + "44" }]}>
            <Ionicons name="globe" size={22} color={Colors.info} />
            <Text style={[styles.networkCount, { color: Colors.info }]}>{stats.broadband_count}</Text>
            <Text style={styles.networkLabel}>برودباند</Text>
          </View>
          <View style={[styles.networkCard, { borderColor: Colors.warning + "44" }]}>
            <Ionicons name="time" size={22} color={Colors.warning} />
            <Text style={[styles.networkCount, { color: Colors.warning }]}>{stats.pending_tasks}</Text>
            <Text style={styles.networkLabel}>مهام معلقة</Text>
          </View>
          <View style={[styles.networkCard, { borderColor: Colors.success + "44" }]}>
            <Ionicons name="construct" size={22} color={Colors.success} />
            <Text style={[styles.networkCount, { color: Colors.success }]}>{stats.in_progress_tasks}</Text>
            <Text style={styles.networkLabel}>قيد التنفيذ</Text>
          </View>
        </View>

        {/* إضافة المهام */}
        <Text style={styles.sectionHeader}>إضافة مهام</Text>
        <View style={styles.buttonRow}>
          {renderButton("إصلاح", "build", () => router.push("/(supervisor)/repair-ticket"), Colors.error)}
          {renderButton("تركيب جديد", "add-circle", () => router.push("/(supervisor)/installation-tickets"), Colors.success)}
          {renderButton("شراء", "cart", () => router.push("/(supervisor)/purchase-request"), Colors.warning)}
        </View>

        {/* الإدارة */}
        <Text style={styles.sectionHeader}>الإدارة</Text>
        <View style={styles.buttonRow}>
          {renderButton("قاعدة البيانات", "server", () => router.push("/(supervisor)/database"), Colors.primary)}
          {renderButton("إدارة المهندسين", "people", () => router.push("/(supervisor)/engineer-management"), Colors.info)}
          {renderButton("متابعة المهام", "list", () => router.push("/(supervisor)/tasks"), Colors.roles.supervisor)}
        </View>

        {/* خاص بالمسؤول المالي */}
        <Text style={styles.sectionHeader}>التسليمات المالية</Text>
        <View style={styles.buttonRow}>
          {renderButton("تسليم الاشتراكات", "cash", () => router.push("/(supervisor)/subscription-delivery"), "#00BCD4")}
          {renderButton("جرد مالي", "calculator", () => router.push("/(supervisor)/finance-audit"), "#9C27B0")}
        </View>

        {/* طلبات الشراء */}
        {pendingRequests.length > 0 && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>طلبات الشراء المعلقة</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{pendingRequests.length}</Text>
              </View>
            </View>
            {pendingRequests.map(req => (
              <TouchableOpacity
                key={req.id} style={styles.listCard}
                onPress={() => router.push("/(supervisor)/purchase-request")}
              >
                <Text style={styles.cardTitle}>{req.description}</Text>
                <Text style={styles.cardSubText}>
                  {new Date(req.createdAt).toLocaleDateString("ar-SA")}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* آخر المهام */}
        {recentTasks.length > 0 && (
          <>
            <Text style={[styles.sectionHeader, { marginTop: 16 }]}>آخر المهام النشطة</Text>
            {recentTasks.map(task => (
              <View key={task.id} style={styles.listCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{task.title}</Text>
                  <View style={[styles.statusBadge, {
                    backgroundColor: task.status === "in_progress" ? Colors.warning + "22" : Colors.error + "22"
                  }]}>
                    <Text style={[styles.statusText, {
                      color: task.status === "in_progress" ? Colors.warning : Colors.error
                    }]}>
                      {task.status === "in_progress" ? "جاري" : "معلق"}
                    </Text>
                  </View>
                </View>
                {task.targetPersonName && (
                  <Text style={styles.cardSubText}>{task.targetPersonName}</Text>
                )}
              </View>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 20 },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  welcomeText: { fontSize: 18, fontWeight: "bold", color: Colors.text, textAlign: "right" },
  dateText: { fontSize: 12, color: Colors.textSecondary, textAlign: "right" },
  networkRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 20 },
  networkCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12,
    padding: 10, alignItems: "center", borderWidth: 1, gap: 4,
  },
  networkCount: { fontSize: 18, fontWeight: "bold" },
  networkLabel: { fontSize: 10, color: Colors.textSecondary, textAlign: "center" },
  sectionHeader: { fontSize: 15, fontWeight: "bold", color: Colors.text, textAlign: "right", marginBottom: 10 },
  sectionHeaderRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 10 },
  countBadge: { backgroundColor: Colors.warning + "33", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countBadgeText: { fontSize: 12, color: Colors.warning, fontWeight: "bold" },
  buttonRow: { flexDirection: "row-reverse", gap: 12, marginBottom: 20, flexWrap: "wrap" },
  actionButton: { alignItems: "center", width: 76 },
  iconCircle: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.surface,
    justifyContent: "center", alignItems: "center", marginBottom: 6,
    borderWidth: 1,
  },
  buttonLabel: { fontSize: 10, color: Colors.textSecondary, textAlign: "center" },
  listCard: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: "bold", color: Colors.text, textAlign: "right", flex: 1 },
  cardSubText: { fontSize: 12, color: Colors.textSecondary, textAlign: "right" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "bold" },
});
