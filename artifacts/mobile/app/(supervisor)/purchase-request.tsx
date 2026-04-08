import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, apiDelete, formatDate } from "@/utils/api";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:  { label: "جديد",       color: Colors.info    },
  approved: { label: "تم الشراء",  color: Colors.success },
  rejected: { label: "مرفوض",     color: Colors.error   },
  purchased:{ label: "تم الشراء",  color: Colors.success },
};

type Item = { name: string; quantity: string };

function AlertModal({ visible, title, message, color, onClose }: {
  visible: boolean; title: string; message: string; color: string; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.alertBox}>
          <Ionicons name={color === Colors.success ? "checkmark-circle" : "alert-circle"} size={48} color={color} />
          <Text style={styles.alertTitle}>{title}</Text>
          {!!message && <Text style={styles.alertMsg}>{message}</Text>}
          <TouchableOpacity style={[styles.alertBtn, { backgroundColor: color }]} onPress={onClose}>
            <Text style={styles.alertBtnTxt}>حسناً</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function PurchaseRequestScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [showForm,    setShowForm]    = useState(true);
  const [requests,    setRequests]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [deletingId,  setDeletingId]  = useState<number | null>(null);
  const [modal, setModal] = useState({ visible: false, title: "", message: "", color: Colors.success });

  /* ── قائمة الأصناف الديناميكية ── */
  const [items, setItems] = useState<Item[]>([{ name: "", quantity: "1" }]);

  const showAlert = (title: string, message: string, color = Colors.error) =>
    setModal({ visible: true, title, message, color });

  const fetchRequests = useCallback(async () => {
    try {
      const data = await apiGet("/purchase-requests", token);
      setRequests(Array.isArray(data) ? data.filter((r: any) => r.status === "pending") : []);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  /* إضافة صنف جديد */
  const addItem = () => setItems(prev => [...prev, { name: "", quantity: "1" }]);

  /* حذف صنف */
  const removeItem = (idx: number) =>
    setItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  /* تعديل صنف */
  const updateItem = (idx: number, field: keyof Item, value: string) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));

  /* إرسال الطلبات */
  const handleSubmit = async () => {
    const valid = items.filter(it => it.name.trim());
    if (!valid.length) { showAlert("خطأ", "أدخل اسم صنف واحد على الأقل"); return; }
    setSubmitting(true);
    try {
      const created = await Promise.all(
        valid.map(it =>
          apiPost("/purchase-requests", token, {
            description: it.name.trim(),
            quantity: parseInt(it.quantity || "1") || 1,
          })
        )
      );
      setRequests(prev => [...created.reverse(), ...prev]);
      setItems([{ name: "", quantity: "1" }]);
      setShowForm(false);
      showAlert("تم", `تمت إضافة ${created.length} صنف بنجاح`, Colors.success);
    } catch (e: any) {
      showAlert("خطأ", e.message ?? "فشل الإرسال");
    } finally {
      setSubmitting(false);
    }
  };

  /* حذف طلب */
  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await apiDelete(`/purchase-requests/${id}`, token);
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch {} finally {
      setDeletingId(null);
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
      {/* ── رأس الصفحة ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>طلبات الشراء</Text>
        <TouchableOpacity onPress={() => setShowForm(f => !f)}>
          <Ionicons
            name={showForm ? "close-circle" : "add-circle"}
            size={26}
            color={showForm ? Colors.error : Colors.primary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} />
        }
      >
        {/* ══════ نموذج الإضافة ══════ */}
        {showForm && (
          <View style={styles.formCard}>
            <View style={styles.formTitleRow}>
              <View style={[styles.formIconWrap, { backgroundColor: "#FF9800" + "22" }]}>
                <Ionicons name="cart" size={20} color="#FF9800" />
              </View>
              <Text style={styles.formTitle}>إضافة أصناف جديدة</Text>
            </View>

            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>الكمية</Text>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>اسم الصنف</Text>
              <View style={{ width: 32 }} />
            </View>

            {items.map((it, idx) => (
              <View key={idx} style={styles.itemRow}>
                {/* حذف */}
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeItem(idx)}
                  disabled={items.length === 1}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={items.length === 1 ? Colors.border : Colors.error}
                  />
                </TouchableOpacity>

                {/* اسم الصنف */}
                <TextInput
                  style={[styles.itemInput, { flex: 3 }]}
                  value={it.name}
                  onChangeText={v => updateItem(idx, "name", v)}
                  placeholder={`صنف ${idx + 1}`}
                  placeholderTextColor={Colors.textMuted}
                  textAlign="right"
                />

                {/* الكمية */}
                <TextInput
                  style={[styles.itemInput, styles.qtyInput]}
                  value={it.quantity}
                  onChangeText={v => updateItem(idx, "quantity", v.replace(/\D/g, ""))}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={Colors.textMuted}
                  textAlign="center"
                />
              </View>
            ))}

            {/* زر إضافة صنف */}
            <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
              <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
              <Text style={styles.addItemBtnText}>إضافة صنف آخر</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#FFF" />
                : (
                  <>
                    <Ionicons name="send" size={16} color="#FFF" />
                    <Text style={styles.submitBtnText}>
                      إرسال {items.filter(i => i.name.trim()).length > 0
                        ? `(${items.filter(i => i.name.trim()).length} صنف)`
                        : ""}
                    </Text>
                  </>
                )
              }
            </TouchableOpacity>
          </View>
        )}

        {/* ══════ قائمة الطلبات الحالية ══════ */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionBadge, { backgroundColor: Colors.info + "22" }]}>
            <Text style={[styles.sectionBadgeText, { color: Colors.info }]}>{requests.length}</Text>
          </View>
          <Text style={styles.sectionTitle}>الأصناف المطلوبة</Text>
        </View>

        {requests.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="cart-outline" size={52} color={Colors.textMuted} />
            <Text style={styles.emptyText}>لا توجد طلبات شراء معلقة</Text>
            {!showForm && (
              <TouchableOpacity style={styles.emptyAddBtn} onPress={() => setShowForm(true)}>
                <Text style={styles.emptyAddBtnText}>إضافة طلب جديد</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : requests.map(req => {
          const statusInfo = STATUS_MAP[req.status] ?? { label: req.status, color: Colors.textSecondary };
          return (
            <View key={req.id} style={styles.reqCard}>
              <View style={styles.reqTop}>
                <TouchableOpacity
                  onPress={() => handleDelete(req.id)}
                  disabled={deletingId === req.id}
                  style={styles.reqDeleteBtn}
                >
                  {deletingId === req.id
                    ? <ActivityIndicator size="small" color={Colors.error} />
                    : <Ionicons name="trash-outline" size={16} color={Colors.error} />}
                </TouchableOpacity>

                <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + "22" }]}>
                  <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                </View>

                <Text style={styles.reqName} numberOfLines={1}>{req.description}</Text>
              </View>

              <View style={styles.reqBottom}>
                <Text style={styles.reqDate}>{formatDate(req.createdAt)}</Text>
                {req.quantity && (
                  <View style={styles.qtyBadge}>
                    <Ionicons name="layers-outline" size={11} color={Colors.textSecondary} />
                    <Text style={styles.qtyBadgeText}>× {req.quantity}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      <AlertModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        color={modal.color}
        onClose={() => setModal(m => ({ ...m, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  content: { padding: 16 },

  /* Form Card */
  formCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: Colors.border, gap: 12,
  },
  formTitleRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  formIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  formTitle: { fontSize: 16, fontWeight: "bold", color: Colors.text },

  /* Table Header */
  tableHeader: {
    flexDirection: "row-reverse", alignItems: "center",
    paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8,
  },
  tableHeaderCell: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary, textAlign: "right" },

  /* Item Row */
  itemRow: {
    flexDirection: "row-reverse", alignItems: "center", gap: 8,
  },
  removeBtn: { padding: 4 },
  itemInput: {
    backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: Colors.text, fontSize: 14, borderWidth: 1, borderColor: Colors.border,
  },
  qtyInput: { flex: 1, textAlign: "center" },

  /* Add Item Button */
  addItemBtn: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
    borderColor: Colors.primary + "50", borderStyle: "dashed",
    backgroundColor: Colors.primary + "08",
  },
  addItemBtnText: { fontSize: 13, color: Colors.primary, fontWeight: "700" },

  /* Submit Button */
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14,
    alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 8,
  },
  submitBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 15 },

  /* Section Header */
  sectionHeader: {
    flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: "bold", color: Colors.text },
  sectionBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  sectionBadgeText: { fontSize: 12, fontWeight: "bold" },

  /* Request Card */
  reqCard: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.border, gap: 8,
  },
  reqTop: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  reqName: { flex: 1, color: Colors.text, fontWeight: "bold", fontSize: 14, textAlign: "right" },
  reqDeleteBtn: { padding: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  statusText: { fontSize: 11, fontWeight: "bold" },
  reqBottom: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  reqDate: { fontSize: 11, color: Colors.textMuted },
  qtyBadge: { flexDirection: "row-reverse", alignItems: "center", gap: 3, backgroundColor: Colors.surfaceElevated, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  qtyBadgeText: { fontSize: 12, color: Colors.textSecondary, fontWeight: "600" },

  /* Empty */
  empty: { alignItems: "center", marginTop: 40, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
  emptyAddBtn: { backgroundColor: Colors.primary + "22", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  emptyAddBtnText: { color: Colors.primary, fontWeight: "bold" },

  /* Alert Modal */
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 30 },
  alertBox: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: Colors.border, width: "100%", alignItems: "center", gap: 10,
  },
  alertTitle: { fontSize: 17, fontWeight: "bold", color: Colors.text },
  alertMsg: { fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  alertBtn: { borderRadius: 12, paddingHorizontal: 30, paddingVertical: 12, marginTop: 4 },
  alertBtnTxt: { color: "#FFF", fontWeight: "bold", fontSize: 15 },
});
