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
import { apiGet, apiPatch } from "@/utils/api";

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
}

/* ─────────────── المكوّن الرئيسي ─────────────── */
export default function TechEngineerScreen() {
  const insets  = useSafeAreaInsets();
  const { user, token } = useAuth();

  type Section = "new" | "inprogress";
  const [section,    setSection]    = useState<Section>("new");
  const [repairs,    setRepairs]    = useState<any[]>([]);
  const [installs,   setInstalls]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving,     setSaving]     = useState<string | null>(null); // ticket id being saved

  /* مودال الإتمام */
  const [completeTicket, setCompleteTicket] = useState<Ticket | null>(null);
  const [cStep,  setCStep]  = useState<"photo" | "notes">("photo");
  const [cNotes, setCNotes] = useState("");
  const [cPhoto, setCPhoto] = useState<string | null>(null);
  const [cSaving, setCsaving] = useState(false);

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
        apiGet("/tickets/installation", token).catch(() => []),
      ]);
      setRepairs(Array.isArray(r) ? r.filter(isVisible) : []);
      setInstalls(Array.isArray(i) ? i.filter(isVisible) : []);
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
  });

  /* ─── التذاكر حسب القسم ─── */
  const newRepairs   = repairs.filter(t => ["new","pending","draft"].includes(t.status)).map(t => toTicket(t, "repair"));
  const ipRepairs    = repairs.filter(t => t.status === "in_progress").map(t => toTicket(t, "repair"));
  const newInstalls  = installs.filter(t => ["new","pending"].includes(t.status)).map(t => toTicket(t, "install"));
  const ipInstalls   = installs.filter(t => ["in_progress","preparing"].includes(t.status)).map(t => toTicket(t, "install"));

  const newItems  = [...newRepairs, ...newInstalls].sort((a, b) => 0);
  const ipItems   = [...ipRepairs, ...ipInstalls];

  const shownItems = section === "new" ? newItems : ipItems;

  /* ─── بدء التنفيذ ─── */
  const startTicket = async (t: Ticket) => {
    setSaving(t.id);
    try {
      const endpoint = t.source === "repair"
        ? `/tickets/repair/${t.sourceId}`
        : `/tickets/installation/${t.sourceId}`;
      await apiPatch(endpoint, token, {
        status:        "in_progress",
        assignedToName: myName || undefined,
      });
      if (t.source === "repair") {
        setRepairs(prev => prev.map(r => r.id === t.sourceId ? { ...r, status: "in_progress" } : r));
      } else {
        setInstalls(prev => prev.map(r => r.id === t.sourceId ? { ...r, status: "in_progress" } : r));
      }
      setSection("inprogress");
      showToast("بدأ التنفيذ");
    } catch { showToast("فشل بدء التنفيذ"); }
    finally { setSaving(null); }
  };

  /* ─── فتح مودال الإتمام ─── */
  const openComplete = (t: Ticket) => {
    setCompleteTicket(t);
    setCStep("photo");
    setCNotes("");
    setCPhoto(null);
  };

  /* ─── اختيار صورة ─── */
  const pickPhoto = async (fromCamera: boolean) => {
    try {
      let result;
      if (fromCamera) {
        await ImagePicker.requestCameraPermissionsAsync();
        result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      } else {
        await ImagePicker.requestMediaLibraryPermissionsAsync();
        result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ["images"] as any });
      }
      if (!result.canceled) setCPhoto(result.assets[0].uri);
    } catch {}
    setCStep("notes");
  };

  /* ─── حفظ الإتمام ─── */
  const saveComplete = async () => {
    if (!completeTicket) return;
    setCsaving(true);
    try {
      const endpoint = completeTicket.source === "repair"
        ? `/tickets/repair/${completeTicket.sourceId}`
        : `/tickets/installation/${completeTicket.sourceId}`;
      await apiPatch(endpoint, token, {
        status:        "completed",
        assignedToName: myName || undefined,
        ...(cNotes ? { notes: cNotes } : {}),
        ...(completeTicket.source === "install" && cNotes ? { engineerNotes: cNotes } : {}),
      });
      if (completeTicket.source === "repair") {
        setRepairs(prev => prev.filter(r => r.id !== completeTicket.sourceId));
      } else {
        setInstalls(prev => prev.filter(r => r.id !== completeTicket.sourceId));
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
        <View style={[s.onlineDot, { backgroundColor: Colors.success }]} />
      </View>

      {/* ══ ملخص سريع ══ */}
      <View style={s.summaryRow}>
        <SummaryPill label="جديدة" count={newItems.length}  color="#2196F3" active={section === "new"}    onPress={() => setSection("new")} />
        <SummaryPill label="جاري"  count={ipItems.length}   color={TECH_COLOR} active={section === "inprogress"} onPress={() => setSection("inprogress")} />
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
        <Text style={s.sectionCount}>{shownItems.length}</Text>
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
      >
        {shownItems.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name={section === "new" ? "checkmark-circle-outline" : "hourglass-outline"} size={56} color={Colors.textMuted} />
            <Text style={s.emptyTitle}>
              {section === "new" ? "لا توجد تذاكر جديدة" : "لا توجد تذاكر قيد التنفيذ"}
            </Text>
            <Text style={s.emptyHint}>
              {section === "new" ? "ستظهر هنا التذاكر المخصصة لك أو للجميع" : "ابدأ تنفيذ تذكرة من قسم الجديدة"}
            </Text>
          </View>
        ) : (
          shownItems.map(ticket =>
            ticket.source === "repair" ? (
              <RepairCard
                key={ticket.id}
                ticket={ticket}
                section={section}
                saving={saving === ticket.id}
                onStart={() => startTicket(ticket)}
                onComplete={() => openComplete(ticket)}
                onCopy={copyPhone}
                onOpenMap={openMap}
                onCopyMap={copyMapUrl}
              />
            ) : (
              <InstallCard
                key={ticket.id}
                ticket={ticket}
                section={section}
                saving={saving === ticket.id}
                onStart={() => startTicket(ticket)}
                onComplete={() => openComplete(ticket)}
                onCopy={copyPhone}
                onOpenMap={openMap}
                onCopyMap={copyMapUrl}
              />
            )
          )
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
    </View>
  );
}

/* ════════════════════════════════════════════════
   بطاقة الإصلاح
════════════════════════════════════════════════ */
function RepairCard({ ticket, section, saving, onStart, onComplete, onCopy, onOpenMap, onCopyMap }: {
  ticket: Ticket;
  section: "new" | "inprogress";
  saving: boolean;
  onStart: () => void;
  onComplete: () => void;
  onCopy: (p: string) => void;
  onOpenMap: (url: string) => void;
  onCopyMap: (url: string) => void;
}) {
  const isExternal = ticket.serviceType === "hotspot_external";
  const typeInfo   = REPAIR_TYPE[ticket.serviceType] ?? { label: `إصلاح ${ticket.serviceType}`, color: Colors.error };
  const hasPhone   = !!ticket.clientPhone && !isExternal;
  const hasMap     = !!ticket.locationUrl;

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
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════
   بطاقة التركيب
════════════════════════════════════════════════ */
function InstallCard({ ticket, section, saving, onStart, onComplete, onCopy, onOpenMap, onCopyMap }: {
  ticket: Ticket;
  section: "new" | "inprogress";
  saving: boolean;
  onStart: () => void;
  onComplete: () => void;
  onCopy: (p: string) => void;
  onOpenMap: (url: string) => void;
  onCopyMap: (url: string) => void;
}) {
  const typeLabel = INSTALL_TYPE[ticket.serviceType] ?? `تركيب ${ticket.serviceType}`;
  const hasPhone  = !!ticket.clientPhone;
  const hasMap    = !!ticket.locationUrl;

  return (
    <View style={[c.card, { borderLeftColor: Colors.success }]}>
      {/* رأس البطاقة */}
      <View style={c.cardHead}>
        <Text style={c.cardNum}>#{ticket.sourceId}</Text>
        {ticket.serviceNumber && (
          <Text style={c.serviceNum}>{ticket.serviceNumber}</Text>
        )}
        <View style={[c.typeBadge, { backgroundColor: Colors.success + "22" }]}>
          <Text style={[c.typeBadgeText, { color: Colors.success }]}>{typeLabel}</Text>
        </View>
        <View style={[c.statusDot, { backgroundColor: section === "new" ? "#2196F3" : Colors.warning }]} />
      </View>

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

      {ticket.notes && (
        <View style={c.problemBox}>
          <Text style={c.problemLabel}>ملاحظات:</Text>
          <Text style={c.problemText}>{ticket.notes}</Text>
        </View>
      )}

      {/* الأزرار */}
      <View style={c.btnRow}>
        {section === "new" ? (
          <ActionBtn
            label="بدء التنفيذ"
            icon="play-circle"
            color="#2196F3"
            loading={saving}
            onPress={onStart}
            flex={2}
          />
        ) : (
          <ActionBtn
            label="تم التنفيذ"
            icon="checkmark-done-circle"
            color={Colors.success}
            loading={saving}
            onPress={onComplete}
            flex={2}
          />
        )}

        {hasPhone && (
          <ActionBtn
            label="اتصال"
            icon="call"
            color={Colors.success}
            onPress={() => Linking.openURL(`tel:${ticket.clientPhone}`)}
            flex={1}
          />
        )}

        {hasMap && (
          <ActionBtn label="خريطة" icon="map" color={Colors.info} onPress={() => onOpenMap(ticket.locationUrl!)} flex={1} />
        )}
      </View>
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
