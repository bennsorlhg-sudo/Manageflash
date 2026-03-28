import React from "react";
import { View, Text, StyleSheet, ScrollView, Platform, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useListHotspotPoints, useListBroadbandPoints } from "@workspace/api-client-react";
import { Colors } from "@/constants/colors";
import { StatusBadge } from "@/components/StatusBadge";
import type { PointStatus } from "@/constants/colors";

export default function SupervisorNetworkScreen() {
  const insets = useSafeAreaInsets();
  const { data: hotspot, isLoading: hLoading, refetch: rH } = useListHotspotPoints();
  const { data: broadband, isLoading: bLoading, refetch: rB } = useListBroadbandPoints();
  const isLoading = hLoading || bLoading;

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>الشبكة</Text>
        <Ionicons name="wifi" size={22} color={Colors.roles.supervisor} />
      </View>
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 80 }]}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => { rH(); rB(); }} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>هوت سبوت ({hotspot?.length ?? 0})</Text>
          {hotspot?.map((p) => (
            <View key={p.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <StatusBadge status={p.status as PointStatus} size="sm" />
                <Text style={styles.cardName}>{p.name}</Text>
              </View>
              <Text style={styles.cardLocation}>{p.location}</Text>
            </View>
          ))}
          {(!hotspot || hotspot.length === 0) && <Text style={styles.emptyText}>لا توجد نقاط</Text>}

          <Text style={styles.sectionTitle}>برودباند ({broadband?.length ?? 0})</Text>
          {broadband?.map((p) => (
            <View key={p.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <StatusBadge status={p.status as PointStatus} size="sm" />
                <Text style={styles.cardName}>{p.name}</Text>
              </View>
              <Text style={styles.cardLocation}>{p.location}</Text>
            </View>
          ))}
          {(!broadband || broadband.length === 0) && <Text style={styles.emptyText}>لا توجد نقاط</Text>}
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
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, gap: 10 },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textAlign: "right",
    marginTop: 8,
    marginBottom: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  cardLocation: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "right" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "right", paddingVertical: 8 },
});
