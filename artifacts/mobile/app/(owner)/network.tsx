import React, { useState } from "react";
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
import { useListHotspotPoints, useListBroadbandPoints } from "@workspace/api-client-react";
import { Colors } from "@/constants/colors";
import { StatusBadge } from "@/components/StatusBadge";
import type { PointStatus } from "@/constants/colors";

type Tab = "hotspot" | "broadband";

export default function NetworkScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>("hotspot");

  const {
    data: hotspotPoints,
    isLoading: hotspotLoading,
    refetch: refetchHotspot,
  } = useListHotspotPoints();
  const {
    data: broadbandPoints,
    isLoading: broadbandLoading,
    refetch: refetchBroadband,
  } = useListBroadbandPoints();

  const isLoading = activeTab === "hotspot" ? hotspotLoading : broadbandLoading;
  const points = activeTab === "hotspot" ? hotspotPoints : broadbandPoints;

  const handleRefresh = () => {
    if (activeTab === "hotspot") refetchHotspot();
    else refetchBroadband();
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
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
            هوت سبوت
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "broadband" && styles.tabActive]}
          onPress={() => setActiveTab("broadband")}
        >
          <Text style={[styles.tabText, activeTab === "broadband" && styles.tabTextActive]}>
            برودباند
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
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
              refreshing={false}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {!points || points.length === 0 ? (
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
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  tabs: {
    flexDirection: "row-reverse",
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  tabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: "#fff",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 20,
    gap: 12,
  },
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
  cardName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    textAlign: "right",
  },
  cardRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },
  cardLocation: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  cardNotes: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "right",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
});
