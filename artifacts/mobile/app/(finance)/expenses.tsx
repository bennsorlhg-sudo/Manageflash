import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, TextInput, ActivityIndicator, RefreshControl, Modal, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, apiPut, apiDelete, formatCurrency, formatDate } from "@/utils/api";

/* ─── Alert / Confirm Modal ─── */
function ConfirmModal({ visible, title, message, onConfirm, onCancel, confirmColor = Colors.error }: {
  visible: boolean; title: string; message: string;
  onConfirm: () => void; onCancel: () => void; confirmColor?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.confirmBox}>
          <View style={[s.confirmIcon, { backgroundColor: confirmColor + "20" }]}>
            <Ionicons name="warning" size={36} color={confirmColor} />
          </View>
          <Text style={s.confirmTitle}>{title}</Text>
          <Text style={s.confirmMsg}>{message}</Text>
          <View style={s.confirmBtns}>
            <TouchableOpacity style={[s.confirmYes, { backgroundColor: confirmColor }]} onPress={onConfirm}>
              <Text style={s.confirmYesTxt}>تأكيد</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.confirmNo} onPress={onCancel}>
              <Text style={s.confirmNoTxt}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AlertModal({ visible, title, message, color, onClose }: {
  visible: boolean; title: string; message: string; color: string; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.alertBox}>
          <View style={[s.confirmIcon, { backgroundColor: color + "20" }]}>
            <Ionicons name={color === Colors.error ? "close-circle" : "checkmark-circle"} size={36} color={color} />
          </View>
          <Text style={s.confirmTitle}>{title}</Text>
          {!!message && <Text style={s.confirmMsg}>{message}</Text>}
          <TouchableOpacity style={[s.confirmYes, { backgroundColor: color }]} onPress={onClose}>
            <Text style={s.confirmYesTxt}>حسناً</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const PAYMENT_TYPE_LABELS: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  cash: { label: "نقد",  color: Colors.error,   icon: "cash"    },
  debt: { label: "دين",  color: Colors.warning, icon: "receipt" },
  loan: { label: "سلفة", color: Colors.info,    icon: "time"    },
};

export default function ExpensesScreen() {
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<"history" | "templates" | "obligations">("history");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [templates,    setTemplates]    = useState<any[]>([]);
  const [obligations,  setObligations]  = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [filter,       setFilter]       = useState<"day" | "week" | "month">("month");

  /* حالة الحذف */
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting,     setDeleting]     = useState(false);

  /* حالة التعديل */
  const [editTarget,   setEditTarget]   = useState<any>(null);
  const [editDesc,     setEditDesc]     = useState("");
  const [editAmt,      setEditAmt]      = useState("");
  const [editPt,       setEditPt]       = useState<"cash" | "debt">("cash");
  const [editPerson,   setEditPerson]   = useState("");
  const [saving,       setSaving]       = useState(false);

  /* حالة التفاصيل */
  const [detailItem,   setDetailItem]   = useState<any>(null);

  /* Alert Modal */
  const [alert, setAlert] = useState({ visible: false, title: "", message: "", color: Colors.success });

  /* عرض صورة */
  const [viewImg, setViewImg] = useState<string | null>(null);
  const showAlert = (title: string, message: string, color = Colors.success) =>
    setAlert({ visible: true, title, message, color });

  /* Template Modal */
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newTemplateName,   setNewTemplateName]   = useState("");
  const [newTemplateAmount, setNewTemplateAmount] = useState("");

  /* Obligation Modal */
  const [showObligModal, setShowObligModal] = useState(false);
  const [newOblig,       setNewOblig]       = useState({ name: "", amount: "", notes: "" });

  const fetchData = useCallback(async () => {
    try {
      const [txs, tmpl, oblig] = await Promise.all([
        apiGet("/transactions?type=expense&limit=200", token),
        apiGet("/expense-templates", token),
        apiGet("/obligations", token),
      ]);
      setTransactions(txs);
      setTemplates(tmpl);
      setObligations(oblig);
    } catch {} finally {
      setLoading(false); setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* فلترة الفترة الزمنية */
  const filterByPeriod = (items: any[]) => {
    const now = new Date();
    return items.filter(t => {
      const d = new Date(t.createdAt);
      if (filter === "day")   return d.toDateString() === now.toDateString();
      if (filter === "week")  { const wa = new Date(now); wa.setDate(now.getDate() - 7); return d >= wa; }
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  };

  const filtered     = filterByPeriod(transactions);
  const totalExpense = filtered.reduce((s, t) => s + parseFloat(t.amount), 0);
  const cashTotal    = filtered.filter(t => t.paymentType === "cash").reduce((s, t) => s + parseFloat(t.amount), 0);
  const debtTotal    = filtered.filter(t => t.paymentType === "debt").reduce((s, t) => s + parseFloat(t.amount), 0);

  /* ── حذف ── */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/transactions/${deleteTarget.id}`, token);
      setTransactions(prev => prev.filter(t => t.id !== deleteTarget.id));
      const msg = deleteTarget.paymentType === "cash"
        ? `تم استعادة ${formatCurrency(parseFloat(deleteTarget.amount))} إلى الصندوق`
        : `تم إزالة سجل الدين المرتبط (${formatCurrency(parseFloat(deleteTarget.amount))})`;
      showAlert("تم الحذف ✓", msg);
      setDeleteTarget(null);
    } catch (e: any) {
      showAlert("خطأ", e?.message ?? "فشل الحذف", Colors.error);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  /* ── تعديل ── */
  const openEdit = (tx: any) => {
    setEditTarget(tx);
    setEditDesc(tx.description ?? "");
    setEditAmt(String(parseFloat(tx.amount)));
    setEditPt(tx.paymentType === "debt" ? "debt" : "cash");
    setEditPerson(tx.personName ?? "");
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    const newAmt = parseFloat(editAmt.replace(/[^0-9.]/g, ""));
    if (!newAmt || newAmt <= 0) return showAlert("خطأ", "أدخل مبلغاً صحيحاً", Colors.error);
    setSaving(true);
    try {
      const updated = await apiPut(`/transactions/${editTarget.id}`, token, {
        amount: newAmt,
        description: editDesc.trim(),
        paymentType: editPt,
        personName: editPerson.trim() || editTarget.personName,
      });
      setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
      showAlert("تم التعديل ✓",
        `تم تحديث المصروف\n${editDesc.trim()}\n${formatCurrency(newAmt)}`
      );
      setEditTarget(null);
    } catch (e: any) {
      showAlert("خطأ", e?.message ?? "فشل التعديل", Colors.error);
    } finally {
      setSaving(false);
    }
  };

  /* ── قوالب ── */
  const addTemplate = async () => {
    if (!newTemplateName.trim()) return;
    setSaving(true);
    try {
      const t = await apiPost("/expense-templates", token, {
        name: newTemplateName,
        amount: newTemplateAmount ? parseFloat(newTemplateAmount) : undefined,
      });
      setTemplates(prev => [...prev, t]);
      setShowTemplateModal(false);
      setNewTemplateName(""); setNewTemplateAmount("");
    } catch (e: any) { showAlert("خطأ", e?.message ?? "فشل الإضافة", Colors.error); }
    finally { setSaving(false); }
  };

  const deleteTemplate = async (id: number) => {
    try {
      await apiDelete(`/expense-templates/${id}`, token);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (e: any) { showAlert("خطأ", e?.message ?? "فشل الحذف", Colors.error); }
  };

  /* ── التزامات ── */
  const addObligation = async () => {
    if (!newOblig.name.trim() || !newOblig.amount) return;
    setSaving(true);
    try {
      const o = await apiPost("/obligations", token, {
        name: newOblig.name, amount: parseFloat(newOblig.amount), notes: newOblig.notes,
      });
      setObligations(prev => [...prev, o]);
      setShowObligModal(false);
      setNewOblig({ name: "", amount: "", notes: "" });
    } catch (e: any) { showAlert("خطأ", e?.message ?? "فشل الإضافة", Colors.error); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <View style={[s.container, s.center, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>المصاريف</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ── التبويبات ── */}
      <View style={s.tabRow}>
        {(["history", "templates", "obligations"] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tab, activeTab === t && s.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[s.tabTxt, activeTab === t && s.tabTxtActive]}>
              {t === "history" ? "السجل" : t === "templates" ? "القوالب" : "الالتزامات"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ══════════════ تبويب السجل ══════════════ */}
      {activeTab === "history" && (
        <>
          {/* فلتر الفترة */}
          <View style={s.filterRow}>
            {(["day", "week", "month"] as const).map(p => (
              <TouchableOpacity
                key={p}
                style={[s.filterBtn, filter === p && s.filterBtnActive]}
                onPress={() => setFilter(p)}
              >
                <Text style={[s.filterBtnTxt, filter === p && s.filterBtnTxtActive]}>
                  {p === "day" ? "اليوم" : p === "week" ? "الأسبوع" : "الشهر"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ملخص الفترة */}
          <View style={s.summaryRow}>
            <View style={s.summaryCard}>
              <Text style={s.summaryLbl}>الإجمالي</Text>
              <Text style={[s.summaryVal, { color: Colors.error }]}>{formatCurrency(totalExpense)}</Text>
            </View>
            <View style={s.summaryCard}>
              <Text style={s.summaryLbl}>نقداً</Text>
              <Text style={[s.summaryVal, { color: Colors.error }]}>{formatCurrency(cashTotal)}</Text>
            </View>
            <View style={s.summaryCard}>
              <Text style={s.summaryLbl}>ديناً</Text>
              <Text style={[s.summaryVal, { color: Colors.warning }]}>{formatCurrency(debtTotal)}</Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={s.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
          >
            {filtered.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="receipt-outline" size={48} color={Colors.textMuted} />
                <Text style={s.emptyTxt}>لا توجد مصاريف في هذه الفترة</Text>
              </View>
            ) : filtered.map(tx => {
              const pt = PAYMENT_TYPE_LABELS[tx.paymentType ?? "cash"] ?? PAYMENT_TYPE_LABELS.cash;
              return (
                <View key={tx.id} style={s.txCard}>
                  {/* الوصف + المبلغ */}
                  <View style={s.txTop}>
                    <Text style={[s.txAmt, { color: Colors.error }]}>
                      {formatCurrency(parseFloat(tx.amount))}
                    </Text>
                    <Text style={s.txDesc} numberOfLines={2}>{tx.description}</Text>
                  </View>

                  {/* طريقة الدفع + التاريخ */}
                  <View style={s.txMeta}>
                    <Text style={s.txDate}>{formatDate(tx.createdAt)}</Text>
                    <View style={[s.ptBadge, { backgroundColor: pt.color + "18" }]}>
                      <Ionicons name={pt.icon} size={11} color={pt.color} />
                      <Text style={[s.ptBadgeTxt, { color: pt.color }]}>{pt.label}</Text>
                    </View>
                  </View>

                  {/* صور المشتريات إن وجدت */}
                  {(!!tx.itemsPhotoUrl || !!tx.invoicePhotoUrl) && (
                    <View style={s.photosBtnRow}>
                      {!!tx.itemsPhotoUrl && (
                        <TouchableOpacity
                          style={[s.photoBtn, { borderColor: Colors.info + "50" }]}
                          onPress={() => setViewImg(tx.itemsPhotoUrl)}
                        >
                          <Ionicons name="bag-outline" size={13} color={Colors.info} />
                          <Text style={[s.photoBtnTxt, { color: Colors.info }]}>صورة المشتريات</Text>
                        </TouchableOpacity>
                      )}
                      {!!tx.invoicePhotoUrl && (
                        <TouchableOpacity
                          style={[s.photoBtn, { borderColor: Colors.warning + "50" }]}
                          onPress={() => setViewImg(tx.invoicePhotoUrl)}
                        >
                          <Ionicons name="receipt-outline" size={13} color={Colors.warning} />
                          <Text style={[s.photoBtnTxt, { color: Colors.warning }]}>صورة الفاتورة</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* أزرار الإجراءات */}
                  <View style={s.txActions}>
                    <TouchableOpacity
                      style={[s.txActionBtn, s.txActionBtnDetail]}
                      onPress={() => setDetailItem(tx)}
                    >
                      <Ionicons name="information-circle-outline" size={14} color={Colors.primary} />
                      <Text style={[s.txActionBtnTxt, { color: Colors.primary }]}>تفاصيل</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[s.txActionBtn, s.txActionBtnEdit]}
                      onPress={() => openEdit(tx)}
                    >
                      <Ionicons name="create-outline" size={14} color={Colors.warning} />
                      <Text style={[s.txActionBtnTxt, { color: Colors.warning }]}>تعديل</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[s.txActionBtn, s.txActionBtnDelete]}
                      onPress={() => setDeleteTarget(tx)}
                    >
                      <Ionicons name="trash-outline" size={14} color={Colors.error} />
                      <Text style={[s.txActionBtnTxt, { color: Colors.error }]}>حذف</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
            <View style={{ height: 30 }} />
          </ScrollView>
        </>
      )}

      {/* ══════════════ تبويب القوالب ══════════════ */}
      {activeTab === "templates" && (
        <ScrollView contentContainerStyle={s.content}>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowTemplateModal(true)}>
            <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
            <Text style={s.addBtnTxt}>إضافة قالب جديد</Text>
          </TouchableOpacity>
          {templates.map(t => (
            <View key={t.id} style={s.templateCard}>
              <TouchableOpacity onPress={() => deleteTemplate(t.id)} style={s.deleteIcon}>
                <Ionicons name="trash-outline" size={18} color={Colors.error} />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={s.templateName}>{t.name}</Text>
                {t.amount && <Text style={s.templateAmt}>{formatCurrency(parseFloat(t.amount))}</Text>}
              </View>
            </View>
          ))}
          {templates.length === 0 && (
            <View style={s.empty}>
              <Ionicons name="documents-outline" size={48} color={Colors.textMuted} />
              <Text style={s.emptyTxt}>لا توجد قوالب. أضف قالباً للبدء.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ══════════════ تبويب الالتزامات ══════════════ */}
      {activeTab === "obligations" && (
        <ScrollView contentContainerStyle={s.content}>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowObligModal(true)}>
            <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
            <Text style={s.addBtnTxt}>إضافة التزام شهري</Text>
          </TouchableOpacity>
          {obligations.map(o => (
            <View key={o.id} style={s.obligCard}>
              <Text style={[s.obligAmt, { color: Colors.error }]}>{formatCurrency(parseFloat(o.amount))}/شهر</Text>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.obligName}>{o.name}</Text>
                {o.notes && <Text style={s.obligNotes}>{o.notes}</Text>}
              </View>
            </View>
          ))}
          {obligations.length === 0 && (
            <View style={s.empty}>
              <Ionicons name="calendar-outline" size={48} color={Colors.textMuted} />
              <Text style={s.emptyTxt}>لا توجد التزامات شهرية</Text>
            </View>
          )}
          {obligations.length > 0 && (
            <View style={s.obligTotal}>
              <Text style={[s.obligTotalVal, { color: Colors.error }]}>
                {formatCurrency(obligations.reduce((s, o) => s + parseFloat(o.amount), 0))}
              </Text>
              <Text style={s.obligTotalLbl}>مجموع الالتزامات الشهرية</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ══════════════ Modal التفاصيل ══════════════ */}
      <Modal visible={!!detailItem} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>تفاصيل المصروف</Text>
            {detailItem && (() => {
              const pt = PAYMENT_TYPE_LABELS[detailItem.paymentType ?? "cash"] ?? PAYMENT_TYPE_LABELS.cash;
              return (
                <View style={{ gap: 12 }}>
                  <View style={s.detailRow}>
                    <Text style={[s.detailVal, { color: Colors.error }]}>
                      {formatCurrency(parseFloat(detailItem.amount))}
                    </Text>
                    <Text style={s.detailKey}>المبلغ</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Text style={s.detailVal}>{detailItem.description}</Text>
                    <Text style={s.detailKey}>البيان</Text>
                  </View>
                  <View style={s.detailRow}>
                    <View style={[s.ptBadge, { backgroundColor: pt.color + "18" }]}>
                      <Text style={[s.ptBadgeTxt, { color: pt.color }]}>{pt.label}</Text>
                    </View>
                    <Text style={s.detailKey}>طريقة الدفع</Text>
                  </View>
                  {detailItem.personName && (
                    <View style={s.detailRow}>
                      <Text style={s.detailVal}>{detailItem.personName}</Text>
                      <Text style={s.detailKey}>الجهة</Text>
                    </View>
                  )}
                  <View style={s.detailRow}>
                    <Text style={s.detailVal}>{formatDate(detailItem.createdAt)}</Text>
                    <Text style={s.detailKey}>التاريخ</Text>
                  </View>
                </View>
              );
            })()}

            {/* الصور في التفاصيل */}
            {detailItem && (!!detailItem.itemsPhotoUrl || !!detailItem.invoicePhotoUrl) && (
              <View style={{ gap: 10, paddingTop: 4 }}>
                {!!detailItem.itemsPhotoUrl && (
                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 5 }}>
                      <Ionicons name="bag-outline" size={14} color={Colors.info} />
                      <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.info }}>صورة المشتريات</Text>
                    </View>
                    <TouchableOpacity onPress={() => setViewImg(detailItem.itemsPhotoUrl)} activeOpacity={0.85}>
                      <Image source={{ uri: detailItem.itemsPhotoUrl }} style={{ width: "100%", height: 140, borderRadius: 10 }} resizeMode="cover" />
                    </TouchableOpacity>
                  </View>
                )}
                {!!detailItem.invoicePhotoUrl && (
                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 5 }}>
                      <Ionicons name="receipt-outline" size={14} color={Colors.warning} />
                      <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.warning }}>صورة الفاتورة</Text>
                    </View>
                    <TouchableOpacity onPress={() => setViewImg(detailItem.invoicePhotoUrl)} activeOpacity={0.85}>
                      <Image source={{ uri: detailItem.invoicePhotoUrl }} style={{ width: "100%", height: 140, borderRadius: 10 }} resizeMode="cover" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity style={[s.modalSaveBtn, { backgroundColor: Colors.primary }]} onPress={() => setDetailItem(null)}>
              <Text style={s.modalSaveBtnTxt}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══════════════ Modal التعديل ══════════════ */}
      <Modal visible={!!editTarget} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>تعديل المصروف</Text>

            {editTarget && (
              <View style={s.editInfoBox}>
                <Text style={s.editInfoTxt}>
                  القيمة الحالية: {formatCurrency(parseFloat(editTarget.amount))} —{" "}
                  {editTarget.paymentType === "cash" ? "نقد" : "دين"}
                </Text>
              </View>
            )}

            <Text style={s.fieldLabel}>البيان</Text>
            <TextInput
              style={s.modalInput} value={editDesc} onChangeText={setEditDesc}
              placeholder="وصف المصروف" placeholderTextColor={Colors.textMuted} textAlign="right"
            />

            <Text style={[s.fieldLabel, { marginTop: 12 }]}>المبلغ الجديد (ر.س)</Text>
            <TextInput
              style={[s.modalInput, { fontSize: 20, fontWeight: "800" }]}
              value={editAmt}
              onChangeText={v => setEditAmt(v.replace(/[^0-9.]/g, ""))}
              placeholder="0.00" placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad" textAlign="right"
            />

            <Text style={[s.fieldLabel, { marginTop: 12 }]}>طريقة الدفع</Text>
            <View style={s.payRow}>
              {([
                { k: "cash", label: "نقد", c: Colors.error   },
                { k: "debt", label: "دين", c: Colors.warning },
              ] as const).map(p => (
                <TouchableOpacity
                  key={p.k}
                  style={[s.payBtn, editPt === p.k && { borderColor: p.c, backgroundColor: p.c + "18" }]}
                  onPress={() => setEditPt(p.k)}
                >
                  <Text style={[s.payBtnTxt, editPt === p.k && { color: p.c }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {editPt === "debt" && (
              <>
                <Text style={[s.fieldLabel, { marginTop: 12 }]}>اسم الجهة الدائنة</Text>
                <TextInput
                  style={s.modalInput} value={editPerson} onChangeText={setEditPerson}
                  placeholder="اسم المورد..." placeholderTextColor={Colors.textMuted} textAlign="right"
                />
              </>
            )}

            {/* ملاحظة الأثر */}
            {editTarget && (
              <View style={s.effectNote}>
                <Ionicons name="information-circle" size={14} color={Colors.info} />
                <Text style={s.effectNoteTxt}>
                  سيتم تعديل الصندوق والديون تلقائياً بناءً على الفرق
                </Text>
              </View>
            )}

            <View style={s.modalBtns}>
              <TouchableOpacity
                style={[s.modalSaveBtn, saving && { opacity: 0.5 }]}
                onPress={handleEdit} disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.modalSaveBtnTxt}>حفظ التعديل</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setEditTarget(null)}>
                <Text style={s.modalCancelBtnTxt}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════ Modal القالب ══════════════ */}
      <Modal visible={showTemplateModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>قالب مصروف جديد</Text>
            <Text style={s.fieldLabel}>الاسم</Text>
            <TextInput
              style={s.modalInput} value={newTemplateName} onChangeText={setNewTemplateName}
              textAlign="right" placeholder="مثال: إيجار المكتب" placeholderTextColor={Colors.textMuted}
            />
            <Text style={[s.fieldLabel, { marginTop: 12 }]}>المبلغ (اختياري)</Text>
            <TextInput
              style={s.modalInput} value={newTemplateAmount} onChangeText={setNewTemplateAmount}
              textAlign="right" placeholder="0.00" placeholderTextColor={Colors.textMuted} keyboardType="numeric"
            />
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.modalSaveBtn, saving && { opacity: 0.5 }]} onPress={addTemplate} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.modalSaveBtnTxt}>حفظ</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowTemplateModal(false)}>
                <Text style={s.modalCancelBtnTxt}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════ Modal الالتزام ══════════════ */}
      <Modal visible={showObligModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>التزام شهري جديد</Text>
            <Text style={s.fieldLabel}>الاسم</Text>
            <TextInput
              style={s.modalInput} value={newOblig.name} onChangeText={v => setNewOblig(o => ({ ...o, name: v }))}
              textAlign="right" placeholder="مثال: إيجار المكتب" placeholderTextColor={Colors.textMuted}
            />
            <Text style={[s.fieldLabel, { marginTop: 12 }]}>المبلغ الشهري (ر.س)</Text>
            <TextInput
              style={s.modalInput} value={newOblig.amount} onChangeText={v => setNewOblig(o => ({ ...o, amount: v }))}
              textAlign="right" placeholder="0.00" placeholderTextColor={Colors.textMuted} keyboardType="numeric"
            />
            <Text style={[s.fieldLabel, { marginTop: 12 }]}>ملاحظات</Text>
            <TextInput
              style={s.modalInput} value={newOblig.notes} onChangeText={v => setNewOblig(o => ({ ...o, notes: v }))}
              textAlign="right" placeholder="اختياري" placeholderTextColor={Colors.textMuted}
            />
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.modalSaveBtn, saving && { opacity: 0.5 }]} onPress={addObligation} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.modalSaveBtnTxt}>حفظ</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowObligModal(false)}>
                <Text style={s.modalCancelBtnTxt}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════ Confirm Delete Modal ══════════════ */}
      <ConfirmModal
        visible={!!deleteTarget}
        title="تأكيد الحذف"
        message={deleteTarget ? `هل تريد حذف: "${deleteTarget.description}"?\n\n${deleteTarget.paymentType === "cash"
          ? `سيتم إعادة ${formatCurrency(parseFloat(deleteTarget.amount))} للصندوق النقدي`
          : `سيتم إزالة سجل الدين المرتبط (${formatCurrency(parseFloat(deleteTarget.amount))})`}` : ""}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <AlertModal
        visible={alert.visible} title={alert.title} message={alert.message} color={alert.color}
        onClose={() => setAlert(a => ({ ...a, visible: false }))}
      />

      {/* ══════════════ مودال عرض الصورة ══════════════ */}
      <Modal visible={!!viewImg} transparent animationType="fade" onRequestClose={() => setViewImg(null)}>
        <TouchableOpacity style={s.imgOverlay} activeOpacity={1} onPress={() => setViewImg(null)}>
          {!!viewImg && (
            <Image source={{ uri: viewImg }} style={s.imgFull} resizeMode="contain" />
          )}
          <View style={s.imgClose}>
            <Ionicons name="close-circle" size={32} color="#fff" />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center:    { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: Colors.text },

  tabRow:      { flexDirection: "row-reverse", paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  tab:         { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  tabActive:   { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabTxt:      { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" },
  tabTxtActive: { color: "#fff" },

  filterRow:      { flexDirection: "row-reverse", paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterBtn:      { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  filterBtnActive:   { backgroundColor: Colors.error + "18", borderColor: Colors.error },
  filterBtnTxt:      { fontSize: 12, color: Colors.textSecondary },
  filterBtnTxtActive: { color: Colors.error, fontWeight: "bold" },

  summaryRow: { flexDirection: "row-reverse", paddingHorizontal: 16, paddingBottom: 6, gap: 8 },
  summaryCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 10,
    padding: 10, alignItems: "center", borderWidth: 1, borderColor: Colors.border,
  },
  summaryLbl: { fontSize: 10, color: Colors.textMuted, marginBottom: 2 },
  summaryVal: { fontSize: 13, fontWeight: "800" },

  content: { padding: 16, paddingTop: 8 },
  empty:   { alignItems: "center", marginTop: 40, gap: 12 },
  emptyTxt: { color: Colors.textMuted, fontSize: 15 },

  /* بطاقة المعاملة */
  txCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  txTop:  { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  txDesc: { fontSize: 14, color: Colors.text, flex: 1, textAlign: "right", marginLeft: 8, lineHeight: 20 },
  txAmt:  { fontSize: 15, fontWeight: "800", flexShrink: 0 },
  txMeta: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  txDate: { fontSize: 11, color: Colors.textMuted },

  ptBadge:    { flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  ptBadgeTxt: { fontSize: 10, fontWeight: "700" },

  txActions:         { flexDirection: "row-reverse", gap: 6 },
  txActionBtn:       { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  txActionBtnDetail: { borderColor: Colors.primary + "44", backgroundColor: Colors.primary + "0C" },
  txActionBtnEdit:   { borderColor: Colors.warning + "44", backgroundColor: Colors.warning + "0C" },
  txActionBtnDelete: { borderColor: Colors.error   + "44", backgroundColor: Colors.error   + "0C" },
  txActionBtnTxt:    { fontSize: 12, fontWeight: "700" },

  /* القوالب */
  addBtn:    { flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.primary + "66", marginBottom: 16 },
  addBtnTxt: { color: Colors.primary, fontWeight: "600", fontSize: 14 },
  templateCard: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
  },
  templateName: { fontSize: 14, fontWeight: "bold", color: Colors.text },
  templateAmt:  { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  deleteIcon:   { padding: 8 },

  /* الالتزامات */
  obligCard: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
  },
  obligName:  { fontSize: 14, fontWeight: "bold", color: Colors.text },
  obligNotes: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  obligAmt:   { fontSize: 14, fontWeight: "800" },
  obligTotal: {
    marginTop: 16, padding: 16, backgroundColor: Colors.error + "11",
    borderRadius: 12, borderWidth: 1, borderColor: Colors.error + "33",
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
  },
  obligTotalLbl: { fontSize: 13, color: Colors.textSecondary },
  obligTotalVal: { fontSize: 18, fontWeight: "800" },

  /* Modals */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalBox: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 0,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: Colors.text, textAlign: "center", marginBottom: 16 },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: 8, fontWeight: "600" },
  modalInput: {
    backgroundColor: Colors.background, borderRadius: 12, padding: 13,
    color: Colors.text, fontSize: 15, borderWidth: 1, borderColor: Colors.border,
  },
  editInfoBox: {
    backgroundColor: Colors.info + "12", borderRadius: 10, padding: 10, marginBottom: 12,
  },
  editInfoTxt: { fontSize: 12, color: Colors.info, textAlign: "right", fontWeight: "600" },
  payRow:  { flexDirection: "row-reverse", gap: 8, marginBottom: 4 },
  payBtn:  {
    flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  payBtnTxt: { fontSize: 14, fontWeight: "700", color: Colors.textSecondary },

  effectNote: {
    flexDirection: "row-reverse", alignItems: "flex-start", gap: 6,
    backgroundColor: Colors.info + "10", borderRadius: 10, padding: 10, marginTop: 10,
  },
  effectNoteTxt: { flex: 1, fontSize: 11, color: Colors.textSecondary, textAlign: "right" },

  modalBtns:      { flexDirection: "row-reverse", gap: 10, marginTop: 16 },
  modalSaveBtn:   { flex: 1, backgroundColor: Colors.primary, borderRadius: 12, padding: 14, alignItems: "center" },
  modalSaveBtnTxt: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  modalCancelBtn:  { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, alignItems: "center" },
  modalCancelBtnTxt: { color: Colors.textSecondary, fontWeight: "bold" },

  /* تفاصيل */
  detailRow: {
    flexDirection: "row-reverse", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  detailKey: { fontSize: 12, color: Colors.textMuted },
  detailVal: { fontSize: 14, fontWeight: "700", color: Colors.text, flex: 1, textAlign: "right", marginRight: 12 },

  /* Confirm + Alert */
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  confirmBox: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 28,
    width: "100%", maxWidth: 340, alignItems: "center", gap: 12,
  },
  alertBox: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 28,
    width: "100%", maxWidth: 340, alignItems: "center", gap: 12,
  },
  confirmIcon:   { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center" },
  confirmTitle:  { fontSize: 17, fontWeight: "800", color: Colors.text, textAlign: "center" },
  confirmMsg:    { fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  confirmBtns:   { flexDirection: "row-reverse", gap: 10, width: "100%" },
  confirmYes:    { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  confirmYesTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  confirmNo:     { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  confirmNoTxt:  { color: Colors.textSecondary, fontWeight: "700", fontSize: 15 },

  /* أزرار صور المشتريات في الكرت */
  photosBtnRow: { flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" },
  photoBtn: {
    flexDirection: "row-reverse", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, backgroundColor: Colors.surfaceElevated,
  },
  photoBtnTxt: { fontSize: 12, fontWeight: "600" },

  /* مودال عرض الصورة */
  imgOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center", alignItems: "center",
  },
  imgFull:  { width: "100%", height: "80%", borderRadius: 8 },
  imgClose: { position: "absolute", top: 52, right: 18 },
});
