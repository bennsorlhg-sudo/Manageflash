import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

type IoniconsName = ComponentProps<typeof Ionicons>["name"];

interface StatCard {
  icon: IoniconsName;
  label: string;
  value: string;
  color: string;
}

const statCards: StatCard[] = [
  { icon: "wifi", label: "نقاط الهوت سبوت", value: "—", color: Colors.primary },
  { icon: "radio", label: "نقاط البرودباند", value: "—", color: Colors.success },
  { icon: "people", label: "أعضاء الفريق", value: "—", color: Colors.roles.supervisor },
  { icon: "cart", label: "نقاط المبيعات", value: "—", color: Colors.roles.finance_manager },
];

interface QuickActionProps {
  icon: IoniconsName;
  label: string;
  color: string;
  onPress: () => void;
}

export default function OwnerDashboard() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>مرحباً،</Text>
          <Text style={styles.userName}>{user?.name}</Text>
        </View>
        <View style={styles.logoMini}>
          <Ionicons name="flash" size={22} color={Colors.primary} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>نظرة عامة</Text>
        <View style={styles.statsGrid}>
          {statCards.map((card) => (
            <View key={card.label} style={[styles.statCard, { borderTopColor: card.color }]}>
              <View style={[styles.statIconWrap, { backgroundColor: card.color + "22" }]}>
                <Ionicons name={card.icon} size={22} color={card.color} />
              </View>
              <Text style={styles.statValue}>{card.value}</Text>
              <Text style={styles.statLabel}>{card.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
        <View style={styles.actionsGrid}>
          <QuickAction
            icon="person-add"
            label="إضافة عضو"
            color={Colors.primary}
            onPress={() => router.push("/(owner)/team")}
          />
          <QuickAction
            icon="wifi"
            label="الشبكة"
            color={Colors.success}
            onPress={() => router.push("/(owner)/network")}
          />
          <QuickAction
            icon="settings"
            label="الإعدادات"
            color={Colors.textSecondary}
            onPress={() => {}}
          />
          <QuickAction
            icon="bar-chart"
            label="التقارير"
            color={Colors.warning}
            onPress={() => {}}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function QuickAction({ icon, label, color, onPress }: QuickActionProps) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.actionIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  greeting: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
  },
  userName: {
    fontSize: 20,
    color: Colors.text,
    fontFamily: "Inter_700Bold",
    textAlign: "right",
  },
  logoMini: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textAlign: "right",
    marginBottom: 4,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 3,
    padding: 14,
    gap: 8,
    alignItems: "flex-end",
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "right",
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    alignItems: "center",
    gap: 10,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    textAlign: "center",
  },
});
