/**
 * شاشة كل العمليات — Flash Net
 * ─────────────────────────────────────────────────────────
 * تجمع كل عمليات النظام من:
 *   • financial_transactions  (بيع / صرف / تحصيل / سداد / عهدة نقد)
 *   • custody_records[cards]  (تسليم / استلام كروت فقط — النقد مُسجَّل بـ CUSTODY-RECV)
 * لكل عملية يُعرَض تأثيرها الدقيق (ما زاد / ما نقص).
 */
import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, RefreshControl, Modal, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPut, apiDelete, formatCurrency, formatDateTime } from "@/utils/api";

/* ══════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════ */
type Dir = "up" | "down";
interface Effect { label: string; dir: Dir; amount: number }
interface OpMeta {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  tag: string;
  effects: Effect[];
  canEdit: boolean;
}
type Period = "day" | "week" | "month" | "custom";

/* ══════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════ */
const PERIODS: { key: Period; label: string }[] = [
  { key: "month",  label: "الشهر"  },
  { key: "week",   label: "الأسبوع" },
  { key: "day",    label: "اليوم"  },
  { key: "custom", label: "تحديد"  },
];

/* كل العمليات الـ 13 + الكل — مع الألوان والأيقونات */
const OP_CHIPS = [
  { key: "all",              label: "الكل",             icon: "apps"                         as const, color: Colors.primary   },
  { key: "hot_cash",         label: "هوتسبوت نقد",      icon: "wifi"                         as const, color: "#43A047"        },
  { key: "hot_loan",         label: "هوتسبوت سلفة",     icon: "wifi-outline"                 as const, color: Colors.warning   },
  { key: "bb_cash",          label: "برودباند نقد",     icon: "globe"                        as const, color: "#00BCD4"        },
  { key: "bb_loan",          label: "برودباند سلفة",    icon: "globe-outline"                as const, color: "#FF9800"        },
  { key: "exp_cash",         label: "صرف نقدي",         icon: "arrow-up-circle"              as const, color: Colors.error     },
  { key: "exp_debt",         label: "صرف دين",          icon: "receipt"                      as const, color: "#FF7043"        },
  { key: "collect",          label: "تحصيل سلفة",       icon: "checkmark-circle"             as const, color: "#29B6F6"        },
  { key: "loan_payment",     label: "سداد دين",         icon: "return-down-forward-outline"  as const, color: "#9C27B0"        },
  { key: "custody_out",      label: "تسليم عهدة",       icon: "send"                         as const, color: "#673AB7"        },
  { key: "recv_cash_agent",  label: "استلام نقد مندوب", icon: "arrow-down-circle"            as const, color: "#4CAF50"        },
  { key: "recv_cards_agent", label: "كروت مرتجعة",      icon: "card-outline"                 as const, color: Colors.info      },
  { key: "recv_cash_owner",  label: "نقد من المالك",    icon: "briefcase"                    as const, color: Colors.primary   },
  { key: "recv_cards_owner", label: "كروت من المالك",   icon: "briefcase-outline"            as const, color: "#5C6BC0"        },
];

/* ══════════════════════════════════════════════════════════
   PURE FUNCTION — تحليل كل عملية وتحديد تأثيرها
══════════════════════════════════════════════════════════ */
function getOpMeta(item: any): OpMeta {
  const amt = parseFloat(item.amount ?? "0");

  /* ─── custody_records (كروت فقط) ─── */
  if (item._source === "custody") {
    const from = item.fromRole;

    /* 9. تسليم كروت للمندوب: ↑عهدة مندوبين, ↓إجمالي كروت, ↓عهدة رئيسية */
    if (from === "finance_manager") {
      return {
        label: `تسليم كروت ← ${item.toPersonName ?? "مندوب"}`,
        icon: "send",
        color: "#673AB7",
        tag: "custody_out",  /* تسليم عهدة */
        effects: [
          { label: "عهدة المندوبين",  dir: "up",   amount: amt },
          { label: "إجمالي الكروت",   dir: "down", amount: amt },
          { label: "العهدة الرئيسية", dir: "down", amount: amt },
        ],
        canEdit: false,
      };
    }

    /* 11. استلام كروت مرتجعة: ↑إجمالي كروت, ↑عهدة رئيسية, ↓عهدة مندوبين */
    if (from === "tech_engineer") {
      return {
        label: `استلام كروت ← ${item.toPersonName ?? "مندوب"}`,
        icon: "arrow-down-circle",
        color: Colors.info,
        tag: "recv_cards_agent",
        effects: [
          { label: "إجمالي الكروت",   dir: "up",   amount: amt },
          { label: "العهدة الرئيسية", dir: "up",   amount: amt },
          { label: "عهدة المندوبين",  dir: "down", amount: amt },
        ],
        canEdit: false,
      };
    }

    /* 13. كروت من المالك: ↑إجمالي كروت, ↑عهدة رئيسية */
    if (from === "owner") {
      return {
        label: "كروت من المالك",
        icon: "briefcase-outline",
        color: "#5C6BC0",
        tag: "recv_cards_owner",
        effects: [
          { label: "إجمالي الكروت",   dir: "up", amount: amt },
          { label: "العهدة الرئيسية", dir: "up", amount: amt },
        ],
        canEdit: false,
      };
    }

    return {
      label: "عهدة كروت", icon: "card", color: Colors.textMuted, tag: "other",
      effects: [], canEdit: false,
    };
  }

  /* ─── financial_transactions ─── */
  const type = item.type;
  const pt   = item.paymentType ?? "cash";
  const cat  = item.category    ?? "hotspot";
  const ref  = item.referenceId ?? "";
  const who  = item.personName  ?? "";
  const isHot = cat === "hotspot";

  /* 10. استلام نقد من مندوب: ↑صندوق, ↑عهدة رئيسية, ↓عهدة مندوبين */
  if (type === "sale" && pt === "cash" && ref.startsWith("CUSTODY-RECV")) {
    return {
      label: `استلام نقد ← ${who || "مندوب"}`,
      icon: "arrow-down-circle",
      color: "#4CAF50",
      tag: "recv_cash_agent",
      effects: [
        { label: "الصندوق النقدي",   dir: "up",   amount: amt },
        { label: "العهدة الرئيسية",  dir: "up",   amount: amt },
        { label: "عهدة المندوبين",   dir: "down", amount: amt },
      ],
      canEdit: true,
    };
  }

  /* 1. بيع هوتسبوت نقدي: ↑صندوق, ↓كروت
     3. بيع برودباند نقدي: ↑صندوق, ↑عهدة رئيسية */
  if (type === "sale" && pt === "cash") {
    return {
      label: `بيع ${isHot ? "هوتسبوت" : "برودباند"} — نقد`,
      icon: "cart",
      color: isHot ? "#43A047" : "#00BCD4",
      tag: isHot ? "hot_cash" : "bb_cash",
      effects: isHot
        ? [
            { label: "الصندوق النقدي", dir: "up",   amount: amt },
            { label: "إجمالي الكروت",  dir: "down", amount: amt },
          ]
        : [
            { label: "الصندوق النقدي", dir: "up", amount: amt },
            { label: "العهدة الرئيسية",dir: "up", amount: amt },
          ],
      canEdit: true,
    };
  }

  /* 2. بيع هوتسبوت سلفة: ↑سلف, ↓كروت
     4. بيع برودباند سلفة: ↑سلف, ↑عهدة رئيسية */
  if (type === "sale" && pt === "loan") {
    return {
      label: `بيع ${isHot ? "هوتسبوت" : "برودباند"} — سلفة`,
      icon: "cart-outline",
      color: isHot ? Colors.warning : "#FF9800",
      tag: isHot ? "hot_loan" : "bb_loan",
      effects: isHot
        ? [
            { label: "سلف العملاء",   dir: "up",   amount: amt },
            { label: "إجمالي الكروت", dir: "down", amount: amt },
          ]
        : [
            { label: "سلف العملاء",    dir: "up", amount: amt },
            { label: "العهدة الرئيسية",dir: "up", amount: amt },
          ],
      canEdit: true,
    };
  }

  /* 7. تحصيل سلفة: ↑صندوق, ↓سلف العملاء */
  if (type === "sale" && pt === "collect") {
    return {
      label: `تحصيل سلفة ← ${who}`,
      icon: "checkmark-circle",
      color: "#29B6F6",
      tag: "collect",
      effects: [
        { label: "الصندوق النقدي", dir: "up",   amount: amt },
        { label: "سلف العملاء",   dir: "down", amount: amt },
      ],
      canEdit: true,
    };
  }

  /* 5. صرفية نقدية: ↓صندوق, ↓عهدة رئيسية */
  if (type === "expense" && pt === "cash") {
    return {
      label: "صرفية نقدية",
      icon: "arrow-up-circle",
      color: Colors.error,
      tag: "exp_cash",
      effects: [
        { label: "الصندوق النقدي",  dir: "down", amount: amt },
        { label: "العهدة الرئيسية", dir: "down", amount: amt },
      ],
      canEdit: true,
    };
  }

  /* 6. صرفية بدين: ↑ديون الشركة فقط */
  if (type === "expense" && pt === "debt") {
    return {
      label: `صرفية بدين ← ${who}`,
      icon: "receipt",
      color: "#FF7043",
      tag: "exp_debt",
      effects: [
        { label: "ديون الشركة", dir: "up", amount: amt },
      ],
      canEdit: true,
    };
  }

  /* 8. سداد دين: ↓ديون الشركة, ↓صندوق, ↓عهدة رئيسية */
  if (type === "expense" && pt === "loan_payment") {
    return {
      label: `سداد دين ← ${who}`,
      icon: "return-down-forward-outline",
      color: "#9C27B0",
      tag: "loan_payment",
      effects: [
        { label: "ديون الشركة",    dir: "down", amount: amt },
        { label: "الصندوق النقدي", dir: "down", amount: amt },
        { label: "العهدة الرئيسية",dir: "down", amount: amt },
      ],
      canEdit: true,
    };
  }

  /* 12. عهدة نقد من المالك: ↑صندوق, ↑عهدة رئيسية */
  if (type === "custody_in") {
    return {
      label: "عهدة نقد من المالك",
      icon: "briefcase",
      color: Colors.primary,
      tag: "recv_cash_owner",
      effects: [
        { label: "الصندوق النقدي",  dir: "up", amount: amt },
        { label: "العهدة الرئيسية", dir: "up", amount: amt },
      ],
      canEdit: true,
    };
  }

  return {
    label: "عملية أخرى", icon: "ellipse-outline",
    color: Colors.textMuted, tag: "other", effects: [], canEdit: true,
  };
}

/* ══════════════════════════════════════════════════════════
   SUB-COMPONENTS (defined OUTSIDE parent — no re-render issues)
══════════════════════════════════════════════════════════ */

/* ─── بطاقة التأثير ─── */
function EffectPills({ effects }: { effects: Effect[] }) {
  if (!effects.length) return null;
  return (
    <View style={ec.row}>
      {effects.map((e, i) => {
        const isUp    = e.dir === "up";
        const color   = isUp ? Colors.success : Colors.error;
        const bg      = color + "18";
        const arrow   = isUp ? "↑" : "↓";
        return (
          <View key={i} style={[ec.pill, { backgroundColor: bg, borderColor: color + "50" }]}>
            <Text style={[ec.arrow, { color }]}>{arrow}</Text>
            <Text style={[ec.label, { color }]}>{e.label}</Text>
            <Text style={[ec.amt, { color }]}>{formatCurrency(e.amount)}</Text>
          </View>
        );
      })}
    </View>
  );
}
const ec = StyleSheet.create({
  row:   { flexDirection: "row-reverse", flexWrap: "wrap", gap: 5, marginTop: 8 },
  pill:  { flexDirection: "row-reverse", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, borderWidth: 1 },
  arrow: { fontSize: 11, fontWeight: "800" },
  label: { fontSize: 10, fontWeight: "600" },
  amt:   { fontSize: 10, fontWeight: "800" },
});

/* ─── Modal تنبيه ─── */
function AlertModal({ visible, title, message, color, onClose }: {
  visible: boolean; title: string; message: string; color: string; onClose: () => void;
}) {
  if (!visible) return null;
  const isOk = color === Colors.success;
  return (
    <Modal visible transparent animationType="fade">
      <View style={mc.overlay}>
        <View style={mc.box}>
          <View style={[mc.iconWrap, { backgroundColor: color + "20" }]}>
            <Ionicons name={isOk ? "checkmark-circle" : "close-circle"} size={42} color={color} />
          </View>
          <Text style={mc.title}>{title}</Text>
          {!!message && <Text style={mc.msg}>{message}</Text>}
          <TouchableOpacity style={[mc.btn, { backgroundColor: color }]} onPress={onClose}>
            <Text style={mc.btnTxt}>حسناً</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Modal تأكيد الحذف ─── */
function ConfirmDeleteModal({ item, meta, onCancel, onConfirm, deleting }: {
  item: any | null; meta: OpMeta | null;
  onCancel: () => void; onConfirm: () => void; deleting: boolean;
}) {
  if (!item || !meta) return null;
  const amt = parseFloat(item.amount ?? "0");
  return (
    <Modal visible animationType="fade" transparent>
      <View style={mc.overlay}>
        <View style={mc.box}>
          <View style={[mc.iconWrap, { backgroundColor: Colors.error + "20" }]}>
            <Ionicons name="trash" size={38} color={Colors.error} />
          </View>
          <Text style={mc.title}>حذف العملية؟</Text>
          <Text style={[mc.msg, { textAlign: "center" }]}>
            <Text style={{ fontWeight: "700", color: Colors.text }}>{meta.label}</Text>
            {`\nبمبلغ `}
            <Text style={{ fontWeight: "800", color: Colors.error }}>{formatCurrency(amt)}</Text>
          </Text>

          {/* التأثير المعكوس */}
          {meta.effects.length > 0 && (
            <View style={mc.effectWrap}>
              <Text style={mc.effectHdr}>التأثير بعد الحذف:</Text>
              {meta.effects.map((e, i) => {
                const wasUp   = e.dir === "up";
                const color   = wasUp ? Colors.error : Colors.success;
                const newDir  = wasUp ? "↓" : "↑";
                return (
                  <View key={i} style={mc.effectRow}>
                    <Text style={[mc.effectAmt, { color }]}>{formatCurrency(e.amount)}</Text>
                    <Text style={[mc.effectDir, { color }]}>{newDir}</Text>
                    <Text style={mc.effectLbl}>{e.label}</Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={mc.btnRow}>
            <TouchableOpacity
              style={[mc.btn, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }]}
              onPress={onCancel}>
              <Text style={[mc.btnTxt, { color: Colors.text }]}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[mc.btn, { backgroundColor: Colors.error, flex: 1 }]}
              onPress={onConfirm} disabled={deleting}>
              {deleting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={mc.btnTxt}>حذف ✕</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Modal تعديل ─── */
function EditModal({ item, meta, token, onClose, onSuccess, onError }: {
  item: any | null; meta: OpMeta | null; token: string | null;
  onClose: () => void; onSuccess: () => void; onError: (msg: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [desc,   setDesc]   = useState("");
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (item) {
      setAmount(String(parseFloat(item.amount ?? "0")));
      setDesc(item.description ?? item.notes ?? "");
    }
  }, [item]);

  if (!item || !meta) return null;

  const handleSave = async () => {
    const parsedAmt = parseFloat(amount.replace(/[^0-9.]/g, ""));
    if (!parsedAmt || parsedAmt <= 0) { onError("أدخل مبلغاً صحيحاً"); return; }
    setSaving(true);
    try {
      if (item._source === "custody") {
        await apiPut(`/custody/${item.id}`, token, { amount: parsedAmt, notes: desc.trim() || undefined });
      } else {
        await apiPut(`/transactions/${item.id}`, token, { amount: parsedAmt, description: desc.trim() || undefined });
      }
      onSuccess();
    } catch (e: any) {
      onError(e?.message ?? "فشل التعديل");
    } finally { setSaving(false); }
  };

  return (
    <Modal visible animationType="slide" transparent>
      <View style={mc.sheetOverlay}>
        <View style={mc.sheet}>
          <View style={mc.sheetHdr}>
            <Text style={mc.sheetTitle}>تعديل: {meta.label}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* التأثير الحالي */}
          {meta.effects.length > 0 && (
            <View style={mc.curEffect}>
              <Text style={mc.curEffectLbl}>التأثير الحالي:</Text>
              <EffectPills effects={meta.effects} />
            </View>
          )}

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={mc.lbl}>المبلغ الجديد (ر.س)</Text>
            <TextInput
              style={mc.inp} value={amount} onChangeText={setAmount}
              keyboardType="decimal-pad" textAlign="right"
              placeholder="0.00" placeholderTextColor={Colors.textMuted}
            />
            <Text style={[mc.lbl, { marginTop: 14 }]}>
              {item._source === "custody" ? "ملاحظات" : "البيان"}
            </Text>
            <TextInput
              style={[mc.inp, { height: 70 }]} value={desc} onChangeText={setDesc}
              textAlign="right" multiline
              placeholder="وصف العملية..." placeholderTextColor={Colors.textMuted}
            />

            {/* تنبيه التأثير */}
            <View style={mc.warnBox}>
              <Ionicons name="information-circle" size={14} color={Colors.warning} />
              <Text style={mc.warnTxt}>سيُعدَّل الفرق تلقائياً على الأرقام المرتبطة</Text>
            </View>

            <TouchableOpacity
              style={[mc.saveBtn, saving && { opacity: 0.5 }]}
              onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={mc.saveBtnTxt}>حفظ التعديل</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Modal تفاصيل كاملة ─── */
function DetailModal({ item, meta, onClose }: {
  item: any | null; meta: OpMeta | null; onClose: () => void;
}) {
  if (!item || !meta) return null;
  const isCust = item._source === "custody";
  const rows: { key: string; val: string }[] = [];

  if (item.personName || item.toPersonName)
    rows.push({ key: "الشخص / الجهة", val: item.personName || item.toPersonName });
  if (!isCust && item.description)
    rows.push({ key: "البيان", val: item.description });
  if (isCust && item.notes)
    rows.push({ key: "ملاحظات", val: item.notes });
  if (!isCust && item.paymentType)
    rows.push({ key: "نوع الدفع", val: PT_LABEL[item.paymentType] ?? item.paymentType });
  if (!isCust && item.category && item.category !== "other")
    rows.push({ key: "الخدمة", val: item.category === "hotspot" ? "هوتسبوت" : "برودباند" });
  rows.push({ key: "التاريخ", val: formatDateTime(item.createdAt || item.created_at) });
  if (!isCust && item.referenceId)
    rows.push({ key: "المرجع", val: item.referenceId });

  return (
    <Modal visible animationType="slide" transparent>
      <View style={mc.sheetOverlay}>
        <View style={mc.sheet}>
          <View style={mc.sheetHdr}>
            <Text style={mc.sheetTitle}>{meta.label}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* المبلغ */}
          <View style={[mc.amtWrap, { borderColor: meta.color + "40", backgroundColor: meta.color + "0E" }]}>
            <Ionicons name={meta.icon} size={22} color={meta.color} />
            <Text style={[mc.amtBig, { color: meta.color }]}>
              {formatCurrency(parseFloat(item.amount ?? "0"))}
            </Text>
          </View>

          {/* التأثير */}
          <View style={mc.curEffect}>
            <Text style={mc.curEffectLbl}>تأثير العملية:</Text>
            <EffectPills effects={meta.effects} />
          </View>

          {/* تفاصيل */}
          {rows.map(r => (
            <View key={r.key} style={mc.detRow}>
              <Text style={mc.detVal} numberOfLines={2}>{r.val}</Text>
              <Text style={mc.detKey}>{r.key}</Text>
            </View>
          ))}

          <TouchableOpacity style={mc.saveBtn} onPress={onClose}>
            <Text style={mc.saveBtnTxt}>إغلاق</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const PT_LABEL: Record<string, string> = {
  cash: "نقدي", loan: "سلفة", debt: "دين", collect: "تحصيل سلفة",
  loan_payment: "سداد دين", cash_out: "نقدي",
};

/* styles للـ modals (shared) */
const mc = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", alignItems: "center", padding: 20 },
  box:        { backgroundColor: Colors.surface, borderRadius: 22, padding: 22, width: "100%", maxWidth: 340, alignItems: "center", gap: 12 },
  iconWrap:   { width: 70, height: 70, borderRadius: 35, justifyContent: "center", alignItems: "center" },
  title:      { fontSize: 16, fontWeight: "800", color: Colors.text, textAlign: "center" },
  msg:        { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  btnRow:     { flexDirection: "row-reverse", gap: 10, width: "100%" },
  btn:        { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  btnTxt:     { color: "#fff", fontSize: 14, fontWeight: "700" },
  effectWrap: { backgroundColor: Colors.background, borderRadius: 10, padding: 10, width: "100%", gap: 6 },
  effectHdr:  { fontSize: 12, color: Colors.textMuted, textAlign: "right" },
  effectRow:  { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  effectDir:  { fontSize: 14, fontWeight: "800" },
  effectLbl:  { fontSize: 12, color: Colors.text, flex: 1, textAlign: "right" },
  effectAmt:  { fontSize: 12, fontWeight: "700" },
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:      { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "92%", gap: 12 },
  sheetHdr:   { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: Colors.text, flex: 1, textAlign: "right" },
  curEffect:  { backgroundColor: Colors.background, borderRadius: 10, padding: 10, gap: 4 },
  curEffectLbl:{ fontSize: 11, color: Colors.textMuted, textAlign: "right" },
  lbl:        { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: 4 },
  inp:        { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: Colors.text, fontSize: 14, backgroundColor: Colors.background },
  warnBox:    { flexDirection: "row-reverse", gap: 6, alignItems: "center", backgroundColor: Colors.warning + "15", borderRadius: 8, padding: 10, marginTop: 10 },
  warnTxt:    { fontSize: 12, color: Colors.warning, flex: 1, textAlign: "right" },
  saveBtn:    { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 10 },
  saveBtnTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
  amtWrap:    { flexDirection: "row-reverse", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, padding: 14, width: "100%" },
  amtBig:     { fontSize: 26, fontWeight: "800" },
  detRow:     { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border, width: "100%" },
  detKey:     { fontSize: 12, color: Colors.textMuted, flexShrink: 0 },
  detVal:     { fontSize: 13, color: Colors.text, fontWeight: "600", flex: 1, textAlign: "right", marginRight: 10 },
});

/* ══════════════════════════════════════════════════════════
   MAIN SCREEN
══════════════════════════════════════════════════════════ */
export default function OperationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  /* ─── state ─── */
  const [allItems,   setAllItems]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [period,   setPeriod]   = useState<Period>("month");
  const [fromDate, setFromDate] = useState("");
  const [toDate,   setToDate]   = useState("");
  const [chip,     setChip]     = useState("all");

  const [viewItem,   setViewItem]   = useState<any>(null);
  const [editItem,   setEditItem]   = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [deleting,   setDeleting]   = useState(false);
  const [alert, setAlert] = useState({ visible: false, title: "", message: "", color: Colors.success });
  const showAlert = (title: string, message: string, color = Colors.success) =>
    setAlert({ visible: true, title, message, color });

  /* ─── جلب البيانات ─── */
  const fetchAll = useCallback(async () => {
    try {
      const [txData, custodyData] = await Promise.all([
        apiGet("/transactions?limit=500", token),
        apiGet("/custody?limit=200",      token),
      ]);
      const txItems = (Array.isArray(txData) ? txData : [])
        .map((t: any) => ({ ...t, _source: "tx", _date: t.createdAt }));

      /* كروت العهدة فقط — النقد مُسجَّل بـ CUSTODY-RECV في financial_transactions */
      const custItems = (Array.isArray(custodyData) ? custodyData : [])
        .filter((r: any) => r.type === "cards")
        .map((r: any) => ({ ...r, _source: "custody", _date: r.createdAt }));

      const merged = [...txItems, ...custItems]
        .sort((a, b) => new Date(b._date).getTime() - new Date(a._date).getTime());

      setAllItems(merged);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  /* ─── فلترة بالفترة ─── */
  const inPeriod = useCallback((item: any) => {
    const d = new Date(item._date);
    const now = new Date();
    if (period === "day")   return d.toDateString() === now.toDateString();
    if (period === "week")  { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w; }
    if (period === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (period === "custom") {
      const from = fromDate ? new Date(fromDate + "T00:00:00") : null;
      const to   = toDate   ? new Date(toDate   + "T23:59:59") : null;
      if (from && d < from) return false;
      if (to   && d > to)   return false;
      return true;
    }
    return true;
  }, [period, fromDate, toDate]);

  /* ─── عناصر الفترة المحددة ─── */
  const periodItems = useMemo(() => allItems.filter(inPeriod), [allItems, inPeriod]);

  /* ─── عدد كل نوع في الفترة ─── */
  const chipCounts = useMemo(() => {
    const counts: Record<string, number> = { all: periodItems.length };
    periodItems.forEach(item => {
      const t = getOpMeta(item).tag;
      counts[t] = (counts[t] ?? 0) + 1;
    });
    return counts;
  }, [periodItems]);

  /* ─── قائمة مُعالَجة ─── */
  const displayed = useMemo(() => {
    if (chip === "all") return periodItems;
    return periodItems.filter(item => getOpMeta(item).tag === chip);
  }, [periodItems, chip]);

  /* ─── إجمالي المبلغ للنوع المحدد ─── */
  const chipTotal = useMemo(() => {
    if (chip === "all") return 0;
    return displayed.reduce((sum, item) => sum + parseFloat(item.amount ?? "0"), 0);
  }, [displayed, chip]);

  /* ─── حذف ─── */
  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      if (deleteItem._source === "custody") {
        await apiDelete(`/custody/${deleteItem.id}`, token);
      } else {
        await apiDelete(`/transactions/${deleteItem.id}`, token);
      }
      setDeleteItem(null);
      await fetchAll();
      showAlert("تم الحذف ✓", "تم حذف العملية وتحديث الأرقام تلقائياً");
    } catch (e: any) {
      setDeleteItem(null);
      showAlert("خطأ في الحذف", e?.message ?? "فشل الحذف", Colors.error);
    } finally { setDeleting(false); }
  };

  const pt = Platform.OS === "web" ? 20 : insets.top;
  const pb = Platform.OS === "web" ? 40 : insets.bottom + 30;

  const viewMeta   = viewItem   ? getOpMeta(viewItem)   : null;
  const editMeta   = editItem   ? getOpMeta(editItem)   : null;
  const deleteMeta = deleteItem ? getOpMeta(deleteItem) : null;

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: pt, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: pt }]}>

      {/* ─── Header ─── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>كل العمليات</Text>
        <Text style={s.count}>{displayed.length}</Text>
      </View>

      {/* ─── فلاتر الفترة ─── */}
      <View style={s.periodRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[s.periodBtn, period === p.key && s.periodBtnOn]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[s.periodBtnTxt, period === p.key && s.periodBtnTxtOn]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ─── تاريخ مخصص ─── */}
      {period === "custom" && (
        <View style={s.dateRow}>
          <View style={s.dateField}>
            <Text style={s.dateLbl}>إلى</Text>
            <TextInput style={s.dateInp} value={toDate}   onChangeText={setToDate}
              placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} textAlign="right" />
          </View>
          <Ionicons name="arrow-back" size={14} color={Colors.textMuted} />
          <View style={s.dateField}>
            <Text style={s.dateLbl}>من</Text>
            <TextInput style={s.dateInp} value={fromDate} onChangeText={setFromDate}
              placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} textAlign="right" />
          </View>
        </View>
      )}

      {/* ─── القائمة + شبكة الفلاتر ─── */}
      <ScrollView
        contentContainerStyle={[s.list, { paddingBottom: pb }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} />}
      >
        {/* شبكة مربعات الفلاتر */}
        <View style={s.gridWrap}>
          {OP_CHIPS.map(c => {
            const active  = chip === c.key;
            const cnt     = chipCounts[c.key] ?? 0;
            return (
              <TouchableOpacity
                key={c.key}
                style={[s.gridBox, active && { backgroundColor: c.color, borderColor: c.color }]}
                onPress={() => setChip(c.key)}
                activeOpacity={0.75}
              >
                <View style={[s.gridIconWrap, { backgroundColor: active ? "rgba(255,255,255,0.2)" : c.color + "20" }]}>
                  <Ionicons name={c.icon} size={17} color={active ? "#fff" : c.color} />
                </View>
                <Text style={[s.gridLabel, active && { color: "#fff" }]} numberOfLines={2}>{c.label}</Text>
                {cnt > 0 && (
                  <View style={[s.gridBadge, { backgroundColor: active ? "rgba(255,255,255,0.25)" : c.color + "25" }]}>
                    <Text style={[s.gridBadgeTxt, { color: active ? "#fff" : c.color }]}>{cnt}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* بطاقة الإجمالي — تظهر فقط عند تحديد نوع معين */}
        {chip !== "all" && (() => {
          const activeChip = OP_CHIPS.find(c => c.key === chip)!;
          return (
            <View style={[s.totalCard, { borderColor: activeChip.color + "50", backgroundColor: activeChip.color + "0D" }]}>
              <View style={s.totalCardTop}>
                <View style={[s.totalIconWrap, { backgroundColor: activeChip.color + "20" }]}>
                  <Ionicons name={activeChip.icon} size={20} color={activeChip.color} />
                </View>
                <Text style={[s.totalTitle, { color: activeChip.color }]}>{activeChip.label}</Text>
                <View style={[s.totalCountBadge, { backgroundColor: activeChip.color + "20" }]}>
                  <Text style={[s.totalCountTxt, { color: activeChip.color }]}>{displayed.length} عملية</Text>
                </View>
              </View>
              <View style={s.totalDivider} />
              <Text style={s.totalLbl}>إجمالي المبالغ</Text>
              <Text style={[s.totalAmt, { color: activeChip.color }]}>{formatCurrency(chipTotal)}</Text>
            </View>
          );
        })()}

        {/* فاصل */}
        <View style={s.divider}>
          <Text style={s.dividerTxt}>
            {chip === "all"
              ? `جميع العمليات (${displayed.length})`
              : `تفاصيل ${OP_CHIPS.find(c => c.key === chip)?.label}`}
          </Text>
        </View>

        {displayed.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="reader-outline" size={50} color={Colors.textMuted} />
            <Text style={s.emptyTxt}>لا توجد عمليات في هذه الفترة</Text>
          </View>
        ) : (
          displayed.map(item => {
            const meta = getOpMeta(item);
            const amt  = parseFloat(item.amount ?? "0");
            const date = formatDateTime(item._date);
            const who  = item.personName || item.toPersonName || "";

            return (
              <View key={`${item._source}-${item.id}`}
                style={[s.card, { borderRightColor: meta.color }]}>

                {/* ── رأس البطاقة ── */}
                <View style={s.cardTop}>
                  <View style={s.cardLeft}>
                    <Text style={[s.cardAmt, { color: meta.color }]}>{formatCurrency(amt)}</Text>
                    <Text style={s.cardDate}>{date}</Text>
                  </View>
                  <View style={s.cardRight}>
                    <View style={[s.cardIconWrap, { backgroundColor: meta.color + "18" }]}>
                      <Ionicons name={meta.icon} size={18} color={meta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardLabel} numberOfLines={1}>{meta.label}</Text>
                      {!!who && <Text style={s.cardWho} numberOfLines={1}>{who}</Text>}
                      {!!(item.description || item.notes) && (
                        <Text style={s.cardDesc} numberOfLines={1}>
                          {item.description || item.notes}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* ── تأثير العملية ── */}
                <EffectPills effects={meta.effects} />

                {/* ── أزرار الإجراءات ── */}
                <View style={s.actions}>
                  <TouchableOpacity
                    style={[s.actBtn, { borderColor: Colors.primary + "50", backgroundColor: Colors.primary + "10" }]}
                    onPress={() => setViewItem(item)}>
                    <Ionicons name="eye-outline" size={13} color={Colors.primary} />
                    <Text style={[s.actBtnTxt, { color: Colors.primary }]}>تفاصيل</Text>
                  </TouchableOpacity>

                  {meta.canEdit && (
                    <TouchableOpacity
                      style={[s.actBtn, { borderColor: Colors.warning + "50", backgroundColor: Colors.warning + "10" }]}
                      onPress={() => setEditItem(item)}>
                      <Ionicons name="create-outline" size={13} color={Colors.warning} />
                      <Text style={[s.actBtnTxt, { color: Colors.warning }]}>تعديل</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[s.actBtn, { borderColor: Colors.error + "50", backgroundColor: Colors.error + "10" }]}
                    onPress={() => setDeleteItem(item)}>
                    <Ionicons name="trash-outline" size={13} color={Colors.error} />
                    <Text style={[s.actBtnTxt, { color: Colors.error }]}>حذف</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ─── Modals ─── */}
      <DetailModal
        item={viewItem} meta={viewMeta}
        onClose={() => setViewItem(null)}
      />

      <EditModal
        item={editItem} meta={editMeta} token={token}
        onClose={() => setEditItem(null)}
        onSuccess={() => { setEditItem(null); fetchAll(); showAlert("تم التعديل ✓", "تم تحديث العملية وانعكاسها على الأرقام"); }}
        onError={(msg) => { setEditItem(null); showAlert("خطأ", msg, Colors.error); }}
      />

      <ConfirmDeleteModal
        item={deleteItem} meta={deleteMeta}
        onCancel={() => setDeleteItem(null)}
        onConfirm={handleDelete} deleting={deleting}
      />

      <AlertModal
        visible={alert.visible} title={alert.title} message={alert.message} color={alert.color}
        onClose={() => setAlert(a => ({ ...a, visible: false }))}
      />
    </View>
  );
}

/* ══════════════════════════════════════════════════════════
   STYLES
══════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 19, fontWeight: "bold", color: Colors.text },
  count: { fontSize: 13, color: Colors.textMuted, backgroundColor: Colors.surface,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },

  /* فلاتر الفترة */
  periodRow: { flexDirection: "row-reverse", paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  periodBtn: {
    flex: 1, paddingVertical: 7, alignItems: "center", borderRadius: 9,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  periodBtnOn:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  periodBtnTxt:   { fontSize: 12, color: Colors.textSecondary, fontWeight: "600" },
  periodBtnTxtOn: { color: "#fff" },

  /* تاريخ مخصص */
  dateRow:  { flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  dateField:{ flex: 1 },
  dateLbl:  { fontSize: 11, color: Colors.textMuted, textAlign: "right", marginBottom: 3 },
  dateInp:  { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    color: Colors.text, fontSize: 12, backgroundColor: Colors.surface },

  /* شبكة مربعات الفلاتر */
  gridWrap: {
    flexDirection: "row-reverse", flexWrap: "wrap",
    gap: 8, marginBottom: 4,
  },
  gridBox: {
    width: "31%",
    alignItems: "center", gap: 5,
    paddingVertical: 10, paddingHorizontal: 6,
    borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  gridIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
  },
  gridLabel: {
    fontSize: 10, fontWeight: "700", color: Colors.textSecondary,
    textAlign: "center", lineHeight: 14,
  },
  gridBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
  },
  gridBadgeTxt: { fontSize: 10, fontWeight: "800" },

  /* بطاقة الإجمالي */
  totalCard: {
    borderRadius: 16, borderWidth: 1.5,
    padding: 16, gap: 4, alignItems: "center",
  },
  totalCardTop: {
    flexDirection: "row-reverse", alignItems: "center",
    gap: 8, width: "100%",
  },
  totalIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
  },
  totalTitle: { fontSize: 15, fontWeight: "800", flex: 1, textAlign: "right" },
  totalCountBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  totalCountTxt: { fontSize: 11, fontWeight: "700" },
  totalDivider: { height: 1, backgroundColor: Colors.border, width: "100%", marginVertical: 8 },
  totalLbl: { fontSize: 12, color: Colors.textMuted, textAlign: "center" },
  totalAmt: { fontSize: 30, fontWeight: "800", textAlign: "center", letterSpacing: 0.5 },

  /* فاصل العنوان */
  divider: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingTop: 10, marginBottom: 4, alignItems: "center",
  },
  dividerTxt: { fontSize: 12, color: Colors.textMuted, fontWeight: "600" },

  /* list */
  list: { padding: 12, gap: 10 },
  empty:    { alignItems: "center", marginTop: 60, gap: 12 },
  emptyTxt: { color: Colors.textMuted, fontSize: 14 },

  /* بطاقة عملية */
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    borderRightWidth: 4,
  },
  cardTop:      { flexDirection: "row-reverse", gap: 10, alignItems: "flex-start" },
  cardRight:    { flex: 1, flexDirection: "row-reverse", gap: 10, alignItems: "flex-start" },
  cardIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  cardLeft:     { alignItems: "flex-end", flexShrink: 0 },
  cardLabel:    { fontSize: 13, fontWeight: "700", color: Colors.text, textAlign: "right" },
  cardWho:      { fontSize: 12, color: Colors.textSecondary, textAlign: "right", marginTop: 2 },
  cardDesc:     { fontSize: 11, color: Colors.textMuted, textAlign: "right", marginTop: 1 },
  cardAmt:      { fontSize: 15, fontWeight: "800", textAlign: "right" },
  cardDate:     { fontSize: 10, color: Colors.textMuted, textAlign: "right", marginTop: 2 },

  /* أزرار */
  actions: {
    flexDirection: "row-reverse", gap: 7, marginTop: 10,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  actBtn: {
    flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: 8, borderRadius: 8, borderWidth: 1,
  },
  actBtnTxt: { fontSize: 11, fontWeight: "700" },
});
