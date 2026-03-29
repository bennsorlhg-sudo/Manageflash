import React, { useState, useCallback, useEffect, useRef } from "react";
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
import { apiPost, apiPut, apiFetch } from "@/utils/api";

const PAGE_SIZE = 50;

/* ─── Types ─── */
interface HotspotPoint {
  id: number; flashNumber: number | null; name: string; location: string;
  hotspotType: string | null; deviceName: string | null; clientName: string | null;
  clientPhone: string | null; subscriptionFee: string | null; ipAddress: string | null;
  isClientOwned: boolean | null; locationUrl: string | null; notes: string | null; status: string;
}
interface BroadbandPoint {
  id: number; flashNumber: number | null; name: string; location: string;
  subscriptionName: string | null; deviceName: string | null; clientName: string | null;
  clientPhone: string | null; subscriptionFee: string | null; locationUrl: string | null;
  notes: string | null; status: string; isClientOwned: boolean | null;
}
type TabType = "hotspot" | "broadband";
type HotspotFilter = "all" | "internal" | "external";

/* ─── Blank forms ─── */
const blankH = () => ({ flashNumber: "", deviceName: "", hotspotType: "internal" as "internal"|"external", clientName: "", clientPhone: "", subscriptionFee: "", ipAddress: "", isClientOwned: false, locationUrl: "", location: "" });
const blankB = () => ({ flashNumber: "", subscriptionName: "", deviceName: "", clientName: "", clientPhone: "", subscriptionFee: "", locationUrl: "", location: "" });

/* ─── Alert component ─── */
function AlertModal({ title, msg, visible, onClose }: { title: string; msg: string; visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={ms.overlay}><View style={ms.box}>
        <Text style={ms.title}>{title}</Text>
        {msg ? <Text style={ms.msg}>{msg}</Text> : null}
        <TouchableOpacity style={ms.btn} onPress={onClose}><Text style={ms.btnT}>حسناً</Text></TouchableOpacity>
      </View></View>
    </Modal>
  );
}
const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 30 },
  box: { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border },
  title: { color: Colors.text, fontSize: 17, fontWeight: "bold", textAlign: "right", marginBottom: 8 },
  msg: { color: Colors.textSecondary, fontSize: 14, textAlign: "right", marginBottom: 16 },
  btn: { backgroundColor: Colors.primary, borderRadius: 10, padding: 12, alignItems: "center" },
  btnT: { color: "#FFF", fontWeight: "bold" },
});

/* ─── Form input ─── */
function FInput({ label, value, onChangeText, placeholder = "", keyboardType = "default" as any, multiline = false }: any) {
  return (
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
}

export default function DatabaseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [tab, setTab] = useState<TabType>("hotspot");
  const [hotspotFilter, setHotspotFilter] = useState<HotspotFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [hotspotPoints, setHotspotPoints] = useState<HotspotPoint[]>([]);
  const [broadbandPoints, setBroadbandPoints] = useState<BroadbandPoint[]>([]);
  const [hotspotTotal, setHotspotTotal] = useState(0);
  const [broadbandTotal, setBroadbandTotal] = useState(0);
  const [hotspotOffset, setHotspotOffset] = useState(0);
  const [broadbandOffset, setBroadbandOffset] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addStep, setAddStep] = useState<1|2>(1);
  const [addType, setAddType] = useState<TabType>("hotspot");
  const [hForm, setHForm] = useState(blankH());
  const [bForm, setBForm] = useState(blankB());
  const [saving, setSaving] = useState(false);

  // Edit
  const [editItem, setEditItem] = useState<HotspotPoint|BroadbandPoint|null>(null);
  const [editHForm, setEditHForm] = useState<any>(null);
  const [editBForm, setEditBForm] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<{id:number;type:TabType;name:string}|null>(null);
  const [deleting, setDeleting] = useState(false);

  // Empty numbers
  const [showEmpty, setShowEmpty] = useState(false);
  const [emptyNums, setEmptyNums] = useState<number[]>([]);
  const [emptyMax, setEmptyMax] = useState(0);

  // Alert
  const [alertVis, setAlertVis] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMsg, setAlertMsg] = useState("");
  const showAlert = (t: string, m = "") => { setAlertTitle(t); setAlertMsg(m); setAlertVis(true); };

  const debounceRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  /* ─── Debounce search ─── */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  /* ─── Fetch functions ─── */
  const fetchHotspot = useCallback(async (off = 0, append = false, s = debouncedSearch, f = hotspotFilter) => {
    const typeParam = f === "all" ? "" : `&type=${f === "internal" ? "internal" : "external"}`;
    const searchParam = s ? `&search=${encodeURIComponent(s)}` : "";
    const json = await apiFetch(`/network/hotspot-points?limit=${PAGE_SIZE}&offset=${off}${typeParam}${searchParam}`, token);
    const data: HotspotPoint[] = json.data ?? [];
    setHotspotTotal(json.total ?? 0);
    setHotspotOffset(off + data.length);
    setHotspotPoints(prev => append ? [...prev, ...data] : data);
  }, [token, debouncedSearch, hotspotFilter]);

  const fetchBroadband = useCallback(async (off = 0, append = false, s = debouncedSearch) => {
    const searchParam = s ? `&search=${encodeURIComponent(s)}` : "";
    const json = await apiFetch(`/network/broadband-points?limit=${PAGE_SIZE}&offset=${off}${searchParam}`, token);
    const data: BroadbandPoint[] = json.data ?? [];
    setBroadbandTotal(json.total ?? 0);
    setBroadbandOffset(off + data.length);
    setBroadbandPoints(prev => append ? [...prev, ...data] : data);
  }, [token, debouncedSearch]);

  /* ─── Initial load & filter/search changes ─── */
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const run = async () => {
      try {
        if (tab === "hotspot") await fetchHotspot(0, false, debouncedSearch, hotspotFilter);
        else await fetchBroadband(0, false, debouncedSearch);
      } catch { }
      setLoading(false);
      setRefreshing(false);
    };
    run();
  }, [tab, hotspotFilter, debouncedSearch, token]);

  /* ─── Load more ─── */
  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      if (tab === "hotspot" && hotspotOffset < hotspotTotal) {
        await fetchHotspot(hotspotOffset, true);
      } else if (tab === "broadband" && broadbandOffset < broadbandTotal) {
        await fetchBroadband(broadbandOffset, true);
      }
    } catch { }
    setLoadingMore(false);
  };

  /* ─── Empty numbers ─── */
  const openEmptyNumbers = async () => {
    setShowEmpty(true);
    try {
      const endpoint = tab === "hotspot" ? "hotspot-points" : "broadband-points";
      const nums: number[] = await apiFetch(`/network/${endpoint}/flash-numbers`, token);
      const used = new Set(nums);
      const max = nums.length ? Math.max(...nums) : 0;
      const empty: number[] = [];
      for (let i = 1; i <= max; i++) if (!used.has(i)) empty.push(i);
      setEmptyNums(empty);
      setEmptyMax(max);
    } catch { showAlert("خطأ", "فشل تحميل الأرقام"); }
  };

  /* ─── Actions ─── */
  const copyText = async (text: string) => {
    await Clipboard.setStringAsync(text);
    showAlert("تم النسخ", text.substring(0, 60));
  };
  const openMap = (url: string) => url ? Linking.openURL(url) : showAlert("لا يوجد رابط");
  const callPhone = (phone: string) => Linking.openURL(`tel:${phone.replace(/\D/g, "")}`);

  /* ─── Add ─── */
  const handleAdd = async () => {
    setSaving(true);
    try {
      if (addType === "hotspot") {
        if (!hForm.flashNumber) { showAlert("خطأ", "أدخل رقم الفلاش"); return; }
        const p: any = { flashNumber: parseInt(hForm.flashNumber), name: `فلاش ${hForm.flashNumber}`, hotspotType: hForm.hotspotType, deviceName: hForm.deviceName || null, location: hForm.location || "-", locationUrl: hForm.locationUrl || null, isClientOwned: hForm.isClientOwned };
        if (hForm.hotspotType === "internal") { p.clientName = hForm.clientName || null; p.clientPhone = hForm.clientPhone.replace(/\D/g,"") || null; p.subscriptionFee = hForm.subscriptionFee || null; p.ipAddress = hForm.ipAddress || null; }
        const added = await apiPost("/network/hotspot-points", token, p);
        setHotspotPoints(prev => [added, ...prev]);
        setHotspotTotal(t => t + 1);
      } else {
        if (!bForm.flashNumber) { showAlert("خطأ", "أدخل رقم الفلاش"); return; }
        const p = { flashNumber: parseInt(bForm.flashNumber), name: `فلاش P${bForm.flashNumber}`, subscriptionName: bForm.subscriptionName || null, deviceName: bForm.deviceName || null, clientName: bForm.clientName || null, clientPhone: bForm.clientPhone.replace(/\D/g,"") || null, subscriptionFee: bForm.subscriptionFee || null, location: bForm.location || "-", locationUrl: bForm.locationUrl || null };
        const added = await apiPost("/network/broadband-points", token, p);
        setBroadbandPoints(prev => [added, ...prev]);
        setBroadbandTotal(t => t + 1);
      }
      setShowAdd(false); setHForm(blankH()); setBForm(blankB()); setAddStep(1);
    } catch (e: any) { showAlert("خطأ", e.message ?? "فشل الإضافة"); }
    finally { setSaving(false); }
  };

  /* ─── Edit ─── */
  const openEdit = (item: HotspotPoint|BroadbandPoint) => {
    setEditItem(item);
    if (tab === "hotspot") { const h = item as HotspotPoint; setEditHForm({ flashNumber: h.flashNumber ? String(h.flashNumber) : "", deviceName: h.deviceName ?? "", hotspotType: h.hotspotType ?? "internal", clientName: h.clientName ?? "", clientPhone: h.clientPhone ?? "", subscriptionFee: h.subscriptionFee ?? "", ipAddress: h.ipAddress ?? "", isClientOwned: h.isClientOwned ?? false, locationUrl: h.locationUrl ?? "", location: h.location ?? "" }); }
    else { const b = item as BroadbandPoint; setEditBForm({ flashNumber: b.flashNumber ? String(b.flashNumber) : "", subscriptionName: b.subscriptionName ?? "", deviceName: b.deviceName ?? "", clientName: b.clientName ?? "", clientPhone: b.clientPhone ?? "", subscriptionFee: b.subscriptionFee ?? "", locationUrl: b.locationUrl ?? "", location: b.location ?? "" }); }
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    setEditSaving(true);
    try {
      if (tab === "hotspot") {
        const f = editHForm;
        const p: any = { flashNumber: f.flashNumber ? parseInt(f.flashNumber) : null, name: `فلاش ${f.flashNumber}`, hotspotType: f.hotspotType, deviceName: f.deviceName || null, location: f.location || "-", locationUrl: f.locationUrl || null, clientName: f.clientName || null, clientPhone: f.clientPhone.replace(/\D/g,"") || null, subscriptionFee: f.subscriptionFee || null, ipAddress: f.ipAddress || null, isClientOwned: f.isClientOwned };
        const updated = await apiPut(`/network/hotspot-points/${editItem.id}`, token, p);
        setHotspotPoints(prev => prev.map(x => x.id === updated.id ? updated : x));
      } else {
        const f = editBForm;
        const p = { flashNumber: f.flashNumber ? parseInt(f.flashNumber) : null, name: `فلاش P${f.flashNumber}`, subscriptionName: f.subscriptionName || null, deviceName: f.deviceName || null, clientName: f.clientName || null, clientPhone: f.clientPhone.replace(/\D/g,"") || null, subscriptionFee: f.subscriptionFee || null, location: f.location || "-", locationUrl: f.locationUrl || null };
        const updated = await apiPut(`/network/broadband-points/${editItem.id}`, token, p);
        setBroadbandPoints(prev => prev.map(x => x.id === updated.id ? updated : x));
      }
      setEditItem(null);
    } catch (e: any) { showAlert("خطأ", e.message ?? "فشل التعديل"); }
    finally { setEditSaving(false); }
  };

  /* ─── Delete ─── */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const ep = deleteTarget.type === "hotspot" ? "hotspot-points" : "broadband-points";
      await apiFetch(`/network/${ep}/${deleteTarget.id}`, token, { method: "DELETE" });
      if (deleteTarget.type === "hotspot") { setHotspotPoints(prev => prev.filter(p => p.id !== deleteTarget.id)); setHotspotTotal(t => t - 1); }
      else { setBroadbandPoints(prev => prev.filter(p => p.id !== deleteTarget.id)); setBroadbandTotal(t => t - 1); }
      setDeleteTarget(null);
    } catch (e: any) { showAlert("خطأ", e.message ?? "فشل الحذف"); }
    finally { setDeleting(false); }
  };

  /* ─── Cards ─── */
  const renderHotspotCard = (p: HotspotPoint) => {
    const isInt = p.hotspotType === "internal";
    return (
      <View key={p.id} style={[styles.card, { borderLeftColor: isInt ? Colors.primary : Colors.warning }]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.flashNum, { color: isInt ? Colors.primary : Colors.warning }]}>{p.name}</Text>
            {p.deviceName ? <Text style={styles.deviceName}>{p.deviceName}</Text> : null}
            <View style={[styles.typeBadge, { backgroundColor: (isInt ? Colors.primary : Colors.warning) + "18" }]}>
              <Text style={[styles.typeBadgeText, { color: isInt ? Colors.primary : Colors.warning }]}>{isInt ? "داخلي" : "خارجي"}</Text>
            </View>
          </View>
          {p.subscriptionFee ? <Text style={styles.feeText}>{Number(p.subscriptionFee).toLocaleString()} ر</Text>
            : isInt && p.isClientOwned ? <View style={styles.ownerBadge}><Text style={styles.ownerText}>ملك العميل</Text></View>
            : isInt ? <View style={[styles.ownerBadge, { backgroundColor: Colors.primary + "15" }]}><Text style={[styles.ownerText, { color: Colors.primary }]}>ملك الشبكة</Text></View>
            : null}
        </View>

        {isInt && (
          <View style={styles.section}>
            {p.clientName ? <Text style={styles.clientNameText}>{p.clientName}</Text>
              : <Text style={styles.noClientText}>لا يوجد مشترك</Text>}
            {p.clientPhone ? (
              <View style={styles.phoneRow}>
                <TouchableOpacity onPress={() => callPhone(p.clientPhone!)} style={styles.iconBtn}><Ionicons name="call" size={18} color={Colors.success} /></TouchableOpacity>
                <TouchableOpacity onPress={() => copyText(p.clientPhone!)} style={styles.iconBtn}><Ionicons name="copy-outline" size={18} color={Colors.textSecondary} /></TouchableOpacity>
                <Text style={styles.phoneText}>{p.clientPhone}</Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.locationRow}>
          <View style={styles.locIcons}>
            {p.locationUrl ? <TouchableOpacity onPress={() => openMap(p.locationUrl!)} style={styles.iconBtn}><Ionicons name="location" size={18} color={Colors.error} /></TouchableOpacity> : null}
            <TouchableOpacity onPress={() => copyText(p.locationUrl || p.location)} style={styles.iconBtn}><Ionicons name="copy-outline" size={18} color={Colors.textSecondary} /></TouchableOpacity>
          </View>
          <Text style={styles.locationText} numberOfLines={2}>{p.location}</Text>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => setDeleteTarget({ id: p.id, type: "hotspot", name: p.name })}>
            <Ionicons name="trash-outline" size={15} color={Colors.error} /><Text style={[styles.actText, { color: Colors.error }]}>حذف</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(p)}>
            <Ionicons name="pencil-outline" size={15} color={Colors.primary} /><Text style={[styles.actText, { color: Colors.primary }]}>تعديل</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderBroadbandCard = (p: BroadbandPoint) => (
    <View key={p.id} style={[styles.card, { borderLeftColor: Colors.warning }]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.flashNum, { color: Colors.warning }]}>{p.name}</Text>
          {p.subscriptionName ? <Text style={styles.deviceName}>{p.subscriptionName}</Text> : null}
          {p.deviceName ? <Text style={[styles.deviceName, { color: Colors.textMuted, fontSize: 11 }]}>{p.deviceName}</Text> : null}
          <View style={{ flexDirection: "row-reverse", gap: 6, marginTop: 4 }}>
            <View style={[styles.typeBadge, { backgroundColor: Colors.warning + "18" }]}>
              <Text style={[styles.typeBadgeText, { color: Colors.warning }]}>برودباند</Text>
            </View>
            {p.isClientOwned
              ? <View style={styles.ownerBadge}><Text style={styles.ownerText}>ملك العميل</Text></View>
              : <View style={[styles.ownerBadge, { backgroundColor: Colors.primary + "15" }]}><Text style={[styles.ownerText, { color: Colors.primary }]}>ملك الشبكة</Text></View>}
          </View>
        </View>
        {p.subscriptionFee ? <Text style={styles.feeText}>{Number(p.subscriptionFee).toLocaleString()} ر</Text> : null}
      </View>

      <View style={styles.section}>
        {p.clientName ? <Text style={styles.clientNameText}>{p.clientName}</Text> : <Text style={styles.noClientText}>لا يوجد مشترك</Text>}
        {p.clientPhone ? (
          <View style={styles.phoneRow}>
            <TouchableOpacity onPress={() => callPhone(p.clientPhone!)} style={styles.iconBtn}><Ionicons name="call" size={18} color={Colors.success} /></TouchableOpacity>
            <TouchableOpacity onPress={() => copyText(p.clientPhone!)} style={styles.iconBtn}><Ionicons name="copy-outline" size={18} color={Colors.textSecondary} /></TouchableOpacity>
            <Text style={styles.phoneText}>{p.clientPhone}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.locationRow}>
        <View style={styles.locIcons}>
          {p.locationUrl ? <TouchableOpacity onPress={() => openMap(p.locationUrl!)} style={styles.iconBtn}><Ionicons name="location" size={18} color={Colors.error} /></TouchableOpacity> : null}
          <TouchableOpacity onPress={() => copyText(p.locationUrl || p.location)} style={styles.iconBtn}><Ionicons name="copy-outline" size={18} color={Colors.textSecondary} /></TouchableOpacity>
        </View>
        <Text style={styles.locationText} numberOfLines={2}>{p.location}</Text>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => setDeleteTarget({ id: p.id, type: "broadband", name: p.name })}>
          <Ionicons name="trash-outline" size={15} color={Colors.error} /><Text style={[styles.actText, { color: Colors.error }]}>حذف</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(p)}>
          <Ionicons name="pencil-outline" size={15} color={Colors.primary} /><Text style={[styles.actText, { color: Colors.primary }]}>تعديل</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const list = tab === "hotspot" ? hotspotPoints : broadbandPoints;
  const total = tab === "hotspot" ? hotspotTotal : broadbandTotal;
  const offset = tab === "hotspot" ? hotspotOffset : broadbandOffset;
  const hasMore = offset < total;

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-forward" size={24} color={Colors.text} /></TouchableOpacity>
        <Text style={styles.title}>قاعدة البيانات</Text>
        <View style={{ flexDirection: "row-reverse", gap: 8, alignItems: "center" }}>
          <TouchableOpacity onPress={openEmptyNumbers} style={styles.emptyBtn}><Ionicons name="grid-outline" size={20} color={Colors.warning} /></TouchableOpacity>
          <TouchableOpacity onPress={() => { setShowAdd(true); setAddStep(1); setAddType(tab); }} style={styles.addBtn}><Ionicons name="add" size={22} color="#FFF" /></TouchableOpacity>
        </View>
      </View>

      {/* Main tabs */}
      <View style={styles.mainTabs}>
        {(["hotspot","broadband"] as TabType[]).reverse().map(t => (
          <TouchableOpacity key={t} style={[styles.mainTab, tab === t && styles.mainTabActive]} onPress={() => { setTab(t); setSearch(""); setDebouncedSearch(""); }}>
            <Text style={[styles.mainTabText, tab === t && styles.mainTabTextActive]}>
              {t === "hotspot" ? `هوتسبوت` : `برودباند`}
              {" "}({t === "hotspot" ? hotspotTotal : broadbandTotal})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Hotspot sub-filter */}
      {tab === "hotspot" && (
        <View style={styles.subFilter}>
          {(["all","internal","external"] as HotspotFilter[]).map(f => (
            <TouchableOpacity key={f} style={[styles.subBtn, hotspotFilter === f && styles.subBtnActive]} onPress={() => setHotspotFilter(f)}>
              <Text style={[styles.subBtnText, hotspotFilter === f && styles.subBtnTextActive]}>{f === "all" ? "الكل" : f === "internal" ? "داخلي" : "خارجي"}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput style={styles.searchInput} placeholder="بحث..." placeholderTextColor={Colors.textMuted} value={search} onChangeText={setSearch} textAlign="right" />
        {search ? <TouchableOpacity onPress={() => setSearch("")}><Ionicons name="close-circle" size={18} color={Colors.textMuted} /></TouchableOpacity> : null}
      </View>

      {/* Count */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {loading ? "جاري التحميل..." : `${list.length} من ${total} نقطة`}
        </Text>
        {tab === "hotspot" && !loading && (
          <Text style={styles.countSmall}>{list.filter(p => (p as HotspotPoint).hotspotType === "internal").length} داخلي · {list.filter(p => (p as HotspotPoint).hotspotType === "external").length} خارجي</Text>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ color: Colors.textMuted, marginTop: 12 }}>جاري تحميل البيانات...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); tab === "hotspot" ? fetchHotspot(0, false) : fetchBroadband(0, false); }} />}
        >
          {list.length === 0 ? (
            <View style={styles.empty}><Ionicons name="search-outline" size={48} color={Colors.textMuted} /><Text style={styles.emptyText}>لا توجد نتائج</Text></View>
          ) : (
            <>
              {tab === "hotspot" ? (list as HotspotPoint[]).map(renderHotspotCard) : (list as BroadbandPoint[]).map(renderBroadbandCard)}

              {hasMore && (
                <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} disabled={loadingMore}>
                  {loadingMore
                    ? <ActivityIndicator color={Colors.primary} />
                    : <Text style={styles.loadMoreText}>تحميل المزيد ({total - offset} متبقي)</Text>}
                </TouchableOpacity>
              )}
            </>
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {/* ─── Add Modal ─── */}
      <Modal visible={showAdd} transparent animationType="slide">
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>إضافة نقطة جديدة</Text>
              {addStep === 1 ? (
                <>
                  <Text style={styles.formLabel}>نوع الشبكة</Text>
                  <View style={[styles.choiceRow, { marginBottom: 16 }]}>
                    {(["hotspot","broadband"] as TabType[]).reverse().map(t => (
                      <TouchableOpacity key={t} style={[styles.choiceBtn, addType === t && styles.choiceBtnActive]} onPress={() => setAddType(t)}>
                        <Ionicons name={t === "hotspot" ? "radio" : "wifi"} size={20} color={addType === t ? "#FFF" : Colors.textSecondary} />
                        <Text style={[styles.choiceBtnText, addType === t && { color: "#FFF" }]}>{t === "hotspot" ? "هوتسبوت" : "برودباند"}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {addType === "hotspot" && (
                    <>
                      <Text style={styles.formLabel}>نوع البث</Text>
                      <View style={styles.choiceRow}>
                        {(["internal","external"] as const).map(f => (
                          <TouchableOpacity key={f} style={[styles.choiceBtn, hForm.hotspotType === f && styles.choiceBtnActive]} onPress={() => setHForm(x => ({ ...x, hotspotType: f }))}>
                            <Text style={[styles.choiceBtnText, hForm.hotspotType === f && { color: "#FFF" }]}>{f === "internal" ? "داخلي" : "خارجي"}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                  <View style={styles.modalBtns}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}><Text style={styles.cancelBtnText}>إلغاء</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.nextBtn} onPress={() => setAddStep(2)}><Text style={styles.nextBtnText}>التالي ←</Text></TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  {addType === "hotspot" ? (
                    <>
                      <FInput label="رقم الفلاش *" value={hForm.flashNumber} onChangeText={(v: string) => setHForm(f => ({ ...f, flashNumber: v.replace(/\D/g,"") }))} keyboardType="numeric" placeholder="مثال: 15" />
                      <FInput label="اسم الجهاز" value={hForm.deviceName} onChangeText={(v: string) => setHForm(f => ({ ...f, deviceName: v }))} placeholder="Tplink, D-Link..." />
                      <FInput label="وصف الموقع" value={hForm.location} onChangeText={(v: string) => setHForm(f => ({ ...f, location: v }))} placeholder="حي، شارع..." />
                      <FInput label="رابط خرائط جوجل" value={hForm.locationUrl} onChangeText={(v: string) => setHForm(f => ({ ...f, locationUrl: v }))} placeholder="https://maps.google.com/..." />
                      {hForm.hotspotType === "internal" && (
                        <>
                          <FInput label="اسم العميل" value={hForm.clientName} onChangeText={(v: string) => setHForm(f => ({ ...f, clientName: v }))} />
                          <FInput label="رقم الجوال" value={hForm.clientPhone} onChangeText={(v: string) => setHForm(f => ({ ...f, clientPhone: v.replace(/\D/g,"") }))} keyboardType="phone-pad" />
                          <FInput label="رسوم الاشتراك (ر)" value={hForm.subscriptionFee} onChangeText={(v: string) => setHForm(f => ({ ...f, subscriptionFee: v.replace(/\D/g,"") }))} keyboardType="numeric" />
                          <FInput label="عنوان IP" value={hForm.ipAddress} onChangeText={(v: string) => setHForm(f => ({ ...f, ipAddress: v }))} placeholder="192.168.0.x" />
                          <View style={styles.switchRow}>
                            <Switch value={hForm.isClientOwned} onValueChange={v => setHForm(f => ({ ...f, isClientOwned: v }))} trackColor={{ true: Colors.primary }} />
                            <Text style={styles.switchLabel}>الجهاز ملك العميل</Text>
                          </View>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <FInput label="رقم الفلاش *" value={bForm.flashNumber} onChangeText={(v: string) => setBForm(f => ({ ...f, flashNumber: v.replace(/\D/g,"") }))} keyboardType="numeric" placeholder="مثال: 5 ← يظهر P5" />
                      <FInput label="اسم الاشتراك" value={bForm.subscriptionName} onChangeText={(v: string) => setBForm(f => ({ ...f, subscriptionName: v }))} placeholder="andls123" />
                      <FInput label="اسم الجهاز" value={bForm.deviceName} onChangeText={(v: string) => setBForm(f => ({ ...f, deviceName: v }))} />
                      <FInput label="اسم العميل" value={bForm.clientName} onChangeText={(v: string) => setBForm(f => ({ ...f, clientName: v }))} />
                      <FInput label="رقم الجوال" value={bForm.clientPhone} onChangeText={(v: string) => setBForm(f => ({ ...f, clientPhone: v.replace(/\D/g,"") }))} keyboardType="phone-pad" />
                      <FInput label="رسوم الاشتراك (ر)" value={bForm.subscriptionFee} onChangeText={(v: string) => setBForm(f => ({ ...f, subscriptionFee: v.replace(/\D/g,"") }))} keyboardType="numeric" />
                      <FInput label="وصف الموقع" value={bForm.location} onChangeText={(v: string) => setBForm(f => ({ ...f, location: v }))} />
                      <FInput label="رابط خرائط جوجل" value={bForm.locationUrl} onChangeText={(v: string) => setBForm(f => ({ ...f, locationUrl: v }))} />
                    </>
                  )}
                  <View style={styles.modalBtns}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddStep(1)}><Text style={styles.cancelBtnText}>→ رجوع</Text></TouchableOpacity>
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
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>تعديل — {editItem?.name}</Text>
              {tab === "hotspot" && editHForm ? (
                <>
                  <FInput label="رقم الفلاش" value={editHForm.flashNumber} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, flashNumber: v.replace(/\D/g,"") }))} keyboardType="numeric" />
                  <FInput label="اسم الجهاز" value={editHForm.deviceName} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, deviceName: v }))} />
                  <FInput label="وصف الموقع" value={editHForm.location} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, location: v }))} />
                  <FInput label="رابط الخريطة" value={editHForm.locationUrl} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, locationUrl: v }))} />
                  <Text style={styles.formLabel}>نوع البث</Text>
                  <View style={[styles.choiceRow, { marginBottom: 12 }]}>
                    {(["internal","external"] as const).map(t => (
                      <TouchableOpacity key={t} style={[styles.choiceBtn, editHForm.hotspotType === t && styles.choiceBtnActive]} onPress={() => setEditHForm((f: any) => ({ ...f, hotspotType: t }))}>
                        <Text style={[styles.choiceBtnText, editHForm.hotspotType === t && { color: "#FFF" }]}>{t === "internal" ? "داخلي" : "خارجي"}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {editHForm.hotspotType === "internal" && (
                    <>
                      <FInput label="اسم العميل" value={editHForm.clientName} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, clientName: v }))} />
                      <FInput label="رقم الجوال" value={editHForm.clientPhone} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, clientPhone: v.replace(/\D/g,"") }))} keyboardType="phone-pad" />
                      <FInput label="رسوم الاشتراك" value={editHForm.subscriptionFee} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, subscriptionFee: v.replace(/\D/g,"") }))} keyboardType="numeric" />
                      <FInput label="عنوان IP" value={editHForm.ipAddress} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, ipAddress: v }))} />
                      <View style={styles.switchRow}><Switch value={editHForm.isClientOwned} onValueChange={v => setEditHForm((f: any) => ({ ...f, isClientOwned: v }))} trackColor={{ true: Colors.primary }} /><Text style={styles.switchLabel}>الجهاز ملك العميل</Text></View>
                    </>
                  )}
                </>
              ) : tab === "broadband" && editBForm ? (
                <>
                  <FInput label="رقم الفلاش" value={editBForm.flashNumber} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, flashNumber: v.replace(/\D/g,"") }))} keyboardType="numeric" />
                  <FInput label="اسم الاشتراك" value={editBForm.subscriptionName} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, subscriptionName: v }))} />
                  <FInput label="اسم الجهاز" value={editBForm.deviceName} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, deviceName: v }))} />
                  <FInput label="اسم العميل" value={editBForm.clientName} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, clientName: v }))} />
                  <FInput label="رقم الجوال" value={editBForm.clientPhone} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, clientPhone: v.replace(/\D/g,"") }))} keyboardType="phone-pad" />
                  <FInput label="رسوم الاشتراك" value={editBForm.subscriptionFee} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, subscriptionFee: v.replace(/\D/g,"") }))} keyboardType="numeric" />
                  <FInput label="وصف الموقع" value={editBForm.location} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, location: v }))} />
                  <FInput label="رابط الخريطة" value={editBForm.locationUrl} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, locationUrl: v }))} />
                </>
              ) : null}
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditItem(null)}><Text style={styles.cancelBtnText}>إلغاء</Text></TouchableOpacity>
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
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { margin: 30, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderRadius: 16 }]}>
            <Ionicons name="warning" size={40} color={Colors.error} style={{ alignSelf: "center", marginBottom: 12 }} />
            <Text style={[styles.modalTitle, { textAlign: "center" }]}>تأكيد الحذف</Text>
            <Text style={{ color: Colors.textSecondary, textAlign: "center", marginBottom: 20 }}>هل تريد حذف "{deleteTarget?.name}"؟{"\n"}لا يمكن التراجع.</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteTarget(null)}><Text style={styles.cancelBtnText}>إلغاء</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.nextBtn, { backgroundColor: Colors.error }, deleting && { opacity: 0.6 }]} onPress={handleDelete} disabled={deleting}>
                {deleting ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.nextBtnText}>حذف</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Empty Numbers Modal ─── */}
      <Modal visible={showEmpty} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { margin: 20, maxHeight: "80%", borderRadius: 20 }]}>
            <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <TouchableOpacity onPress={() => setShowEmpty(false)}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
              <Text style={styles.modalTitle}>الأرقام الشاغرة — {tab === "hotspot" ? "هوتسبوت" : "برودباند"}</Text>
            </View>
            <Text style={{ color: Colors.textMuted, textAlign: "right", marginBottom: 12, fontSize: 12 }}>
              من 1 إلى {emptyMax} · {emptyNums.length} رقم شاغر
            </Text>
            <ScrollView>
              {emptyNums.length === 0
                ? <Text style={[styles.emptyText, { margin: 20, textAlign: "center" }]}>لا توجد أرقام شاغرة 🎉</Text>
                : (
                  <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, paddingBottom: 20 }}>
                    {emptyNums.map(n => (
                      <View key={n} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.warning + "25", borderWidth: 1, borderColor: Colors.warning }}>
                        <Text style={{ color: Colors.warning, fontWeight: "bold", fontSize: 14 }}>{tab === "hotspot" ? n : `P${n}`}</Text>
                      </View>
                    ))}
                  </View>
                )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <AlertModal title={alertTitle} msg={alertMsg} visible={alertVis} onClose={() => setAlertVis(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  emptyBtn: { padding: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.warning + "60", backgroundColor: Colors.warning + "15" },
  addBtn: { backgroundColor: Colors.primary, width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },

  mainTabs: { flexDirection: "row-reverse", paddingHorizontal: 12, paddingTop: 10, gap: 8 },
  mainTab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  mainTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  mainTabText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  mainTabTextActive: { color: "#FFF" },

  subFilter: { flexDirection: "row-reverse", paddingHorizontal: 12, paddingTop: 8, gap: 6 },
  subBtn: { flex: 1, paddingVertical: 7, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  subBtnActive: { backgroundColor: Colors.primary + "20", borderColor: Colors.primary },
  subBtnText: { fontSize: 12, color: Colors.textSecondary },
  subBtnTextActive: { color: Colors.primary, fontWeight: "bold" },

  searchBox: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginHorizontal: 12, marginTop: 8, marginBottom: 4, backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, paddingVertical: 10, color: Colors.text, fontSize: 14 },

  countRow: { flexDirection: "row-reverse", justifyContent: "space-between", paddingHorizontal: 14, paddingBottom: 6 },
  countText: { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  countSmall: { color: Colors.textMuted, fontSize: 11 },

  list: { padding: 12, gap: 10 },
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3 },
  cardHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  flashNum: { fontSize: 22, fontWeight: "bold" },
  deviceName: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  typeBadge: { marginTop: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBadgeText: { fontSize: 11, fontWeight: "bold" },
  feeText: { fontSize: 15, fontWeight: "bold", color: Colors.success },
  ownerBadge: { backgroundColor: Colors.info + "20", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  ownerText: { color: Colors.info, fontSize: 11, fontWeight: "bold" },
  section: { marginBottom: 8 },
  clientNameText: { fontSize: 15, fontWeight: "bold", color: Colors.text, textAlign: "right", marginBottom: 4 },
  noClientText: { fontSize: 13, color: Colors.textMuted, textAlign: "right", fontStyle: "italic", marginBottom: 4 },
  phoneRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  phoneText: { color: Colors.textSecondary, fontSize: 13, flex: 1, textAlign: "right" },
  iconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.background, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  locationRow: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 6, marginBottom: 8 },
  locIcons: { flexDirection: "row-reverse", gap: 4 },
  locationText: { flex: 1, color: Colors.textSecondary, fontSize: 13, textAlign: "right", lineHeight: 18 },
  cardActions: { flexDirection: "row-reverse", gap: 8, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  deleteBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.error + "50", backgroundColor: Colors.error + "10" },
  editBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary + "50", backgroundColor: Colors.primary + "10" },
  actText: { fontSize: 12, fontWeight: "600" },

  loadMoreBtn: { marginTop: 8, padding: 14, alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.primary + "15" },
  loadMoreText: { color: Colors.primary, fontWeight: "bold", fontSize: 14 },

  empty: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: Colors.text, textAlign: "right", marginBottom: 16 },

  choiceRow: { flexDirection: "row-reverse", gap: 10 },
  choiceBtn: { flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, gap: 4 },
  choiceBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  choiceBtnText: { fontSize: 14, fontWeight: "bold", color: Colors.textSecondary },

  formLabel: { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: 6 },
  formInput: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  switchRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12, marginBottom: 12 },
  switchLabel: { color: Colors.text, fontSize: 14 },

  modalBtns: { flexDirection: "row-reverse", gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, padding: 13, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: "bold" },
  nextBtn: { flex: 1, padding: 13, alignItems: "center", borderRadius: 10, backgroundColor: Colors.primary },
  nextBtnText: { color: "#FFF", fontWeight: "bold" },
});
