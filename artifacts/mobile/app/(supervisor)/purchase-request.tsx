import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, formatDate } from "@/utils/api";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد المراجعة", color: Colors.warning },
  approved: { label: "تمت الموافقة", color: Colors.success },
  rejected: { label: "مرفوض", color: Colors.error },
  purchased: { label: "تم الشراء", color: Colors.info },
};

const PRIORITY_OPTIONS = [
  { value: "low", label: "منخفض" },
  { value: "medium", label: "متوسط" },
  { value: "high", label: "عالي" },
  { value: "urgent", label: "عاجل" },
];

export default function PurchaseRequestScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [showForm, setShowForm] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    description: "", quantity: "", unit: "", notes: "", priority: "medium", estimatedCost: "",
  });

  const fetchRequests = useCallback(async () => {
    try {
      const data = await apiGet("/purchase-requests", token);
      setRequests(data);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleSubmit = async () => {
    if (!formData.description) { Alert.alert("خطأ", "أدخل وصف الصنف المطلوب"); return; }
    setSubmitting(true);
    try {
      const req = await apiPost("/purchase-requests", token, {
        description: formData.description,
        quantity: formData.quantity ? parseInt(formData.quantity) : undefined,
        unit: formData.unit || undefined,
        notes: formData.notes || undefined,
        priority: formData.priority,
        estimatedCost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : undefined,
      });
      setRequests(prev => [req, ...prev]);
      setFormData({ description: "", quantity: "", unit: "", notes: "", priority: "medium", estimatedCost: "" });
      setShowForm(false);
      Alert.alert("تم", "تم إرسال طلب الشراء بنجاح");
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>طلبات الشراء</Text>
        <TouchableOpacity onPress={() => setShowForm(!showForm)}>
          <Ionicons name={showForm ? "close-circle" : "add-circle"} size={26} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} />}
      >
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>طلب شراء جديد</Text>

            <Text style={styles.label}>اسم الصنف / الوصف *</Text>
            <TextInput
              style={styles.input} value={formData.description}
              onChangeText={v => setFormData(f => ({ ...f, description: v }))}
              textAlign="right" placeholder="مثال: كابل CAT6 طول 100م" placeholderTextColor={Colors.textMuted}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>الكمية</Text>
                <TextInput
                  style={styles.input} value={formData.quantity}
                  onChangeText={v => setFormData(f => ({ ...f, quantity: v }))}
                  textAlign="right" keyboardType="numeric" placeholder="1" placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>الوحدة</Text>
                <TextInput
                  style={styles.input} value={formData.unit}
                  onChangeText={v => setFormData(f => ({ ...f, unit: v }))}
                  textAlign="right" placeholder="قطعة / متر" placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            <Text style={styles.label}>التكلفة التقديرية (ر.س)</Text>
            <TextInput
              style={styles.input} value={formData.estimatedCost}
              onChangeText={v => setFormData(f => ({ ...f, estimatedCost: v }))}
              textAlign="right" keyboardType="numeric" placeholder="0.00" placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>الأولوية</Text>
            <View style={styles.priorityRow}>
              {PRIORITY_OPTIONS.map(p => (
                <TouchableOpacity
                  key={p.value}
                  style={[styles.priorityBtn, formData.priority === p.value && styles.priorityBtnActive]}
                  onPress={() => setFormData(f => ({ ...f, priority: p.value }))}
                >
                  <Text style={[styles.priorityBtnText, formData.priority === p.value && styles.priorityBtnTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>ملاحظات</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: "top" }]}
              value={formData.notes} onChangeText={v => setFormData(f => ({ ...f, notes: v }))}
              textAlign="right" multiline placeholder="أي تفاصيل إضافية..." placeholderTextColor={Colors.textMuted}
            />

            <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>إرسال الطلب</Text>}
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionTitle}>الطلبات ({requests.length})</Text>

        {requests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>لا توجد طلبات شراء</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
              <Text style={styles.addBtnText}>إضافة طلب جديد</Text>
            </TouchableOpacity>
          </View>
        ) : requests.map(req => {
          const statusInfo = STATUS_MAP[req.status] ?? { label: req.status, color: Colors.textSecondary };
          const priorityInfo = PRIORITY_OPTIONS.find(p => p.value === req.priority);
          return (
            <View key={req.id} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <Text style={styles.requestItem}>{req.description}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + "22" }]}>
                  <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                </View>
              </View>
              {(req.quantity || req.unit) && (
                <Text style={styles.requestDetail}>
                  {req.quantity ? `الكمية: ${req.quantity}` : ""} {req.unit ? req.unit : ""}
                </Text>
              )}
              {req.notes && <Text style={styles.requestNotes}>{req.notes}</Text>}
              <View style={styles.requestFooter}>
                <Text style={styles.requestDate}>{formatDate(req.createdAt)}</Text>
                {priorityInfo && (
                  <Text style={styles.requestPriority}>{priorityInfo.label}</Text>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  content: { padding: 16 },
  formCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  formTitle: { fontSize: 17, fontWeight: "bold", color: Colors.text, textAlign: "right", marginBottom: 16 },
  label: { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, color: Colors.text, textAlign: "right", borderWidth: 1, borderColor: Colors.border },
  row: { flexDirection: "row-reverse" },
  priorityRow: { flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" },
  priorityBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  priorityBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  priorityBtnText: { fontSize: 12, color: Colors.textSecondary },
  priorityBtnTextActive: { color: "#FFF", fontWeight: "bold" },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 },
  submitBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: Colors.text, textAlign: "right", marginBottom: 12 },
  emptyContainer: { alignItems: "center", marginTop: 40, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
  addBtn: { backgroundColor: Colors.primary + "22", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  addBtnText: { color: Colors.primary, fontWeight: "bold" },
  requestCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  requestHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  requestItem: { color: Colors.text, fontWeight: "bold", fontSize: 14, flex: 1, textAlign: "right" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "bold" },
  requestDetail: { color: Colors.textSecondary, fontSize: 12, textAlign: "right", marginTop: 6 },
  requestNotes: { color: Colors.textMuted, fontSize: 12, textAlign: "right", marginTop: 4 },
  requestFooter: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  requestDate: { color: Colors.textMuted, fontSize: 11 },
  requestPriority: { color: Colors.textMuted, fontSize: 11 },
});
