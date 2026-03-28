import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Colors, type UserRole } from "@/constants/colors";
import { RoleBadge } from "@/components/RoleBadge";
import { useAuth } from "@/context/AuthContext";

export default function TechProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert("تسجيل الخروج", "هل أنت متأكد؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "خروج", style: "destructive", onPress: async () => { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); await logout(); } },
    ]);
  };

  if (!user) return null;

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>حسابي</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color={Colors.roles.tech_engineer} />
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.phone}>{user.phone}</Text>
          <RoleBadge role={user.role as UserRole} />
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: "flex-end" },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  content: { padding: 20, gap: 16 },
  profileCard: { backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 24, alignItems: "center", gap: 10 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.roles.tech_engineer + "22", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.roles.tech_engineer + "55" },
  name: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  phone: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  logoutBtn: { backgroundColor: Colors.error + "15", borderWidth: 1, borderColor: Colors.error + "44", borderRadius: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  logoutText: { color: Colors.error, fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
