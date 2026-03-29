import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Linking, ActivityIndicator, RefreshControl, Modal, Platform, Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, apiPut, apiFetch } from "@/utils/api";

/* ─── Types ─── */
interface HotspotPoint {
  id: number;
  flashNumber: number | null;
  name: string;
  location: string;
  hotspotType: string | null;
  deviceName: string | null;
  clientName: string | null;
  clientPhone: string | null;
  subscriptionFee: string | null;
  ipAddress: string | null;
  isClientOwned: boolean | null;
  locationUrl: string | null;
  notes: string | null;
  status: string;
}

interface BroadbandPoint {
  id: number;
  flashNumber: number | null;
  name: string;
  location: string;
  subscriptionName: string | null;
  deviceName: string | null;
  clientName: string | null;
  clientPhone: string | null;
  subscriptionFee: string | null;
  locationUrl: string | null;
  notes: string | null;
  status: string;
}

type TabType = "hotspot" | "broadband";
type HotspotFilter = "all" | "internal" | "external";

/* ─── Alert helper ─── */
function useAlert() {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState("");
  const show = (t: string, m: string) => { setTitle(t); setMsg(m); setVisible(true); };
  const AlertComp = () => (
    <Modal visible={visible} transparent animationType="fade">
      <View style={alertStyles.overlay}>
        <View style={alertStyles.box}>
          <Text style={alertStyles.title}>{title}</Text>
          {msg ? <Text style={alertStyles.msg}>{msg}</Text> : null}
          <TouchableOpacity style={alertStyles.btn} onPress={() => setVisible(false)}>
            <Text style={alertStyles.btnText}>حسناً</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
  return { show, AlertComp };
}
const alertStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 30 },
  box: { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border },
  title: { color: Colors.text, fontSize: 17, fontWeight: "bold", textAlign: "right", marginBottom: 8 },
  msg: { color: Colors.textSecondary, fontSize: 14, textAlign: "right", marginBottom: 16 },
  btn: { backgroundColor: Colors.primary, borderRadius: 10, padding: 12, alignItems: "center" },
  btnText: { color: "#FFF", fontWeight: "bold" },
});

/* ─── Blank form ─── */
const blankHotspot = () => ({
  flashNumber: "", deviceName: "", hotspotType: "internal" as "internal" | "external",
  clientName: "", clientPhone: "", subscriptionFee: "", ipAddress: "",
  isClientOwned: false, locationUrl: "", location: "",
});
const blankBroadband = () => ({
  flashNumber: "", subscriptionName: "", deviceName: "",
  clientName: "", clientPhone: "", subscriptionFee: "", locationUrl: "", location: "",
});

export default function DatabaseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const { show: showAlert, AlertComp } = useAlert();

  const [tab, setTab] = useState<TabType>("hotspot");
  const [hotspotFilter, setHotspotFilter] = useState<HotspotFilter>("all");
  const [search, setSearch] = useState("");
  const [hotspotPoints, setHotspotPoints] = useState<HotspotPoint[]>([]);
  const [broadbandPoints, setBroadbandPoints] = useState<BroadbandPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1); // 1=type choice, 2=form
  const [addType, setAddType] = useState<TabType>("hotspot");
  const [hForm, setHForm] = useState(blankHotspot());
  const [bForm, setBForm] = useState(blankBroadband());
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editItem, setEditItem] = useState<HotspotPoint | BroadbandPoint | null>(null);
  const [editHForm, setEditHForm] = useState<any>(null);
  const [editBForm, setEditBForm] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; type: TabType; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Empty numbers modal
  const [showEmpty, setShowEmpty] = useState(false);

  const numSort = (a: any, b: any) => (a.flashNumber ?? 9999) - (b.flashNumber ?? 9999);

  const fetchData = useCallback(async () => {
    try {
      const [h, b] = await Promise.all([
        apiGet("/network/hotspot-points", token),
        apiGet("/network/broadband-points", token),
      ]);
      setHotspotPoints(Array.isArray(h) ? h.sort(numSort) : []);
      setBroadbandPoints(Array.isArray(b) ? b.sort(numSort) : []);
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── Filtered list ─── */
  const filteredHotspot = hotspotPoints
    .filter(p => hotspotFilter === "all" || (hotspotFilter === "internal" ? p.hotspotType === "internal" : p.hotspotType === "external"))
    .filter(p => !search || p.name.includes(search) || (p.location || "").includes(search) || (p.clientName || "").includes(search));

  const filteredBroadband = broadbandPoints
    .filter(p => !search || p.name.includes(search) || (p.location || "").includes(search) || (p.subscriptionName || "").includes(search) || (p.clientName || "").includes(search));

  /* ─── Empty numbers ─── */
  const emptyNumbers = (() => {
    const src = tab === "hotspot" ? hotspotPoints : broadbandPoints;
    const used = new Set(src.map(p => p.flashNumber).filter(Boolean));
    const max = Math.max(...Array.from(used as Set<number>), 0);
    const empty: number[] = [];
    for (let i = 1; i <= max; i++) {
      if (!used.has(i)) empty.push(i);
    }
    return { empty, max };
  })();

  /* ─── Actions ─── */
  const copyText = async (text: string) => {
    await Clipboard.setStringAsync(text);
    showAlert("تم النسخ", text.substring(0, 60));
  };

  const openMap = (url: string) => {
    if (url) Linking.openURL(url);
    else showAlert("لا يوجد رابط", "لم يُسجَّل رابط الخريطة لهذه النقطة");
  };

  const callPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    Linking.openURL(`tel:${cleaned}`);
  };

  /* ─── Add ─── */
  const handleAdd = async () => {
    setSaving(true);
    try {
      if (addType === "hotspot") {
        if (!hForm.flashNumber) { showAlert("خطأ", "أدخل رقم الفلاش"); return; }
        const payload: any = {
          flashNumber: parseInt(hForm.flashNumber),
          name: `فلاش ${hForm.flashNumber}`,
          hotspotType: hForm.hotspotType,
          deviceName: hForm.deviceName || null,
          location: hForm.location || "-",
          locationUrl: hForm.locationUrl || null,
          isClientOwned: hForm.isClientOwned,
        };
        if (hForm.hotspotType === "internal") {
          payload.clientName = hForm.clientName || null;
          payload.clientPhone = hForm.clientPhone.replace(/\D/g, "") || null;
          payload.subscriptionFee = hForm.subscriptionFee || null;
          payload.ipAddress = hForm.ipAddress || null;
        }
        const added = await apiPost("/network/hotspot-points", token, payload);
        setHotspotPoints(prev => [...prev, added].sort(numSort));
      } else {
        if (!bForm.flashNumber) { showAlert("خطأ", "أدخل رقم الفلاش"); return; }
        const payload = {
          flashNumber: parseInt(bForm.flashNumber),
          name: `فلاش P${bForm.flashNumber}`,
          subscriptionName: bForm.subscriptionName || null,
          deviceName: bForm.deviceName || null,
          clientName: bForm.clientName || null,
          clientPhone: bForm.clientPhone.replace(/\D/g, "") || null,
          subscriptionFee: bForm.subscriptionFee || null,
          location: bForm.location || "-",
          locationUrl: bForm.locationUrl || null,
        };
        const added = await apiPost("/network/broadband-points", token, payload);
        setBroadbandPoints(prev => [...prev, added].sort(numSort));
      }
      setShowAdd(false);
      setHForm(blankHotspot());
      setBForm(blankBroadband());
      setAddStep(1);
    } catch (e: any) {
      showAlert("خطأ", e.message ?? "فشل الإضافة");
    } finally {
      setSaving(false);
    }
  };

  /* ─── Edit ─── */
  const openEdit = (item: HotspotPoint | BroadbandPoint) => {
    setEditItem(item);
    if (tab === "hotspot") {
      const h = item as HotspotPoint;
      setEditHForm({
        flashNumber: h.flashNumber ? String(h.flashNumber) : "",
        deviceName: h.deviceName ?? "",
        hotspotType: h.hotspotType ?? "internal",
        clientName: h.clientName ?? "",
        clientPhone: h.clientPhone ?? "",
        subscriptionFee: h.subscriptionFee ?? "",
        ipAddress: h.ipAddress ?? "",
        isClientOwned: h.isClientOwned ?? false,
        locationUrl: h.locationUrl ?? "",
        location: h.location ?? "",
      });
    } else {
      const b = item as BroadbandPoint;
      setEditBForm({
        flashNumber: b.flashNumber ? String(b.flashNumber) : "",
        subscriptionName: b.subscriptionName ?? "",
        deviceName: b.deviceName ?? "",
        clientName: b.clientName ?? "",
        clientPhone: b.clientPhone ?? "",
        subscriptionFee: b.subscriptionFee ?? "",
        locationUrl: b.locationUrl ?? "",
        location: b.location ?? "",
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    setEditSaving(true);
    try {
      if (tab === "hotspot") {
        const f = editHForm;
        const payload: any = {
          flashNumber: f.flashNumber ? parseInt(f.flashNumber) : null,
          name: `فلاش ${f.flashNumber}`,
          hotspotType: f.hotspotType,
          deviceName: f.deviceName || null,
          location: f.location || "-",
          locationUrl: f.locationUrl || null,
          clientName: f.clientName || null,
          clientPhone: f.clientPhone.replace(/\D/g, "") || null,
          subscriptionFee: f.subscriptionFee || null,
          ipAddress: f.ipAddress || null,
          isClientOwned: f.isClientOwned,
        };
        const updated = await apiPut(`/network/hotspot-points/${editItem.id}`, token, payload);
        setHotspotPoints(prev => prev.map(p => p.id === updated.id ? updated : p).sort(numSort));
      } else {
        const f = editBForm;
        const payload = {
          flashNumber: f.flashNumber ? parseInt(f.flashNumber) : null,
          name: `فلاش P${f.flashNumber}`,
          subscriptionName: f.subscriptionName || null,
          deviceName: f.deviceName || null,
          clientName: f.clientName || null,
          clientPhone: f.clientPhone.replace(/\D/g, "") || null,
          subscriptionFee: f.subscriptionFee || null,
          location: f.location || "-",
          locationUrl: f.locationUrl || null,
        };
        const updated = await apiPut(`/network/broadband-points/${editItem.id}`, token, payload);
        setBroadbandPoints(prev => prev.map(p => p.id === updated.id ? updated : p).sort(numSort));
      }
      setEditItem(null);
    } catch (e: any) {
      showAlert("خطأ", e.message ?? "فشل التعديل");
    } finally {
      setEditSaving(false);
    }
  };

  /* ─── Delete ─── */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const endpoint = deleteTarget.type === "hotspot" ? "hotspot-points" : "broadband-points";
      await apiFetch(`/network/${endpoint}/${deleteTarget.id}`, token, { method: "DELETE" });
      if (deleteTarget.type === "hotspot") {
        setHotspotPoints(prev => prev.filter(p => p.id !== deleteTarget.id));
      } else {
        setBroadbandPoints(prev => prev.filter(p => p.id !== deleteTarget.id));
      }
      setDeleteTarget(null);
    } catch (e: any) {
      showAlert("خطأ", e.message ?? "فشل الحذف");
    } finally {
      setDeleting(false);
    }
  };

  /* ─── Card renders ─── */
  const renderHotspotCard = (p: HotspotPoint) => {
    const isInternal = p.hotspotType === "internal";
    return (
      <View key={p.id} style={styles.card}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={styles.flashBlock}>
            <Text style={styles.flashNum}>{p.name}</Text>
            {p.deviceName ? <Text style={styles.deviceName}>{p.deviceName}</Text> : null}
            <View style={[styles.typeBadge, isInternal ? styles.badgeInternal : styles.badgeExternal]}>
              <Text style={[styles.typeBadgeText, { color: isInternal ? Colors.primary : Colors.warning }]}>
                {isInternal ? "داخلي" : "خارجي"}
              </Text>
            </View>
          </View>
          {/* Subscription fee or "ملك العميل" */}
          <View style={{ alignItems: "flex-end" }}>
            {p.subscriptionFee ? (
              <Text style={styles.feeText}>{Number(p.subscriptionFee).toLocaleString()} ر</Text>
            ) : isInternal && p.isClientOwned ? (
              <View style={styles.ownerBadge}>
                <Text style={styles.ownerBadgeText}>ملك العميل</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Internal: client info */}
        {isInternal && (
          <View style={styles.section}>
            {p.clientName ? (
              <Text style={styles.clientNameText}>{p.clientName}</Text>
            ) : (
              <Text style={styles.noClientText}>ملك الشبكة</Text>
            )}
            {p.clientPhone ? (
              <View style={styles.phoneRow}>
                <TouchableOpacity onPress={() => callPhone(p.clientPhone!)} style={styles.iconBtn}>
                  <Ionicons name="call" size={18} color={Colors.success} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => copyText(p.clientPhone!)} style={styles.iconBtn}>
                  <Ionicons name="copy-outline" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.phoneText}>{p.clientPhone}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Location */}
        <View style={styles.locationRow}>
          <View style={styles.locationIcons}>
            {p.locationUrl ? (
              <TouchableOpacity onPress={() => openMap(p.locationUrl!)} style={styles.iconBtn}>
                <Ionicons name="location" size={18} color={Colors.error} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => copyText(p.locationUrl || p.location)} style={styles.iconBtn}>
              <Ionicons name="copy-outline" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.locationText} numberOfLines={2}>{p.location}</Text>
        </View>

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => setDeleteTarget({ id: p.id, type: "hotspot", name: p.name })}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.error} />
            <Text style={[styles.actionBtnText, { color: Colors.error }]}>حذف</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(p)}>
            <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
            <Text style={[styles.actionBtnText, { color: Colors.primary }]}>تعديل</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderBroadbandCard = (p: BroadbandPoint) => (
    <View key={p.id} style={[styles.card, { borderLeftColor: Colors.warning, borderLeftWidth: 3 }]}>
      <View style={styles.cardHeader}>
        <View style={styles.flashBlock}>
          <Text style={[styles.flashNum, { color: Colors.warning }]}>{p.name}</Text>
          {p.subscriptionName ? <Text style={styles.deviceName}>{p.subscriptionName}</Text> : null}
          <View style={[styles.typeBadge, { backgroundColor: Colors.warning + "20" }]}>
            <Text style={[styles.typeBadgeText, { color: Colors.warning }]}>برودباند</Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          {p.subscriptionFee ? (
            <Text style={styles.feeText}>{Number(p.subscriptionFee).toLocaleString()} ر</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        {p.clientName ? (
          <Text style={styles.clientNameText}>{p.clientName}</Text>
        ) : (
          <Text style={styles.noClientText}>لا يوجد مشترك</Text>
        )}
        {p.clientPhone ? (
          <View style={styles.phoneRow}>
            <TouchableOpacity onPress={() => callPhone(p.clientPhone!)} style={styles.iconBtn}>
              <Ionicons name="call" size={18} color={Colors.success} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => copyText(p.clientPhone!)} style={styles.iconBtn}>
              <Ionicons name="copy-outline" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.phoneText}>{p.clientPhone}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.locationRow}>
        <View style={styles.locationIcons}>
          {p.locationUrl ? (
            <TouchableOpacity onPress={() => openMap(p.locationUrl!)} style={styles.iconBtn}>
              <Ionicons name="location" size={18} color={Colors.error} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => copyText(p.locationUrl || p.location)} style={styles.iconBtn}>
            <Ionicons name="copy-outline" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.locationText} numberOfLines={2}>{p.location}</Text>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => setDeleteTarget({ id: p.id, type: "broadband", name: p.name })}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.error} />
          <Text style={[styles.actionBtnText, { color: Colors.error }]}>حذف</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(p)}>
          <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
          <Text style={[styles.actionBtnText, { color: Colors.primary }]}>تعديل</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  /* ─── Form helpers ─── */
  const FInput = ({ label, value, onChangeText, placeholder = "", keyboardType = "default" as any, multiline = false }: any) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={[styles.formInput, multiline && { height: 70, textAlignVertical: "top" }]}
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={Colors.textMuted} textAlign="right"
        keyboardType={keyboardType} multiline={multiline}
      />
    </View>
  );

  /* ─── Main render ─── */
  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>قاعدة البيانات</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowEmpty(true)} style={styles.emptyBtn}>
            <Ionicons name="grid-outline" size={20} color={Colors.warning} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setShowAdd(true); setAddStep(1); }} style={styles.addBtn}>
            <Ionicons name="add" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main tabs */}
      <View style={styles.mainTabs}>
        <TouchableOpacity
          style={[styles.mainTab, tab === "broadband" && styles.mainTabActive]}
          onPress={() => { setTab("broadband"); setSearch(""); }}
        >
          <Text style={[styles.mainTabText, tab === "broadband" && styles.mainTabTextActive]}>
            برودباند ({broadbandPoints.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainTab, tab === "hotspot" && styles.mainTabActive]}
          onPress={() => { setTab("hotspot"); setSearch(""); }}
        >
          <Text style={[styles.mainTabText, tab === "hotspot" && styles.mainTabTextActive]}>
            هوتسبوت ({hotspotPoints.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Hotspot sub-filter */}
      {tab === "hotspot" && (
        <View style={styles.subFilter}>
          {(["all", "internal", "external"] as HotspotFilter[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.subFilterBtn, hotspotFilter === f && styles.subFilterBtnActive]}
              onPress={() => setHotspotFilter(f)}
            >
              <Text style={[styles.subFilterText, hotspotFilter === f && styles.subFilterTextActive]}>
                {f === "all" ? "الكل" : f === "internal" ? "داخلي" : "خارجي"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={tab === "hotspot" ? "بحث بالاسم أو الموقع أو العميل..." : "بحث بالاسم أو الاشتراك أو العميل..."}
          placeholderTextColor={Colors.textMuted}
          value={search} onChangeText={setSearch} textAlign="right"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Count row */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {tab === "hotspot" ? filteredHotspot.length : filteredBroadband.length} نقطة
        </Text>
        {tab === "hotspot" && (
          <Text style={styles.countSmall}>
            {hotspotPoints.filter(p => p.hotspotType === "internal").length} داخلي ·{" "}
            {hotspotPoints.filter(p => p.hotspotType === "external").length} خارجي
          </Text>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        >
          {tab === "hotspot"
            ? filteredHotspot.map(renderHotspotCard)
            : filteredBroadband.map(renderBroadbandCard)
          }
          {(tab === "hotspot" ? filteredHotspot : filteredBroadband).length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>لا توجد نتائج</Text>
            </View>
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {/* ─── Add Modal ─── */}
      <Modal visible={showAdd} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>إضافة نقطة جديدة</Text>

              {addStep === 1 ? (
                <>
                  <Text style={styles.formLabel}>نوع الشبكة</Text>
                  <View style={styles.choiceRow}>
                    <TouchableOpacity
                      style={[styles.choiceBtn, addType === "broadband" && styles.choiceBtnActive]}
                      onPress={() => setAddType("broadband")}
                    >
                      <Ionicons name="wifi" size={20} color={addType === "broadband" ? "#FFF" : Colors.textSecondary} />
                      <Text style={[styles.choiceBtnText, addType === "broadband" && { color: "#FFF" }]}>برودباند</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.choiceBtn, addType === "hotspot" && styles.choiceBtnActive]}
                      onPress={() => setAddType("hotspot")}
                    >
                      <Ionicons name="radio" size={20} color={addType === "hotspot" ? "#FFF" : Colors.textSecondary} />
                      <Text style={[styles.choiceBtnText, addType === "hotspot" && { color: "#FFF" }]}>هوتسبوت</Text>
                    </TouchableOpacity>
                  </View>

                  {addType === "hotspot" && (
                    <>
                      <Text style={[styles.formLabel, { marginTop: 16 }]}>نوع البث</Text>
                      <View style={styles.choiceRow}>
                        <TouchableOpacity
                          style={[styles.choiceBtn, hForm.hotspotType === "external" && styles.choiceBtnActive]}
                          onPress={() => setHForm(f => ({ ...f, hotspotType: "external" }))}
                        >
                          <Text style={[styles.choiceBtnText, hForm.hotspotType === "external" && { color: "#FFF" }]}>خارجي</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.choiceBtn, hForm.hotspotType === "internal" && styles.choiceBtnActive]}
                          onPress={() => setHForm(f => ({ ...f, hotspotType: "internal" }))}
                        >
                          <Text style={[styles.choiceBtnText, hForm.hotspotType === "internal" && { color: "#FFF" }]}>داخلي</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  <View style={styles.modalBtns}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
                      <Text style={styles.cancelBtnText}>إلغاء</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.nextBtn} onPress={() => setAddStep(2)}>
                      <Text style={styles.nextBtnText}>التالي ←</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  {addType === "hotspot" ? (
                    <>
                      <FInput label="رقم الفلاش *" value={hForm.flashNumber} onChangeText={(v: string) => setHForm(f => ({ ...f, flashNumber: v.replace(/\D/g, "") }))} keyboardType="numeric" placeholder="مثال: 15" />
                      <FInput label="اسم الجهاز" value={hForm.deviceName} onChangeText={(v: string) => setHForm(f => ({ ...f, deviceName: v }))} placeholder="مثال: Tplink" />
                      <FInput label="وصف الموقع" value={hForm.location} onChangeText={(v: string) => setHForm(f => ({ ...f, location: v }))} placeholder="حي، شارع..." />
                      <FInput label="رابط خرائط جوجل" value={hForm.locationUrl} onChangeText={(v: string) => setHForm(f => ({ ...f, locationUrl: v }))} placeholder="https://maps.google.com/..." />
                      {hForm.hotspotType === "internal" && (
                        <>
                          <FInput label="اسم العميل" value={hForm.clientName} onChangeText={(v: string) => setHForm(f => ({ ...f, clientName: v }))} />
                          <FInput label="رقم الجوال" value={hForm.clientPhone} onChangeText={(v: string) => setHForm(f => ({ ...f, clientPhone: v.replace(/\D/g, "") }))} keyboardType="phone-pad" />
                          <FInput label="رسوم الاشتراك" value={hForm.subscriptionFee} onChangeText={(v: string) => setHForm(f => ({ ...f, subscriptionFee: v.replace(/\D/g, "") }))} keyboardType="numeric" placeholder="بالريال" />
                          <FInput label="عنوان IP" value={hForm.ipAddress} onChangeText={(v: string) => setHForm(f => ({ ...f, ipAddress: v }))} placeholder="192.168.0.x" keyboardType="decimal-pad" />
                          <View style={styles.switchRow}>
                            <Switch
                              value={hForm.isClientOwned}
                              onValueChange={v => setHForm(f => ({ ...f, isClientOwned: v }))}
                              trackColor={{ true: Colors.primary }}
                            />
                            <Text style={styles.switchLabel}>الجهاز ملك العميل</Text>
                          </View>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <FInput label="رقم الفلاش *" value={bForm.flashNumber} onChangeText={(v: string) => setBForm(f => ({ ...f, flashNumber: v.replace(/\D/g, "") }))} keyboardType="numeric" placeholder="مثال: 5 → سيظهر P5" />
                      <FInput label="اسم الاشتراك" value={bForm.subscriptionName} onChangeText={(v: string) => setBForm(f => ({ ...f, subscriptionName: v }))} placeholder="مثال: andls123" />
                      <FInput label="اسم الجهاز" value={bForm.deviceName} onChangeText={(v: string) => setBForm(f => ({ ...f, deviceName: v }))} placeholder="D-Link DIR-612" />
                      <FInput label="اسم العميل" value={bForm.clientName} onChangeText={(v: string) => setBForm(f => ({ ...f, clientName: v }))} />
                      <FInput label="رقم الجوال" value={bForm.clientPhone} onChangeText={(v: string) => setBForm(f => ({ ...f, clientPhone: v.replace(/\D/g, "") }))} keyboardType="phone-pad" />
                      <FInput label="رسوم الاشتراك" value={bForm.subscriptionFee} onChangeText={(v: string) => setBForm(f => ({ ...f, subscriptionFee: v.replace(/\D/g, "") }))} keyboardType="numeric" placeholder="بالريال" />
                      <FInput label="وصف الموقع" value={bForm.location} onChangeText={(v: string) => setBForm(f => ({ ...f, location: v }))} placeholder="حي، شارع..." />
                      <FInput label="رابط خرائط جوجل" value={bForm.locationUrl} onChangeText={(v: string) => setBForm(f => ({ ...f, locationUrl: v }))} placeholder="https://maps.google.com/..." />
                    </>
                  )}

                  <View style={styles.modalBtns}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddStep(1)}>
                      <Text style={styles.cancelBtnText}>→ رجوع</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.nextBtn, saving && { opacity: 0.6 }]} onPress={handleAdd} disabled={saving}>
                      {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.nextBtnText}>حفظ</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ─── Edit Modal ─── */}
      <Modal visible={!!editItem} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>تعديل — {editItem?.name}</Text>
              {tab === "hotspot" && editHForm ? (
                <>
                  <FInput label="رقم الفلاش" value={editHForm.flashNumber} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, flashNumber: v.replace(/\D/g, "") }))} keyboardType="numeric" />
                  <FInput label="اسم الجهاز" value={editHForm.deviceName} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, deviceName: v }))} />
                  <FInput label="وصف الموقع" value={editHForm.location} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, location: v }))} />
                  <FInput label="رابط الخريطة" value={editHForm.locationUrl} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, locationUrl: v }))} />
                  <Text style={styles.formLabel}>نوع البث</Text>
                  <View style={[styles.choiceRow, { marginBottom: 12 }]}>
                    {["external", "internal"].map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.choiceBtn, editHForm.hotspotType === t && styles.choiceBtnActive]}
                        onPress={() => setEditHForm((f: any) => ({ ...f, hotspotType: t }))}
                      >
                        <Text style={[styles.choiceBtnText, editHForm.hotspotType === t && { color: "#FFF" }]}>
                          {t === "internal" ? "داخلي" : "خارجي"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {editHForm.hotspotType === "internal" && (
                    <>
                      <FInput label="اسم العميل" value={editHForm.clientName} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, clientName: v }))} />
                      <FInput label="رقم الجوال" value={editHForm.clientPhone} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, clientPhone: v.replace(/\D/g, "") }))} keyboardType="phone-pad" />
                      <FInput label="رسوم الاشتراك" value={editHForm.subscriptionFee} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, subscriptionFee: v.replace(/\D/g, "") }))} keyboardType="numeric" />
                      <FInput label="عنوان IP" value={editHForm.ipAddress} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, ipAddress: v }))} />
                      <View style={styles.switchRow}>
                        <Switch
                          value={editHForm.isClientOwned}
                          onValueChange={v => setEditHForm((f: any) => ({ ...f, isClientOwned: v }))}
                          trackColor={{ true: Colors.primary }}
                        />
                        <Text style={styles.switchLabel}>الجهاز ملك العميل</Text>
                      </View>
                    </>
                  )}
                </>
              ) : tab === "broadband" && editBForm ? (
                <>
                  <FInput label="رقم الفلاش" value={editBForm.flashNumber} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, flashNumber: v.replace(/\D/g, "") }))} keyboardType="numeric" />
                  <FInput label="اسم الاشتراك" value={editBForm.subscriptionName} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, subscriptionName: v }))} />
                  <FInput label="اسم الجهاز" value={editBForm.deviceName} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, deviceName: v }))} />
                  <FInput label="اسم العميل" value={editBForm.clientName} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, clientName: v }))} />
                  <FInput label="رقم الجوال" value={editBForm.clientPhone} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, clientPhone: v.replace(/\D/g, "") }))} keyboardType="phone-pad" />
                  <FInput label="رسوم الاشتراك" value={editBForm.subscriptionFee} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, subscriptionFee: v.replace(/\D/g, "") }))} keyboardType="numeric" />
                  <FInput label="وصف الموقع" value={editBForm.location} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, location: v }))} />
                  <FInput label="رابط الخريطة" value={editBForm.locationUrl} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, locationUrl: v }))} />
                </>
              ) : null}
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditItem(null)}>
                  <Text style={styles.cancelBtnText}>إلغاء</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.nextBtn, editSaving && { opacity: 0.6 }]} onPress={handleSaveEdit} disabled={editSaving}>
                  {editSaving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.nextBtnText}>حفظ</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ─── Delete Confirm ─── */}
      <Modal visible={!!deleteTarget} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { margin: 30 }]}>
            <Ionicons name="warning" size={40} color={Colors.error} style={{ alignSelf: "center", marginBottom: 12 }} />
            <Text style={[styles.modalTitle, { textAlign: "center" }]}>تأكيد الحذف</Text>
            <Text style={{ color: Colors.textSecondary, textAlign: "center", marginBottom: 20 }}>
              هل تريد حذف "{deleteTarget?.name}"؟{"\n"}لا يمكن التراجع عن هذا الإجراء.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteTarget(null)}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: Colors.error }, deleting && { opacity: 0.6 }]}
                onPress={handleDelete} disabled={deleting}
              >
                {deleting ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.nextBtnText}>حذف</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Empty Numbers Modal ─── */}
      <Modal visible={showEmpty} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { margin: 20, maxHeight: "80%" }]}>
            <View style={styles.emptyModalHeader}>
              <TouchableOpacity onPress={() => setShowEmpty(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                الأرقام الشاغرة — {tab === "hotspot" ? "هوتسبوت" : "برودباند"}
              </Text>
            </View>
            <Text style={{ color: Colors.textMuted, textAlign: "right", marginBottom: 12, fontSize: 12 }}>
              من رقم 1 إلى {emptyNumbers.max} — {emptyNumbers.empty.length} رقم شاغر
            </Text>
            <ScrollView>
              {emptyNumbers.empty.length === 0 ? (
                <Text style={[styles.emptyText, { margin: 20 }]}>لا توجد أرقام شاغرة 🎉</Text>
              ) : (
                <View style={styles.emptyGrid}>
                  {emptyNumbers.empty.map(n => (
                    <View key={n} style={styles.emptyChip}>
                      <Text style={styles.emptyChipText}>
                        {tab === "hotspot" ? n : `P${n}`}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <AlertComp />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  headerActions: { flexDirection: "row-reverse", gap: 8, alignItems: "center" },
  emptyBtn: { padding: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.warning + "60", backgroundColor: Colors.warning + "15" },
  addBtn: { backgroundColor: Colors.primary, width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },

  mainTabs: { flexDirection: "row-reverse", paddingHorizontal: 12, paddingTop: 10, gap: 8 },
  mainTab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  mainTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  mainTabText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  mainTabTextActive: { color: "#FFF" },

  subFilter: { flexDirection: "row-reverse", paddingHorizontal: 12, paddingTop: 8, gap: 6 },
  subFilterBtn: { flex: 1, paddingVertical: 7, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  subFilterBtnActive: { backgroundColor: Colors.primary + "20", borderColor: Colors.primary },
  subFilterText: { fontSize: 12, color: Colors.textSecondary },
  subFilterTextActive: { color: Colors.primary, fontWeight: "bold" },

  searchBox: {
    flexDirection: "row-reverse", alignItems: "center", gap: 8,
    marginHorizontal: 12, marginTop: 8, marginBottom: 4,
    backgroundColor: Colors.surface, borderRadius: 12,
    paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, paddingVertical: 10, color: Colors.text, fontSize: 14 },

  countRow: { flexDirection: "row-reverse", justifyContent: "space-between", paddingHorizontal: 14, paddingBottom: 6 },
  countText: { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  countSmall: { color: Colors.textMuted, fontSize: 11 },

  list: { padding: 12, gap: 10 },

  card: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border, borderLeftColor: Colors.primary, borderLeftWidth: 3,
  },
  cardHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  flashBlock: { flex: 1 },
  flashNum: { fontSize: 22, fontWeight: "bold", color: Colors.primary },
  deviceName: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  typeBadge: { marginTop: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeInternal: { backgroundColor: Colors.primary + "18" },
  badgeExternal: { backgroundColor: Colors.warning + "18" },
  typeBadgeText: { fontSize: 11, fontWeight: "bold" },
  feeText: { fontSize: 15, fontWeight: "bold", color: Colors.success },
  ownerBadge: { backgroundColor: Colors.info + "20", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  ownerBadgeText: { color: Colors.info, fontSize: 11, fontWeight: "bold" },

  section: { marginBottom: 8 },
  clientNameText: { fontSize: 15, fontWeight: "bold", color: Colors.text, textAlign: "right", marginBottom: 4 },
  noClientText: { fontSize: 13, color: Colors.textMuted, textAlign: "right", fontStyle: "italic", marginBottom: 4 },
  phoneRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  phoneText: { color: Colors.textSecondary, fontSize: 13, flex: 1, textAlign: "right" },
  iconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.background, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: Colors.border },

  locationRow: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 6, marginBottom: 8 },
  locationIcons: { flexDirection: "row-reverse", gap: 4 },
  locationText: { flex: 1, color: Colors.textSecondary, fontSize: 13, textAlign: "right", lineHeight: 18 },

  cardActions: { flexDirection: "row-reverse", gap: 8, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  deleteBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.error + "50", backgroundColor: Colors.error + "10" },
  editBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary + "50", backgroundColor: Colors.primary + "10" },
  actionBtnText: { fontSize: 12, fontWeight: "600" },

  empty: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  modalScroll: { flexGrow: 1, justifyContent: "flex-end" },
  modalBox: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: Colors.text, textAlign: "right", marginBottom: 16 },

  choiceRow: { flexDirection: "row-reverse", gap: 10 },
  choiceBtn: { flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, gap: 4 },
  choiceBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  choiceBtnText: { fontSize: 14, fontWeight: "bold", color: Colors.textSecondary },

  formLabel: { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: 6 },
  formInput: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, color: Colors.text, borderWidth: 1, borderColor: Colors.border, textAlign: "right" },
  switchRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12, marginBottom: 12 },
  switchLabel: { color: Colors.text, fontSize: 14 },

  modalBtns: { flexDirection: "row-reverse", gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, padding: 13, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: "bold" },
  nextBtn: { flex: 1, padding: 13, alignItems: "center", borderRadius: 10, backgroundColor: Colors.primary },
  nextBtnText: { color: "#FFF", fontWeight: "bold" },

  emptyModalHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  emptyGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, paddingBottom: 20 },
  emptyChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.warning + "25", borderWidth: 1, borderColor: Colors.warning },
  emptyChipText: { color: Colors.warning, fontWeight: "bold", fontSize: 14 },
});
