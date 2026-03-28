import React from "react";
import { View, Text, StyleSheet, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

export default function TechTicketsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>التذاكر</Text>
        <Ionicons name="construct" size={22} color={Colors.roles.tech_engineer} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.emptyCard}>
          <Ionicons name="construct-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>مرحباً، {user?.name}</Text>
          <Text style={styles.emptyRole}>مهندس تقني</Text>
          <Text style={styles.emptyNote}>سيتم إضافة تذاكر الصيانة والتركيب في المهام القادمة</Text>
        </View>
      </ScrollView>
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
  content: { flex: 1, padding: 20, alignItems: "center", justifyContent: "center" },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 32,
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  emptyRole: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.roles.tech_engineer },
  emptyNote: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center", marginTop: 8 },
});
