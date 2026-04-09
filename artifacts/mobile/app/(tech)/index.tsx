import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Modal, TextInput, ActivityIndicator,
  RefreshControl, Image, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";
import { apiGet, apiPatch, apiPost } from "@/utils/api";

/* ─────────────── ثوابت ─────────────── */
const TECH_COLOR = Colors.roles?.tech_engineer ?? "#FF9800";

const REPAIR_TYPE: Record<string, { label: string; color: string }> = {
  hotspot_internal: { label: "إصلاح هوتسبوت داخلي", color: Colors.primary },
  hotspot_external: { label: "إصلاح هوتسبوت خارجي", color: Colors.warning },
  broadband:        { label: "إصلاح برودباند",        color: "#9C27B0" },
  hotspot:          { label: "إصلاح هوتسبوت",         color: Colors.primary },
};

const INSTALL_TYPE: Record<string, string> = {
  hotspot_internal: "تركيب هوتسبوت داخلي",
  hotspot_external: "تركيب هوتسبوت خارجي",
  broadband:        "تركيب برودباند",
  broadband_internal: "تركيب برودباند داخلي",
  external:         "تركيب نقطة بث خارجية",
};

/* ─────────────── النوع الموحّد ─────────────── */
interface Ticket {
  id: string;
  sourceId: number;
  source: "repair" | "install";
  serviceType: string;
  serviceNumber: string | null;
  clientName: string | null;
  clientPhone: string | null;
  location: string | null;
  locationUrl: string | null;
  problemDescription: string | null;
  notes: string | null;
  priority: string | null;
  status: string;
  /* للتركيب فقط */
  subscriptionName: string | null;
  /* نقاط البث */
  hasRelayPoints:   boolean;
  isRelayPoint:     boolean;
  sequenceOrder:    number;
  contractImageUrl: string | null;
  /* مقوي هوتسبوت داخلي */
  hasBooster:             boolean;
  boosterDeviceName:      string | null;
  boosterDeviceSerial:    string | null;
  boosterSubscriptionFee: string | null;
  deviceName:             string | null;
  deviceSerial:           string | null;
  assignedToName:         string | null;
}

/* ─────────────── نوع مجموعة التركيب ─────────────── */
interface InstallGroup {
  parent:    Ticket;
  parentRaw: any;
  relays:    Ticket[];
}

/* ─────────────── المكوّن الرئيسي ─────────────── */
export default function TechEngineerScreen() {
  const insets  = useSafeAreaInsets();
  const { user, token, logout } = useAuth();

  type Section = "new" | "inprogress";
  const [section,     setSection]     = useState<Section>("new");
  const [repairs,     setRepairs]     = useState<any[]>([]);
  const [allInstalls, setAllInstalls] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving,     setSaving]     = useState<string | null>(null); // ticket id being saved

  /* مودال الإتمام */
  const [completeTicket, setCompleteTicket] = useState<Ticket | null>(null);
  const [cStep,         setCStep]         = useState<"photo" | "notes">("photo");
  const [cNotes,        setCNotes]        = useState("");
  const [cPhoto,        setCPhoto]        = useState<string | null>(null);
  const [cPhotoBase64,  setCPhotoBase64]  = useState<string | null>(null);
  const [cSaving,       setCsaving]       = useState(false);

  /* مودال صورة الموقع */
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);

  /* مودال تأكيد إلغاء التنفيذ */
  const [cancelConfirm, setCancelConfirm] = useState<Ticket | null>(null);
  const [cancelling,    setCancelling]    = useState(false);

  /* مودال تأكيد تسجيل الخروج */
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  /* toast */
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const myName = (user?.name ?? "").trim();
  const myId   = user?.id;

  /* هل التذكرة تظهر لهذا المهندس */
  const isVisible = (t: { assignedToId?: any; assignedToName?: string | null }) => {
    if (!t.assignedToId && !t.assignedToName) return true; // للجميع
    if (myId && t.assignedToId && String(t.assignedToId) === String(myId)) return true;
    if (myName && t.assignedToName && t.assignedToName.trim() === myName) return true;
    return false;
  };

  /* ─── جلب البيانات ─── */
  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [r, i] = await Promise.all([
        apiGet("/tickets/repair", token).catch(() => []),
        apiGet("/tickets/installation?techMode=true", token).catch(() => []),
      ]);
      setRepairs(Array.isArray(r) ? r.filter(isVisible) : []);
      setAllInstalls(Array.isArray(i) ? i : []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [token, myName, myId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ─── تحويل للنوع الموحّد ─── */
  const toTicket = (raw: any, source: "repair" | "install"): Ticket => ({
    id:               `${source}-${raw.id}`,
    sourceId:         raw.id,
    source,
    serviceType:      raw.serviceType ?? "",
    serviceNumber:    raw.serviceNumber ?? null,
    clientName:       raw.clientName ?? null,
    clientPhone:      raw.clientPhone ?? null,
    location:         source === "repair" ? (raw.location ?? null) : (raw.address ?? null),
    locationUrl:      raw.locationUrl ?? null,
    problemDescription: raw.problemDescription ?? null,
    notes:            raw.notes ?? null,
    priority:         raw.priority ?? null,
    status:           raw.status ?? "",
    subscriptionName: raw.subscriptionName ?? null,
    hasRelayPoints:   raw.hasRelayPoints ?? false,
    isRelayPoint:     raw.isRelayPoint ?? false,
    sequenceOrder:    raw.sequenceOrder ?? 0,
    contractImageUrl: raw.contractImageUrl ?? null,
    hasBooster:             raw.hasBooster ?? false,
    boosterDeviceName:      raw.boosterDeviceName ?? null,
    boosterDeviceSerial:    raw.boosterDeviceSerial ?? null,
    boosterSubscriptionFee: raw.boosterSubscriptionFee ?? null,
    deviceName:             raw.deviceName ?? null,
    deviceSerial:           raw.deviceSerial ?? null,
    assignedToName:         raw.assignedToName ?? null,
  });

  /* ─── بناء مجموعات التركيب (أب + نقاط بث وسيطة) ─── */
  const newRepairs = repairs.filter(t => ["new","pending","draft"].includes(t.status)).map(t => toTicket(t, "repair"));
  const ipRepairs  = repairs.filter(t => t.status === "in_progress").map(t => toTicket(t, "repair"));

  /* التذاكر الرئيسية في مرحلة التجهيز */
  const mainPreparing = allInstalls.filter(t => !t.isRelayPoint && t.status === "preparing");
  /* نقاط البث المرئية لهذا المهندس بحالة جديدة */
  const myNewRelays   = allInstalls.filter(t => t.isRelayPoint && t.status === "new" && isVisible(t));
  /* in_progress (رئيسية ووسيطة) مرئية لهذا المهندس */
  const ipInstalls    = allInstalls.filter(t => t.status === "in_progress" && isVisible(t)).map(t => toTicket(t, "install"));

  const installGroups: InstallGroup[] = mainPreparing
    .filter(t => isVisible(t) || myNewRelays.some(r => r.parentTicketId === t.id))
    .map(t => ({
      parent:    toTicket(t, "install"),
      parentRaw: t,
      relays:    myNewRelays
        .filter(r => r.parentTicketId === t.id)
        .sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0))
        .map(r => toTicket(r, "install")),
    }))
    .sort((a, b) => new Date(b.parentRaw.createdAt).getTime() - new Date(a.parentRaw.createdAt).getTime());

  const ipItems   = [...ipRepairs, ...ipInstalls];
  const newCount  = newRepairs.length + installGroups.length;
  const ipCount   = ipItems.length;

  /* ─── بدء التنفيذ ─── */
  const startTicket = async (t: Ticket) => {
    setSaving(t.id);
    try {
      if (t.source === "repair") {
        await apiPatch(`/tickets/repair/${t.sourceId}`, token, {
          status: "in_progress",
          assignedToName: myName || undefined,
        });
        setRepairs(prev => prev.map(r => r.id === t.sourceId ? { ...r, status: "in_progress", assignedToName: myName } : r));
      } else {
        /* تركيب أو نقطة بث وسيطة: يستخدم execute — يتحقق من نقاط البث */
        await apiPost(`/tickets/installation/${t.sourceId}/execute`, token, { assignedToName: myName || undefined });
        setAllInstalls(prev => prev.map(r => r.id === t.sourceId ? { ...r, status: "in_progress", assignedToName: myName } : r));
      }
      setSection("inprogress");
      showToast("بدأ التنفيذ");
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("نقاط البث")) {
        showToast("يجب إتمام نقاط البث الوسيطة أولاً");
      } else {
        showToast("فشل بدء التنفيذ");
      }
    }
    finally { setSaving(null); }
  };

  /* ─── إلغاء التنفيذ (إعادة للجديدة) ─── */
  const cancelTicket = async () => {
    const t = cancelConfirm;
    if (!t) return;
    setCancelling(true);
    try {
      /* تحديد الحالة التي ترجع إليها التذكرة */
      const backStatus =
        t.source === "repair"                          ? "new" :
        t.source === "install" && t.isRelayPoint       ? "new" : "preparing";

      const endpoint =
        t.source === "repair"
          ? `/tickets/repair/${t.sourceId}`
          : `/tickets/installation/${t.sourceId}`;

      await apiPatch(endpoint, token, {
        status:         backStatus,
        assignedToName: null,
      });

      /* تحديث الحالة المحلية */
      if (t.source === "repair") {
        setRepairs(prev => prev.map(r =>
          r.id === t.sourceId ? { ...r, status: backStatus, assignedToName: null } : r
        ));
      } else {
        setAllInstalls(prev => prev.map(r =>
          r.id === t.sourceId ? { ...r, status: backStatus, assignedToName: null } : r
        ));
      }

      setCancelConfirm(null);
      setSection("new");
      showToast("تم إلغاء التنفيذ — أُعيدت للجديدة");
    } catch {
      showToast("فشل إلغاء التنفيذ");
    } finally { setCancelling(false); }
  };

  /* ─── فتح مودال الإتمام ─── */
  const openComplete = (t: Ticket) => {
    setCompleteTicket(t);
    setCStep("photo");
    setCNotes("");
    setCPhoto(null);
    setCPhotoBase64(null);
  };

  /* ─── اختيار صورة ─── */
  const pickPhoto = async (fromCamera: boolean) => {
    try {
      let result;
      if (fromCamera) {
        await ImagePicker.requestCameraPermissionsAsync();
        result = await ImagePicker.launchCameraAsync({ quality: 0.3, base64: true });
      } else {
        await ImagePicker.requestMediaLibraryPermissionsAsync();
        result = await ImagePicker.launchImageLibraryAsync({ quality: 0.3, base64: true, mediaTypes: ["images"] as any });
      }
      if (!result.canceled) {
        const asset = result.assets[0];
        setCPhoto(asset.uri);
        setCPhotoBase64(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : null);
      }
    } catch {}
    setCStep("notes");
  };

  /* ─── حفظ الإتمام ─── */
  const saveComplete = async () => {
    if (!completeTicket) return;
    setCsaving(true);
    try {
      if (completeTicket.source === "repair") {
        /* تذاكر الصيانة: PATCH بالحالة والصورة */
        await apiPatch(`/tickets/repair/${completeTicket.sourceId}`, token, {
          status: "completed",
          assignedToName: myName || undefined,
          ...(cNotes ? { notes: cNotes } : {}),
          completionPhotoUrl: cPhotoBase64 || null,
        });
        setRepairs(prev => prev.filter(r => r.id !== completeTicket.sourceId));
      } else if (completeTicket.isRelayPoint) {
        /* نقطة بث وسيطة: archive — يتحقق من الإخوة ويفك القيد عن الأصل */
        await apiPost(`/tickets/installation/${completeTicket.sourceId}/archive`, token, {
          engineerNotes: cNotes || null,
        });
        await fetchAll(true); /* refresh: قد تغيّر hasRelayPoints على الأصل */
      } else {
        /* تذكرة تركيب رئيسية: complete — يحفظ الصورة، لا يكتب في قاعدة الشبكة */
        await apiPost(`/tickets/installation/${completeTicket.sourceId}/complete`, token, {
          engineerNotes: cNotes || null,
          completionPhotoUrl: cPhotoBase64 || null,
        });
        setAllInstalls(prev => prev.filter(t => t.id !== completeTicket.sourceId));
      }
      setCompleteTicket(null);
      setSection("new");
      showToast("تم إنهاء المهمة");
    } catch { showToast("فشل حفظ التنفيذ"); }
    finally { setCsaving(false); }
  };

  /* ─── نسخ الرقم ─── */
  const copyPhone = async (phone: string) => {
    await Clipboard.setStringAsync(phone);
    showToast("تم نسخ الرقم");
  };

  /* ─── نسخ رابط الموقع ─── */
  const copyMapUrl = async (url: string) => {
    await Clipboard.setStringAsync(url);
    showToast("تم نسخ رابط الموقع");
  };

  /* ─── فتح الموقع في خرائط جوجل مع دبوس ─── */
  const openMap = async (rawUrl: string) => {
    /* 1) استخرج الإحداثيات إذا وجدت في الرابط (مثل @24.123,46.456) */
    const coordMatch = rawUrl.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    /* 2) أو إحداثيات في قائمة نص مثل "24.123,46.456" */
    const plainCoord = rawUrl.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);

    let mapsUrl: string;

    if (coordMatch) {
      const lat = coordMatch[1];
      const lng = coordMatch[2];
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    } else if (plainCoord) {
      const lat = plainCoord[1];
      const lng = plainCoord[2];
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    } else if (rawUrl.startsWith("http")) {
      /* رابط جاهز — نفتحه مباشرة (goo.gl أو maps.app.goo.gl) */
      mapsUrl = rawUrl;
    } else {
      /* نصّ موقع — ابحث عنه */
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawUrl)}`;
    }

    const canOpen = await Linking.canOpenURL(mapsUrl);
    if (canOpen) {
      Linking.openURL(mapsUrl);
    } else {
      /* fallback: افتح في المتصفح */
      Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(rawUrl)}`);
    }
  };

  /* ─── toast ─── */
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  };

  /* ─── Loading ─── */
  if (loading) return (
    <View style={[s.container, { justifyContent: "center", alignItems: "center", paddingTop: insets.top }]}>
      <ActivityIndicator size="large" color={TECH_COLOR} />
    </View>
  );

  return (
    <View style={[s.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>

      {/* ══ رأس الصفحة ══ */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => fetchAll(true)} style={s.refreshBtn}>
          <Ionicons name="refresh" size={20} color={TECH_COLOR} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={s.headerName}>{user?.name ?? "المهندس الفني"}</Text>
          <Text style={s.headerSub}>المهندس الفني</Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={() => setLogoutConfirm(true)} activeOpacity={0.75}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
        </TouchableOpacity>
      </View>

      {/* ══ ملخص سريع ══ */}
      <View style={s.summaryRow}>
        <SummaryPill label="جديدة" count={newCount}  color="#2196F3" active={section === "new"}        onPress={() => setSection("new")} />
        <SummaryPill label="جاري"  count={ipCount}   color={TECH_COLOR} active={section === "inprogress"} onPress={() => setSection("inprogress")} />
      </View>

      {/* ══ عنوان القسم ══ */}
      <View style={[s.sectionHeader, { borderLeftColor: section === "new" ? "#2196F3" : TECH_COLOR }]}>
        <Ionicons
          name={section === "new" ? "list-circle-outline" : "hammer-outline"}
          size={18}
          color={section === "new" ? "#2196F3" : TECH_COLOR}
        />
        <Text style={[s.sectionTitle, { color: section === "new" ? "#2196F3" : TECH_COLOR }]}>
          {section === "new" ? "تذاكر جديدة" : "تذاكر قيد التنفيذ"}
        </Text>
        <Text style={s.sectionCount}>{section === "new" ? newCount : ipCount}</Text>
      </View>

      {/* ══ قائمة التذاكر ══ */}
      <ScrollView
        contentContainerStyle={s.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchAll(true); }}
            tintColor={TECH_COLOR}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {section === "new" ? (
          <>
            {/* تذاكر الإصلاح الجديدة */}
            {newRepairs.map(ticket => (
              <RepairCard
                key={ticket.id}
                ticket={ticket}
                section="new"
                saving={saving === ticket.id}
                onStart={() => startTicket(ticket)}
                onComplete={() => openComplete(ticket)}
                onCopy={copyPhone}
                onOpenMap={openMap}
                onCopyMap={copyMapUrl}
                onViewImage={setViewImageUrl}
              />
            ))}
            {/* مجموعات التركيب (أب + نقاط بث وسيطة) */}
            {installGroups.map(group => (
              <InstallGroupView
                key={group.parent.id}
                group={group}
                saving={saving}
                onStartParent={startTicket}
                onStartRelay={startTicket}
                onComplete={openComplete}
                onCopy={copyPhone}
                onOpenMap={openMap}
                onCopyMap={copyMapUrl}
                onViewImage={setViewImageUrl}
              />
            ))}
            {newCount === 0 && (
              <View style={s.emptyBox}>
                <Ionicons name="checkmark-circle-outline" size={56} color={Colors.textMuted} />
                <Text style={s.emptyTitle}>لا توجد تذاكر جديدة</Text>
                <Text style={s.emptyHint}>ستظهر هنا التذاكر المخصصة لك أو للجميع</Text>
              </View>
            )}
          </>
        ) : (
          <>
            {ipItems.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="hourglass-outline" size={56} color={Colors.textMuted} />
                <Text style={s.emptyTitle}>لا توجد تذاكر قيد التنفيذ</Text>
                <Text style={s.emptyHint}>ابدأ تنفيذ تذكرة من قسم الجديدة</Text>
              </View>
            ) : (
              ipItems.map(ticket =>
                ticket.source === "repair" ? (
                  <RepairCard
                    key={ticket.id}
                    ticket={ticket}
                    section="inprogress"
                    saving={saving === ticket.id}
                    onStart={() => startTicket(ticket)}
                    onComplete={() => openComplete(ticket)}
                    onCancel={() => setCancelConfirm(ticket)}
                    onCopy={copyPhone}
                    onOpenMap={openMap}
                    onCopyMap={copyMapUrl}
                    onViewImage={setViewImageUrl}
                  />
                ) : (
                  <InstallCard
                    key={ticket.id}
                    ticket={ticket}
                    section="inprogress"
                    saving={saving === ticket.id}
                    onStart={() => startTicket(ticket)}
                    onComplete={() => openComplete(ticket)}
                    onCancel={() => setCancelConfirm(ticket)}
                    onCopy={copyPhone}
                    onOpenMap={openMap}
                    onCopyMap={copyMapUrl}
                    onViewImage={setViewImageUrl}
                  />
                )
              )
            )}
          </>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ══════════════════════════════════════════
          مودال الإتمام
      ══════════════════════════════════════════ */}
      <Modal visible={!!completeTicket} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>

            {cStep === "photo" ? (
              /* ── مرحلة الصورة ── */
              <>
                <View style={s.cameraIconBox}>
                  <Ionicons name="camera" size={44} color={TECH_COLOR} />
                </View>
                <Text style={s.modalTitle}>هل تريد إرفاق صورة توثيقاً للعمل؟</Text>

                <TouchableOpacity style={[s.photoBtn, { backgroundColor: TECH_COLOR }]} onPress={() => pickPhoto(true)}>
                  <Ionicons name="camera-outline" size={18} color="#fff" />
                  <Text style={s.photoBtnText}>التقاط صورة</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[s.photoBtn, { backgroundColor: Colors.primary }]} onPress={() => pickPhoto(false)}>
                  <Ionicons name="images-outline" size={18} color="#fff" />
                  <Text style={s.photoBtnText}>اختيار من المعرض</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.skipBtn} onPress={() => setCStep("notes")}>
                  <Text style={s.skipBtnText}>تخطي — بدون صورة</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setCompleteTicket(null)}>
                  <Text style={s.cancelLink}>إلغاء</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* ── مرحلة الملاحظات ── */
              <>
                <Text style={s.modalTitle}>ملاحظات التنفيذ</Text>

                {cPhoto && (
                  <View style={s.photoPreviewBox}>
                    <Image source={{ uri: cPhoto }} style={s.photoPreview} resizeMode="cover" />
                    <TouchableOpacity style={s.removePhoto} onPress={() => setCPhoto(null)}>
                      <Ionicons name="close-circle" size={22} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                )}

                <TextInput
                  style={s.notesInput}
                  multiline
                  numberOfLines={4}
                  placeholder="اكتب ملاحظاتك هنا (اختياري)..."
                  placeholderTextColor={Colors.textMuted}
                  value={cNotes}
                  onChangeText={setCNotes}
                  textAlignVertical="top"
                  textAlign="right"
                />

                <TouchableOpacity
                  style={[s.confirmBtn, cSaving && { opacity: 0.6 }]}
                  onPress={saveComplete}
                  disabled={cSaving}
                >
                  {cSaving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <>
                        <Ionicons name="checkmark-done" size={18} color="#fff" />
                        <Text style={s.confirmBtnText}>تأكيد إنهاء المهمة</Text>
                      </>
                  }
                </TouchableOpacity>

                <TouchableOpacity style={s.backBtn} onPress={() => setCStep("photo")} disabled={cSaving}>
                  <Text style={s.backBtnText}>رجوع</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ══ Toast ══ */}
      {!!toast && (
        <View style={s.toast}>
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}

      {/* ══ مودال تأكيد تسجيل الخروج ══ */}
      <Modal visible={logoutConfirm} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.modalBox, { paddingTop: 24 }]}>
            <View style={{ width: 62, height: 62, borderRadius: 31,
              backgroundColor: Colors.error + "18", justifyContent: "center", alignItems: "center", marginBottom: 6 }}>
              <Ionicons name="log-out-outline" size={36} color={Colors.error} />
            </View>
            <Text style={[s.modalTitle, { color: Colors.text }]}>تسجيل الخروج؟</Text>
            <Text style={{ color: Colors.textSecondary, textAlign: "center", fontSize: 13, lineHeight: 20, marginBottom: 4 }}>
              هل تريد الخروج والعودة لصفحة تسجيل الدخول؟
            </Text>
            <View style={{ flexDirection: "row-reverse", gap: 10, width: "100%", marginTop: 8 }}>
              <TouchableOpacity
                style={[s.confirmBtn, { backgroundColor: Colors.error, flex: 1 }]}
                onPress={() => { setLogoutConfirm(false); logout(); }}
              >
                <Ionicons name="log-out-outline" size={16} color="#fff" />
                <Text style={s.confirmBtnText}>نعم، خروج</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.backBtn, { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, marginTop: 0 }]}
                onPress={() => setLogoutConfirm(false)}
              >
                <Text style={s.backBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ مودال تأكيد إلغاء التنفيذ ══ */}
      <Modal visible={!!cancelConfirm} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.modalBox, { paddingTop: 24 }]}>
            <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: Colors.error + "20",
              justifyContent: "center", alignItems: "center", marginBottom: 6 }}>
              <Ionicons name="arrow-undo-circle" size={38} color={Colors.error} />
            </View>
            <Text style={[s.modalTitle, { color: Colors.text }]}>إلغاء التنفيذ؟</Text>
            <Text style={{ color: Colors.textSecondary, textAlign: "center", fontSize: 13, lineHeight: 20, marginBottom: 4 }}>
              سيتم إعادة التذكرة{"\n"}
              <Text style={{ fontWeight: "700", color: Colors.text }}>
                {cancelConfirm
                  ? (cancelConfirm.source === "repair"
                      ? `إصلاح #${cancelConfirm.sourceId}`
                      : `تركيب #${cancelConfirm.sourceId}`)
                  : ""}
              </Text>
              {"\n"}إلى قسم الجديدة لكي يستلمها مهندس آخر
            </Text>

            <View style={{ flexDirection: "row-reverse", gap: 10, width: "100%", marginTop: 8 }}>
              <TouchableOpacity
                style={[s.confirmBtn, { backgroundColor: Colors.error, flex: 1 }]}
                onPress={cancelTicket}
                disabled={cancelling}
              >
                {cancelling
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <>
                      <Ionicons name="arrow-undo" size={16} color="#fff" />
                      <Text style={s.confirmBtnText}>نعم، إلغاء التنفيذ</Text>
                    </>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.backBtn, { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, marginTop: 0 }]}
                onPress={() => setCancelConfirm(null)}
                disabled={cancelling}
              >
                <Text style={s.backBtnText}>لا، تراجع</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ مودال عرض صورة الموقع ══ */}
      <Modal visible={!!viewImageUrl} transparent animationType="fade" onRequestClose={() => setViewImageUrl(null)}>
        <View style={imgModal.overlay}>
          <TouchableOpacity style={imgModal.closeArea} onPress={() => setViewImageUrl(null)} activeOpacity={1}>
            <View style={imgModal.card}>
              <View style={imgModal.header}>
                <Text style={imgModal.title}>صورة الموقع</Text>
                <TouchableOpacity onPress={() => setViewImageUrl(null)}>
                  <Ionicons name="close-circle" size={26} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {viewImageUrl && (
                <Image
                  source={{ uri: viewImageUrl }}
                  style={imgModal.image}
                  resizeMode="contain"
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

/* ════════════════════════════════════════════════
   بطاقة الإصلاح
════════════════════════════════════════════════ */
function RepairCard({ ticket, section, saving, onStart, onComplete, onCancel, onCopy, onOpenMap, onCopyMap, onViewImage }: {
  ticket: Ticket;
  section: "new" | "inprogress";
  saving: boolean;
  onStart: () => void;
  onComplete: () => void;
  onCancel?: () => void;
  onCopy: (p: string) => void;
  onOpenMap: (url: string) => void;
  onCopyMap: (url: string) => void;
  onViewImage: (url: string) => void;
}) {
  const isExternal = ticket.serviceType === "hotspot_external";
  const typeInfo   = REPAIR_TYPE[ticket.serviceType] ?? { label: `إصلاح ${ticket.serviceType}`, color: Colors.error };
  const hasPhone   = !!ticket.clientPhone && !isExternal;
  const hasMap     = !!ticket.locationUrl;
  const hasImage   = !!ticket.contractImageUrl;

  return (
    <View style={c.card}>
      {/* رأس البطاقة */}
      <View style={c.cardHead}>
        <Text style={c.cardNum}>#{ticket.sourceId}</Text>
        {ticket.serviceNumber && (
          <Text style={c.serviceNum}>{ticket.serviceNumber}</Text>
        )}
        <View style={[c.typeBadge, { backgroundColor: typeInfo.color + "22" }]}>
          <Text style={[c.typeBadgeText, { color: typeInfo.color }]}>{typeInfo.label}</Text>
        </View>
        <View style={[c.statusDot, { backgroundColor: section === "new" ? "#2196F3" : Colors.warning }]} />
      </View>

      <View style={c.divider} />

      {/* اسم العميل */}
      {!isExternal && ticket.clientName && (
        <View style={c.row}>
          <Ionicons name="person-outline" size={15} color={Colors.textSecondary} />
          <Text style={c.rowText}>{ticket.clientName}</Text>
        </View>
      )}

      {/* رقم الجوال + نسخ */}
      {!isExternal && ticket.clientPhone && (
        <View style={c.row}>
          <Ionicons name="call-outline" size={15} color={Colors.success} />
          <Text style={[c.rowText, { color: Colors.success, flex: 1 }]}>{ticket.clientPhone}</Text>
          <TouchableOpacity onPress={() => onCopy(ticket.clientPhone!)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="copy-outline" size={15} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* الموقع + نسخ فقط (بدون أيقونة التوجيه) */}
      {ticket.location && (
        <View style={c.row}>
          <Ionicons name="location-outline" size={15} color={Colors.textSecondary} />
          <Text style={[c.rowText, { flex: 1 }]}>{ticket.location}</Text>
          {hasMap && (
            <TouchableOpacity
              onPress={() => onCopyMap(ticket.locationUrl!)}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              style={c.mapIconBtn}
            >
              <Ionicons name="copy-outline" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* إذا لا يوجد وصف موقع نصي ولكن يوجد رابط خريطة فقط */}
      {!ticket.location && hasMap && (
        <View style={c.row}>
          <Ionicons name="location-outline" size={15} color={Colors.info} />
          <TouchableOpacity onPress={() => onOpenMap(ticket.locationUrl!)} style={{ flex: 1 }}>
            <Text style={[c.rowText, { color: Colors.info, flex: 1 }]}>فتح الموقع في خرائط جوجل</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onCopyMap(ticket.locationUrl!)}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={c.mapIconBtn}
          >
            <Ionicons name="copy-outline" size={15} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* وصف المشكلة */}
      {ticket.problemDescription && (
        <View style={c.problemBox}>
          <Text style={c.problemLabel}>المشكلة:</Text>
          <Text style={c.problemText}>{ticket.problemDescription}</Text>
        </View>
      )}

      {ticket.notes && (
        <View style={c.notesBox}>
          <Ionicons name="document-text-outline" size={13} color={Colors.textMuted} />
          <Text style={c.notesText}>{ticket.notes}</Text>
        </View>
      )}

      {/* الأزرار */}
      <View style={c.btnRow}>
        {section === "new" ? (
          <ActionBtn label="بدء التنفيذ" icon="play-circle" color="#2196F3" loading={saving} onPress={onStart} flex={2} />
        ) : (
          <ActionBtn label="تم التنفيذ" icon="checkmark-done-circle" color={Colors.success} loading={saving} onPress={onComplete} flex={2} />
        )}
        {hasPhone && (
          <ActionBtn label="اتصال" icon="call" color={Colors.success} onPress={() => Linking.openURL(`tel:${ticket.clientPhone}`)} flex={1} />
        )}
        {hasMap && (
          <ActionBtn label="خريطة" icon="map" color={Colors.info} onPress={() => onOpenMap(ticket.locationUrl!)} flex={1} />
        )}
        {hasImage && (
          <ActionBtn label="صورة" icon="image" color="#9C27B0" onPress={() => onViewImage(ticket.contractImageUrl!)} flex={1} />
        )}
      </View>

      {/* زر إلغاء التنفيذ — للتبويب الجاري فقط */}
      {section === "inprogress" && onCancel && (
        <TouchableOpacity style={c.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
          <Ionicons name="arrow-undo" size={14} color={Colors.error} />
          <Text style={c.cancelBtnTxt}>إلغاء التنفيذ — إعادة للجديدة</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ════════════════════════════════════════════════
   بطاقة التركيب
════════════════════════════════════════════════ */
function InstallCard({ ticket, section, saving, onStart, onComplete, onCancel, onCopy, onOpenMap, onCopyMap, onViewImage }: {
  ticket: Ticket;
  section: "new" | "inprogress";
  saving: boolean;
  onStart: () => void;
  onComplete: () => void;
  onCancel?: () => void;
  onCopy: (p: string) => void;
  onOpenMap: (url: string) => void;
  onCopyMap: (url: string) => void;
  onViewImage: (url: string) => void;
}) {
  const typeLabel   = INSTALL_TYPE[ticket.serviceType] ?? `تركيب ${ticket.serviceType}`;
  const hasPhone    = !!ticket.clientPhone;
  const hasMap      = !!ticket.locationUrl;
  const hasImage    = !!ticket.contractImageUrl;
  /* مقيّد: التذكرة الرئيسية مع نقاط بث لم تكتمل بعد */
  const isBlocked   = ticket.hasRelayPoints && ticket.status === "preparing";
  const boosterColor = "#4CAF50";

  const cardBorderColor = ticket.isRelayPoint ? "#9C27B0" : Colors.success;

  return (
    <View style={[c.card, { borderLeftColor: cardBorderColor }]}>
      {/* رأس البطاقة */}
      <View style={c.cardHead}>
        <Text style={c.cardNum}>#{ticket.sourceId}</Text>
        {ticket.serviceNumber && (
          <Text style={c.serviceNum}>{ticket.serviceNumber}</Text>
        )}
        <View style={[c.typeBadge, { backgroundColor: cardBorderColor + "22" }]}>
          <Text style={[c.typeBadgeText, { color: cardBorderColor }]}>{typeLabel}</Text>
        </View>
        {ticket.hasBooster && (
          <View style={ic2.boosterPill}>
            <Ionicons name="hardware-chip" size={11} color={boosterColor} />
            <Text style={ic2.boosterPillText}>+ هوتسبوت</Text>
          </View>
        )}
        <View style={[c.statusDot, { backgroundColor: section === "new" ? "#2196F3" : Colors.warning }]} />
      </View>

      {/* شارة نقطة البث مع رقم الترتيب */}
      {ticket.isRelayPoint && (
        <View style={ic2.relayBadge}>
          <Ionicons name="git-network-outline" size={13} color="#9C27B0" />
          <Text style={ic2.relayText}>نقطة البث رقم {ticket.sequenceOrder}</Text>
        </View>
      )}

      {/* تنبيه القيد على التذكرة الرئيسية */}
      {isBlocked && (
        <View style={ic2.blockedBox}>
          <Ionicons name="lock-closed" size={14} color="#FF9800" />
          <Text style={ic2.blockedText}>يجب إتمام نقاط البث الخارجية أولاً قبل بدء التنفيذ</Text>
        </View>
      )}

      <View style={c.divider} />

      {ticket.clientName && (
        <View style={c.row}>
          <Ionicons name="person-outline" size={15} color={Colors.textSecondary} />
          <Text style={c.rowText}>{ticket.clientName}</Text>
        </View>
      )}

      {ticket.clientPhone && (
        <View style={c.row}>
          <Ionicons name="call-outline" size={15} color={Colors.success} />
          <Text style={[c.rowText, { color: Colors.success, flex: 1 }]}>{ticket.clientPhone}</Text>
          <TouchableOpacity onPress={() => onCopy(ticket.clientPhone!)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="copy-outline" size={15} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* الموقع + نسخ فقط (بدون أيقونة التوجيه) */}
      {ticket.location && (
        <View style={c.row}>
          <Ionicons name="location-outline" size={15} color={Colors.textSecondary} />
          <Text style={[c.rowText, { flex: 1 }]}>{ticket.location}</Text>
          {hasMap && (
            <TouchableOpacity
              onPress={() => onCopyMap(ticket.locationUrl!)}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              style={c.mapIconBtn}
            >
              <Ionicons name="copy-outline" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* إذا لا يوجد وصف موقع نصي ولكن يوجد رابط خريطة فقط */}
      {!ticket.location && hasMap && (
        <View style={c.row}>
          <Ionicons name="location-outline" size={15} color={Colors.info} />
          <TouchableOpacity onPress={() => onOpenMap(ticket.locationUrl!)} style={{ flex: 1 }}>
            <Text style={[c.rowText, { color: Colors.info }]}>فتح الموقع في خرائط جوجل</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onCopyMap(ticket.locationUrl!)}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={c.mapIconBtn}
          >
            <Ionicons name="copy-outline" size={15} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {ticket.subscriptionName && (
        <View style={c.row}>
          <Ionicons name="wifi-outline" size={15} color={Colors.info} />
          <Text style={c.rowText}>{ticket.subscriptionName}</Text>
        </View>
      )}

      {/* اسم جهاز البرودباند */}
      {ticket.deviceName && (
        <View style={[c.row, { backgroundColor: Colors.primary + "10", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 }]}>
          <Ionicons name="globe-outline" size={15} color={Colors.primary} />
          <Text style={[c.rowText, { color: Colors.primary, fontWeight: "bold" }]}>
            {ticket.hasBooster ? "برودباند: " : ""}{ticket.deviceName}{ticket.deviceSerial ? ` — ${ticket.deviceSerial}` : ""}
          </Text>
        </View>
      )}

      {/* بيانات المقوي الداخلي هوتسبوت */}
      {ticket.hasBooster && (
        <View style={ic2.boosterBox}>
          <View style={ic2.boosterBoxHeader}>
            <Ionicons name="hardware-chip" size={13} color={boosterColor} />
            <Text style={ic2.boosterBoxTitle}>مقوي داخلي هوتسبوت</Text>
          </View>
          {ticket.boosterDeviceName && (
            <View style={c.row}>
              <Ionicons name="wifi-outline" size={13} color={boosterColor} />
              <Text style={[c.rowText, { color: boosterColor, fontWeight: "600", fontSize: 13 }]}>
                {ticket.boosterDeviceName}{ticket.boosterDeviceSerial ? ` — ${ticket.boosterDeviceSerial}` : ""}
              </Text>
            </View>
          )}
          {ticket.boosterSubscriptionFee ? (
            <View style={c.row}>
              <Ionicons name="cash-outline" size={13} color={Colors.success} />
              <Text style={[c.rowText, { fontSize: 13 }]}>اشتراك المقوي: {ticket.boosterSubscriptionFee} ريال</Text>
            </View>
          ) : (
            <View style={c.row}>
              <Ionicons name="information-circle-outline" size={13} color={Colors.textMuted} />
              <Text style={[c.rowText, { color: Colors.textMuted, fontSize: 12 }]}>اشتراك المقوي: لم يُدفع بعد</Text>
            </View>
          )}
        </View>
      )}

      {ticket.notes && (
        <View style={c.problemBox}>
          <Text style={c.problemLabel}>ملاحظات:</Text>
          <Text style={c.problemText}>{ticket.notes}</Text>
        </View>
      )}

      {/* الأزرار */}
      <View style={c.btnRow}>
        {/* زر بدء التنفيذ — معطَّل (رمادي) إذا كانت التذكرة مقيّدة بنقاط بث */}
        {section === "new" && isBlocked && (
          <View style={[ab.btn, { flex: 2, backgroundColor: Colors.surfaceElevated, borderColor: Colors.border }]}>
            <Ionicons name="lock-closed" size={16} color={Colors.textMuted} />
            <Text style={[ab.label, { color: Colors.textMuted }]}>بدء التنفيذ</Text>
          </View>
        )}
        {section === "new" && !isBlocked && (
          <ActionBtn label="بدء التنفيذ" icon="play-circle" color="#2196F3" loading={saving} onPress={onStart} flex={2} />
        )}
        {section === "inprogress" && (
          <ActionBtn label="تم التنفيذ" icon="checkmark-done-circle" color={Colors.success} loading={saving} onPress={onComplete} flex={2} />
        )}

        {hasPhone && (
          <ActionBtn label="اتصال" icon="call" color={Colors.success} onPress={() => Linking.openURL(`tel:${ticket.clientPhone}`)} flex={1} />
        )}
        {hasMap && (
          <ActionBtn label="خريطة" icon="map" color={Colors.info} onPress={() => onOpenMap(ticket.locationUrl!)} flex={1} />
        )}
        {hasImage && (
          <ActionBtn label="صورة الموقع" icon="image" color="#9C27B0" onPress={() => onViewImage(ticket.contractImageUrl!)} flex={hasMap ? 1 : 2} />
        )}
      </View>

      {/* زر إلغاء التنفيذ — للتبويب الجاري فقط */}
      {section === "inprogress" && onCancel && (
        <TouchableOpacity style={c.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
          <Ionicons name="arrow-undo" size={14} color={Colors.error} />
          <Text style={c.cancelBtnTxt}>إلغاء التنفيذ — إعادة للجديدة</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ════════════════════════════════════════════════
   مكوّنات مساعدة
════════════════════════════════════════════════ */
function SummaryPill({ label, count, color, active, onPress }: {
  label: string; count: number; color: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[sp.pill, active && { backgroundColor: color + "22", borderColor: color }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[sp.badge, { backgroundColor: color }]}>
        <Text style={sp.badgeNum}>{count}</Text>
      </View>
      <Text style={[sp.label, active && { color, fontWeight: "bold" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActionBtn({ label, icon, color, loading, onPress, flex = 1 }: {
  label: string; icon: string; color: string;
  loading?: boolean; onPress: () => void; flex?: number;
}) {
  return (
    <TouchableOpacity
      style={[ab.btn, { flex, backgroundColor: color + "18", borderColor: color }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.75}
    >
      {loading
        ? <ActivityIndicator size="small" color={color} />
        : <>
            <Ionicons name={icon as any} size={16} color={color} />
            <Text style={[ab.label, { color }]}>{label}</Text>
          </>
      }
    </TouchableOpacity>
  );
}

/* ════════════════════════════════════════════════
   مجموعة تذكرة التركيب (أب + نقاط بث وسيطة)
════════════════════════════════════════════════ */
function InstallGroupView({ group, saving, onStartParent, onStartRelay, onComplete, onCopy, onOpenMap, onCopyMap, onViewImage }: {
  group: InstallGroup;
  saving: string | null;
  onStartParent: (t: Ticket) => void;
  onStartRelay:  (t: Ticket) => void;
  onComplete:    (t: Ticket) => void;
  onCopy:     (p: string) => void;
  onOpenMap:  (url: string) => void;
  onCopyMap:  (url: string) => void;
  onViewImage:(url: string) => void;
}) {
  return (
    <View style={tg.group}>
      {/* البطاقة الرئيسية (الأب) */}
      <InstallCard
        ticket={group.parent}
        section="new"
        saving={saving === group.parent.id}
        onStart={() => onStartParent(group.parent)}
        onComplete={() => onComplete(group.parent)}
        onCopy={onCopy}
        onOpenMap={onOpenMap}
        onCopyMap={onCopyMap}
        onViewImage={onViewImage}
      />

      {/* قائمة نقاط البث الوسيطة */}
      {group.relays.length > 0 && (
        <View style={tg.relayList}>
          <View style={tg.relayHeader}>
            <Ionicons name="git-network-outline" size={13} color="#9C27B0" />
            <Text style={tg.relayHeaderText}>نقاط البث الوسيطة ({group.relays.length})</Text>
          </View>
          {group.relays.map(relay => (
            <RelaySubCard
              key={relay.id}
              ticket={relay}
              saving={saving === relay.id}
              onStart={() => onStartRelay(relay)}
              onCopy={onCopy}
              onOpenMap={onOpenMap}
              onCopyMap={onCopyMap}
              onViewImage={onViewImage}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/* ════════════════════════════════════════════════
   بطاقة نقطة البث الوسيطة (مدمجة تحت الأب)
════════════════════════════════════════════════ */
function RelaySubCard({ ticket, saving, onStart, onCopy, onOpenMap, onCopyMap, onViewImage }: {
  ticket: Ticket;
  saving: boolean;
  onStart:    () => void;
  onCopy:     (p: string) => void;
  onOpenMap:  (url: string) => void;
  onCopyMap:  (url: string) => void;
  onViewImage:(url: string) => void;
}) {
  const hasMap   = !!ticket.locationUrl;
  const hasPhone = !!ticket.clientPhone;
  const hasImage = !!ticket.contractImageUrl;

  return (
    <View style={rs.card}>
      {/* رأس البطاقة: رقم التسلسل + العنوان */}
      <View style={rs.head}>
        <View style={rs.seqBadge}>
          <Text style={rs.seqNum}>{ticket.sequenceOrder}</Text>
        </View>
        <Ionicons name="git-network-outline" size={14} color="#9C27B0" />
        <Text style={rs.title}>نقطة البث الوسيطة</Text>
        {ticket.assignedToName && (
          <View style={rs.assignedBadge}>
            <Ionicons name="person-circle" size={12} color={Colors.primary} />
            <Text style={rs.assignedText} numberOfLines={1}>{ticket.assignedToName}</Text>
          </View>
        )}
      </View>

      {/* الموقع */}
      {(ticket.location || hasMap) && (
        <View style={rs.row}>
          <Ionicons name="location-outline" size={13} color={Colors.textSecondary} />
          <Text style={rs.rowText} numberOfLines={1}>{ticket.location ?? "رابط موقع"}</Text>
          {hasMap && (
            <TouchableOpacity
              onPress={() => onCopyMap(ticket.locationUrl!)}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <Ionicons name="copy-outline" size={13} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* الملاحظات */}
      {ticket.notes && (
        <Text style={rs.notes} numberOfLines={2}>{ticket.notes}</Text>
      )}

      {/* أزرار */}
      <View style={rs.btnRow}>
        <ActionBtn label="بدء التنفيذ" icon="play-circle" color="#9C27B0" loading={saving} onPress={onStart} flex={2} />
        {hasPhone && (
          <ActionBtn label="اتصال" icon="call" color={Colors.success} onPress={() => Linking.openURL(`tel:${ticket.clientPhone}`)} flex={1} />
        )}
        {hasMap && (
          <ActionBtn label="خريطة" icon="map" color={Colors.info} onPress={() => onOpenMap(ticket.locationUrl!)} flex={1} />
        )}
        {hasImage && (
          <ActionBtn label="صورة" icon="image" color={Colors.primary} onPress={() => onViewImage(ticket.contractImageUrl!)} flex={1} />
        )}
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════
   الأنماط
════════════════════════════════════════════════ */
const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.background },

  /* رأس الصفحة */
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  refreshBtn:  { padding: 6 },
  headerName:  { fontSize: 17, fontWeight: "bold", color: Colors.text, textAlign: "center" },
  headerSub:   { fontSize: 12, color: Colors.textMuted, textAlign: "center" },
  onlineDot:   { width: 10, height: 10, borderRadius: 5 },
  logoutBtn:   { padding: 6, borderRadius: 8, backgroundColor: Colors.error + "15" },

  /* ملخص سريع */
  summaryRow: { flexDirection: "row-reverse", paddingHorizontal: 14, paddingVertical: 10, gap: 10 },

  /* عنوان القسم */
  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderLeftWidth: 4,
    marginHorizontal: 14,
    borderRadius: 4,
    backgroundColor: Colors.surface,
    marginBottom: 8,
    gap: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: "bold", flex: 1, textAlign: "right" },
  sectionCount: {
    fontSize: 12, color: Colors.textMuted,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8,
  },

  /* قائمة */
  listContent: { paddingHorizontal: 14, paddingTop: 4 },
  emptyBox: { alignItems: "center", marginTop: 60, gap: 12, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: "bold", color: Colors.textSecondary, textAlign: "center" },
  emptyHint:  { fontSize: 13, color: Colors.textMuted, textAlign: "center", lineHeight: 20 },

  /* مودال */
  overlay: { flex: 1, backgroundColor: "#000000BB", justifyContent: "flex-end" },
  modalBox: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 12,
  },
  cameraIconBox: {
    alignSelf: "center",
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: TECH_COLOR + "18",
    alignItems: "center", justifyContent: "center",
  },
  modalTitle: { fontSize: 17, fontWeight: "bold", color: Colors.text, textAlign: "center" },
  photoBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  photoBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  skipBtn: { paddingVertical: 10, alignItems: "center" },
  skipBtnText: { fontSize: 14, color: Colors.textSecondary, textDecorationLine: "underline" },
  cancelLink: { textAlign: "center", color: Colors.textMuted, fontSize: 13, paddingVertical: 8 },

  photoPreviewBox: { alignSelf: "center", borderRadius: 10, overflow: "hidden", position: "relative" },
  photoPreview:    { width: 180, height: 120, borderRadius: 10 },
  removePhoto: {
    position: "absolute", top: 4, right: 4,
    backgroundColor: Colors.surface, borderRadius: 12,
  },

  notesInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    fontSize: 14,
    color: Colors.text,
    minHeight: 90,
  },
  confirmBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.success,
    paddingVertical: 14,
    borderRadius: 14,
  },
  confirmBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  backBtn: { alignItems: "center", paddingVertical: 8 },
  backBtnText: { color: Colors.textMuted, fontSize: 14 },

  /* Toast */
  toast: {
    position: "absolute", bottom: 50, alignSelf: "center",
    backgroundColor: "#1a1a2e",
    paddingHorizontal: 22, paddingVertical: 10,
    borderRadius: 20, elevation: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4,
  },
  toastText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});

/* بطاقة */
const c = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
    marginBottom: 12,
    padding: 14,
    gap: 8,
  },
  cardHead: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  cardNum: { fontSize: 13, fontWeight: "bold", color: Colors.textMuted },
  serviceNum: { fontSize: 14, fontWeight: "bold", color: Colors.primary },
  typeBadge: { flex: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeBadgeText: { fontSize: 12, fontWeight: "bold", textAlign: "center" },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  divider: { height: 1, backgroundColor: Colors.border },

  row: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  rowText: { fontSize: 14, color: Colors.text, flex: 1, textAlign: "right" },

  problemBox: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10, padding: 10, gap: 4,
  },
  problemLabel: { fontSize: 12, color: Colors.textMuted, textAlign: "right", fontWeight: "600" },
  problemText: { fontSize: 13, color: Colors.text, textAlign: "right" },

  notesBox: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 6 },
  notesText: { fontSize: 12, color: Colors.textSecondary, flex: 1, textAlign: "right", fontStyle: "italic" },

  mapIconBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center", justifyContent: "center",
    marginRight: 2,
  },

  btnRow: { flexDirection: "row-reverse", gap: 8, marginTop: 4 },

  /* زر إلغاء التنفيذ */
  cancelBtn: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 6, marginTop: 4, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.error + "50",
    backgroundColor: Colors.error + "0D",
  },
  cancelBtnTxt: { fontSize: 12, fontWeight: "700", color: Colors.error },
});

/* SummaryPill */
const sp = StyleSheet.create({
  pill: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  badge: { minWidth: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  badgeNum: { fontSize: 16, fontWeight: "bold", color: "#fff" },
  label: { fontSize: 14, color: Colors.textSecondary, fontWeight: "600" },
});

/* ActionBtn */
const ab = StyleSheet.create({
  btn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    minHeight: 42,
  },
  label: { fontSize: 12, fontWeight: "bold" },
});

/* شارات نقطة البث وقيد التنفيذ */
const ic2 = StyleSheet.create({
  relayBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#9C27B022",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-end",
  },
  relayText: { fontSize: 12, fontWeight: "bold", color: "#9C27B0" },

  blockedBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FF980018",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FF980044",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  blockedText: { fontSize: 12, color: "#FF9800", flex: 1, textAlign: "right" },

  boosterBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#4CAF5022",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-end",
  },
  boosterText: { fontSize: 12, fontWeight: "bold", color: "#4CAF50", flex: 1, textAlign: "right" },

  boosterPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#4CAF5022",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  boosterPillText: { fontSize: 10, fontWeight: "bold", color: "#4CAF50" },

  boosterBox: {
    backgroundColor: "#4CAF5010",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4CAF5040",
    padding: 8,
    gap: 4,
    marginTop: 4,
  },
  boosterBoxHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  boosterBoxTitle: { fontSize: 12, fontWeight: "bold", color: "#4CAF50" },
});

/* InstallGroupView */
const tg = StyleSheet.create({
  group: { marginBottom: 14 },
  relayList: {
    marginTop: -6,
    marginLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: "#9C27B040",
    paddingLeft: 10,
  },
  relayHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
    marginTop: 4,
  },
  relayHeaderText: { fontSize: 12, fontWeight: "bold", color: "#9C27B0" },
});

/* RelaySubCard */
const rs = StyleSheet.create({
  card: {
    backgroundColor: "#9C27B010",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#9C27B040",
    borderLeftWidth: 3,
    borderLeftColor: "#9C27B0",
    marginBottom: 8,
    padding: 12,
    gap: 7,
  },
  head: { flexDirection: "row-reverse", alignItems: "center", gap: 7, flexWrap: "wrap" },
  seqBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#9C27B0",
    alignItems: "center", justifyContent: "center",
  },
  seqNum: { fontSize: 11, fontWeight: "bold", color: "#fff" },
  title: { fontSize: 13, fontWeight: "bold", color: "#9C27B0", flex: 1, textAlign: "right" },
  assignedBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.primary + "18",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  assignedText: { fontSize: 11, color: Colors.primary },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  rowText: { fontSize: 13, color: Colors.text, flex: 1, textAlign: "right" },
  notes: { fontSize: 12, color: Colors.textSecondary, textAlign: "right", fontStyle: "italic" },
  btnRow: { flexDirection: "row-reverse", gap: 6, marginTop: 2 },
});

/* مودال صورة الموقع */
const imgModal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#000000CC", justifyContent: "center", alignItems: "center" },
  closeArea: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center" },
  card: {
    width: "90%",
    backgroundColor: Colors.surface,
    borderRadius: 18,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 15, fontWeight: "bold", color: Colors.text },
  image: { width: "100%", height: 300 },
});
