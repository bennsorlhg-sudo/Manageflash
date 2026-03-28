import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Linking, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet } from "@/utils/api";

export default function EngineerManagementScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [engineers, setEngineers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const fetchEngineers = useCallback(async () => {
    try {
      const users = await apiGet("/users", token);
      setEngineers(users.filter((u: any) => u.role === "tech_engineer"));
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchEngineers(); }, [fetchEngineers]);

  const filtered = engineers.filter(e =>
    !search || e.name?.toLowerCase().includes(search.toLowerCase()) || e.phone?.includes(search)
  );

  const callEngineer = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert("خطأ", "تعذّر فتح المكالمة"));
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
        <Text style={styles.title}>إدارة المهندسين</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="بحث بالاسم أو الهاتف"
          placeholderTextColor={Colors.textMuted}
          textAlign="right"
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEngineers(); }} />}
      >
        <Text style={styles.countText}>{filtered.length} مهندس</Text>

        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={60} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {engineers.length === 0 ? "لا يوجد مهندسون مسجلون" : "لا توجد نتائج للبحث"}
            </Text>
            {engineers.length === 0 && (
              <Text style={styles.emptyHint}>
                يمكن إضافة مهندسين من قسم إدارة المستخدمين لدى المالك
              </Text>
            )}
          </View>
        ) : filtered.map(eng => (
          <View key={eng.id} style={styles.engCard}>
            <View style={styles.engAvatar}>
              <Text style={styles.engAvatarText}>
                {eng.name?.charAt(0) ?? "م"}
              </Text>
            </View>
            <View style={styles.engInfo}>
              <Text style={styles.engName}>{eng.name}</Text>
              {eng.phone && (
                <Text style={styles.engPhone}>{eng.phone}</Text>
              )}
              <View style={[styles.roleTag, { backgroundColor: Colors.roles.tech_engineer + "22" }]}>
                <Text style={[styles.roleTagText, { color: Colors.roles.tech_engineer }]}>
                  مهندس تقني
                </Text>
              </View>
            </View>
            <View style={styles.engActions}>
              {eng.phone && (
                <TouchableOpacity style={styles.callBtn} onPress={() => callEngineer(eng.phone)}>
                  <Ionicons name="call" size={20} color={Colors.success} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  searchBar: { flexDirection: "row-reverse", alignItems: "center", margin: 16, backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  content: { paddingHorizontal: 16 },
  countText: { color: Colors.textMuted, fontSize: 12, textAlign: "right", marginBottom: 10 },
  emptyContainer: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 16 },
  emptyHint: { color: Colors.textMuted, fontSize: 12, textAlign: "center", paddingHorizontal: 40 },
  engCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border, flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  engAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.roles.tech_engineer + "33", justifyContent: "center", alignItems: "center" },
  engAvatarText: { fontSize: 22, fontWeight: "bold", color: Colors.roles.tech_engineer },
  engInfo: { flex: 1, alignItems: "flex-end", gap: 3 },
  engName: { fontSize: 15, fontWeight: "bold", color: Colors.text },
  engPhone: { fontSize: 13, color: Colors.textSecondary },
  roleTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 2 },
  roleTagText: { fontSize: 11, fontWeight: "bold" },
  engActions: { gap: 8 },
  callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.success + "22", justifyContent: "center", alignItems: "center" },
});
