import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Linking, ActivityIndicator, RefreshControl, Modal, Alert, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, apiPut } from "@/utils/api";

const STATUS_LABELS: Record<string, string> = {
  active: "نشط", active_incomplete: "نشط ناقص", ready: "جاهز", empty: "فارغ", stopped: "متوقف",
};

const STATUS_OPTIONS = ["active", "active_incomplete", "ready", "empty", "stopped"] as const;

export default function DatabaseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [tab, setTab] = useState<"hotspot" | "broadband">("hotspot");
  const [search, setSearch] = useState("");
  const [hotspotPoints, setHotspotPoints] = useState<any[]>([]);
  const [broadbandPoints, setBroadbandPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPoint, setNewPoint] = useState({ name: "", location: "", status: "empty", notes: "" });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [h, b] = await Promise.all([
        apiGet("/network/hotspot-points", token),
        apiGet("/network/broadband-points", token),
      ]);
      const numSort = (a: any, b: any) => {
        const na = parseInt(a.name.replace(/[^0-9]/g, "")) || 0;
        const nb = parseInt(b.name.replace(/[^0-9]/g, "")) || 0;
        return na - nb;
      };
      setHotspotPoints(h.sort(numSort));
      setBroadbandPoints(b.sort(numSort));
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getStatusColor = (s: string) => Colors.status[s as keyof typeof Colors.status] ?? Colors.textSecondary;

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("تم النسخ", text);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const endpoint = tab === "hotspot" ? "hotspot-points" : "broadband-points";
      const updated = await apiPut(`/network/${endpoint}/${editData.id}`, token, {
        name: editData.name, location: editData.location,
        status: editData.status, notes: editData.notes,
      });
      if (tab === "hotspot") {
        setHotspotPoints(prev => prev.map(p => p.id === updated.id ? updated : p));
      } else {
        setBroadbandPoints(prev => prev.map(p => p.id === updated.id ? updated : p));
      }
      setSelectedPoint(updated);
      setEditMode(false);
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPoint = async () => {
    if (!newPoint.name || !newPoint.location) { Alert.alert("خطأ", "أدخل الاسم والموقع"); return; }
    setSaving(true);
    try {
      const endpoint = tab === "hotspot" ? "hotspot-points" : "broadband-points";
      const added = await apiPost(`/network/${endpoint}`, token, newPoint);
      if (tab === "hotspot") {
        setHotspotPoints(prev => [...prev, added].sort((a, b) => {
          const na = parseInt(a.name.replace(/[^0-9]/g, "")) || 0;
          const nb = parseInt(b.name.replace(/[^0-9]/g, "")) || 0;
          return na - nb;
        }));
      } else {
        setBroadbandPoints(prev => [...prev, added]);
      }
      setShowAddModal(false);
      setNewPoint({ name: "", location: "", status: "empty", notes: "" });
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    } finally {
      setSaving(false);
    }
  };

  const points = tab === "hotspot" ? hotspotPoints : broadbandPoints;
  const filteredPoints = points.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.location.toLowerCase().includes(search.toLowerCase())
  );

  const statusCounts = {
    active: points.filter(p => p.status === "active").length,
    ready: points.filter(p => p.status === "ready").length,
    empty: points.filter(p => p.status === "empty").length,
    stopped: points.filter(p => p.status === "stopped").length,
  };

  if (selectedPoint) {
    return (
      <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setSelectedPoint(null); setEditMode(false); }}>
            <Ionicons name="arrow-forward" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{selectedPoint.name}</Text>
          <TouchableOpacity onPress={() => { setEditMode(!editMode); setEditData({ ...selectedPoint }); }}>
            <Ionicons name={editMode ? "close" : "pencil"} size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {editMode ? (
            <View style={styles.card}>
              <Text style={styles.label}>الاسم</Text>
              <TextInput style={styles.input} value={editData?.name} onChangeText={v => setEditData({ ...editData, name: v })} textAlign="right" />
              <Text style={[styles.label, { marginTop: 12 }]}>الموقع</Text>
              <TextInput style={styles.input} value={editData?.location} onChangeText={v => setEditData({ ...editData, location: v })} textAlign="right" />
              <Text style={[styles.label, { marginTop: 12 }]}>الحالة</Text>
              <View style={styles.statusGrid}>
                {STATUS_OPTIONS.map(s => (
                  <TouchableOpacity
                    key={s} onPress={() => setEditData({ ...editData, status: s })}
                    style={[styles.statusBtn, editData?.status === s && { backgroundColor: getStatusColor(s) + "22", borderColor: getStatusColor(s) }]}
                  >
                    <Text style={[styles.statusBtnText, editData?.status === s && { color: getStatusColor(s) }]}>
                      {STATUS_LABELS[s]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.label, { marginTop: 12 }]}>ملاحظات</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: "top" }]}
                value={editData?.notes ?? ""} onChangeText={v => setEditData({ ...editData, notes: v })}
                textAlign="right" multiline
              />
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSaveEdit} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>حفظ التغييرات</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.detailCard}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>الحالة</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedPoint.status) + "20" }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(selectedPoint.status) }]}>
                    {STATUS_LABELS[selectedPoint.status] ?? selectedPoint.status}
                  </Text>
                </View>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>الموقع</Text>
                <TouchableOpacity onPress={() => copyToClipboard(selectedPoint.location)}>
                  <Text style={[styles.detailValue, { color: Colors.primaryLight }]}>{selectedPoint.location}</Text>
                </TouchableOpacity>
              </View>
              {selectedPoint.notes && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>ملاحظات</Text>
                  <Text style={styles.detailValue}>{selectedPoint.notes}</Text>
                </View>
              )}
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.actionButton} onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(selectedPoint.location)}`)}>
                  <Ionicons name="map" size={20} color={Colors.primary} />
                  <Text style={styles.actionBtnText}>خرائط</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => copyToClipboard(selectedPoint.location)}>
                  <Ionicons name="copy" size={20} color={Colors.info} />
                  <Text style={styles.actionBtnText}>نسخ الموقع</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>قاعدة البيانات</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)}>
          <Ionicons name="add-circle" size={26} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* الأقسام */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tabBtn, tab === "broadband" && styles.tabBtnActive]} onPress={() => setTab("broadband")}>
          <Text style={[styles.tabBtnText, tab === "broadband" && styles.tabBtnTextActive]}>برودباند ({broadbandPoints.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === "hotspot" && styles.tabBtnActive]} onPress={() => setTab("hotspot")}>
          <Text style={[styles.tabBtnText, tab === "hotspot" && styles.tabBtnTextActive]}>هوتسبوت ({hotspotPoints.length})</Text>
        </TouchableOpacity>
      </View>

      {/* إحصاءات سريعة */}
      <View style={styles.statsRow}>
        {Object.entries(statusCounts).map(([s, c]) => (
          <View key={s} style={styles.statChip}>
            <Text style={[styles.statCount, { color: getStatusColor(s) }]}>{c}</Text>
            <Text style={styles.statLabel}>{STATUS_LABELS[s]}</Text>
          </View>
        ))}
      </View>

      {/* بحث */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput} placeholder="بحث بالاسم أو الموقع..."
          placeholderTextColor={Colors.textMuted} value={search}
          onChangeText={setSearch} textAlign="right"
        />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        >
          {filteredPoints.map(p => (
            <TouchableOpacity key={p.id} style={styles.pointCard} onPress={() => setSelectedPoint(p)}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(p.status) }]} />
              <View style={styles.pointInfo}>
                <Text style={styles.pointName}>{p.name}</Text>
                <Text style={styles.pointLocation}>{p.location}</Text>
              </View>
              <View style={styles.pointRight}>
                <Text style={[styles.statusLabel, { color: getStatusColor(p.status) }]}>
                  {STATUS_LABELS[p.status] ?? p.status}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>
          ))}
          {filteredPoints.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>لا توجد نتائج</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* إضافة نقطة */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>إضافة نقطة {tab === "hotspot" ? "هوتسبوت" : "برودباند"}</Text>
            <Text style={styles.label}>الاسم</Text>
            <TextInput style={styles.input} value={newPoint.name} onChangeText={v => setNewPoint(p => ({ ...p, name: v }))} textAlign="right" placeholder="مثال: فلاش 980" placeholderTextColor={Colors.textMuted} />
            <Text style={[styles.label, { marginTop: 12 }]}>الموقع</Text>
            <TextInput style={styles.input} value={newPoint.location} onChangeText={v => setNewPoint(p => ({ ...p, location: v }))} textAlign="right" placeholder="حي ..." placeholderTextColor={Colors.textMuted} />
            <Text style={[styles.label, { marginTop: 12 }]}>الحالة</Text>
            <View style={styles.statusGrid}>
              {STATUS_OPTIONS.map(s => (
                <TouchableOpacity
                  key={s} onPress={() => setNewPoint(p => ({ ...p, status: s }))}
                  style={[styles.statusBtn, newPoint.status === s && { backgroundColor: getStatusColor(s) + "22", borderColor: getStatusColor(s) }]}
                >
                  <Text style={[styles.statusBtnText, newPoint.status === s && { color: getStatusColor(s) }]}>
                    {STATUS_LABELS[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddPoint} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>إضافة</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  tabs: { flexDirection: "row-reverse", padding: 12, gap: 8 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  tabBtnTextActive: { color: "#FFF" },
  statsRow: { flexDirection: "row-reverse", paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  statChip: { flex: 1, alignItems: "center", backgroundColor: Colors.surface, borderRadius: 10, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  statCount: { fontSize: 16, fontWeight: "bold" },
  statLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  searchContainer: {
    flexDirection: "row-reverse", alignItems: "center", gap: 8,
    marginHorizontal: 12, marginBottom: 8, backgroundColor: Colors.surface,
    borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, paddingVertical: 10, color: Colors.text, fontSize: 14 },
  list: { padding: 12, paddingTop: 4 },
  pointCard: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    marginBottom: 8, flexDirection: "row-reverse", alignItems: "center",
    borderWidth: 1, borderColor: Colors.border,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 10 },
  pointInfo: { flex: 1, alignItems: "flex-end" },
  pointName: { fontSize: 15, fontWeight: "bold", color: Colors.text },
  pointLocation: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  pointRight: { alignItems: "flex-end", gap: 4 },
  statusLabel: { fontSize: 11, fontWeight: "600" },
  emptyContainer: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
  content: { padding: 16 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  detailCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  detailItem: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailLabel: { fontSize: 14, color: Colors.textSecondary },
  detailValue: { fontSize: 14, color: Colors.text, fontWeight: "500", textAlign: "right", flex: 1, marginRight: 12 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 13, fontWeight: "bold" },
  actionButtons: { flexDirection: "row-reverse", gap: 12, marginTop: 16 },
  actionButton: { flex: 1, alignItems: "center", justifyContent: "center", padding: 12, backgroundColor: Colors.background, borderRadius: 12, gap: 4, borderWidth: 1, borderColor: Colors.border },
  actionBtnText: { fontSize: 12, color: Colors.text },
  label: { fontSize: 14, color: Colors.textSecondary, textAlign: "right", marginBottom: 8 },
  input: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  statusGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  statusBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  statusBtnText: { fontSize: 12, color: Colors.textSecondary },
  saveBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 },
  saveBtnText: { color: "#FFF", fontWeight: "bold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: Colors.text, textAlign: "center", marginBottom: 16 },
  modalActions: { flexDirection: "row-reverse", gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: "bold" },
});
