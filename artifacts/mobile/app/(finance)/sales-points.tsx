import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useRouter } from "expo-router";

export default function SalesPointsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [points] = useState([
    { id: 1, name: "نقطة بيع الشمال", owner: "أحمد صالح", phone: "0501234567", location: "حي الشفاء", oldDebt: 5000, notes: "عميل قديم وموثوق" },
    { id: 2, name: "نقطة بيع الوسط", owner: "خالد فهد", phone: "0557654321", location: "شارع الملك", oldDebt: 2300, notes: "" },
    { id: 3, name: "نقطة بيع الشرق", owner: "ياسر حمد", phone: "0549876543", location: "المنطقة الصناعية", oldDebt: 0, notes: "توزيع كروت فقط" },
  ]);

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>نقاط البيع</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {points.map((point) => (
          <View key={point.id} style={styles.pointCard}>
            <View style={styles.cardHeader}>
              <View style={styles.nameSection}>
                <Text style={styles.pointName}>{point.name}</Text>
                <Text style={styles.ownerName}>{point.owner}</Text>
              </View>
              <View style={styles.debtBadge}>
                <Text style={styles.debtLabel}>مديونية قديمة</Text>
                <Text style={styles.debtValue}>{point.oldDebt.toLocaleString("ar-SA")} ر.س</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.contactSection}>
              <TouchableOpacity style={styles.contactItem} onPress={() => handleCall(point.phone)}>
                <View style={styles.iconContainer}>
                  <Ionicons name="call-outline" size={18} color={Colors.primary} />
                </View>
                <Text style={styles.contactText}>{point.phone}</Text>
              </TouchableOpacity>

              <View style={styles.contactItem}>
                <View style={[styles.iconContainer, { backgroundColor: Colors.info + "15" }]}>
                  <Ionicons name="location-outline" size={18} color={Colors.info} />
                </View>
                <Text style={styles.contactText}>{point.location}</Text>
              </View>
            </View>

            {point.notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>ملاحظات:</Text>
                <Text style={styles.notesText}>{point.notes}</Text>
              </View>
            ) : null}
          </View>
        ))}
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
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  backButton: { padding: 4 },
  content: { padding: 20 },
  pointCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start" },
  nameSection: { alignItems: "flex-end", flex: 1 },
  pointName: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "right" },
  ownerName: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  debtBadge: { backgroundColor: Colors.background, padding: 8, borderRadius: 12, alignItems: "center", minWidth: 100 },
  debtLabel: { fontSize: 9, color: Colors.textMuted, marginBottom: 2 },
  debtValue: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.warning },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  contactSection: { gap: 12 },
  contactItem: { flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  iconContainer: { backgroundColor: Colors.primary + "15", padding: 8, borderRadius: 10 },
  contactText: { fontSize: 14, color: Colors.text, fontFamily: "Inter_500Medium" },
  notesBox: { marginTop: 16, backgroundColor: Colors.background, padding: 12, borderRadius: 12 },
  notesLabel: { fontSize: 11, color: Colors.textSecondary, marginBottom: 4, textAlign: "right" },
  notesText: { fontSize: 13, color: Colors.text, textAlign: "right", fontFamily: "Inter_400Regular" },
});
