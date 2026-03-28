import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { StatusBadge } from "@/components/StatusBadge";
import type { PointStatus } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet } from "@/utils/api";

type Tab = "hotspot" | "broadband";

interface NetworkPoint {
  id: number;
  name: string;
  location: string;
  status: string;
  notes?: string | null;
  supervisorId?: number | null;
}

export default function NetworkScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("hotspot");

  const [hotspotPoints, setHotspotPoints] = useState<NetworkPoint[]>([]);
  const [broadbandPoints, setBroadbandPoints] = useState<NetworkPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [hotspot, broadband] = await Promise.all([
        apiGet("/network/hotspot-points", token),
        apiGet("/network/broadband-points", token),
      ]);
      setHotspotPoints(hotspot);
      setBroadbandPoints(broadband);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const points = activeTab === "hotspot" ? hotspotPoints : broadbandPoints;

  const statusCounts = (arr: NetworkPoint[]) => ({
    active: arr.filter(p => p.status === "active").length,
    empty: arr.filter(p => p.status === "empty").length,
    ready: arr.filter(p => p.status === "ready").length,
    stopped: arr.filter(p => p.status === "stopped").length,
  });

  const hCounts = statusCounts(hotspotPoints);
  const bCounts = statusCounts(broadbandPoints);
  const counts = activeTab === "hotspot" ? hCounts : bCounts;

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>الشبكة</Text>
        <Ionicons name="wifi" size={22} color={Colors.primary} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "hotspot" && styles.tabActive]}
          onPress={() => setActiveTab("hotspot")}
        >
          <Text style={[styles.tabText, activeTab === "hotspot" && styles.tabTextActive]}>
            هوت سبوت ({hotspotPoints.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "broadband" && styles.tabActive]}
          onPress={() => setActiveTab("broadband")}
        >
          <Text style={[styles.tabText, activeTab === "broadband" && styles.tabTextActive]}>
            برودباند ({broadbandPoints.length})
          </Text>
        </TouchableOpacity>
      </View>

      {!loading && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: Colors.status.active }]} />
            <Text style={styles.statText}>نشط {counts.active}</Text>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: Colors.status.ready }]} />
            <Text style={styles.statText}>جاهز {counts.ready}</Text>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: Colors.status.empty }]} />
            <Text style={styles.statText}>فارغ {counts.empty}</Text>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: Colors.status.stopped }]} />
            <Text style={styles.statText}>متوقف {counts.stopped}</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 80 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchData(); }}
              tintColor={Colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {points.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="wifi-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>لا توجد نقاط شبكة بعد</Text>
            </View>
          ) : (
            points.map((point) => (
              <View key={point.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <StatusBadge status={point.status as PointStatus} size="sm" />
                  <Text style={styles.cardName}>{point.name}</Text>
                </View>
                <View style={styles.cardRow}>
                  <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.cardLocation}>{point.location}</Text>
                </View>
                {point.notes && (
                  <Text style={styles.cardNotes}>{point.notes}</Text>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  tabs: {
    flexDirection: "row-reverse",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  tabTextActive: { color: "#fff" },
  statsRow: {
    flexDirection: "row-reverse",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  statItem: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statText: { fontSize: 12, color: Colors.textSecondary },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 12 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text, textAlign: "right" },
  cardRow: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  cardLocation: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  cardNotes: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "right" },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textMuted },
});
