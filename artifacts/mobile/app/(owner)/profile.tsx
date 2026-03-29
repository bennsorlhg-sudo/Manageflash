import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Colors, ROLE_LABELS, type UserRole } from "@/constants/colors";
import { RoleBadge } from "@/components/RoleBadge";
import { useAuth } from "@/context/AuthContext";

type IoniconsName = ComponentProps<typeof Ionicons>["name"];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleLogout = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await logout();
    router.replace("/login");
  };

  if (!user) return null;

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 12 : insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>حسابي</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.profileName}>{user.name}</Text>
          <Text style={styles.profilePhone}>{user.phone}</Text>
          <RoleBadge role={user.role as UserRole} />
        </View>

        <View style={styles.section}>
          <InfoRow icon="call-outline" label="رقم الهاتف" value={user.phone} />
          <InfoRow icon="shield-checkmark-outline" label="الدور" value={ROLE_LABELS[user.role as UserRole]} />
          <InfoRow
            icon="radio-button-on-outline"
            label="الحالة"
            value={user.isActive ? "نشط" : "غير نشط"}
            valueColor={user.isActive ? Colors.success : Colors.error}
          />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowConfirm(true)} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>تسجيل الخروج</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Flash Net v1.0.0</Text>
      </ScrollView>

      <Modal transparent visible={showConfirm} animationType="fade" onRequestClose={() => setShowConfirm(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>تسجيل الخروج</Text>
            <Text style={styles.dialogMsg}>هل أنت متأكد من تسجيل الخروج؟</Text>
            <View style={styles.dialogBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowConfirm(false)} activeOpacity={0.8}>
                <Text style={styles.cancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleLogout} activeOpacity={0.8}>
                <Text style={styles.confirmText}>خروج</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: IoniconsName;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Text style={[styles.infoValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
      </View>
      <View style={styles.infoRight}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Ionicons name={icon} size={16} color={Colors.textMuted} />
      </View>
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
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 16, alignItems: "stretch" },
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
    backgroundColor: Colors.primary + "22",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.primary + "55",
    marginBottom: 4,
  },
  profileName: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  profilePhone: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
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
  infoLeft: { flex: 1, alignItems: "flex-start" },
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
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  dialog: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    width: 300,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  dialogTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "center" },
  dialogMsg: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
  dialogBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    backgroundColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: { color: Colors.text, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  confirmBtn: {
    flex: 1,
    backgroundColor: Colors.error,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  confirmText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
