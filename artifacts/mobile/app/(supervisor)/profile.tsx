import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Colors, ROLE_LABELS, type UserRole } from "@/constants/colors";
import { RoleBadge } from "@/components/RoleBadge";
import { useAuth } from "@/context/AuthContext";

export default function SupervisorProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert("تسجيل الخروج", "هل أنت متأكد؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "خروج",
        style: "destructive",
        onPress: async () => {
          if (Platform.OS !== "web") {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  if (!user) return null;

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 12 : insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>حسابي</Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color={Colors.roles.supervisor} />
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.phone}>{user.phone}</Text>
          <RoleBadge role={user.role as UserRole} />
        </View>

        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>{user.phone}</Text>
            <View style={styles.infoRight}>
              <Text style={styles.infoLabel}>رقم الهاتف</Text>
              <Ionicons name="call-outline" size={16} color={Colors.textMuted} />
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>{ROLE_LABELS[user.role as UserRole]}</Text>
            <View style={styles.infoRight}>
              <Text style={styles.infoLabel}>الدور</Text>
              <Ionicons name="shield-checkmark-outline" size={16} color={Colors.textMuted} />
            </View>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.infoValue, { color: user.isActive ? Colors.success : Colors.error }]}>
              {user.isActive ? "نشط" : "غير نشط"}
            </Text>
            <View style={styles.infoRight}>
              <Text style={styles.infoLabel}>الحالة</Text>
              <Ionicons name="radio-button-on-outline" size={16} color={Colors.textMuted} />
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>تسجيل الخروج</Text>
        </TouchableOpacity>
        <Text style={styles.version}>Flash Net v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: "flex-end",
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  content: { padding: 20, gap: 16 },
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.roles.supervisor + "22",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.roles.supervisor + "55",
    marginBottom: 4,
  },
  name: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  phone: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoRight: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  infoLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  infoValue: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.text },
  logoutBtn: {
    backgroundColor: Colors.error + "15",
    borderWidth: 1,
    borderColor: Colors.error + "44",
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutText: { color: Colors.error, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  version: { textAlign: "center", color: Colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular" },
});
