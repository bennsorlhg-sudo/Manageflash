import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Linking, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, apiPatch, formatDateTime } from "@/utils/api";

type Tab = "new" | "in_progress" | "completed" | "archived" | "create";

const TAB_LABELS: Record<Tab, string> = {
  create: "إنشاء", new: "جديدة", in_progress: "جارية", completed: "مكتملة", archived: "أرشيف",
};

const SERVICE_TYPES = [
  { value: "hotspot_internal", label: "هوتسبوت داخلي" },
  { value: "hotspot_external", label: "هوتسبوت خارجي" },
  { value: "broadband", label: "برودباند" },
];

export default function InstallationTicketsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("new");
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    clientName: "", clientPhone: "", serviceType: "hotspot_internal",
    locationUrl: "", address: "", notes: "",
  });

  const fetchTickets = useCallback(async () => {
    try {
      const data = await apiGet("/tickets/installation", token);
      setTickets(data);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const filteredTickets = tickets.filter(t => t.status === activeTab);

  const handleSubmit = async () => {
    if (!formData.clientName || !formData.clientPhone) {
      Alert.alert("خطأ", "أدخل اسم العميل ورقم الهاتف");
      return;
    }
    setSubmitting(true);
    try {
      const ticket = await apiPost("/tickets/installation", token, formData);
      setTickets(prev => [ticket, ...prev]);
      setActiveTab("new");
      setFormData({ clientName: "", clientPhone: "", serviceType: "hotspot_internal", locationUrl: "", address: "", notes: "" });
      Alert.alert("تم", "تم إنشاء تذكرة التركيب بنجاح");
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const updated = await apiPatch(`/tickets/installation/${id}`, token, { status });
      setTickets(prev => prev.map(t => t.id === id ? updated : t));
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    }
  };

  const getServiceLabel = (type: string) => SERVICE_TYPES.find(s => s.value === type)?.label ?? type;

  const renderTicket = (t: any) => (
    <View key={t.id} style={styles.ticketCard}>
      <View style={styles.ticketHeader}>
        <Text style={styles.ticketName}>{t.clientName}</Text>
        <View style={[styles.typeBadge, { backgroundColor: Colors.primary + "22" }]}>
          <Text style={[styles.typeBadgeText, { color: Colors.primary }]}>{getServiceLabel(t.serviceType)}</Text>
        </View>
      </View>
      {t.clientPhone && (
        <TouchableOpacity style={styles.phoneRow} onPress={() => Linking.openURL(`tel:${t.clientPhone}`)}>
          <Ionicons name="call" size={14} color={Colors.success} />
          <Text style={[styles.infoText, { color: Colors.success }]}>{t.clientPhone}</Text>
        </TouchableOpacity>
      )}
      {t.address && <Text style={styles.infoText}>{t.address}</Text>}
      {t.locationUrl && (
        <TouchableOpacity onPress={() => Linking.openURL(t.locationUrl)} style={styles.linkRow}>
          <Ionicons name="location" size={14} color={Colors.primaryLight} />
          <Text style={[styles.infoText, { color: Colors.primaryLight }]}>فتح الموقع</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.dateText}>{formatDateTime(t.createdAt)}</Text>
      {t.notes && <Text style={styles.notesText}>{t.notes}</Text>}

      <View style={styles.ticketActions}>
        {t.status === "new" && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.warning + "22" }]} onPress={() => updateStatus(t.id, "in_progress")}>
            <Text style={[styles.actionBtnText, { color: Colors.warning }]}>بدء التنفيذ</Text>
          </TouchableOpacity>
        )}
        {t.status === "in_progress" && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.success + "22" }]} onPress={() => updateStatus(t.id, "completed")}>
            <Text style={[styles.actionBtnText, { color: Colors.success }]}>إكمال</Text>
          </TouchableOpacity>
        )}
        {(t.status === "new" || t.status === "in_progress") && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.textMuted + "22" }]} onPress={() => updateStatus(t.id, "archived")}>
            <Text style={[styles.actionBtnText, { color: Colors.textMuted }]}>أرشفة</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>تذاكر التركيب</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
        {(["create", "new", "in_progress", "completed", "archived"] as Tab[]).map(t => (
          <TouchableOpacity
            key={t} style={[styles.tabButton, activeTab === t && styles.tabButtonActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabButtonText, activeTab === t && styles.tabButtonTextActive]}>
              {TAB_LABELS[t]}
              {t !== "create" && tickets.filter(tx => tx.status === t).length > 0
                ? ` (${tickets.filter(tx => tx.status === t).length})`
                : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {activeTab === "create" ? (
        <ScrollView contentContainerStyle={styles.content}>
          {/* نوع الخدمة */}
          <View style={styles.card}>
            <Text style={styles.label}>نوع التركيب</Text>
            <View style={styles.serviceTypes}>
              {SERVICE_TYPES.map(s => (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.serviceTypeBtn, formData.serviceType === s.value && styles.serviceTypeBtnActive]}
                  onPress={() => setFormData(f => ({ ...f, serviceType: s.value }))}
                >
                  <Text style={[styles.serviceTypeBtnText, formData.serviceType === s.value && styles.serviceTypeBtnTextActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* بيانات العميل */}
          <View style={styles.card}>
            <Text style={styles.label}>اسم العميل *</Text>
            <TextInput
              style={styles.input} value={formData.clientName}
              onChangeText={v => setFormData(f => ({ ...f, clientName: v }))}
              textAlign="right" placeholder="اسم العميل" placeholderTextColor={Colors.textMuted}
            />
            <Text style={[styles.label, { marginTop: 12 }]}>رقم الهاتف *</Text>
            <TextInput
              style={styles.input} value={formData.clientPhone}
              onChangeText={v => setFormData(f => ({ ...f, clientPhone: v }))}
              textAlign="right" placeholder="05xxxxxxxx" placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />
            <Text style={[styles.label, { marginTop: 12 }]}>العنوان</Text>
            <TextInput
              style={styles.input} value={formData.address}
              onChangeText={v => setFormData(f => ({ ...f, address: v }))}
              textAlign="right" placeholder="الحي / الشارع" placeholderTextColor={Colors.textMuted}
            />
            <Text style={[styles.label, { marginTop: 12 }]}>رابط الموقع</Text>
            <TextInput
              style={styles.input} value={formData.locationUrl}
              onChangeText={v => setFormData(f => ({ ...f, locationUrl: v }))}
              textAlign="right" placeholder="https://maps.google.com/..." placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
            />
            <Text style={[styles.label, { marginTop: 12 }]}>ملاحظات</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: "top" }]}
              value={formData.notes} onChangeText={v => setFormData(f => ({ ...f, notes: v }))}
              textAlign="right" placeholder="أي تفاصيل إضافية..." placeholderTextColor={Colors.textMuted}
              multiline
            />
          </View>

          <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>إنشاء تذكرة التركيب</Text>}
          </TouchableOpacity>
        </ScrollView>
      ) : loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTickets(); }} />}
        >
          {filteredTickets.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>لا توجد تذاكر</Text>
            </View>
          ) : filteredTickets.map(renderTicket)}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  tabsScroll: { maxHeight: 52 },
  tabs: { flexDirection: "row-reverse", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tabButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  tabButtonActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabButtonText: { fontSize: 13, color: Colors.textSecondary, fontWeight: "500" },
  tabButtonTextActive: { color: "#FFF", fontWeight: "bold" },
  content: { padding: 16 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  label: { fontSize: 14, color: Colors.textSecondary, textAlign: "right", marginBottom: 8 },
  input: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  serviceTypes: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  serviceTypeBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  serviceTypeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  serviceTypeBtnText: { fontSize: 13, color: Colors.textSecondary },
  serviceTypeBtnTextActive: { color: "#FFF", fontWeight: "bold" },
  submitBtn: { backgroundColor: Colors.success, borderRadius: 12, padding: 16, alignItems: "center" },
  submitBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
  ticketCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  ticketHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  ticketName: { fontSize: 16, fontWeight: "bold", color: Colors.text },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeBadgeText: { fontSize: 11, fontWeight: "bold" },
  phoneRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6, marginBottom: 4 },
  linkRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 4 },
  infoText: { fontSize: 13, color: Colors.textSecondary },
  dateText: { fontSize: 11, color: Colors.textMuted, marginTop: 8, textAlign: "right" },
  notesText: { fontSize: 12, color: Colors.textMuted, marginTop: 4, textAlign: "right" },
  ticketActions: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  actionBtnText: { fontSize: 12, fontWeight: "bold" },
  emptyContainer: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
});
