import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, Modal, Linking, TextInput, Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiDelete, apiPost, formatDate } from "@/utils/api";

/* ─────────────── ثوابت ─────────────── */
const SUPERVISOR_COLOR = Colors.roles?.supervisor ?? "#00BCD4";

const STATUS: Record<string, { bg: string; color: string; label: string }> = {
  new:         { bg: "#2196F322", color: "#2196F3", label: "جديدة" },
  pending:     { bg: "#2196F322", color: "#2196F3", label: "جديدة" },
  draft:       { bg: "#90909022", color: "#909090", label: "مسودة" },
  preparing:   { bg: "#9C27B022", color: "#9C27B0", label: "جاري التجهيز" },
  in_progress: { bg: "#FF980022", color: "#FF9800", label: "جاري التنفيذ" },
  completed:   { bg: "#4CAF5022", color: "#4CAF50", label: "مكتملة" },
  archived:    { bg: "#90909022", color: "#909090", label: "مؤرشفة" },
};

const PRIORITY_AR: Record<string, { label: string; color: string }> = {
  urgent: { label: "عاجل",   color: Colors.error },
  high:   { label: "عالي",   color: "#FF5722" },
  normal: { label: "عادي",   color: Colors.success },
  medium: { label: "متوسط",  color: Colors.warning },
  low:    { label: "منخفض",  color: Colors.textMuted },
};

const SERVICE_TYPE_AR: Record<string, string> = {
  hotspot_internal: "إصلاح هوتسبوت داخلي",
  hotspot_external: "إصلاح هوتسبوت خارجي",
  broadband:        "إصلاح برودباند",
  hotspot:          "إصلاح هوتسبوت",
};

const SERVICE_TYPE_COLOR: Record<string, string> = {
  hotspot_internal: Colors.primary,
  hotspot_external: Colors.warning,
  broadband:        Colors.info,
  hotspot:          Colors.primary,
};

const INSTALL_TYPE_AR: Record<string, string> = {
  hotspot_internal:   "تركيب هوتسبوت داخلي",
  hotspot_external:   "تركيب هوتسبوت خارجي",
  broadband_internal: "تركيب برودباند داخلي",
  broadband:          "تركيب برودباند",
  external:           "تركيب نقطة بث خارجية",
};

const INSTALL_TYPE_COLOR: Record<string, string> = {
  hotspot_internal:   "#4CAF50",
  hotspot_external:   "#FF9800",
  broadband_internal: "#2196F3",
  broadband:          "#2196F3",
  external:           "#FF9800",
};

const STATUS_FILTERS = [
  { key: "all",         label: "الكل" },
  { key: "pending",     label: "جديدة" },
  { key: "in_progress", label: "جاري" },
  { key: "completed",   label: "مكتملة" },
];

/* ─────────────── نوع القسم ─────────────── */
type Section = "repair" | "install";

/* ─────────────── مودال التايملاين ─────────────── */
type TimelineData = {
  ticketNum: string;
  createdAt: string | null;
  startedAt:  string | null;
  resolvedAt: string | null;
  completedAt:string | null;
  engineerName: string | null;
};

/* ════════════════════════════════════════════════
   المكوّن الرئيسي
════════════════════════════════════════════════ */
export default function TaskTrackingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();

  const [section,        setSection]        = useState<Section>("repair");
  const [statusFilter,   setStatusFilter]   = useState("all");
  const [repairTickets,  setRepairTickets]  = useState<any[]>([]);
  const [installTickets, setInstallTickets] = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);

  /* expanded details */
  const [expandedId,  setExpandedId]  = useState<number | null>(null);
  /* timeline modal */
  const [timeline,    setTimeline]    = useState<TimelineData | null>(null);
  /* delete modal */
  const [deleteState, setDeleteState] = useState<{
    visible: boolean; id: number | null; ticketNum: string; section: Section;
  }>({ visible: false, id: null, ticketNum: "", section: "repair" });
  const [deleting, setDeleting] = useState(false);
  /* prepare modal */
  const [prepareItem,   setPrepareItem]   = useState<any>(null);
  const [prepSubmitting, setPrepSubmitting] = useState(false);
  /* archive modal */
  const [archiveItem,   setArchiveItem]   = useState<any>(null);
  const [archSubmitting, setArchSubmitting] = useState(false);
  /* engineers list */
  const [engineers, setEngineers] = useState<{id:number;name:string}[]>([]);

  /* ─── جلب البيانات ─── */
  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); }
    try {
      const [r, i] = await Promise.all([
        apiGet("/tickets/repair", token),
        apiGet("/tickets/installation", token),
      ]);
      setRepairTickets(Array.isArray(r) ? r : []);
      setInstallTickets(Array.isArray(i) ? i : []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    apiGet("/users/engineers", token).then(setEngineers).catch(() => {});
  }, [token]);

  /* ─── فلترة ─── */
  const filterItems = (items: any[]) => items.filter(item => {
    const s = item.status ?? "";
    if (statusFilter === "all")         return true;
    if (statusFilter === "pending")     return ["pending", "new", "draft"].includes(s);
    if (statusFilter === "in_progress") return ["in_progress", "preparing"].includes(s);
    if (statusFilter === "completed")   return ["completed", "archived"].includes(s);
    return true;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const items = filterItems(section === "repair" ? repairTickets : installTickets);

  /* ─── حذف ─── */
  const openDelete = (id: number, ticketNum: string, sec: Section) =>
    setDeleteState({ visible: true, id, ticketNum, section: sec });

  const handleDelete = async () => {
    if (!deleteState.id) return;
    setDeleting(true);
    try {
      const endpoint = deleteState.section === "repair"
        ? `/tickets/repair/${deleteState.id}`
        : `/tickets/installation/${deleteState.id}`;
      await apiDelete(endpoint, token);
      if (deleteState.section === "repair") {
        setRepairTickets(prev => prev.filter(t => t.id !== deleteState.id));
      } else {
        setInstallTickets(prev => prev.filter(t => t.id !== deleteState.id));
      }
    } catch {} finally {
      setDeleting(false);
      setDeleteState({ visible: false, id: null, ticketNum: "", section: "repair" });
    }
  };

  /* ─── تجهيز التذكرة ─── */
  const handlePrepare = async (id: number, payload: any) => {
    setPrepSubmitting(true);
    try {
      const updated = await apiPost(`/tickets/installation/${id}/prepare`, token, payload);
      setInstallTickets(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
      setPrepareItem(null);
      /* انتقال تلقائي لتبويب "جاري" في قسم التركيب */
      setSection("install");
      setStatusFilter("in_progress");
    } catch (e: any) {
      /* الخطأ سيظهر داخل المودال */
      throw e;
    } finally {
      setPrepSubmitting(false);
    }
  };

  /* ─── أرشفة التذكرة ─── */
  const handleArchive = async (id: number, payload: any) => {
    setArchSubmitting(true);
    try {
      const updated = await apiPost(`/tickets/installation/${id}/archive`, token, payload);
      setInstallTickets(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
      setArchiveItem(null);
    } catch (e: any) {
      throw e;
    } finally {
      setArchSubmitting(false);
    }
  };

  /* ─── التايملاين ─── */
  const openTimeline = (item: any, sec: Section) => {
    setTimeline({
      ticketNum:   `#${item.id}`,
      createdAt:   item.createdAt   ?? null,
      startedAt:   item.startedAt   ?? null,
      resolvedAt:  item.resolvedAt  ?? item.completedAt ?? null,
      completedAt: item.completedAt ?? null,
      engineerName: item.assignedToName ?? null,
    });
  };

  /* ─── تحميل ─── */
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={SUPERVISOR_COLOR} />
      </View>
    );
  }

  /* ─── الواجهة ─── */
  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>

      {/* ── رأس الصفحة ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>متابعة المهام</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => { setRefreshing(true); fetchAll(true); }}
        >
          <Ionicons name="refresh" size={20} color={SUPERVISOR_COLOR} />
        </TouchableOpacity>
      </View>

      {/* ── تبديل القسم ── */}
      <View style={styles.sectionRow}>
        <TouchableOpacity
          style={[styles.sectionBtn, section === "repair" && { backgroundColor: Colors.error + "22", borderColor: Colors.error }]}
          onPress={() => setSection("repair")}
        >
          <Ionicons name="build" size={15} color={section === "repair" ? Colors.error : Colors.textSecondary} />
          <Text style={[styles.sectionBtnText, section === "repair" && { color: Colors.error, fontWeight: "bold" }]}>
            مهام الإصلاح
          </Text>
          <View style={[styles.countBubble, { backgroundColor: Colors.error }]}>
            <Text style={styles.countBubbleText}>{repairTickets.length}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sectionBtn, section === "install" && { backgroundColor: Colors.info + "22", borderColor: Colors.info }]}
          onPress={() => setSection("install")}
        >
          <Ionicons name="add-circle" size={15} color={section === "install" ? Colors.info : Colors.textSecondary} />
          <Text style={[styles.sectionBtnText, section === "install" && { color: Colors.info, fontWeight: "bold" }]}>
            مهام التركيب
          </Text>
          <View style={[styles.countBubble, { backgroundColor: Colors.info }]}>
            <Text style={styles.countBubbleText}>{installTickets.length}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── فلتر الحالة ── */}
      <FilterBar
        active={statusFilter}
        onSelect={setStatusFilter}
        source={section === "repair" ? repairTickets : installTickets}
      />

      {/* ── القائمة ── */}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchAll(true); }}
            tintColor={SUPERVISOR_COLOR}
          />
        }
      >
        <Text style={styles.countText}>{items.length} تذكرة</Text>

        {items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-circle-outline" size={52} color={Colors.textMuted} />
            <Text style={styles.emptyText}>لا توجد تذاكر في هذا الفلتر</Text>
          </View>
        ) : section === "repair" ? (
          items.map(item => (
            <RepairCard
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
              onTimeline={() => openTimeline(item, "repair")}
              onDelete={() => openDelete(item.id, `#${item.id}`, "repair")}
            />
          ))
        ) : (
          items.map(item => (
            <InstallCard
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
              onTimeline={() => openTimeline(item, "install")}
              onDelete={() => openDelete(item.id, `#${item.id}`, "install")}
              onPrepare={() => setPrepareItem(item)}
              onArchive={() => setArchiveItem(item)}
            />
          ))
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ════ مودال التايملاين ════ */}
      <Modal visible={!!timeline} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setTimeline(null)}>
          <View style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>متابعة الحالة {timeline?.ticketNum}</Text>

            <TimelineRow
              icon="create-outline"
              label="وقت الإنشاء"
              time={timeline?.createdAt ?? null}
              color={Colors.primary}
            />
            <TimelineRow
              icon="play-circle-outline"
              label="وقت البدء"
              time={timeline?.startedAt ?? null}
              color={Colors.warning}
            />
            <TimelineRow
              icon="checkmark-done-circle-outline"
              label="وقت الانتهاء"
              time={timeline?.resolvedAt ?? null}
              color={Colors.success}
            />
            {timeline?.engineerName ? (
              <View style={styles.timelineEngineerRow}>
                <Ionicons name="person-circle" size={18} color={SUPERVISOR_COLOR} />
                <Text style={styles.timelineEngineerText}>
                  المهندس المنفذ: {timeline.engineerName}
                </Text>
              </View>
            ) : (
              <View style={styles.timelineEngineerRow}>
                <Ionicons name="people-circle-outline" size={18} color={Colors.textMuted} />
                <Text style={[styles.timelineEngineerText, { color: Colors.textMuted }]}>
                  مرسلة للكل (لم يُسند بعد)
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.timelineCloseBtn} onPress={() => setTimeline(null)}>
              <Text style={styles.timelineCloseBtnText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ════ مودال تأكيد الحذف ════ */}
      <Modal visible={deleteState.visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.deleteCard}>
            <View style={styles.deleteIconCircle}>
              <Ionicons name="trash" size={32} color={Colors.error} />
            </View>
            <Text style={styles.deleteTitle}>حذف التذكرة {deleteState.ticketNum}</Text>
            <Text style={styles.deleteMsg}>
              هل أنت متأكد من حذف التذكرة؟{"\n"}
              لن تظهر للمهندس الفني بعد الحذف.
            </Text>
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.deleteCancelBtn}
                onPress={() => setDeleteState({ visible: false, id: null, ticketNum: "", section: "repair" })}
                disabled={deleting}
              >
                <Text style={styles.deleteCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.deleteConfirmText}>حذف</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* ════ مودال التجهيز ════ */}
      {!!prepareItem && (
        <PrepareModal
          item={prepareItem}
          engineers={engineers}
          submitting={prepSubmitting}
          onClose={() => setPrepareItem(null)}
          onSubmit={(payload) => handlePrepare(prepareItem.id, payload)}
        />
      )}

      {/* ════ مودال الأرشفة ════ */}
      {!!archiveItem && (
        <ArchiveModal
          item={archiveItem}
          submitting={archSubmitting}
          onClose={() => setArchiveItem(null)}
          onSubmit={(payload) => handleArchive(archiveItem.id, payload)}
        />
      )}
    </View>
  );
}

/* ════════════════════════════════════════════════
   مكوّن فلتر الحالة
════════════════════════════════════════════════ */
function countByKey(items: any[], key: string) {
  return items.filter(it => {
    const s = it.status ?? "";
    if (key === "pending")     return ["pending", "new", "draft"].includes(s);
    if (key === "in_progress") return ["in_progress", "preparing"].includes(s);
    if (key === "completed")   return ["completed", "archived"].includes(s);
    return false;
  }).length;
}

const FILTER_META: Record<string, { color: string }> = {
  all:         { color: Colors.primary },
  pending:     { color: "#2196F3" },
  in_progress: { color: "#FF9800" },
  completed:   { color: "#4CAF50" },
};

function FilterBar({ active, onSelect, source }: {
  active: string;
  onSelect: (k: string) => void;
  source: any[];
}) {
  const filters = [
    { key: "all",         label: "الكل",          count: source.length },
    { key: "pending",     label: "جديدة",         count: countByKey(source, "pending") },
    { key: "in_progress", label: "جاري",          count: countByKey(source, "in_progress") },
    { key: "completed",   label: "مكتملة",        count: countByKey(source, "completed") },
  ];

  return (
    <View style={fbStyles.row}>
      {filters.map(f => {
        const isActive = active === f.key;
        const meta = FILTER_META[f.key];
        return (
          <TouchableOpacity
            key={f.key}
            style={[
              fbStyles.btn,
              isActive && { backgroundColor: meta.color + "22", borderColor: meta.color },
            ]}
            onPress={() => onSelect(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[fbStyles.label, isActive && { color: meta.color, fontWeight: "bold" }]}>
              {f.label}
            </Text>
            <View style={[fbStyles.badge, { backgroundColor: isActive ? meta.color : Colors.border }]}>
              <Text style={fbStyles.badgeText}>{f.count}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const fbStyles = StyleSheet.create({
  row: {
    flexDirection: "row-reverse",
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 8,
  },
  btn: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 5,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#fff",
  },
});

/* ════════════════════════════════════════════════
   بطاقة تذكرة الإصلاح
════════════════════════════════════════════════ */
function RepairCard({ item, expanded, onExpand, onTimeline, onDelete }: {
  item: any;
  expanded: boolean;
  onExpand: () => void;
  onTimeline: () => void;
  onDelete: () => void;
}) {
  const si        = STATUS[item.status] ?? STATUS["pending"];
  const typeLabel = SERVICE_TYPE_AR[item.serviceType] ?? `إصلاح ${item.serviceType ?? ""}`;
  const typeColor = SERVICE_TYPE_COLOR[item.serviceType] ?? Colors.primary;
  const prioInfo  = PRIORITY_AR[item.priority] ?? { label: item.priority ?? "—", color: Colors.textMuted };
  const showContact = item.serviceType !== "hotspot_external";
  const isCompleted = item.status === "completed";
  const hasPhone    = showContact && !!item.clientPhone;
  const hasMap      = !!item.locationUrl;

  const openMap = async (rawUrl: string) => {
    const coordMatch = rawUrl.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    const plainCoord = rawUrl.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    let mapsUrl: string;
    if (coordMatch) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${coordMatch[1]},${coordMatch[2]}`;
    } else if (plainCoord) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${plainCoord[1]},${plainCoord[2]}`;
    } else if (rawUrl.startsWith("http")) {
      mapsUrl = rawUrl;
    } else {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawUrl)}`;
    }
    const canOpen = await Linking.canOpenURL(mapsUrl);
    if (canOpen) { Linking.openURL(mapsUrl); }
    else { Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(rawUrl)}`); }
  };

  return (
    <View style={[rc.card, { borderLeftColor: typeColor }]}>

      {/* ══ رأس البطاقة ══ */}
      <View style={rc.head}>
        <Text style={rc.num}>#{item.id}</Text>
        {item.serviceNumber && (
          <Text style={rc.serviceNum}>{item.serviceNumber}</Text>
        )}
        <View style={[rc.typeBadge, { backgroundColor: typeColor + "22" }]}>
          <Text style={[rc.typeBadgeText, { color: typeColor }]}>{typeLabel}</Text>
        </View>
        <View style={[rc.statusDot, { backgroundColor: si.color }]} />
      </View>

      <View style={rc.divider} />

      {/* ══ شارة الأولوية + المهندس ══ */}
      <View style={rc.metaRow}>
        <View style={[rc.prioBadge, { borderColor: prioInfo.color + "70" }]}>
          <Text style={[rc.prioBadgeText, { color: prioInfo.color }]}>{prioInfo.label}</Text>
        </View>
        <View style={rc.engineerBadge}>
          <Ionicons
            name={item.assignedToName ? "person-circle" : "people-circle-outline"}
            size={14}
            color={item.assignedToName ? Colors.primary : Colors.textMuted}
          />
          <Text style={[rc.engineerText, { color: item.assignedToName ? Colors.primary : Colors.textMuted }]}>
            {item.assignedToName ?? "للجميع"}
          </Text>
        </View>
      </View>

      {/* ══ اسم العميل ══ */}
      {showContact && item.clientName && (
        <View style={rc.row}>
          <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
          <Text style={rc.rowText}>{item.clientName}</Text>
        </View>
      )}

      {/* ══ الجوال ══ */}
      {showContact && item.clientPhone && (
        <View style={rc.row}>
          <Ionicons name="call-outline" size={14} color={Colors.success} />
          <Text style={[rc.rowText, { color: Colors.success, flex: 1 }]}>{item.clientPhone}</Text>
        </View>
      )}

      {/* ══ الموقع (نص فقط — بدون أيقونة التوجيه) ══ */}
      {item.location && (
        <View style={rc.row}>
          <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
          <Text style={[rc.rowText, { flex: 1 }]}>{item.location}</Text>
        </View>
      )}

      {/* ══ المشكلة ══ */}
      {item.problemDescription && (
        <View style={rc.problemBox}>
          <Text style={rc.problemLabel}>المشكلة:</Text>
          <Text style={rc.problemText}>{item.problemDescription}</Text>
        </View>
      )}

      {/* ══ المهندس المنجز (للمكتملة) ══ */}
      {isCompleted && item.assignedToName && (
        <View style={rc.completedEngineerBox}>
          <Ionicons name="checkmark-done-circle" size={15} color={Colors.success} />
          <Text style={rc.completedEngineerText}>أنجزه: {item.assignedToName}</Text>
        </View>
      )}

      {/* ══ التفاصيل الموسّعة ══ */}
      {expanded && (
        <View style={rc.expandedBox}>
          {item.notes && <InfoLine icon="document-text-outline" label="ملاحظات"       value={item.notes} />}
          {item.createdByName && <InfoLine icon="create-outline" label="أنشأه"         value={item.createdByName} />}
          <InfoLine icon="calendar-outline" label="تاريخ الإنشاء"   value={formatDate(item.createdAt)} />
          {item.startedAt  && <InfoLine icon="play-outline"           label="بدء التنفيذ"  value={formatDate(item.startedAt)} />}
          {item.resolvedAt && <InfoLine icon="checkmark-circle-outline" label="وقت الإنجاز" value={formatDate(item.resolvedAt)} />}
        </View>
      )}

      {/* ══ صف ثانوي: تفاصيل + متابعة ══ */}
      <View style={rc.secRow}>
        <SuperActionBtn icon={expanded ? "chevron-up" : "chevron-down"} label={expanded ? "إخفاء" : "تفاصيل"} color={Colors.textSecondary} onPress={onExpand} />
        <SuperActionBtn icon="time-outline" label="متابعة" color={SUPERVISOR_COLOR} onPress={onTimeline} />
      </View>

      {/* ══ صف أساسي: اتصال + خريطة + حذف ══ */}
      <View style={rc.mainBtnRow}>
        {hasPhone && (
          <TouchableOpacity
            style={[rc.mainBtn, { backgroundColor: Colors.success + "22", borderColor: Colors.success + "55" }]}
            onPress={() => Linking.openURL(`tel:${item.clientPhone}`)}
          >
            <Ionicons name="call" size={16} color={Colors.success} />
            <Text style={[rc.mainBtnText, { color: Colors.success }]}>اتصال</Text>
          </TouchableOpacity>
        )}
        {hasMap && (
          <TouchableOpacity
            style={[rc.mainBtn, { backgroundColor: Colors.info + "22", borderColor: Colors.info + "55" }]}
            onPress={() => openMap(item.locationUrl)}
          >
            <Ionicons name="map" size={16} color={Colors.info} />
            <Text style={[rc.mainBtnText, { color: Colors.info }]}>خريطة</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[rc.mainBtn, { backgroundColor: Colors.error + "18", borderColor: Colors.error + "55" }]}
          onPress={onDelete}
        >
          <Ionicons name="trash" size={16} color={Colors.error} />
          <Text style={[rc.mainBtnText, { color: Colors.error }]}>حذف</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════
   بطاقة تذكرة التركيب
════════════════════════════════════════════════ */
function InstallCard({ item, expanded, onExpand, onTimeline, onDelete, onPrepare, onArchive }: {
  item: any; expanded: boolean;
  onExpand: () => void; onTimeline: () => void; onDelete: () => void;
  onPrepare: () => void; onArchive: () => void;
}) {
  const si        = STATUS[item.status] ?? STATUS["pending"];
  const typeLabel = INSTALL_TYPE_AR[item.serviceType] ?? `تركيب ${item.serviceType ?? ""}`;
  const typeColor = INSTALL_TYPE_COLOR[item.serviceType] ?? Colors.primary;
  const status    = item.status ?? "new";
  const isNew     = ["new", "pending", "draft"].includes(status);
  const isCompleted = ["completed"].includes(status);
  const hasPhone  = !!item.clientPhone;
  const hasMap    = !!item.locationUrl;

  const openMap = async (rawUrl: string) => {
    if (!rawUrl) return;
    const coordMatch = rawUrl.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    const plainCoord = rawUrl.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    let mapsUrl: string;
    if (coordMatch) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${coordMatch[1]},${coordMatch[2]}`;
    } else if (plainCoord) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${plainCoord[1]},${plainCoord[2]}`;
    } else if (rawUrl.startsWith("http")) {
      mapsUrl = rawUrl;
    } else {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawUrl)}`;
    }
    const canOpen = await Linking.canOpenURL(mapsUrl);
    if (canOpen) { Linking.openURL(mapsUrl); }
    else { Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(rawUrl)}`); }
  };

  const isRelayPoint  = !!item.isRelayPoint;
  const sequenceOrder = item.sequenceOrder ?? 0;
  const isBoosterCard = !!item.isBooster;
  const relayColor    = isBoosterCard ? "#4CAF50" : isRelayPoint ? "#9C27B0" : typeColor;

  return (
    <View style={[rc.card, { borderLeftColor: relayColor }]}>

      {/* ══ رأس البطاقة ══ */}
      <View style={rc.head}>
        <Text style={rc.num}>#{item.id}</Text>
        <View style={[rc.typeBadge, { backgroundColor: relayColor + "22" }]}>
          <Text style={[rc.typeBadgeText, { color: relayColor }]}>
            {isBoosterCard ? "هوتسبوت داخلي (مقوي)" : typeLabel}
          </Text>
        </View>
        <View style={[rc.statusDot, { backgroundColor: si.color }]} />
      </View>

      {/* شارة نقطة البث */}
      {isRelayPoint && (
        <View style={icSup.relayBadge}>
          <Ionicons name="git-network-outline" size={12} color="#9C27B0" />
          <Text style={icSup.relayText}>نقطة البث رقم {sequenceOrder}</Text>
        </View>
      )}

      {/* شارة مقوي داخلي هوتسبوت */}
      {!!item.isBooster && (
        <View style={icSup.boosterBadge}>
          <Ionicons name="hardware-chip" size={12} color="#4CAF50" />
          <Text style={icSup.boosterText}>مقوي داخلي هوتسبوت — مرتبط بتذكرة برودباند #{item.parentTicketId}</Text>
        </View>
      )}

      <View style={rc.divider} />

      {/* ══ شارة الحالة + المهندس ══ */}
      <View style={rc.metaRow}>
        <View style={[rc.prioBadge, { borderColor: si.color + "70" }]}>
          <Text style={[rc.prioBadgeText, { color: si.color }]}>{si.label}</Text>
        </View>
        <View style={rc.engineerBadge}>
          <Ionicons
            name={item.assignedToName ? "person-circle" : "people-circle-outline"}
            size={14}
            color={item.assignedToName ? Colors.primary : Colors.textMuted}
          />
          <Text style={[rc.engineerText, { color: item.assignedToName ? Colors.primary : Colors.textMuted }]}>
            {item.assignedToName ?? "للجميع"}
          </Text>
        </View>
      </View>

      {/* ══ اسم العميل ══ */}
      {item.clientName && (
        <View style={rc.row}>
          <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
          <Text style={rc.rowText}>{item.clientName}</Text>
        </View>
      )}

      {/* ══ الجوال ══ */}
      {item.clientPhone && (
        <View style={rc.row}>
          <Ionicons name="call-outline" size={14} color={Colors.success} />
          <Text style={[rc.rowText, { color: Colors.success, flex: 1 }]}>{item.clientPhone}</Text>
        </View>
      )}

      {/* ══ الموقع ══ */}
      {item.address && (
        <View style={rc.row}>
          <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
          <Text style={[rc.rowText, { flex: 1 }]}>{item.address}</Text>
        </View>
      )}

      {/* ══ معلومات الجهاز (بعد التجهيز) ══ */}
      {item.deviceName && (
        <View style={rc.row}>
          <Ionicons name="hardware-chip-outline" size={14} color={Colors.textSecondary} />
          <Text style={rc.rowText}>{item.deviceName} — {item.deviceSerial ?? "—"}</Text>
        </View>
      )}

      {/* ══ الاشتراك ══ */}
      {item.subscriptionFee && (
        <View style={rc.row}>
          <Ionicons name="cash-outline" size={14} color={Colors.success} />
          <Text style={[rc.rowText, { color: Colors.success }]}>قيمة الاشتراك: {item.subscriptionFee} ريال</Text>
        </View>
      )}

      {/* ══ ملاحظات ══ */}
      {item.notes && (
        <View style={rc.problemBox}>
          <Text style={rc.problemLabel}>ملاحظات:</Text>
          <Text style={rc.problemText}>{item.notes}</Text>
        </View>
      )}

      {/* ══ نقاط البث الوسيطة ══ */}
      {item.hasRelayPoints && (
        <View style={ic.relayBadge}>
          <Ionicons name="git-network-outline" size={13} color="#9C27B0" />
          <Text style={ic.relayText}>يحتوي على نقاط بث وسيطة</Text>
        </View>
      )}

      {/* ══ التفاصيل الموسّعة ══ */}
      {expanded && (
        <View style={rc.expandedBox}>
          {item.subscriptionName && <InfoLine icon="wifi-outline"             label="اسم الاشتراك"  value={item.subscriptionName} />}
          {item.internetFee      && <InfoLine icon="cash-outline"             label="رسوم الإنترنت" value={`${item.internetFee} ريال`} />}
          {item.createdByName    && <InfoLine icon="create-outline"           label="أنشأه"          value={item.createdByName} />}
          <InfoLine icon="calendar-outline" label="تاريخ الإنشاء"             value={formatDate(item.createdAt)} />
          {item.completedAt && <InfoLine icon="checkmark-circle-outline"     label="تاريخ الانتهاء" value={formatDate(item.completedAt)} />}
        </View>
      )}

      {/* ══ صف ثانوي: تفاصيل + متابعة ══ */}
      <View style={rc.secRow}>
        <SuperActionBtn icon={expanded ? "chevron-up" : "chevron-down"} label={expanded ? "إخفاء" : "تفاصيل"} color={Colors.textSecondary} onPress={onExpand} />
        <SuperActionBtn icon="time-outline" label="متابعة" color={SUPERVISOR_COLOR} onPress={onTimeline} />
      </View>

      {/* ══ صف أساسي: أزرار الإجراءات ══ */}
      <View style={rc.mainBtnRow}>
        {hasPhone && (
          <TouchableOpacity
            style={[rc.mainBtn, { backgroundColor: Colors.success + "22", borderColor: Colors.success + "55" }]}
            onPress={() => Linking.openURL(`tel:${item.clientPhone}`)}
          >
            <Ionicons name="call" size={16} color={Colors.success} />
            <Text style={[rc.mainBtnText, { color: Colors.success }]}>اتصال</Text>
          </TouchableOpacity>
        )}
        {hasMap && (
          <TouchableOpacity
            style={[rc.mainBtn, { backgroundColor: Colors.info + "22", borderColor: Colors.info + "55" }]}
            onPress={() => openMap(item.locationUrl)}
          >
            <Ionicons name="map" size={16} color={Colors.info} />
            <Text style={[rc.mainBtnText, { color: Colors.info }]}>خريطة</Text>
          </TouchableOpacity>
        )}

        {/* تجهيز — للتذاكر الجديدة فقط */}
        {isNew && (
          <TouchableOpacity
            style={[rc.mainBtn, { backgroundColor: "#9C27B022", borderColor: "#9C27B055" }]}
            onPress={onPrepare}
          >
            <Ionicons name="construct" size={16} color="#9C27B0" />
            <Text style={[rc.mainBtnText, { color: "#9C27B0" }]}>تجهيز</Text>
          </TouchableOpacity>
        )}

        {/* أرشفة — بعد اكتمال المهندس */}
        {isCompleted && (
          <TouchableOpacity
            style={[rc.mainBtn, { backgroundColor: Colors.success + "22", borderColor: Colors.success + "55" }]}
            onPress={onArchive}
          >
            <Ionicons name="archive" size={16} color={Colors.success} />
            <Text style={[rc.mainBtnText, { color: Colors.success }]}>أرشفة</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[rc.mainBtn, { backgroundColor: Colors.error + "18", borderColor: Colors.error + "55" }]}
          onPress={onDelete}
        >
          <Ionicons name="trash" size={16} color={Colors.error} />
          <Text style={[rc.mainBtnText, { color: Colors.error }]}>حذف</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════
   مكوّنات مساعدة
════════════════════════════════════════════════ */
function TimelineRow({ icon, label, time, color }: {
  icon: string; label: string; time: string | null; color: string;
}) {
  return (
    <View style={styles.tlRow}>
      <View style={[styles.tlIconCircle, { borderColor: time ? color : Colors.border }]}>
        <Ionicons name={icon as any} size={14} color={time ? color : Colors.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.tlLabel}>{label}</Text>
        <Text style={[styles.tlTime, { color: time ? Colors.text : Colors.textMuted }]}>
          {time ? formatDate(time) : "لم يتم بعد"}
        </Text>
      </View>
    </View>
  );
}

function InfoLine({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Ionicons name={icon as any} size={13} color={Colors.textSecondary} />
      <Text style={styles.infoLineLabel}>{label}:</Text>
      <Text style={styles.infoLineValue}>{value}</Text>
    </View>
  );
}

function SuperActionBtn({ icon, label, color, onPress }: {
  icon: string; label: string; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={rc.btn} onPress={onPress}>
      <Ionicons name={icon as any} size={14} color={color} />
      <Text style={[rc.btnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ════════════════════════════════════════════════
   أنماط بطاقة الإصلاح (rc)
════════════════════════════════════════════════ */
const rc = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  head: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  num: { fontSize: 13, fontWeight: "bold", color: Colors.textMuted },
  typeBadge: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  typeBadgeText: { fontSize: 12, fontWeight: "bold" },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  divider: { height: 1, backgroundColor: Colors.border },
  metaRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, flexWrap: "wrap" },
  prioBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
  },
  prioBadgeText: { fontSize: 11, fontWeight: "600" },
  engineerBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  engineerText: { fontSize: 11, fontWeight: "600" },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  rowText: { fontSize: 13, color: Colors.textSecondary, textAlign: "right" },
  problemBox: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8, padding: 8, gap: 4,
  },
  problemLabel: { fontSize: 11, color: Colors.textMuted, textAlign: "right" },
  problemText:  { fontSize: 13, color: Colors.text, textAlign: "right" },
  completedEngineerBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.success + "15",
    borderRadius: 8, padding: 8,
  },
  completedEngineerText: { fontSize: 13, fontWeight: "bold", color: Colors.success, textAlign: "right" },
  expandedBox: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10, padding: 10, gap: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  serviceNum: { fontSize: 14, fontWeight: "bold", color: Colors.primary },
  secRow: {
    flexDirection: "row-reverse",
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingTop: 8, gap: 6,
  },
  btnRow: {
    flexDirection: "row-reverse",
    borderTopWidth: 1, borderTopColor: Colors.border,
    marginTop: 4, paddingTop: 10, gap: 6,
  },
  btn: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
  },
  btnText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  mainBtnRow: {
    flexDirection: "row-reverse",
    gap: 8,
  },
  mainBtn: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  mainBtnText: { fontSize: 13, fontWeight: "bold" },
});

/* أنماط InstallCard الإضافية */
const ic = StyleSheet.create({
  relayBadge: {
    flexDirection: "row-reverse", alignItems: "center", gap: 6,
    backgroundColor: "#9C27B018", borderRadius: 8, padding: 8,
  },
  relayText: { fontSize: 12, color: "#9C27B0", textAlign: "right" },
});

/* ════════════════════════════════════════════════
   مودال التجهيز
════════════════════════════════════════════════ */
function PrepareModal({ item, engineers, submitting, onClose, onSubmit }: {
  item: any;
  engineers: {id:number;name:string}[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<void>;
}) {
  const svc = item.serviceType ?? "";
  const [form, setForm] = useState({
    address: item.address ?? "",
    locationUrl: item.locationUrl ?? "",
    deviceName: "",
    deviceSerial: "",
    subscriptionName: "",
    internetFee: "",
    notes: "",
  });
  const [assignedId,   setAssignedId]   = useState<number|null>(item.assignedToId ?? null);
  const [assignedName, setAssignedName] = useState<string>(item.assignedToName ?? "");

  /* نقاط البث (للهوتسبوت فقط) */
  const [hasRelays,   setHasRelays]   = useState(false);
  const [relayCount,  setRelayCount]  = useState("1");
  const [relays, setRelays] = useState<{description:string;locationUrl:string;imageUrl:string|null}[]>(
    [{description:"",locationUrl:"",imageUrl:null}]
  );

  /* مقوي داخلي هوتسبوت (للبرودباند الداخلي فقط) */
  const [hasBooster, setHasBooster] = useState(false);
  const [boosterForm, setBoosterForm] = useState({ deviceName: "", deviceSerial: "", subscriptionFee: "" });
  const setBF = (k: keyof typeof boosterForm, v: string) => setBoosterForm(f => ({...f,[k]:v}));

  const [errMsg, setErrMsg] = useState("");

  const setF = (k: keyof typeof form, v: string) => setForm(f => ({...f,[k]:v}));

  /* إصلاح عداد النقاط: نقبل النص الخام ونعدّل العدد عند الانتهاء */
  const handleRelayCountChange = (v: string) => {
    // نسمح بالحذف (string فارغ مؤقتاً)
    setRelayCount(v);
  };
  const handleRelayCountBlur = () => {
    const n = Math.max(1, Math.min(10, parseInt(relayCount) || 1));
    setRelayCount(String(n));
    setRelays(prev => {
      const next = [...prev];
      while (next.length < n) next.push({description:"",locationUrl:"",imageUrl:null});
      return next.slice(0, n);
    });
  };

  /* اختيار صورة لنقطة بث */
  const pickRelayImage = async (idx: number, fromCamera: boolean) => {
    try {
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") return;
        const res = await ImagePicker.launchCameraAsync({ quality: 0.3, base64: true });
        if (!res.canceled && res.assets[0]) {
          const uri = `data:image/jpeg;base64,${res.assets[0].base64}`;
          setRelays(prev => prev.map((r,j) => j===idx ? {...r,imageUrl:uri} : r));
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") return;
        const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.3, base64: true, mediaTypes: ["images"] as any });
        if (!res.canceled && res.assets[0]) {
          const uri = `data:image/jpeg;base64,${res.assets[0].base64}`;
          setRelays(prev => prev.map((r,j) => j===idx ? {...r,imageUrl:uri} : r));
        }
      }
    } catch {}
  };

  const handleSubmit = async () => {
    if (!form.address.trim()) { setErrMsg("وصف الموقع مطلوب"); return; }
    if (!form.deviceName.trim()) { setErrMsg("اسم الجهاز مطلوب"); return; }
    setErrMsg("");
    const payload: any = {
      address:     form.address.trim(),
      locationUrl: form.locationUrl.trim() || null,
      deviceName:  form.deviceName.trim(),
      deviceSerial: form.deviceSerial.trim() || null,
      notes:       form.notes.trim() || null,
      assignedToId:   assignedId   ?? null,
      assignedToName: assignedName || null,
    };
    if (svc === "broadband_internal") {
      payload.subscriptionName = form.subscriptionName.trim() || null;
      payload.internetFee      = form.internetFee ? parseFloat(form.internetFee) : null;
      if (hasBooster && boosterForm.deviceName.trim()) {
        payload.boosterDevice = {
          deviceName:      boosterForm.deviceName.trim(),
          deviceSerial:    boosterForm.deviceSerial.trim() || null,
          subscriptionFee: boosterForm.subscriptionFee ? parseFloat(boosterForm.subscriptionFee) : null,
        };
      }
    }
    if (svc === "hotspot_internal" && hasRelays) {
      payload.relayPoints = relays.filter(r => r.description.trim()).map(r => ({
        description: r.description.trim(),
        locationUrl: r.locationUrl.trim() || null,
        imageUrl:    r.imageUrl ?? null,
      }));
    }
    try {
      await onSubmit(payload);
    } catch (e: any) {
      setErrMsg(e?.message ?? "فشل التجهيز");
    }
  };

  const svcLabel = INSTALL_TYPE_AR[svc] ?? svc;
  const svcColor = INSTALL_TYPE_COLOR[svc] ?? Colors.primary;

  return (
    <Modal visible transparent animationType="slide">
      <View style={pm.overlay}>
        <View style={pm.sheet}>
          {/* رأس */}
          <View style={pm.header}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={pm.title}>تجهيز التذكرة #{item.id}</Text>
            <View style={[pm.badge, { backgroundColor: svcColor + "22" }]}>
              <Text style={[pm.badgeText, { color: svcColor }]}>{svcLabel}</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={pm.body} keyboardShouldPersistTaps="handled">

            {/* ── تأكيد الموقع ── */}
            <Text style={pm.sectionTitle}>تأكيد الموقع</Text>
            <MF label="وصف الموقع *" value={form.address} onChange={v=>setF("address",v)} multiline />
            <MF label="رابط الموقع (خرائط) — اختياري" value={form.locationUrl} onChange={v=>setF("locationUrl",v)} />

            {/* ── تسليم الجهاز ── */}
            <Text style={pm.sectionTitle}>بيانات الجهاز</Text>
            <MF label="اسم الجهاز *" value={form.deviceName} onChange={v=>setF("deviceName",v)} />
            <MF label="رقم الجهاز (Serial)" value={form.deviceSerial} onChange={v=>setF("deviceSerial",v)} />

            {/* ── برودباند فقط ── */}
            {svc === "broadband_internal" && (
              <>
                <Text style={pm.sectionTitle}>بيانات الاشتراك</Text>
                <MF label="اسم الاشتراك (مثال: andls123)" value={form.subscriptionName} onChange={v=>setF("subscriptionName",v)} />
                <MF label="قيمة اشتراك الإنترنت" value={form.internetFee} onChange={v=>setF("internetFee",v)} kb="decimal-pad" />

                {/* ── مقوي داخلي هوتسبوت ── */}
                <TouchableOpacity
                  style={[pm.toggleBtn, hasBooster && { borderColor: "#4CAF50", backgroundColor: "#4CAF5010" }]}
                  onPress={() => setHasBooster(h => !h)}
                >
                  <Ionicons name={hasBooster ? "checkbox" : "square-outline"} size={18} color={hasBooster ? "#4CAF50" : Colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={[pm.toggleText, hasBooster && { color: "#4CAF50" }]}>إضافة مقوي داخلي هوتسبوت</Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted, textAlign: "right" }}>العميل سيحصل على هوتسبوت داخلي + برودباند</Text>
                  </View>
                </TouchableOpacity>

                {hasBooster && (
                  <View style={pm.boosterSection}>
                    <View style={pm.boosterHeader}>
                      <Ionicons name="hardware-chip" size={15} color="#4CAF50" />
                      <Text style={pm.boosterTitle}>بيانات جهاز المقوي (هوتسبوت داخلي)</Text>
                    </View>
                    <MF label="اسم الجهاز (مثال: شاومي Redmi) *" value={boosterForm.deviceName} onChange={v=>setBF("deviceName",v)} />
                    <MF label="رقم الجهاز (Serial)" value={boosterForm.deviceSerial} onChange={v=>setBF("deviceSerial",v)} />
                    <MF label="قيمة اشتراك المقوي (فارغ = لم يُدفع)" value={boosterForm.subscriptionFee} onChange={v=>setBF("subscriptionFee",v)} kb="decimal-pad" />
                    <View style={pm.boosterNote}>
                      <Ionicons name="information-circle-outline" size={13} color={Colors.warning} />
                      <Text style={pm.boosterNoteText}>سيصل المهندس تذكرة منفصلة لتركيب المقوي مع توضيح ربطه بالبرودباند</Text>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* ── إسناد فني (قبل نقاط البث) ── */}
            <Text style={pm.sectionTitle}>الفني المنفذ — اختياري</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pm.chips} keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                style={[pm.chip, assignedId===null && pm.chipActive]}
                onPress={() => { setAssignedId(null); setAssignedName(""); }}
              >
                <Text style={[pm.chipTxt, assignedId===null && pm.chipActiveTxt]}>الكل</Text>
              </TouchableOpacity>
              {engineers.map(e => (
                <TouchableOpacity
                  key={e.id}
                  style={[pm.chip, assignedId===e.id && pm.chipActive]}
                  onPress={() => { setAssignedId(e.id); setAssignedName(e.name); }}
                >
                  <Text style={[pm.chipTxt, assignedId===e.id && pm.chipActiveTxt]}>{e.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* ── نقاط البث الخارجية (هوتسبوت داخلي فقط) ── */}
            {svc === "hotspot_internal" && (
              <>
                <TouchableOpacity
                  style={[pm.toggleBtn, hasRelays && { borderColor: "#9C27B0" }]}
                  onPress={() => setHasRelays(h => !h)}
                >
                  <Ionicons name={hasRelays ? "checkbox" : "square-outline"} size={18} color={hasRelays ? "#9C27B0" : Colors.textMuted} />
                  <Text style={[pm.toggleText, hasRelays && { color: "#9C27B0" }]}>إضافة نقاط بث خارجية</Text>
                </TouchableOpacity>
                {hasRelays && (
                  <View style={pm.relaySection}>
                    {/* عداد النقاط — مع دعم حذف الرقم والكتابة */}
                    <Text style={pm.fieldLabel}>عدد النقاط</Text>
                    <TextInput
                      style={pm.input}
                      value={relayCount}
                      onChangeText={handleRelayCountChange}
                      onBlur={handleRelayCountBlur}
                      keyboardType="number-pad"
                      textAlign="right"
                      selectTextOnFocus
                    />
                    {relays.map((r, i) => (
                      <View key={i} style={pm.relayItem}>
                        <Text style={pm.relayNum}>نقطة البث ({i+1})</Text>
                        <MF label="وصف الموقع *" value={r.description} onChange={v => setRelays(prev => prev.map((x,j)=>j===i?{...x,description:v}:x))} />
                        <MF label="رابط الموقع — اختياري" value={r.locationUrl} onChange={v => setRelays(prev => prev.map((x,j)=>j===i?{...x,locationUrl:v}:x))} />
                        {/* صورة الموقع */}
                        <Text style={pm.fieldLabel}>صورة الموقع — اختياري</Text>
                        <View style={pm.relayImgRow}>
                          <TouchableOpacity style={pm.relayImgBtn} onPress={() => pickRelayImage(i, true)}>
                            <Ionicons name="camera" size={18} color={Colors.primary} />
                            <Text style={pm.relayImgBtnTxt}>كاميرا</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={pm.relayImgBtn} onPress={() => pickRelayImage(i, false)}>
                            <Ionicons name="image" size={18} color={Colors.primary} />
                            <Text style={pm.relayImgBtnTxt}>معرض</Text>
                          </TouchableOpacity>
                        </View>
                        {r.imageUrl ? (
                          <View style={pm.relayImgPreviewWrap}>
                            <Image source={{ uri: r.imageUrl }} style={pm.relayImgPreview} resizeMode="cover" />
                            <TouchableOpacity
                              style={pm.relayImgRemove}
                              onPress={() => setRelays(prev => prev.map((x,j)=>j===i?{...x,imageUrl:null}:x))}
                            >
                              <Ionicons name="close-circle" size={24} color={Colors.error} />
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            <MF label="ملاحظات — اختياري" value={form.notes} onChange={v=>setF("notes",v)} multiline />

            {!!errMsg && (
              <View style={pm.errBox}>
                <Ionicons name="alert-circle-outline" size={15} color={Colors.error} />
                <Text style={pm.errText}>{errMsg}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[pm.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator size="small" color="#fff" />
                : <>
                    <Ionicons name="construct" size={18} color="#fff" />
                    <Text style={pm.submitTxt}>تأكيد التجهيز وإرسال للمهندس</Text>
                  </>
              }
            </TouchableOpacity>
            <View style={{height:30}} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* حقل إدخال موحّد داخل PrepareModal */
function MF({ label, value, onChange, kb, multiline }: {
  label:string; value:string; onChange:(v:string)=>void; kb?:any; multiline?:boolean;
}) {
  return (
    <View style={{marginBottom:10}}>
      <Text style={pm.fieldLabel}>{label}</Text>
      <TextInput
        style={[pm.input, multiline && {height:64}]}
        value={value}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor={Colors.textSecondary}
        keyboardType={kb}
        textAlign="right"
        textAlignVertical={multiline?"top":"center"}
        multiline={multiline}
      />
    </View>
  );
}

/* أنماط PrepareModal */
const pm = StyleSheet.create({
  overlay:  { flex:1, backgroundColor:"#000000AA", justifyContent:"flex-end" },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "92%",
  },
  header: {
    flexDirection: "row-reverse", alignItems: "center",
    paddingHorizontal: 18, paddingVertical: 14, gap: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title:     { flex:1, fontSize:16, fontWeight:"bold", color:Colors.text, textAlign:"right" },
  badge:     { paddingHorizontal:10, paddingVertical:4, borderRadius:8 },
  badgeText: { fontSize:12, fontWeight:"bold" },
  body:      { paddingHorizontal:18, paddingTop:12 },
  sectionTitle: { fontSize:13, fontWeight:"700", color:Colors.textSecondary, textAlign:"right", marginTop:8, marginBottom:6, borderBottomWidth:1, borderBottomColor:Colors.border, paddingBottom:4 },
  fieldLabel:   { fontSize:13, fontWeight:"600", color:Colors.textSecondary, textAlign:"right", marginBottom:4 },
  input: {
    backgroundColor: Colors.surfaceElevated, borderRadius:10,
    borderWidth:1, borderColor:Colors.border, padding:11,
    fontSize:14, color:Colors.text, textAlign:"right", height:44,
  },
  toggleBtn: {
    flexDirection:"row-reverse", alignItems:"center", gap:8,
    backgroundColor: "#9C27B011", borderRadius:10, padding:12,
    borderWidth:1, borderColor:Colors.border, marginBottom:8,
  },
  toggleText: { fontSize:14, color:Colors.textSecondary, fontWeight:"600" },
  relaySection: { backgroundColor:Colors.surfaceElevated, borderRadius:12, padding:12, gap:8, marginBottom:8 },
  relayItem:    { borderTopWidth:1, borderTopColor:Colors.border, paddingTop:8, marginTop:4 },
  relayNum:     { fontSize:13, fontWeight:"bold", color:"#9C27B0", textAlign:"right", marginBottom:6 },

  boosterSection: {
    backgroundColor: "#4CAF5010",
    borderRadius: 12, borderWidth: 1, borderColor: "#4CAF5040",
    padding: 12, gap: 8, marginTop: 4, marginBottom: 8,
  },
  boosterHeader: { flexDirection:"row-reverse", alignItems:"center", gap:6, marginBottom:4 },
  boosterTitle:  { fontSize:13, fontWeight:"bold", color:"#4CAF50", textAlign:"right" },
  boosterNote: {
    flexDirection:"row-reverse", alignItems:"flex-start", gap:5,
    backgroundColor: Colors.warning + "18", borderRadius:8, padding:8,
  },
  boosterNoteText: { fontSize:11, color:Colors.warning, flex:1, textAlign:"right", lineHeight:16 },
  relayImgRow:  { flexDirection:"row-reverse", gap:8, marginBottom:8 },
  relayImgBtn:  { flex:1, flexDirection:"row-reverse", alignItems:"center", justifyContent:"center", gap:6,
                  backgroundColor:Colors.surface, borderWidth:1, borderColor:Colors.border,
                  borderRadius:10, paddingVertical:10 },
  relayImgBtnTxt: { fontSize:13, fontWeight:"600", color:Colors.primary },
  relayImgPreviewWrap: { borderRadius:12, overflow:"hidden", marginBottom:8, position:"relative" },
  relayImgPreview:     { width:"100%", height:150, borderRadius:12 },
  relayImgRemove:      { position:"absolute", top:6, left:6, backgroundColor:"#000000AA", borderRadius:12 },
  chips:    { flexDirection:"row-reverse", gap:8, paddingVertical:4, marginBottom:10 },
  chip:     { paddingHorizontal:14, paddingVertical:7, borderRadius:10, borderWidth:1, borderColor:Colors.border, backgroundColor:Colors.surface },
  chipActive:    { backgroundColor:Colors.primary, borderColor:Colors.primary },
  chipTxt:       { fontSize:13, color:Colors.textSecondary },
  chipActiveTxt: { color:"#fff", fontWeight:"bold" },
  errBox:   { flexDirection:"row-reverse", alignItems:"center", gap:6, backgroundColor:Colors.error+"18", borderRadius:8, padding:10, marginBottom:8 },
  errText:  { fontSize:13, color:Colors.error, flex:1, textAlign:"right" },
  submitBtn: {
    flexDirection:"row-reverse", alignItems:"center", justifyContent:"center",
    gap:8, backgroundColor:Colors.primary, borderRadius:12, padding:14, marginTop:8,
  },
  submitTxt: { fontSize:15, fontWeight:"bold", color:"#fff" },
});

/* ════════════════════════════════════════════════
   مودال الأرشفة
════════════════════════════════════════════════ */
function ArchiveModal({ item, submitting, onClose, onSubmit }: {
  item: any; submitting: boolean;
  onClose: () => void; onSubmit: (payload: any) => Promise<void>;
}) {
  const [notes, setNotes] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const svcLabel = INSTALL_TYPE_AR[item.serviceType] ?? item.serviceType;
  const svcColor = INSTALL_TYPE_COLOR[item.serviceType] ?? Colors.primary;

  const handleSubmit = async () => {
    setErrMsg("");
    try {
      await onSubmit({ archiveNotes: notes.trim() || null });
    } catch (e: any) {
      setErrMsg(e?.message ?? "فشل الأرشفة");
    }
  };

  return (
    <Modal visible transparent animationType="fade">
      <View style={am.overlay}>
        <View style={am.card}>
          {/* أيقونة + عنوان */}
          <View style={am.iconCircle}>
            <Ionicons name="archive" size={36} color={Colors.success} />
          </View>
          <Text style={am.title}>تأكيد الأرشفة #{item.id}</Text>

          {/* ملخص التذكرة */}
          <View style={am.summaryBox}>
            <View style={[am.badge, { backgroundColor: svcColor + "22" }]}>
              <Text style={[am.badgeText, { color: svcColor }]}>{svcLabel}</Text>
            </View>
            {item.clientName   && <Text style={am.summaryText}>العميل: {item.clientName}</Text>}
            {item.deviceName   && <Text style={am.summaryText}>الجهاز: {item.deviceName} — {item.deviceSerial ?? "—"}</Text>}
            {item.address      && <Text style={am.summaryText}>الموقع: {item.address}</Text>}
            {item.subscriptionFee && <Text style={am.summaryText}>الاشتراك: {item.subscriptionFee} ريال</Text>}
            {item.internetFee  && <Text style={am.summaryText}>رسوم الإنترنت: {item.internetFee} ريال</Text>}
            {item.assignedToName && <Text style={am.summaryText}>المهندس: {item.assignedToName}</Text>}
          </View>

          <Text style={am.fieldLabel}>ملاحظات الأرشفة — اختياري</Text>
          <TextInput
            style={[am.input, {height:60}]}
            value={notes}
            onChangeText={setNotes}
            placeholder="أضف ملاحظة..."
            placeholderTextColor={Colors.textSecondary}
            textAlign="right"
            textAlignVertical="top"
            multiline
          />

          {!!errMsg && (
            <View style={am.errBox}>
              <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
              <Text style={am.errText}>{errMsg}</Text>
            </View>
          )}

          <View style={am.actions}>
            <TouchableOpacity style={am.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={am.cancelTxt}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[am.confirmBtn, submitting && {opacity:0.6}]} onPress={handleSubmit} disabled={submitting}>
              {submitting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={am.confirmTxt}>تأكيد الأرشفة</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const am = StyleSheet.create({
  overlay: { flex:1, backgroundColor:"#000000BB", alignItems:"center", justifyContent:"center" },
  card: {
    backgroundColor: Colors.surface, borderRadius:20, padding:22,
    width:"88%", gap:10, alignItems:"center",
  },
  iconCircle: {
    width:70, height:70, borderRadius:35,
    backgroundColor: Colors.success + "18",
    alignItems:"center", justifyContent:"center", marginBottom:4,
  },
  title: { fontSize:18, fontWeight:"bold", color:Colors.text, textAlign:"center" },
  summaryBox: {
    backgroundColor: Colors.surfaceElevated, borderRadius:12,
    padding:12, width:"100%", gap:4, alignItems:"flex-end",
  },
  badge:     { paddingHorizontal:10, paddingVertical:4, borderRadius:8, marginBottom:4 },
  badgeText: { fontSize:12, fontWeight:"bold" },
  summaryText: { fontSize:13, color:Colors.textSecondary, textAlign:"right" },
  fieldLabel: { fontSize:13, fontWeight:"600", color:Colors.textSecondary, textAlign:"right", alignSelf:"flex-end" },
  input: {
    backgroundColor: Colors.surfaceElevated, borderRadius:10,
    borderWidth:1, borderColor:Colors.border, padding:10,
    fontSize:14, color:Colors.text, textAlign:"right", width:"100%",
  },
  errBox: { flexDirection:"row-reverse", alignItems:"center", gap:6, backgroundColor:Colors.error+"18", borderRadius:8, padding:8, width:"100%" },
  errText: { fontSize:13, color:Colors.error, flex:1, textAlign:"right" },
  actions: { flexDirection:"row-reverse", gap:10, width:"100%", marginTop:4 },
  cancelBtn: { flex:1, paddingVertical:12, borderRadius:12, alignItems:"center", backgroundColor:Colors.surfaceElevated },
  cancelTxt: { fontSize:15, fontWeight:"bold", color:Colors.textSecondary },
  confirmBtn:{ flex:1, paddingVertical:12, borderRadius:12, alignItems:"center", backgroundColor:Colors.success },
  confirmTxt:{ fontSize:15, fontWeight:"bold", color:"#fff" },
});

/* ════════════════════════════════════════════════
   الأنماط
════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.background },

  /* رأس الصفحة */
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title:      { fontSize: 20, fontWeight: "bold", color: Colors.text },
  refreshBtn: { padding: 6 },

  /* تبديل القسم */
  sectionRow: { flexDirection: "row-reverse", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  sectionBtn: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  sectionBtnText: { fontSize: 13, color: Colors.textSecondary },
  countBubble: {
    minWidth: 20, height: 20, borderRadius: 10,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 5,
  },
  countBubbleText: { fontSize: 11, color: "#fff", fontWeight: "bold" },

  /* محتوى القائمة */
  content:   { padding: 14 },
  countText: { fontSize: 12, color: Colors.textMuted, textAlign: "right", marginBottom: 10 },
  emptyBox:  { alignItems: "center", marginTop: 70, gap: 14 },
  emptyText: { fontSize: 14, color: Colors.textMuted },

  /* البطاقة */
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
  },
  ticketNum: { fontSize: 13, fontWeight: "bold", color: Colors.textMuted, minWidth: 34, textAlign: "right" },
  typePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typePillText: { fontSize: 12, fontWeight: "bold" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusPillText: { fontSize: 12, fontWeight: "bold" },

  /* الأولوية والتخصيص */
  metaRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, flexWrap: "wrap" },
  prioPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
  },
  prioPillText: { fontSize: 11, fontWeight: "600" },
  assignPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  assignPillText: { fontSize: 11, fontWeight: "600" },

  /* بيانات العميل */
  clientName: { fontSize: 14, fontWeight: "bold", color: Colors.text, textAlign: "right" },
  phoneRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  phoneText: { fontSize: 13, color: Colors.success, textAlign: "right" },

  /* الموقع والوصف */
  infoRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  infoText: { fontSize: 13, color: Colors.textSecondary, textAlign: "right", flex: 1 },
  problemText: {
    fontSize: 13, color: Colors.text, textAlign: "right",
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8, padding: 8, fontStyle: "italic",
  },

  /* التفاصيل الموسّعة */
  expandedBox: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10, padding: 10, gap: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  infoLine: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  infoLineLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: "600" },
  infoLineValue: { fontSize: 12, color: Colors.text, flex: 1, textAlign: "right" },

  /* أزرار الإجراءات */
  actionBtns: {
    flexDirection: "row-reverse",
    borderTopWidth: 1, borderTopColor: Colors.border,
    marginTop: 4, paddingTop: 10, gap: 6,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
  },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },

  /* مودال التايملاين */
  overlay: { flex: 1, backgroundColor: "#000000BB", alignItems: "center", justifyContent: "center" },
  timelineCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20, padding: 24, width: "88%", gap: 4,
  },
  timelineTitle: { fontSize: 17, fontWeight: "bold", color: Colors.text, textAlign: "right", marginBottom: 14 },
  tlRow: {
    flexDirection: "row-reverse", alignItems: "flex-start", gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tlIconCircle: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.surfaceElevated,
  },
  tlLabel: { fontSize: 12, color: Colors.textSecondary, textAlign: "right" },
  tlTime:  { fontSize: 13, fontWeight: "600", textAlign: "right", marginTop: 2 },
  timelineEngineerRow: {
    flexDirection: "row-reverse", alignItems: "center", gap: 8,
    paddingTop: 12, paddingBottom: 4,
  },
  timelineEngineerText: { fontSize: 13, fontWeight: "600", color: Colors.text },
  timelineCloseBtn: {
    marginTop: 14, alignSelf: "center",
    backgroundColor: Colors.primary, paddingHorizontal: 40, paddingVertical: 11,
    borderRadius: 12,
  },
  timelineCloseBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },

  /* مودال الحذف */
  deleteCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20, padding: 28, width: "82%", alignItems: "center", gap: 12,
  },
  deleteIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.error + "18",
    alignItems: "center", justifyContent: "center",
  },
  deleteTitle: { fontSize: 18, fontWeight: "bold", color: Colors.text, textAlign: "center" },
  deleteMsg:   { fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 22 },
  deleteActions: { flexDirection: "row-reverse", gap: 10, marginTop: 6, width: "100%" },
  deleteCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, alignItems: "center",
  },
  deleteCancelText:  { color: Colors.textSecondary, fontWeight: "bold", fontSize: 14 },
  deleteConfirmBtn:  { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.error, alignItems: "center" },
  deleteConfirmText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
});

/* شارات InstallCard للمشرف */
const icSup = StyleSheet.create({
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
  relayText: { fontSize: 11, fontWeight: "bold", color: "#9C27B0" },

  boosterBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#4CAF5022",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  boosterText: { fontSize: 11, fontWeight: "bold", color: "#4CAF50", flex: 1, textAlign: "right" },
});
