import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, Modal, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiDelete, formatDate } from "@/utils/api";

/* ─────────────── ثوابت ─────────────── */
const SUPERVISOR_COLOR = Colors.roles?.supervisor ?? "#00BCD4";

const STATUS: Record<string, { bg: string; color: string; label: string }> = {
  new:         { bg: "#2196F322", color: "#2196F3", label: "جديدة" },
  pending:     { bg: "#2196F322", color: "#2196F3", label: "جديدة" },
  draft:       { bg: "#90909022", color: "#909090", label: "مسودة" },
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
  hotspot_internal: "تركيب هوتسبوت داخلي",
  hotspot_external: "تركيب هوتسبوت خارجي",
  broadband:        "تركيب برودباند",
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

  /* ─── فلترة ─── */
  const filterItems = (items: any[]) => items.filter(item => {
    const s = item.status ?? "";
    if (statusFilter === "all")         return true;
    if (statusFilter === "pending")     return ["pending", "new", "draft"].includes(s);
    if (statusFilter === "in_progress") return s === "in_progress";
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
    if (key === "in_progress") return s === "in_progress";
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
  const si = STATUS[item.status] ?? STATUS["pending"];
  const typeLabel = SERVICE_TYPE_AR[item.serviceType] ?? `إصلاح ${item.serviceType ?? ""}`;
  const typeColor = SERVICE_TYPE_COLOR[item.serviceType] ?? Colors.primary;
  const prioInfo  = PRIORITY_AR[item.priority] ?? { label: item.priority ?? "—", color: Colors.textMuted };
  const canDelete = ["new", "pending", "draft"].includes(item.status ?? "");
  const showContact = item.serviceType !== "hotspot_external";

  return (
    <View style={styles.card}>
      {/* ─ رأس البطاقة ─ */}
      <View style={styles.cardHeader}>
        <Text style={styles.ticketNum}>#{item.id}</Text>
        <View style={{ flexDirection: "row-reverse", gap: 6, flex: 1, flexWrap: "wrap", justifyContent: "flex-start" }}>
          <View style={[styles.typePill, { backgroundColor: typeColor + "22" }]}>
            <Text style={[styles.typePillText, { color: typeColor }]}>{typeLabel}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: si.bg }]}>
            <Text style={[styles.statusPillText, { color: si.color }]}>{si.label}</Text>
          </View>
        </View>
      </View>

      {/* ─ الأولوية والتخصيص ─ */}
      <View style={styles.metaRow}>
        <View style={[styles.prioPill, { borderColor: prioInfo.color + "60" }]}>
          <Text style={[styles.prioPillText, { color: prioInfo.color }]}>{prioInfo.label}</Text>
        </View>
        <View style={styles.assignPill}>
          <Ionicons
            name={item.assignedToName ? "person-circle" : "people-circle-outline"}
            size={13}
            color={item.assignedToName ? Colors.primary : Colors.textMuted}
          />
          <Text style={[styles.assignPillText, { color: item.assignedToName ? Colors.primary : Colors.textMuted }]}>
            {item.assignedToName ?? "للجميع"}
          </Text>
        </View>
      </View>

      {/* ─ بيانات العميل ─ */}
      {showContact && item.clientName && (
        <Text style={styles.clientName}>{item.clientName}</Text>
      )}
      {showContact && item.clientPhone && (
        <TouchableOpacity style={styles.phoneRow} onPress={() => Linking.openURL(`tel:${item.clientPhone}`)}>
          <Ionicons name="call-outline" size={14} color={Colors.success} />
          <Text style={styles.phoneText}>{item.clientPhone}</Text>
        </TouchableOpacity>
      )}

      {/* ─ الموقع ─ */}
      {item.location && (
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.infoText}>{item.location}</Text>
        </View>
      )}
      {item.locationUrl && (
        <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(item.locationUrl)}>
          <Ionicons name="map-outline" size={14} color={Colors.info} />
          <Text style={[styles.infoText, { color: Colors.info }]}>فتح الخريطة</Text>
        </TouchableOpacity>
      )}

      {/* ─ وصف المشكلة ─ */}
      {item.problemDescription && (
        <Text style={styles.problemText}>{item.problemDescription}</Text>
      )}

      {/* ─ التفاصيل الموسّعة ─ */}
      {expanded && (
        <View style={styles.expandedBox}>
          {item.notes && (
            <InfoLine icon="document-text-outline" label="ملاحظات" value={item.notes} />
          )}
          {item.createdByName && (
            <InfoLine icon="person-outline" label="أنشأه" value={item.createdByName} />
          )}
          <InfoLine icon="calendar-outline" label="تاريخ الإنشاء" value={formatDate(item.createdAt)} />
          {item.startedAt && (
            <InfoLine icon="play-outline" label="بدء التنفيذ" value={formatDate(item.startedAt)} />
          )}
          {item.resolvedAt && (
            <InfoLine icon="checkmark-circle-outline" label="وقت الإنجاز" value={formatDate(item.resolvedAt)} />
          )}
        </View>
      )}

      {/* ─ أزرار الإجراءات ─ */}
      <View style={styles.actionBtns}>
        <TouchableOpacity style={styles.actionBtn} onPress={onExpand}>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={Colors.textSecondary} />
          <Text style={styles.actionBtnText}>{expanded ? "إخفاء" : "تفاصيل"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onTimeline}>
          <Ionicons name="time-outline" size={14} color={SUPERVISOR_COLOR} />
          <Text style={[styles.actionBtnText, { color: SUPERVISOR_COLOR }]}>متابعة</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, !canDelete && styles.actionBtnDisabled]}
          onPress={canDelete ? onDelete : undefined}
          disabled={!canDelete}
        >
          <Ionicons name="trash-outline" size={14} color={canDelete ? Colors.error : Colors.textMuted} />
          <Text style={[styles.actionBtnText, { color: canDelete ? Colors.error : Colors.textMuted }]}>
            حذف
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════
   بطاقة تذكرة التركيب
════════════════════════════════════════════════ */
function InstallCard({ item, expanded, onExpand, onTimeline, onDelete }: {
  item: any;
  expanded: boolean;
  onExpand: () => void;
  onTimeline: () => void;
  onDelete: () => void;
}) {
  const si = STATUS[item.status] ?? STATUS["pending"];
  const typeLabel = INSTALL_TYPE_AR[item.serviceType] ?? `تركيب ${item.serviceType ?? ""}`;
  const canDelete = ["new", "pending"].includes(item.status ?? "");

  return (
    <View style={styles.card}>
      {/* ─ رأس البطاقة ─ */}
      <View style={styles.cardHeader}>
        <Text style={styles.ticketNum}>#{item.id}</Text>
        <View style={{ flexDirection: "row-reverse", gap: 6, flex: 1, flexWrap: "wrap", justifyContent: "flex-start" }}>
          <View style={[styles.typePill, { backgroundColor: Colors.info + "22" }]}>
            <Text style={[styles.typePillText, { color: Colors.info }]}>{typeLabel}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: si.bg }]}>
            <Text style={[styles.statusPillText, { color: si.color }]}>{si.label}</Text>
          </View>
        </View>
      </View>

      {/* ─ التخصيص ─ */}
      <View style={styles.metaRow}>
        <View style={styles.assignPill}>
          <Ionicons
            name={item.assignedToName ? "person-circle" : "people-circle-outline"}
            size={13}
            color={item.assignedToName ? Colors.primary : Colors.textMuted}
          />
          <Text style={[styles.assignPillText, { color: item.assignedToName ? Colors.primary : Colors.textMuted }]}>
            {item.assignedToName ?? "للجميع"}
          </Text>
        </View>
      </View>

      {/* ─ بيانات العميل ─ */}
      {item.clientName && (
        <Text style={styles.clientName}>{item.clientName}</Text>
      )}
      {item.clientPhone && (
        <TouchableOpacity style={styles.phoneRow} onPress={() => Linking.openURL(`tel:${item.clientPhone}`)}>
          <Ionicons name="call-outline" size={14} color={Colors.success} />
          <Text style={styles.phoneText}>{item.clientPhone}</Text>
        </TouchableOpacity>
      )}

      {/* ─ الموقع ─ */}
      {item.address && (
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.infoText}>{item.address}</Text>
        </View>
      )}
      {item.locationUrl && (
        <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(item.locationUrl)}>
          <Ionicons name="map-outline" size={14} color={Colors.info} />
          <Text style={[styles.infoText, { color: Colors.info }]}>فتح الخريطة</Text>
        </TouchableOpacity>
      )}

      {item.notes && (
        <Text style={styles.problemText}>{item.notes}</Text>
      )}

      {/* ─ التفاصيل الموسّعة ─ */}
      {expanded && (
        <View style={styles.expandedBox}>
          <InfoLine icon="calendar-outline"    label="تاريخ الإنشاء" value={formatDate(item.createdAt)} />
          {item.scheduledAt && (
            <InfoLine icon="time-outline"      label="موعد التنفيذ"  value={formatDate(item.scheduledAt)} />
          )}
          {item.completedAt && (
            <InfoLine icon="checkmark-circle-outline" label="تاريخ الانتهاء" value={formatDate(item.completedAt)} />
          )}
          {item.subscriptionFee && (
            <InfoLine icon="cash-outline"      label="رسوم الاشتراك" value={`${item.subscriptionFee} ريال`} />
          )}
          {item.deviceName && (
            <InfoLine icon="hardware-chip-outline" label="الجهاز"   value={item.deviceName} />
          )}
        </View>
      )}

      {/* ─ أزرار الإجراءات ─ */}
      <View style={styles.actionBtns}>
        <TouchableOpacity style={styles.actionBtn} onPress={onExpand}>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={Colors.textSecondary} />
          <Text style={styles.actionBtnText}>{expanded ? "إخفاء" : "تفاصيل"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onTimeline}>
          <Ionicons name="time-outline" size={14} color={SUPERVISOR_COLOR} />
          <Text style={[styles.actionBtnText, { color: SUPERVISOR_COLOR }]}>متابعة</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, !canDelete && styles.actionBtnDisabled]}
          onPress={canDelete ? onDelete : undefined}
          disabled={!canDelete}
        >
          <Ionicons name="trash-outline" size={14} color={canDelete ? Colors.error : Colors.textMuted} />
          <Text style={[styles.actionBtnText, { color: canDelete ? Colors.error : Colors.textMuted }]}>
            حذف
          </Text>
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
