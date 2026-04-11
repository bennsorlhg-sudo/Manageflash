import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, Modal, Linking, TextInput, Image,
  KeyboardAvoidingView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiDelete, apiPost, apiPatch, formatDate } from "@/utils/api";

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
  { key: "archived",    label: "مؤرشفة" },
];

/* ─────────────── نوع القسم ─────────────── */
type Section = "repair" | "install" | "purchase";
type PurchaseTab = "new" | "completed";

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
  const [statusFilter,   setStatusFilter]   = useState("pending");
  const [repairTickets,  setRepairTickets]  = useState<any[]>([]);
  const [installTickets, setInstallTickets] = useState<any[]>([]);
  const [purchaseItems,  setPurchaseItems]  = useState<any[]>([]);
  const [purchaseTxns,   setPurchaseTxns]   = useState<any[]>([]);
  const [purchaseTab,    setPurchaseTab]    = useState<PurchaseTab>("new");
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
  /* repair archive / reopen */
  const [repairArchivingId, setRepairArchivingId] = useState<number | null>(null);
  const [repairReopeningId, setRepairReopeningId] = useState<number | null>(null);
  /* engineers list */
  const [engineers, setEngineers] = useState<{id:number;name:string}[]>([]);
  /* عرض صورة الإتمام */
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);

  /* ─── جلب البيانات ─── */
  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); }
    try {
      const [r, i, pr, ptx] = await Promise.all([
        apiGet("/tickets/repair", token),
        apiGet("/tickets/installation", token),
        apiGet("/purchase-requests", token),
        apiGet("/transactions/purchases", token),
      ]);
      setRepairTickets(Array.isArray(r) ? r : []);
      setInstallTickets(Array.isArray(i) ? i : []);
      setPurchaseItems(Array.isArray(pr) ? pr.filter((p: any) => p.status === "pending") : []);
      setPurchaseTxns(Array.isArray(ptx) ? ptx : []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    apiGet("/users/engineers", token).then(setEngineers).catch(() => {});
  }, [token]);

  /* ─── موافقة / حذف صورة تنفيذ الإصلاح ─── */
  const handleApprovePhoto = async (id: number) => {
    try {
      await apiPatch(`/tickets/repair/${id}`, token, { completionPhotoApproved: true });
      setRepairTickets(prev => prev.map(t => t.id === id ? { ...t, completionPhotoApproved: true } : t));
    } catch {}
  };

  const handleDeletePhoto = async (id: number) => {
    try {
      await apiPatch(`/tickets/repair/${id}`, token, { completionPhotoUrl: null, completionPhotoApproved: false });
      setRepairTickets(prev => prev.map(t => t.id === id ? { ...t, completionPhotoUrl: null, completionPhotoApproved: false } : t));
    } catch {}
  };

  /* ─── فلترة ─── */
  const filterItems = (items: any[]) => items.filter(item => {
    const s = item.status ?? "";
    if (statusFilter === "all")         return true;
    if (statusFilter === "pending")     return ["pending", "new", "draft"].includes(s);
    if (statusFilter === "in_progress") return ["in_progress", "preparing"].includes(s);
    if (statusFilter === "completed")   return s === "completed";
    if (statusFilter === "archived")    return s === "archived";
    return true;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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

  /* ─── أرشفة التذكرة (تركيب) ─── */
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

  /* ─── أرشفة تذكرة إصلاح (مكتملة → مؤرشفة + إنجاز) ─── */
  const handleRepairArchive = async (id: number) => {
    setRepairArchivingId(id);
    try {
      const updated = await apiPost(`/tickets/repair/${id}/archive`, token, {});
      setRepairTickets(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
    } catch {} finally {
      setRepairArchivingId(null);
    }
  };

  /* ─── إعادة فتح تذكرة إصلاح مؤرشفة ─── */
  const handleRepairReopen = async (id: number) => {
    setRepairReopeningId(id);
    try {
      const updated = await apiPost(`/tickets/repair/${id}/reopen`, token, {});
      setRepairTickets(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
    } catch {} finally {
      setRepairReopeningId(null);
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
          <Ionicons name="build" size={14} color={section === "repair" ? Colors.error : Colors.textSecondary} />
          <Text style={[styles.sectionBtnText, section === "repair" && { color: Colors.error, fontWeight: "bold" }]}>
            الإصلاح
          </Text>
          <View style={[styles.countBubble, { backgroundColor: Colors.error }]}>
            <Text style={styles.countBubbleText}>{repairTickets.length}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sectionBtn, section === "install" && { backgroundColor: Colors.info + "22", borderColor: Colors.info }]}
          onPress={() => setSection("install")}
        >
          <Ionicons name="add-circle" size={14} color={section === "install" ? Colors.info : Colors.textSecondary} />
          <Text style={[styles.sectionBtnText, section === "install" && { color: Colors.info, fontWeight: "bold" }]}>
            التركيب
          </Text>
          <View style={[styles.countBubble, { backgroundColor: Colors.info }]}>
            <Text style={styles.countBubbleText}>{installTickets.length}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sectionBtn, section === "purchase" && { backgroundColor: "#FF9800" + "22", borderColor: "#FF9800" }]}
          onPress={() => setSection("purchase")}
        >
          <Ionicons name="cart" size={14} color={section === "purchase" ? "#FF9800" : Colors.textSecondary} />
          <Text style={[styles.sectionBtnText, section === "purchase" && { color: "#FF9800", fontWeight: "bold" }]}>
            الشراء
          </Text>
          <View style={[styles.countBubble, { backgroundColor: "#FF9800" }]}>
            <Text style={styles.countBubbleText}>{purchaseItems.length}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── فلتر الحالة (إصلاح/تركيب فقط) ── */}
      {section !== "purchase" && (
        <FilterBar
          active={statusFilter}
          onSelect={setStatusFilter}
          source={section === "repair" ? repairTickets : installTickets}
        />
      )}

      {/* ── تبويبات المشتريات ── */}
      {section === "purchase" && (
        <View style={styles.purchaseTabRow}>
          <TouchableOpacity
            style={[styles.purchaseTabBtn, purchaseTab === "new" && { backgroundColor: Colors.info + "22", borderColor: Colors.info }]}
            onPress={() => setPurchaseTab("new")}
          >
            <Text style={[styles.purchaseTabTxt, purchaseTab === "new" && { color: Colors.info, fontWeight: "bold" }]}>
              الجديدة ({purchaseItems.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.purchaseTabBtn, purchaseTab === "completed" && { backgroundColor: Colors.success + "22", borderColor: Colors.success }]}
            onPress={() => setPurchaseTab("completed")}
          >
            <Text style={[styles.purchaseTabTxt, purchaseTab === "completed" && { color: Colors.success, fontWeight: "bold" }]}>
              المكتملة ({purchaseTxns.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

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
        {section === "purchase" ? (
          /* ════ قسم المشتريات ════ */
          <>
            {purchaseTab === "new" ? (
              purchaseItems.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="cart-outline" size={52} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>لا توجد طلبات شراء جديدة</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.countText}>{purchaseItems.length} صنف مطلوب</Text>
                  {purchaseItems.map(item => (
                    <PurchaseItemCard
                      key={item.id}
                      item={item}
                      onDelete={() => {
                        setPurchaseItems(prev => prev.filter(p => p.id !== item.id));
                      }}
                      token={token}
                    />
                  ))}
                </>
              )
            ) : (
              purchaseTxns.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="bag-check-outline" size={52} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>لا توجد مشتريات مكتملة بعد</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.countText}>{purchaseTxns.length} عملية شراء</Text>
                  {purchaseTxns.map(txn => (
                    <PurchaseTransactionCard
                      key={txn.id}
                      txn={txn}
                      onViewImage={setViewImageUrl}
                    />
                  ))}
                </>
              )
            )}
          </>
        ) : (
          /* ════ الإصلاح والتركيب ════ */
          <>
            <Text style={styles.countText}>{filterItems(section === "repair" ? repairTickets : installTickets).length} تذكرة</Text>

            {filterItems(section === "repair" ? repairTickets : installTickets).length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="checkmark-circle-outline" size={52} color={Colors.textMuted} />
                <Text style={styles.emptyText}>لا توجد تذاكر في هذا الفلتر</Text>
              </View>
            ) : section === "repair" ? (
              filterItems(repairTickets).map(item => (
                <RepairCard
                  key={item.id}
                  item={item}
                  expanded={expandedId === item.id}
                  onExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  onTimeline={() => openTimeline(item, "repair")}
                  onDelete={() => openDelete(item.id, `#${item.id}`, "repair")}
                  onViewImage={setViewImageUrl}
                  onApprovePhoto={handleApprovePhoto}
                  onDeletePhoto={handleDeletePhoto}
                  onArchive={() => handleRepairArchive(item.id)}
                  onReopen={() => handleRepairReopen(item.id)}
                  archiving={repairArchivingId === item.id}
                  reopening={repairReopeningId === item.id}
                />
              ))
            ) : (
              filterItems(installTickets).map(item => (
                <InstallCard
                  key={item.id}
                  item={item}
                  expanded={expandedId === item.id}
                  onExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  onTimeline={() => openTimeline(item, "install")}
                  onDelete={() => openDelete(item.id, `#${item.id}`, "install")}
                  onPrepare={() => setPrepareItem(item)}
                  onArchive={() => setArchiveItem(item)}
                  onViewImage={setViewImageUrl}
                />
              ))
            )}
          </>
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

      {/* ════ مودال عرض صورة الإتمام ════ */}
      <Modal visible={!!viewImageUrl} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "#000000CC", justifyContent: "center", alignItems: "center" }}
          activeOpacity={1}
          onPress={() => setViewImageUrl(null)}
        >
          {!!viewImageUrl && (
            <Image
              source={{ uri: viewImageUrl }}
              style={{ width: "94%", height: 400, borderRadius: 12 }}
              resizeMode="contain"
            />
          )}
          <Text style={{ color: "#fff", marginTop: 12, fontSize: 13 }}>اضغط للإغلاق</Text>
        </TouchableOpacity>
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
    if (key === "in_progress") return ["in_progress", "preparing"].includes(s);
    if (key === "completed")   return s === "completed";
    if (key === "archived")    return s === "archived";
    return false;
  }).length;
}

const FILTER_META: Record<string, { color: string }> = {
  all:         { color: Colors.primary },
  pending:     { color: "#2196F3" },
  in_progress: { color: "#FF9800" },
  completed:   { color: "#4CAF50" },
  archived:    { color: "#9E9E9E" },
};

function FilterBar({ active, onSelect, source }: {
  active: string;
  onSelect: (k: string) => void;
  source: any[];
}) {
  const filters = [
    { key: "all",         label: "الكل",     count: source.length },
    { key: "pending",     label: "جديدة",    count: countByKey(source, "pending") },
    { key: "in_progress", label: "جاري",     count: countByKey(source, "in_progress") },
    { key: "completed",   label: "مكتملة",   count: countByKey(source, "completed") },
    { key: "archived",    label: "مؤرشفة",   count: countByKey(source, "archived") },
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
function RepairCard({ item, expanded, onExpand, onTimeline, onDelete, onViewImage, onApprovePhoto, onDeletePhoto, onArchive, onReopen, archiving, reopening }: {
  item: any;
  expanded: boolean;
  onExpand: () => void;
  onTimeline: () => void;
  onDelete: () => void;
  onViewImage?: (url: string) => void;
  onApprovePhoto?: (id: number) => void;
  onDeletePhoto?: (id: number) => void;
  onArchive?: () => void;
  onReopen?: () => void;
  archiving?: boolean;
  reopening?: boolean;
}) {
  const si            = STATUS[item.status] ?? STATUS["pending"];
  const typeLabel     = SERVICE_TYPE_AR[item.serviceType] ?? `إصلاح ${item.serviceType ?? ""}`;
  const typeColor     = SERVICE_TYPE_COLOR[item.serviceType] ?? Colors.primary;
  const prioInfo      = PRIORITY_AR[item.priority] ?? { label: item.priority ?? "—", color: Colors.textMuted };
  const showContact   = item.serviceType !== "hotspot_external";
  const isCompleted   = item.status === "completed";
  const hasPhone      = showContact && !!item.clientPhone;
  const hasMap        = !!item.locationUrl;
  const hasContract   = !!item.contractImageUrl;
  /* صورة التنفيذ: معلقة (بانتظار المشرف) أو معتمدة */
  const hasPendingPhoto  = isCompleted && !!item.completionPhotoUrl && !item.completionPhotoApproved;
  const hasApprovedPhoto = isCompleted && !!item.completionPhotoUrl && !!item.completionPhotoApproved;

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

      {/* ══ صورة التنفيذ المعلقة — تنتظر قرار المشرف ══ */}
      {hasPendingPhoto && (
        <View style={rc.pendingPhotoBox}>
          <View style={rc.pendingPhotoHeader}>
            <Ionicons name="hourglass-outline" size={15} color={Colors.warning} />
            <Text style={rc.pendingPhotoTitle}>صورة التنفيذ — بانتظار موافقتك</Text>
          </View>
          <View style={rc.pendingPhotoActions}>
            <TouchableOpacity
              style={rc.pendingViewBtn}
              onPress={() => onViewImage && onViewImage(item.completionPhotoUrl)}
            >
              <Ionicons name="eye-outline" size={14} color={Colors.info} />
              <Text style={[rc.pendingBtnText, { color: Colors.info }]}>عرض</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={rc.pendingApproveBtn}
              onPress={() => onApprovePhoto && onApprovePhoto(item.id)}
            >
              <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} />
              <Text style={[rc.pendingBtnText, { color: Colors.success }]}>حفظ الصورة</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={rc.pendingDeleteBtn}
              onPress={() => onDeletePhoto && onDeletePhoto(item.id)}
            >
              <Ionicons name="trash-outline" size={14} color={Colors.error} />
              <Text style={[rc.pendingBtnText, { color: Colors.error }]}>حذف الصورة</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ══ صورة التنفيذ المعتمدة ══ */}
      {hasApprovedPhoto && onViewImage && (
        <TouchableOpacity
          style={rc.completionPhotoBtn}
          onPress={() => onViewImage(item.completionPhotoUrl)}
        >
          <Ionicons name="camera" size={16} color={Colors.success} />
          <Text style={[rc.mainBtnText, { color: Colors.success }]}>صورة التنفيذ ✓</Text>
        </TouchableOpacity>
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

      {/* ══ صف الأرشفة (للمكتملة) / إعادة الفتح (للمؤرشفة) ══ */}
      {isCompleted && onArchive && (
        <TouchableOpacity
          style={[rc.mainBtn, { backgroundColor: "#795548" + "18", borderColor: "#795548" + "55", marginTop: 8, width: "100%" }]}
          onPress={onArchive}
          disabled={archiving}
        >
          {archiving
            ? <ActivityIndicator size="small" color="#795548" />
            : <>
                <Ionicons name="archive-outline" size={16} color="#795548" />
                <Text style={[rc.mainBtnText, { color: "#795548" }]}>أرشفة — تسجيل إنجاز المهندس</Text>
              </>
          }
        </TouchableOpacity>
      )}
      {item.status === "archived" && onReopen && (
        <TouchableOpacity
          style={[rc.mainBtn, { backgroundColor: Colors.warning + "18", borderColor: Colors.warning + "55", marginTop: 8, width: "100%" }]}
          onPress={onReopen}
          disabled={reopening}
        >
          {reopening
            ? <ActivityIndicator size="small" color={Colors.warning} />
            : <>
                <Ionicons name="refresh-outline" size={16} color={Colors.warning} />
                <Text style={[rc.mainBtnText, { color: Colors.warning }]}>إعادة فتح التذكرة</Text>
              </>
          }
        </TouchableOpacity>
      )}

      {/* ══ صف أساسي: اتصال + خريطة + صورة العقد + حذف ══ */}
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
        {hasContract && onViewImage && (
          <TouchableOpacity
            style={[rc.mainBtn, { backgroundColor: "#9C27B022", borderColor: "#9C27B055" }]}
            onPress={() => onViewImage(item.contractImageUrl)}
          >
            <Ionicons name="image" size={16} color="#9C27B0" />
            <Text style={[rc.mainBtnText, { color: "#9C27B0" }]}>الصورة</Text>
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
function InstallCard({ item, expanded, onExpand, onTimeline, onDelete, onPrepare, onArchive, onViewImage }: {
  item: any; expanded: boolean;
  onExpand: () => void; onTimeline: () => void; onDelete: () => void;
  onPrepare: () => void; onArchive: () => void;
  onViewImage?: (url: string) => void;
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
  const hasBooster    = !!item.hasBooster;
  const cardColor     = isRelayPoint ? "#9C27B0" : typeColor;

  return (
    <View style={[rc.card, { borderLeftColor: cardColor }]}>

      {/* ══ رأس البطاقة ══ */}
      <View style={rc.head}>
        <Text style={rc.num}>#{item.id}</Text>
        <View style={[rc.typeBadge, { backgroundColor: cardColor + "22" }]}>
          <Text style={[rc.typeBadgeText, { color: cardColor }]}>{typeLabel}</Text>
        </View>
        {hasBooster && (
          <View style={icSup.boosterPill}>
            <Ionicons name="hardware-chip" size={11} color="#4CAF50" />
            <Text style={icSup.boosterPillText}>+ هوتسبوت</Text>
          </View>
        )}
        <View style={[rc.statusDot, { backgroundColor: si.color }]} />
      </View>

      {/* شارة نقطة البث */}
      {isRelayPoint && (
        <View style={icSup.relayBadge}>
          <Ionicons name="git-network-outline" size={12} color="#9C27B0" />
          <Text style={icSup.relayText}>نقطة البث رقم {sequenceOrder}</Text>
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

      {/* ══ معلومات الجهاز البرودباند (بعد التجهيز) ══ */}
      {item.deviceName && (
        <View style={rc.row}>
          <Ionicons name="globe-outline" size={14} color="#2196F3" />
          <Text style={[rc.rowText, { color: "#2196F3", fontWeight: "600" }]}>
            {hasBooster ? "برودباند: " : ""}{item.deviceName}{item.deviceSerial ? ` — ${item.deviceSerial}` : ""}
          </Text>
        </View>
      )}

      {/* ══ بيانات المقوي الداخلي هوتسبوت ══ */}
      {hasBooster && (
        <View style={icSup.boosterBox}>
          <View style={icSup.boosterBoxHeader}>
            <Ionicons name="hardware-chip" size={13} color="#4CAF50" />
            <Text style={icSup.boosterBoxTitle}>مقوي داخلي هوتسبوت</Text>
          </View>
          {item.boosterDeviceName && (
            <View style={rc.row}>
              <Ionicons name="wifi-outline" size={13} color="#4CAF50" />
              <Text style={[rc.rowText, { color: "#4CAF50", fontWeight: "600", fontSize: 13 }]}>
                {item.boosterDeviceName}{item.boosterDeviceSerial ? ` — ${item.boosterDeviceSerial}` : ""}
              </Text>
            </View>
          )}
          {item.boosterSubscriptionFee && (
            <View style={rc.row}>
              <Ionicons name="cash-outline" size={13} color={Colors.success} />
              <Text style={[rc.rowText, { fontSize: 13 }]}>اشتراك المقوي: {item.boosterSubscriptionFee} ريال</Text>
            </View>
          )}
          {!item.boosterSubscriptionFee && (
            <View style={rc.row}>
              <Ionicons name="information-circle-outline" size={13} color={Colors.textMuted} />
              <Text style={[rc.rowText, { color: Colors.textMuted, fontSize: 12 }]}>اشتراك المقوي: لم يُدفع</Text>
            </View>
          )}
        </View>
      )}

      {/* ══ الاشتراك / الموديم ══ */}
      {item.subscriptionFee && (
        <View style={rc.row}>
          <Ionicons name="cash-outline" size={14} color={Colors.success} />
          <Text style={[rc.rowText, { color: Colors.success }]}>
            {item.serviceType === "broadband_internal" ? "قيمة الموديم" : "قيمة الاشتراك"}: {item.subscriptionFee} ريال
          </Text>
        </View>
      )}
      {item.serviceType === "broadband_internal" && item.internetFee && (
        <View style={rc.row}>
          <Ionicons name="wifi-outline" size={14} color={Colors.success} />
          <Text style={[rc.rowText, { color: Colors.success }]}>اشتراك الإنترنت الشهري: {item.internetFee} ريال</Text>
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
        {/* عرض صورة الإتمام — بعد اكتمال المهندس */}
        {isCompleted && !!item.completionPhotoUrl && onViewImage && (
          <TouchableOpacity
            style={[rc.mainBtn, { backgroundColor: Colors.primary + "22", borderColor: Colors.primary + "55" }]}
            onPress={() => onViewImage(item.completionPhotoUrl)}
          >
            <Ionicons name="image" size={16} color={Colors.primary} />
            <Text style={[rc.mainBtnText, { color: Colors.primary }]}>صورة</Text>
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
  completionPhotoBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.success + "18",
    borderColor: Colors.success + "55",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 6,
  },
  /* صورة التنفيذ المعلقة */
  pendingPhotoBox: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.warning + "55",
    backgroundColor: Colors.warning + "10",
    overflow: "hidden",
  },
  pendingPhotoHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.warning + "30",
  },
  pendingPhotoTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: Colors.warning,
    textAlign: "right",
    flex: 1,
  },
  pendingPhotoActions: {
    flexDirection: "row-reverse",
    padding: 8,
    gap: 6,
  },
  pendingViewBtn: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: Colors.info + "20",
    borderWidth: 1,
    borderColor: Colors.info + "50",
  },
  pendingApproveBtn: {
    flex: 1.3,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: Colors.success + "20",
    borderWidth: 1,
    borderColor: Colors.success + "50",
  },
  pendingDeleteBtn: {
    flex: 1.3,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: Colors.error + "18",
    borderWidth: 1,
    borderColor: Colors.error + "50",
  },
  pendingBtnText: {
    fontSize: 11,
    fontWeight: "600",
  },
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
   قائمة أسماء الأجهزة المنسدلة
════════════════════════════════════════════════ */
const DEVICE_NAME_LIST = [
  "LG",
  "Tplink ثلاثة دقلات",
  "Tplink",
  "D-Link DIR-612",
  "D-Link DIR-650",
  "Xiaomi Mini R1C",
  "D-Link R04",
  "KT708",
];

function DeviceNameDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualVal, setManualVal] = useState("");

  const confirmManual = () => {
    if (manualVal.trim()) onChange(manualVal.trim());
    setOpen(false);
    setManualMode(false);
  };

  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={pm.fieldLabel}>اسم الجهاز *</Text>
      <TouchableOpacity
        style={[pm.input, { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", height: 44 }]}
        onPress={() => { setOpen(true); setManualMode(false); }}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
        <Text style={[{ fontSize: 14, textAlign: "right", flex: 1 }, value ? { color: Colors.text } : { color: Colors.textSecondary }]}>
          {value || "اختر اسم الجهاز..."}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "#000000BB", justifyContent: "center", padding: 20 }}>
          <View style={{ backgroundColor: Colors.surface, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: Colors.border }}>
            {/* رأس */}
            <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
              <TouchableOpacity onPress={() => { setOpen(false); setManualMode(false); }}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: "bold", color: Colors.text }}>اختر اسم الجهاز</Text>
            </View>
            <ScrollView style={{ maxHeight: 350 }} keyboardShouldPersistTaps="handled">
              {DEVICE_NAME_LIST.map(name => (
                <TouchableOpacity
                  key={name}
                  style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.border + "60", backgroundColor: value === name ? Colors.primary + "18" : "transparent" }}
                  onPress={() => { onChange(name); setOpen(false); setManualMode(false); }}
                >
                  {value === name
                    ? <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                    : <View style={{ width: 18 }} />}
                  <Text style={{ fontSize: 14, color: value === name ? Colors.primary : Colors.text, fontWeight: value === name ? "bold" : "normal", flex: 1, textAlign: "right" }}>
                    {name}
                  </Text>
                </TouchableOpacity>
              ))}
              {/* إدخال يدوي */}
              <TouchableOpacity
                style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingVertical: 13, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: Colors.border }}
                onPress={() => setManualMode(m => !m)}
              >
                <Ionicons name="pencil-outline" size={16} color={Colors.warning} />
                <Text style={{ fontSize: 14, color: Colors.warning, fontWeight: "600", flex: 1, textAlign: "right" }}>
                  إدخال اسم آخر يدوياً
                </Text>
              </TouchableOpacity>
              {manualMode && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
                  <TextInput
                    style={[pm.input, { marginTop: 6 }]}
                    value={manualVal}
                    onChangeText={setManualVal}
                    placeholder="اكتب اسم الجهاز..."
                    placeholderTextColor={Colors.textSecondary}
                    textAlign="right"
                    autoFocus
                  />
                  <TouchableOpacity
                    style={{ backgroundColor: Colors.primary, borderRadius: 10, padding: 11, alignItems: "center" }}
                    onPress={confirmManual}
                  >
                    <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 14 }}>تأكيد</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

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
            <DeviceNameDropdown value={form.deviceName} onChange={v=>setF("deviceName",v)} />
            <MF label="رقم الفلاش (Flash Number)" value={form.deviceSerial} onChange={v=>setF("deviceSerial",v)} kb="numeric" />

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
                    <DeviceNameDropdown value={boosterForm.deviceName} onChange={v=>setBF("deviceName",v)} />
                    <MF label="رقم الفلاش (Flash Number)" value={boosterForm.deviceSerial} onChange={v=>setBF("deviceSerial",v)} kb="numeric" />
                    <MF label="قيمة اشتراك المقوي (فارغ = لم يُدفع)" value={boosterForm.subscriptionFee} onChange={v=>setBF("subscriptionFee",v)} kb="decimal-pad" />
                    <View style={pm.boosterNote}>
                      <Ionicons name="information-circle-outline" size={13} color={Colors.warning} />
                      <Text style={pm.boosterNoteText}>بيانات المقوي ستُحفظ ضمن نفس تذكرة البرودباند وتظهر للمهندس التقني</Text>
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

/* ────────────────────────────────────────────────────
   حقل نصي مستقل لنموذج الأرشفة (خارج ArchiveModal تماماً)
────────────────────────────────────────────────────── */
function ArchiveField({ label, value, onChange, kb, ph, multi }: {
  label: string; value: string; onChange: (v: string) => void;
  kb?: any; ph?: string; multi?: boolean;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={am.fieldLabel}>{label}</Text>
      <TextInput
        style={[am.input, multi && { height: 64 }]}
        value={value} onChangeText={onChange}
        placeholder={ph ?? label} placeholderTextColor={Colors.textSecondary}
        keyboardType={kb} textAlign="right"
        textAlignVertical={multi ? "top" : "center"} multiline={multi}
      />
    </View>
  );
}

/* ════════════════════════════════════════════════
   مودال الأرشفة
════════════════════════════════════════════════ */
function ArchiveModal({ item, submitting, onClose, onSubmit }: {
  item: any; submitting: boolean;
  onClose: () => void; onSubmit: (payload: any) => Promise<void>;
}) {
  /* ── نوع الخدمة — قابل للتعديل ── */
  type SvcType = "hotspot_internal" | "hotspot_external" | "broadband_internal";
  /* تطبيع: "external" (نقطة بث) = "hotspot_external" في نموذج الأرشفة */
  const normalizeType = (t: string | null | undefined): SvcType => {
    if (t === "hotspot_external" || t === "external") return "hotspot_external";
    if (t === "broadband_internal") return "broadband_internal";
    return "hotspot_internal";
  };
  const [svcType, setSvcType] = useState<SvcType>(normalizeType(item.serviceType));

  const isInternal  = svcType === "hotspot_internal";
  const isExternal  = svcType === "hotspot_external";
  const isBroadband = svcType === "broadband_internal";

  /* ── الحقول المشتركة ── */
  const [flashNumber,     setFlashNumber]     = useState(item.deviceSerial ?? "");
  const [deviceName,      setDeviceName]      = useState(item.deviceName ?? "");
  const [address,         setAddress]         = useState(item.address ?? "");
  const [locationUrl,     setLocationUrl]     = useState(item.locationUrl ?? "");
  const [installedByName, setInstalledByName] = useState(item.assignedToName ?? "");
  const installDateInit = item.completedAt ? new Date(item.completedAt).toISOString().substring(0,10) : new Date().toISOString().substring(0,10);
  const [installDate,     setInstallDate]     = useState(installDateInit);

  /* ── حقول الهوتسبوت الداخلي والبرودباند ── */
  const [clientName,    setClientName]    = useState(item.clientName ?? "");
  const [clientPhone,   setClientPhone]   = useState(item.clientPhone ?? "");
  const [subscriptionFee, setSubFee]      = useState(item.subscriptionFee ?? "");

  /* ── حقول البرودباند فقط ── */
  const [subscriptionName, setSubName]   = useState(item.subscriptionName ?? "");
  const [internetFee,      setInetFee]   = useState(item.internetFee ?? "");

  /* ── صورة التركيب (خارجي) — تبدأ بصورة إتمام المهندس ── */
  const [installPhoto, setInstallPhoto]   = useState<string | null>(item.completionPhotoUrl ?? null);
  const [imgVisible,   setImgVisible]     = useState(false);

  const [errMsg, setErrMsg] = useState("");

  /* اختيار صورة بديلة */
  const pickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return;
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.3, base64: true, mediaTypes: ["images"] as any });
      if (!res.canceled && res.assets?.[0]?.base64) {
        setInstallPhoto(`data:image/jpeg;base64,${res.assets[0].base64}`);
      }
    } catch {}
  };
  const pickPhotoCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") return;
      const res = await ImagePicker.launchCameraAsync({ quality: 0.3, base64: true });
      if (!res.canceled && res.assets?.[0]?.base64) {
        setInstallPhoto(`data:image/jpeg;base64,${res.assets[0].base64}`);
      }
    } catch {}
  };

  const handleSubmit = async () => {
    if (!flashNumber.trim()) { setErrMsg("رقم الفلاش مطلوب"); return; }
    if (!address.trim())     { setErrMsg("وصف الموقع مطلوب"); return; }
    if (!deviceName.trim() && !isExternal) { setErrMsg("اسم الجهاز مطلوب"); return; }
    setErrMsg("");
    const payload: any = {
      serviceType:    svcType,
      flashNumber:    parseInt(flashNumber.replace(/\D/g, "")) || undefined,
      deviceName:     deviceName.trim() || null,
      address:        address.trim()    || null,
      locationUrl:    locationUrl.trim() || null,
      installedByName: installedByName.trim() || null,
      installDate:    installDate || null,
    };
    if (isInternal) {
      payload.clientName     = clientName.trim() || null;
      payload.clientPhone    = clientPhone.replace(/\D/g, "") || null;
      payload.subscriptionFee = subscriptionFee || null;
    }
    if (isExternal) {
      payload.installPhoto = installPhoto ?? null;
    }
    if (isBroadband) {
      payload.subscriptionName = subscriptionName.trim() || null;
      payload.clientName       = clientName.trim()  || null;
      payload.clientPhone      = clientPhone.replace(/\D/g, "") || null;
      payload.subscriptionFee  = subscriptionFee || null;
      payload.internetFee      = internetFee || null;
    }
    try {
      await onSubmit(payload);
    } catch (e: any) {
      setErrMsg(e?.message ?? "فشل الأرشفة");
    }
  };


  const svcOptions: { key: SvcType; label: string; color: string }[] = [
    { key: "hotspot_internal",  label: "هوتسبوت داخلي", color: Colors.primary },
    { key: "hotspot_external",  label: "هوتسبوت خارجي", color: Colors.warning },
    { key: "broadband_internal",label: "برودباند",        color: Colors.info    },
  ];

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent>
      <KeyboardAvoidingView
        style={am.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={am.sheet}>

          {/* ── رأس ── */}
          <View style={am.sheetHeader}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={am.sheetTitle}>أرشفة التذكرة #{item.id}</Text>
            <Ionicons name="archive" size={20} color={Colors.success} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={am.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
          >

            {/* ── نوع الخدمة ── */}
            <Text style={am.secTitle}>نوع الخدمة</Text>
            <View style={{ flexDirection: "row-reverse", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {svcOptions.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[am.typeChip, svcType === opt.key && { backgroundColor: opt.color + "22", borderColor: opt.color }]}
                  onPress={() => setSvcType(opt.key)}
                >
                  <Text style={[am.typeChipText, svcType === opt.key && { color: opt.color, fontWeight: "bold" }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── رقم الفلاش ── */}
            <Text style={am.secTitle}>بيانات الجهاز</Text>
            <View style={{ marginBottom: 10 }}>
              <Text style={am.fieldLabel}>رقم الفلاش {isBroadband ? "(سيُحفظ كـ P+الرقم)" : ""} *</Text>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                {isBroadband && (
                  <View style={{ backgroundColor: Colors.info + "22", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, borderColor: Colors.info + "55" }}>
                    <Text style={{ color: Colors.info, fontWeight: "bold", fontSize: 16 }}>P</Text>
                  </View>
                )}
                <TextInput
                  style={[am.input, { flex: 1 }]}
                  value={flashNumber}
                  onChangeText={v => setFlashNumber(v.replace(/\D/g, ""))}
                  placeholder="مثال: 15"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="numeric"
                  textAlign="right"
                />
              </View>
            </View>

            {/* ── اسم الجهاز (لكل الأنواع) ── */}
            <DeviceNameDropdown value={deviceName} onChange={setDeviceName} />

            {/* ── برودباند: اسم الاشتراك ── */}
            {isBroadband && (
              <ArchiveField label="اسم الاشتراك (مثال: andls123)" value={subscriptionName} onChange={setSubName} ph="andls123" />
            )}

            {/* ── داخلي + برودباند: بيانات العميل ── */}
            {(isInternal || isBroadband) && (
              <>
                <Text style={am.secTitle}>بيانات العميل</Text>
                <ArchiveField label="اسم العميل" value={clientName} onChange={setClientName} />
                <ArchiveField label="رقم الجوال" value={clientPhone} onChange={v => setClientPhone(v.replace(/\D/g, ""))} kb="phone-pad" />
                <ArchiveField label="رسوم إدخال الموديم — ما دفعه العميل للجهاز (ر)" value={subscriptionFee} onChange={setSubFee} kb="decimal-pad" ph="0" />
              </>
            )}

            {/* ── برودباند: قيمة الباقة ── */}
            {isBroadband && (
              <ArchiveField label="قيمة باقة الإنترنت الشهرية (ر)" value={internetFee} onChange={setInetFee} kb="decimal-pad" ph="0" />
            )}

            {/* ── الموقع ── */}
            <Text style={am.secTitle}>الموقع</Text>
            <ArchiveField label="وصف الموقع *" value={address} onChange={setAddress} multi />
            <ArchiveField label="رابط الموقع (Google Maps)" value={locationUrl} onChange={setLocationUrl} ph="https://maps.google.com/..." />

            {/* ── بيانات التركيب ── */}
            <Text style={am.secTitle}>بيانات التركيب</Text>
            <ArchiveField label="اسم المهندس المركّب" value={installedByName} onChange={setInstalledByName} />
            <ArchiveField label="تاريخ التركيب" value={installDate} onChange={setInstallDate} ph="2025-01-15" />

            {/* ── صورة التركيب (خارجي) ── */}
            {isExternal && (
              <>
                <Text style={am.secTitle}>صورة التركيب</Text>
                {installPhoto ? (
                  <View style={{ marginBottom: 12 }}>
                    <TouchableOpacity activeOpacity={0.85} onPress={() => setImgVisible(true)}>
                      <Image source={{ uri: installPhoto }} style={{ width: "100%", height: 180, borderRadius: 10 }} resizeMode="cover" />
                      <View style={{ position: "absolute", bottom: 6, right: 8, flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: "#00000066", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
                        <Ionicons name="expand-outline" size={14} color="#fff" />
                        <Text style={{ fontSize: 11, color: "#fff" }}>اضغط للتكبير</Text>
                      </View>
                    </TouchableOpacity>
                    <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 8 }}>
                      <TouchableOpacity style={[am.photoActionBtn, { flex: 1 }]} onPress={pickPhotoCamera}>
                        <Ionicons name="camera" size={16} color={Colors.primary} />
                        <Text style={am.photoActionText}>كاميرا</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[am.photoActionBtn, { flex: 1 }]} onPress={pickPhoto}>
                        <Ionicons name="image" size={16} color={Colors.primary} />
                        <Text style={am.photoActionText}>معرض</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[am.photoActionBtn, { flex: 1, borderColor: Colors.error + "55" }]} onPress={() => setInstallPhoto(null)}>
                        <Ionicons name="trash-outline" size={16} color={Colors.error} />
                        <Text style={[am.photoActionText, { color: Colors.error }]}>حذف</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row-reverse", gap: 8, marginBottom: 12 }}>
                    <TouchableOpacity style={[am.photoActionBtn, { flex: 1 }]} onPress={pickPhotoCamera}>
                      <Ionicons name="camera" size={18} color={Colors.primary} />
                      <Text style={am.photoActionText}>كاميرا</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[am.photoActionBtn, { flex: 1 }]} onPress={pickPhoto}>
                      <Ionicons name="image" size={18} color={Colors.primary} />
                      <Text style={am.photoActionText}>معرض الصور</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {/* ── صورة إتمام المهندس (للعرض فقط — لكل الأنواع) ── */}
            {!isExternal && item.completionPhotoUrl && (
              <TouchableOpacity
                style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 10, backgroundColor: Colors.success + "15", borderRadius: 10, borderWidth: 1, borderColor: Colors.success + "40", marginBottom: 12 }}
                onPress={() => setImgVisible(true)}
              >
                <Ionicons name="image-outline" size={16} color={Colors.success} />
                <Text style={{ color: Colors.success, fontWeight: "600", fontSize: 13 }}>عرض صورة إتمام المهندس</Text>
              </TouchableOpacity>
            )}

            {/* ── خطأ ── */}
            {!!errMsg && (
              <View style={am.errBox}>
                <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
                <Text style={am.errText}>{errMsg}</Text>
              </View>
            )}

            {/* ── أزرار ── */}
            <View style={am.actions}>
              <TouchableOpacity style={am.cancelBtn} onPress={onClose} disabled={submitting}>
                <Text style={am.cancelTxt}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[am.confirmBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
                {submitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Ionicons name="archive" size={16} color="#fff" /><Text style={am.confirmTxt}>تأكيد الأرشفة وحفظ</Text></>
                }
              </TouchableOpacity>
            </View>
            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* ── عرض الصورة كاملة ── */}
      <Modal visible={imgVisible} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "#000000CC", justifyContent: "center", alignItems: "center" }}
          activeOpacity={1}
          onPress={() => setImgVisible(false)}
        >
          <Image
            source={{ uri: (isExternal ? installPhoto : item.completionPhotoUrl) ?? "" }}
            style={{ width: "94%", height: 420, borderRadius: 12 }}
            resizeMode="contain"
          />
          <Text style={{ color: "#fff", marginTop: 12, fontSize: 13 }}>اضغط للإغلاق</Text>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

const am = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#000000AA", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "94%",
    borderTopWidth: 1, borderColor: Colors.border,
  },
  sheetHeader: {
    flexDirection: "row-reverse", alignItems: "center", gap: 10,
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sheetTitle: { flex: 1, fontSize: 16, fontWeight: "bold", color: Colors.text, textAlign: "right" },
  body: { paddingHorizontal: 18, paddingTop: 14 },
  secTitle: {
    fontSize: 13, fontWeight: "700", color: Colors.textSecondary, textAlign: "right",
    marginTop: 8, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 4,
  },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  typeChipText: { fontSize: 13, color: Colors.textSecondary },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary, textAlign: "right", marginBottom: 4 },
  input: {
    backgroundColor: Colors.surfaceElevated, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, padding: 11,
    fontSize: 14, color: Colors.text, textAlign: "right", height: 44,
  },
  photoActionBtn: {
    flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.primary + "55", backgroundColor: Colors.primary + "15",
  },
  photoActionText: { fontSize: 13, fontWeight: "600", color: Colors.primary },
  errBox:  { flexDirection: "row-reverse", alignItems: "center", gap: 6, backgroundColor: Colors.error + "18", borderRadius: 8, padding: 8, marginBottom: 8 },
  errText: { fontSize: 13, color: Colors.error, flex: 1, textAlign: "right" },
  actions: { flexDirection: "row-reverse", gap: 10, marginTop: 8 },
  cancelBtn:  { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center", backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border },
  cancelTxt:  { fontSize: 14, fontWeight: "bold", color: Colors.textSecondary },
  confirmBtn: { flex: 2, paddingVertical: 13, borderRadius: 12, alignItems: "center", backgroundColor: Colors.success, flexDirection: "row-reverse", justifyContent: "center", gap: 8 },
  confirmTxt: { fontSize: 14, fontWeight: "bold", color: "#fff" },
});

/* ════════════════════════════════════════════════
   بطاقة صنف الشراء (الجديدة)
════════════════════════════════════════════════ */
function PurchaseItemCard({ item, onDelete, token }: {
  item: any; onDelete: () => void; token: string | null;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiDelete(`/purchase-requests/${item.id}`, token);
      onDelete();
    } catch {} finally {
      setDeleting(false);
    }
  };

  return (
    <View style={pcs.card}>
      <View style={pcs.top}>
        <TouchableOpacity onPress={handleDelete} disabled={deleting} style={pcs.deleteBtn}>
          {deleting
            ? <ActivityIndicator size="small" color={Colors.error} />
            : <Ionicons name="trash-outline" size={16} color={Colors.error} />}
        </TouchableOpacity>

        <View style={[pcs.statusDot, { backgroundColor: Colors.info }]} />

        <Text style={pcs.name} numberOfLines={2}>{item.description}</Text>
      </View>

      {item.quantity && (
        <View style={pcs.qtyRow}>
          <Ionicons name="layers-outline" size={13} color={Colors.textSecondary} />
          <Text style={pcs.qtyText}>الكمية: {item.quantity}</Text>
        </View>
      )}

      <View style={pcs.footer}>
        <View style={[pcs.newBadge]}>
          <Ionicons name="time-outline" size={11} color={Colors.info} />
          <Text style={[pcs.newBadgeTxt]}>بانتظار الشراء</Text>
        </View>
        <Text style={pcs.date}>{formatDate(item.createdAt)}</Text>
      </View>
    </View>
  );
}

const pcs = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
    borderRightWidth: 4, borderRightColor: Colors.info, gap: 8,
  },
  top: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: "bold", color: Colors.text, textAlign: "right" },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  deleteBtn: { padding: 4 },
  qtyRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  qtyText: { fontSize: 13, color: Colors.textSecondary },
  footer: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  newBadge: { flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: Colors.info + "18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  newBadgeTxt: { fontSize: 11, fontWeight: "700", color: Colors.info },
  date: { fontSize: 11, color: Colors.textMuted },
});

/* ════════════════════════════════════════════════
   بطاقة معاملة الشراء المكتملة
════════════════════════════════════════════════ */
function PurchaseTransactionCard({ txn, onViewImage }: {
  txn: any; onViewImage: (url: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const amtNum = parseFloat(txn.amount ?? "0");
  const ptColor = txn.paymentType === "debt" ? Colors.warning : Colors.error;
  const ptLabel = txn.paymentType === "debt" ? "دين" : "نقد";

  /* استخراج أسماء الأصناف من الوصف */
  const itemsDesc = (txn.description ?? "").replace(/^مشتريات:\s*/, "");

  return (
    <View style={ptc.card}>
      {/* رأس البطاقة */}
      <TouchableOpacity style={ptc.head} onPress={() => setExpanded(e => !e)} activeOpacity={0.8}>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16} color={Colors.textMuted}
        />
        <View style={[ptc.ptBadge, { backgroundColor: ptColor + "18" }]}>
          <Text style={[ptc.ptBadgeTxt, { color: ptColor }]}>{ptLabel}</Text>
        </View>
        <View style={[ptc.successBadge]}>
          <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
          <Text style={ptc.successTxt}>تم الشراء</Text>
        </View>
        <Text style={ptc.amount}>{amtNum.toLocaleString("ar-YE")} ر.س</Text>
      </TouchableOpacity>

      {/* الوصف */}
      <Text style={ptc.desc} numberOfLines={expanded ? undefined : 2}>{itemsDesc}</Text>

      {/* التاريخ */}
      <Text style={ptc.date}>{formatDate(txn.createdAt)}</Text>

      {/* التفاصيل عند التوسيع */}
      {expanded && (
        <View style={ptc.expandedBox}>
          {txn.personName && (
            <View style={ptc.detailRow}>
              <Text style={ptc.detailVal}>{txn.personName}</Text>
              <Text style={ptc.detailKey}>المورد / الجهة</Text>
            </View>
          )}

          {/* صورة المشتريات */}
          {!!txn.itemsPhotoUrl && (
            <View style={ptc.photoSection}>
              <View style={ptc.photoLabelRow}>
                <Ionicons name="bag-outline" size={13} color={Colors.info} />
                <Text style={[ptc.photoLabel, { color: Colors.info }]}>صورة المشتريات</Text>
              </View>
              <TouchableOpacity onPress={() => onViewImage(txn.itemsPhotoUrl)} activeOpacity={0.85}>
                <Image source={{ uri: txn.itemsPhotoUrl }} style={ptc.photoThumb} resizeMode="cover" />
                <View style={ptc.photoTapHint}>
                  <Ionicons name="expand-outline" size={13} color="#fff" />
                  <Text style={ptc.photoTapTxt}>اضغط للتكبير</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* صورة الفاتورة */}
          {!!txn.invoicePhotoUrl && (
            <View style={ptc.photoSection}>
              <View style={ptc.photoLabelRow}>
                <Ionicons name="receipt-outline" size={13} color={Colors.warning} />
                <Text style={[ptc.photoLabel, { color: Colors.warning }]}>صورة الفاتورة</Text>
              </View>
              <TouchableOpacity onPress={() => onViewImage(txn.invoicePhotoUrl)} activeOpacity={0.85}>
                <Image source={{ uri: txn.invoicePhotoUrl }} style={ptc.photoThumb} resizeMode="cover" />
                <View style={ptc.photoTapHint}>
                  <Ionicons name="expand-outline" size={13} color="#fff" />
                  <Text style={ptc.photoTapTxt}>اضغط للتكبير</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {!txn.itemsPhotoUrl && !txn.invoicePhotoUrl && (
            <View style={ptc.noPhotosRow}>
              <Ionicons name="image-outline" size={14} color={Colors.textMuted} />
              <Text style={ptc.noPhotosTxt}>لا توجد صور مرفقة</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const ptc = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
    borderRightWidth: 4, borderRightColor: Colors.success, gap: 8,
  },
  head: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  amount: { flex: 1, fontSize: 16, fontWeight: "800", color: Colors.text, textAlign: "right" },
  ptBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  ptBadgeTxt: { fontSize: 11, fontWeight: "700" },
  successBadge: { flexDirection: "row-reverse", alignItems: "center", gap: 3, backgroundColor: Colors.success + "18", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  successTxt: { fontSize: 11, fontWeight: "700", color: Colors.success },
  desc: { fontSize: 13, color: Colors.textSecondary, textAlign: "right", lineHeight: 20 },
  date: { fontSize: 11, color: Colors.textMuted, textAlign: "right" },
  expandedBox: { backgroundColor: Colors.surfaceElevated, borderRadius: 10, padding: 10, gap: 10, marginTop: 4 },
  detailRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  detailKey: { fontSize: 12, color: Colors.textMuted, fontWeight: "600" },
  detailVal: { fontSize: 13, color: Colors.text },
  photoSection: { gap: 6 },
  photoLabelRow: { flexDirection: "row-reverse", alignItems: "center", gap: 5 },
  photoLabel: { fontSize: 12, fontWeight: "700" },
  photoThumb: { width: "100%", height: 150, borderRadius: 10 },
  photoTapHint: { position: "absolute", bottom: 6, right: 8, flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: "#00000066", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  photoTapTxt: { fontSize: 11, color: "#fff" },
  noPhotosRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  noPhotosTxt: { fontSize: 12, color: Colors.textMuted },
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
  sectionRow: { flexDirection: "row-reverse", gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  sectionBtn: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  sectionBtnText: { fontSize: 12, color: Colors.textSecondary },

  /* تبويبات المشتريات */
  purchaseTabRow: {
    flexDirection: "row-reverse", gap: 10, paddingHorizontal: 14, paddingBottom: 10,
  },
  purchaseTabBtn: {
    flex: 1, alignItems: "center", paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  purchaseTabTxt: { fontSize: 14, color: Colors.textSecondary },
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
