import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Linking, Alert, ActivityIndicator, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost } from "@/utils/api";

const SERVICE_TYPE_LABELS: Record<string, string> = {
  hotspot: "هوتسبوت", broadband: "برودباند", support: "دعم فني",
};

export default function RepairTicketScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [serviceNumber, setServiceNumber] = useState("");
  const [clientData, setClientData] = useState<any>(null);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignedToId, setAssignedToId] = useState<number | null>(null);
  const [assignedToName, setAssignedToName] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [engineers, setEngineers] = useState<{ id: number; name: string; phone: string }[]>([]);

  useEffect(() => {
    apiGet("/users/engineers", token)
      .then(setEngineers)
      .catch(() => {});
  }, [token]);

  const detectServiceType = (num: string) => {
    if (num.toLowerCase().startsWith("p")) return "broadband";
    return "hotspot";
  };

  const handleFetch = async () => {
    if (!serviceNumber) return;
    setFetching(true);
    const serviceType = detectServiceType(serviceNumber);
    try {
      const points = await apiGet(`/network/${serviceType === "broadband" ? "broadband" : "hotspot"}-points`, token);
      const match = points.find((p: any) =>
        p.id === parseInt(serviceNumber.replace(/[^0-9]/g, "")) ||
        p.name.includes(serviceNumber)
      );
      if (match) {
        setClientData({
          name: match.name,
          location: match.location,
          type: serviceType,
          status: match.status,
        });
      } else {
        setClientData({
          name: serviceType === "broadband" ? `عميل برودباند - ${serviceNumber}` : `عميل هوتسبوت - ${serviceNumber}`,
          location: "غير محدد",
          type: serviceType,
        });
      }
    } catch {
      setClientData({
        name: serviceType === "broadband" ? `عميل برودباند - ${serviceNumber}` : `عميل هوتسبوت - ${serviceNumber}`,
        location: "غير محدد",
        type: serviceType,
      });
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async () => {
    if (!serviceNumber || !description) {
      Alert.alert("خطأ", "يرجى إدخال رقم الخدمة ووصف المشكلة");
      return;
    }
    setSubmitting(true);
    try {
      await apiPost("/tickets/repair", token, {
        serviceNumber,
        clientName: clientData?.name,
        serviceType: detectServiceType(serviceNumber),
        problemDescription: description,
        priority,
        assignedToName: assignedToName || undefined,
        locationUrl: locationUrl || undefined,
      });
      Alert.alert("تم", "تم إنشاء تذكرة الإصلاح بنجاح", [
        { text: "حسناً", onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "فشل إنشاء التذكرة");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>تذكرة إصلاح</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* رقم الخدمة */}
        <View style={styles.card}>
          <Text style={styles.label}>رقم الخدمة (مثال: 30 هوتسبوت، p30 برودباند)</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input} placeholder="أدخل رقم الخدمة"
              placeholderTextColor={Colors.textMuted} value={serviceNumber}
              onChangeText={setServiceNumber} textAlign="right"
            />
            <TouchableOpacity style={styles.fetchButton} onPress={handleFetch} disabled={fetching}>
              {fetching
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Text style={styles.fetchButtonText}>جلب البيانات</Text>
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* بيانات العميل */}
        {clientData && (
          <View style={styles.clientCard}>
            <View style={styles.clientHeader}>
              <Text style={styles.clientName}>{clientData.name}</Text>
              <View style={[styles.serviceTypeBadge, { backgroundColor: clientData.type === "broadband" ? Colors.info + "22" : Colors.primary + "22" }]}>
                <Text style={[styles.serviceTypeText, { color: clientData.type === "broadband" ? Colors.info : Colors.primary }]}>
                  {SERVICE_TYPE_LABELS[clientData.type]}
                </Text>
              </View>
            </View>
            {clientData.location !== "غير محدد" && (
              <TouchableOpacity
                style={styles.detailRow}
                onPress={() => clientData.location && Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(clientData.location)}`)}
              >
                <Ionicons name="location" size={16} color={Colors.primaryLight} />
                <Text style={[styles.detailValue, { color: Colors.primaryLight }]}>{clientData.location}</Text>
              </TouchableOpacity>
            )}
            {clientData.status && (
              <View style={styles.detailRow}>
                <Ionicons name="radio-button-on" size={16} color={Colors.textMuted} />
                <Text style={styles.detailValue}>الحالة: {clientData.status}</Text>
              </View>
            )}
          </View>
        )}

        {/* وصف المشكلة */}
        <View style={styles.card}>
          <Text style={styles.label}>وصف المشكلة *</Text>
          <TextInput
            style={[styles.inputFull, styles.textArea]} multiline numberOfLines={4}
            placeholder="صف المشكلة بالتفصيل..." placeholderTextColor={Colors.textMuted}
            value={description} onChangeText={setDescription} textAlign="right"
          />
        </View>

        {/* الأولوية */}
        <View style={styles.card}>
          <Text style={styles.label}>الأولوية</Text>
          <View style={styles.priorityRow}>
            {([["low", "منخفض", Colors.textMuted], ["medium", "متوسط", Colors.info], ["high", "مرتفع", Colors.warning], ["urgent", "عاجل", Colors.error]] as [string, string, string][]).map(([val, label, color]) => (
              <TouchableOpacity
                key={val}
                style={[styles.priorityBtn, priority === val && { backgroundColor: color + "22", borderColor: color }]}
                onPress={() => setPriority(val)}
              >
                <Text style={[styles.priorityBtnText, priority === val && { color }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* المهندس المعين */}
        <View style={styles.card}>
          <Text style={styles.label}>إسناد إلى</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.engineerRow}>
            <TouchableOpacity
              style={[styles.engChip, assignedToId === null && styles.engChipActive]}
              onPress={() => { setAssignedToId(null); setAssignedToName(""); }}
            >
              <Text style={[styles.engChipText, assignedToId === null && styles.engChipTextActive]}>الكل</Text>
            </TouchableOpacity>
            {engineers.map(eng => (
              <TouchableOpacity
                key={eng.id}
                style={[styles.engChip, assignedToId === eng.id && styles.engChipActive]}
                onPress={() => { setAssignedToId(eng.id); setAssignedToName(eng.name); }}
              >
                <Text style={[styles.engChipText, assignedToId === eng.id && styles.engChipTextActive]}>
                  {eng.name.trim()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {assignedToId !== null && (
            <Text style={styles.selectedHint}>سيُسند للمهندس: {assignedToName}</Text>
          )}
          <Text style={[styles.label, { marginTop: 12 }]}>رابط الموقع (اختياري)</Text>
          <TextInput
            style={styles.inputFull} placeholder="https://maps.google.com/..."
            placeholderTextColor={Colors.textMuted} value={locationUrl}
            onChangeText={setLocationUrl} textAlign="right"
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity style={[styles.submitButton, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>إنشاء تذكرة الإصلاح</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  content: { padding: 20 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  label: { fontSize: 14, color: Colors.textSecondary, textAlign: "right", marginBottom: 8 },
  inputRow: { flexDirection: "row-reverse", gap: 10 },
  input: {
    flex: 1, backgroundColor: Colors.background, borderRadius: 8, padding: 12,
    color: Colors.text, textAlign: "right", borderWidth: 1, borderColor: Colors.border,
  },
  inputFull: {
    backgroundColor: Colors.background, borderRadius: 8, padding: 12,
    color: Colors.text, textAlign: "right", borderWidth: 1, borderColor: Colors.border,
  },
  fetchButton: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 15, justifyContent: "center", minWidth: 80 },
  fetchButtonText: { color: "#FFF", fontWeight: "bold", fontSize: 12 },
  clientCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.primary + "33" },
  clientHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  clientName: { fontSize: 16, fontWeight: "bold", color: Colors.text },
  serviceTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  serviceTypeText: { fontSize: 12, fontWeight: "bold" },
  detailRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 6 },
  detailValue: { color: Colors.text, fontSize: 14 },
  textArea: { height: 100, textAlignVertical: "top" },
  priorityRow: { flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" },
  priorityBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  priorityBtnText: { fontSize: 13, color: Colors.textSecondary, fontWeight: "500" },
  submitButton: { backgroundColor: Colors.success, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 16 },
  submitButtonText: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
  engineerRow: { flexDirection: "row-reverse", gap: 8, paddingBottom: 4 },
  engChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  engChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  engChipText: { fontSize: 13, color: Colors.textSecondary },
  engChipTextActive: { color: "#FFF", fontWeight: "bold" },
  selectedHint: { fontSize: 12, color: Colors.success, textAlign: "right", marginTop: 8 },
});
