import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Linking, ActivityIndicator, RefreshControl, Modal, Platform, Switch, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiPost, apiPut, apiFetch } from "@/utils/api";

const PAGE_SIZE = 50;

/* ─── قائمة أسماء الأجهزة ─── */
const DEVICE_NAMES = [
  "LG", "Tplink ثلاثة دقلات", "Tplink",
  "D-Link DIR-612", "D-Link DIR-650",
  "Xiaomi Mini R1C", "D-Link R04", "KT708",
];

/* ─── Types ─── */
interface HotspotPoint {
  id: number; flashNumber: number | null; name: string; location: string;
  hotspotType: string | null; deviceName: string | null; clientName: string | null;
  clientPhone: string | null; subscriptionFee: string | null; ipAddress: string | null;
  isClientOwned: boolean | null; locationUrl: string | null; notes: string | null; status: string;
  installPhoto: string | null; installedByName: string | null; installDate: string | null;
}
interface BroadbandPoint {
  id: number; flashNumber: number | null; name: string; location: string;
  subscriptionName: string | null; deviceName: string | null; clientName: string | null;
  clientPhone: string | null; subscriptionFee: string | null; locationUrl: string | null;
  notes: string | null; status: string; isClientOwned: boolean | null;
  installedByName: string | null; installDate: string | null;
}
type TabType = "hotspot" | "broadband";
type HotspotFilter = "all" | "internal" | "external";

/* ─── Blank forms ─── */
const blankH = () => ({
  flashNumber: "", deviceName: "", hotspotType: "internal" as "internal" | "external",
  clientName: "", clientPhone: "", subscriptionFee: "", ipAddress: "",
  isClientOwned: false, locationUrl: "", location: "",
  installPhoto: "", installedByName: "", installDate: "",
});
const blankB = () => ({
  flashNumber: "", subscriptionName: "", deviceName: "", clientName: "",
  clientPhone: "", subscriptionFee: "", locationUrl: "", location: "",
  installedByName: "", installDate: "",
});

/* ─── فتح خرائط جوجل بشكل صحيح ─── */
async function openMap(rawUrl: string) {
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
  if (canOpen) Linking.openURL(mapsUrl);
  else Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(rawUrl)}`);
}

/* ─── AlertModal ─── */
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
  msg: { color: Colors.textSecondary, fontSize: 14, textAlign: "right", marginBottom: 16, lineHeight: 22 },
  btn: { backgroundColor: Colors.primary, borderRadius: 10, padding: 12, alignItems: "center" },
  btnT: { color: "#FFF", fontWeight: "bold" },
});

/* ─── FInput ─── */
function FInput({ label, value, onChangeText, placeholder = "", keyboardType = "default" as any, multiline = false }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={fs.label}>{label}</Text>
      <TextInput
        style={[fs.input, multiline && { height: 70, textAlignVertical: "top" }]}
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={Colors.textMuted} textAlign="right"
        keyboardType={keyboardType} multiline={multiline}
      />
    </View>
  );
}
const fs = StyleSheet.create({
  label: { fontSize: 13, color: Colors.textSecondary, textAlign: "right", marginBottom: 6 },
  input: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
});

/* ─── DeviceDropdown ─── */
function DeviceDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualVal, setManualVal] = useState("");
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={fs.label}>اسم الجهاز</Text>
      <TouchableOpacity style={dds.trigger} onPress={() => setOpen(true)}>
        <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
        <Text style={[dds.val, !value && { color: Colors.textMuted }]}>{value || "اختر اسم الجهاز..."}</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade">
        <View style={dds.overlay}>
          <View style={dds.box}>
            <View style={dds.header}>
              <TouchableOpacity onPress={() => { setOpen(false); setManualMode(false); }}><Ionicons name="close" size={22} color={Colors.text} /></TouchableOpacity>
              <Text style={dds.title}>اختر اسم الجهاز</Text>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {DEVICE_NAMES.map(name => (
                <TouchableOpacity key={name} style={[dds.item, value === name && dds.itemActive]}
                  onPress={() => { onChange(name); setOpen(false); setManualMode(false); }}>
                  {value === name && <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />}
                  <Text style={[dds.itemText, value === name && { color: Colors.primary, fontWeight: "bold" }]}>{name}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[dds.item, { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4 }]}
                onPress={() => setManualMode(true)}>
                <Ionicons name="pencil-outline" size={18} color={Colors.warning} />
                <Text style={[dds.itemText, { color: Colors.warning }]}>أدخل اسماً آخر يدوياً</Text>
              </TouchableOpacity>
            </ScrollView>
            {manualMode && (
              <View style={{ marginTop: 10 }}>
                <TextInput style={[fs.input, { marginBottom: 8 }]} value={manualVal} onChangeText={setManualVal}
                  placeholder="اسم الجهاز..." placeholderTextColor={Colors.textMuted} textAlign="right" autoFocus />
                <TouchableOpacity style={dds.confirmBtn} onPress={() => { onChange(manualVal.trim()); setOpen(false); setManualMode(false); }}>
                  <Text style={dds.confirmBtnText}>تأكيد</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
const dds = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 20 },
  box: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { color: Colors.text, fontSize: 16, fontWeight: "bold" },
  trigger: { flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: Colors.background, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border },
  val: { flex: 1, color: Colors.text, fontSize: 14, textAlign: "right" },
  item: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  itemActive: { backgroundColor: Colors.primary + "15" },
  itemText: { color: Colors.text, fontSize: 14, flex: 1, textAlign: "right" },
  confirmBtn: { backgroundColor: Colors.primary, borderRadius: 10, padding: 12, alignItems: "center" },
  confirmBtnText: { color: "#FFF", fontWeight: "bold" },
});

/* ─── PhotoViewModal ─── */
function PhotoViewModal({ uri, visible, onClose }: { uri: string; visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" }}>
        <TouchableOpacity style={{ position: "absolute", top: 50, left: 20, zIndex: 10 }} onPress={onClose}>
          <Ionicons name="close-circle" size={38} color="#FFF" />
        </TouchableOpacity>
        {uri ? <Image source={{ uri }} style={{ width: "95%", height: "80%", borderRadius: 12 }} resizeMode="contain" />
          : <Text style={{ color: "#FFF" }}>لا توجد صورة</Text>}
      </View>
    </Modal>
  );
}

/* ─── InfoRow (مستعملة داخل قسم التفاصيل الموسّعة) ─── */
function InfoRow({ icon, label, value, color }: { icon: string; label: string; value: string; color?: string }) {
  return (
    <View style={card.infoRow}>
      <Ionicons name={icon as any} size={13} color={color ?? Colors.textSecondary} />
      <Text style={card.infoLabel}>{label}:</Text>
      <Text style={[card.infoValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

/* ════════════════════════════════════════════════
   بطاقة الهوتسبوت
════════════════════════════════════════════════ */
function HotspotCard({ p, onEdit, onDelete, onViewPhoto, onCopy }: {
  p: HotspotPoint;
  onEdit: () => void; onDelete: () => void;
  onViewPhoto: (uri: string) => void;
  onCopy: (text: string, label: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isInt = p.hotspotType === "internal";
  const typeColor = isInt ? Colors.primary : Colors.warning;
  const hasPhone = !!p.clientPhone;
  const hasMap = !!p.locationUrl;

  return (
    <View style={[card.card, { borderLeftColor: typeColor }]}>

      {/* ══ رأس البطاقة ══ */}
      <View style={card.head}>
        <Text style={card.num}>{p.name}</Text>
        <View style={[card.typeBadge, { backgroundColor: typeColor + "22" }]}>
          <Text style={[card.typeBadgeText, { color: typeColor }]}>{isInt ? "داخلي" : "خارجي"}</Text>
        </View>
        {p.subscriptionFee ? (
          <Text style={card.fee}>{Number(p.subscriptionFee).toLocaleString()} ر</Text>
        ) : null}
        <View style={[card.statusDot, { backgroundColor: isInt ? Colors.primary : Colors.warning }]} />
      </View>

      <View style={card.divider} />

      {/* ══ اسم الجهاز + ملكية ══ */}
      <View style={card.metaRow}>
        {p.deviceName ? (
          <View style={card.deviceBadge}>
            <Ionicons name="hardware-chip-outline" size={12} color={Colors.textSecondary} />
            <Text style={card.deviceText}>{p.deviceName}</Text>
          </View>
        ) : null}
        <View style={[card.ownerBadge, { backgroundColor: p.isClientOwned ? Colors.info + "20" : Colors.primary + "15" }]}>
          <Text style={[card.ownerText, { color: p.isClientOwned ? Colors.info : Colors.primary }]}>
            {p.isClientOwned ? "ملك العميل" : "ملك الشبكة"}
          </Text>
        </View>
      </View>

      {/* ══ اسم العميل (داخلي) ══ */}
      {isInt && p.clientName ? (
        <View style={card.row}>
          <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
          <Text style={card.rowText}>{p.clientName}</Text>
        </View>
      ) : isInt ? (
        <View style={card.row}>
          <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
          <Text style={[card.rowText, { color: Colors.textMuted, fontStyle: "italic" }]}>لا يوجد مشترك</Text>
        </View>
      ) : null}

      {/* ══ الجوال (داخلي) مع أيقونة نسخ ══ */}
      {isInt && hasPhone ? (
        <View style={card.row}>
          <TouchableOpacity onPress={() => onCopy(p.clientPhone!, "رقم الجوال")} style={card.copyIconBtn}>
            <Ionicons name="copy-outline" size={13} color={Colors.textMuted} />
          </TouchableOpacity>
          <Ionicons name="call-outline" size={14} color={Colors.success} />
          <Text style={[card.rowText, { color: Colors.success, flex: 1 }]}>{p.clientPhone}</Text>
        </View>
      ) : null}

      {/* ══ الموقع مع أيقونة نسخ ══ */}
      {p.location && p.location !== "-" ? (
        <View style={card.row}>
          <TouchableOpacity onPress={() => onCopy(p.locationUrl || p.location, "الموقع")} style={card.copyIconBtn}>
            <Ionicons name="copy-outline" size={13} color={Colors.textMuted} />
          </TouchableOpacity>
          <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
          <Text style={[card.rowText, { flex: 1 }]} numberOfLines={2}>{p.location}</Text>
        </View>
      ) : null}

      {/* ══ بيانات التركيب (خارجي) ══ */}
      {!isInt && (p.installedByName || p.installDate) ? (
        <View style={[card.row, { backgroundColor: Colors.warning + "10", borderRadius: 8, padding: 6 }]}>
          <Ionicons name="construct-outline" size={14} color={Colors.warning} />
          <Text style={[card.rowText, { color: Colors.warning, flex: 1 }]}>
            {p.installedByName ? `المهندس: ${p.installedByName}` : ""}
            {p.installedByName && p.installDate ? "  ·  " : ""}
            {p.installDate ? p.installDate.substring(0, 10) : ""}
          </Text>
        </View>
      ) : null}

      {/* ══ التفاصيل الموسّعة ══ */}
      {expanded && (
        <View style={card.expandedBox}>
          {isInt && p.ipAddress ? <InfoRow icon="globe-outline" label="عنوان IP" value={p.ipAddress} color={Colors.info} /> : null}
          {isInt && p.subscriptionFee ? <InfoRow icon="cash-outline" label="الاشتراك" value={`${Number(p.subscriptionFee).toLocaleString()} ر`} color={Colors.success} /> : null}
          {!isInt && p.installedByName ? <InfoRow icon="person-circle-outline" label="المهندس" value={p.installedByName} /> : null}
          {!isInt && p.installDate ? <InfoRow icon="calendar-outline" label="تاريخ التركيب" value={p.installDate.substring(0, 10)} /> : null}
          {p.locationUrl ? <InfoRow icon="link-outline" label="رابط الخريطة" value={p.locationUrl.substring(0, 40) + "..."} color={Colors.info} /> : null}
          {p.notes ? <InfoRow icon="document-text-outline" label="ملاحظات" value={p.notes} /> : null}
          <InfoRow icon="information-circle-outline" label="الحالة" value={p.status} />

          {/* صورة التركيب (خارجي) */}
          {!isInt && p.installPhoto ? (
            <TouchableOpacity style={card.photoBtn} onPress={() => onViewPhoto(p.installPhoto!)}>
              <Ionicons name="image" size={15} color={Colors.info} />
              <Text style={[card.photoBtnText, { color: Colors.info }]}>عرض صورة التركيب</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* ══ صف ثانوي: تفاصيل ══ */}
      <View style={card.secRow}>
        <TouchableOpacity style={card.secBtn} onPress={() => setExpanded(e => !e)}>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={Colors.textSecondary} />
          <Text style={[card.secBtnText, { color: Colors.textSecondary }]}>{expanded ? "إخفاء" : "تفاصيل"}</Text>
        </TouchableOpacity>
        {!isInt && p.installPhoto ? (
          <TouchableOpacity style={card.secBtn} onPress={() => onViewPhoto(p.installPhoto!)}>
            <Ionicons name="image-outline" size={14} color={Colors.info} />
            <Text style={[card.secBtnText, { color: Colors.info }]}>صورة التركيب</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ══ صف رئيسي: الإجراءات ══ */}
      <View style={card.mainRow}>
        {isInt && hasPhone ? (
          <TouchableOpacity style={[card.btn, { backgroundColor: Colors.success + "20", borderColor: Colors.success + "55" }]}
            onPress={() => Linking.openURL(`tel:${p.clientPhone!.replace(/\D/g, "")}`)}>
            <Ionicons name="call" size={16} color={Colors.success} />
            <Text style={[card.btnText, { color: Colors.success }]}>اتصال</Text>
          </TouchableOpacity>
        ) : null}
        {hasMap ? (
          <TouchableOpacity style={[card.btn, { backgroundColor: Colors.info + "20", borderColor: Colors.info + "55" }]}
            onPress={() => openMap(p.locationUrl!)}>
            <Ionicons name="map" size={16} color={Colors.info} />
            <Text style={[card.btnText, { color: Colors.info }]}>خريطة</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[card.btn, { backgroundColor: Colors.primary + "20", borderColor: Colors.primary + "55" }]}
          onPress={onEdit}>
          <Ionicons name="pencil" size={16} color={Colors.primary} />
          <Text style={[card.btnText, { color: Colors.primary }]}>تعديل</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[card.btn, { backgroundColor: Colors.error + "18", borderColor: Colors.error + "55" }]}
          onPress={onDelete}>
          <Ionicons name="trash" size={16} color={Colors.error} />
          <Text style={[card.btnText, { color: Colors.error }]}>حذف</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════
   بطاقة البرودباند
════════════════════════════════════════════════ */
function BroadbandCard({ p, onEdit, onDelete, onCopy }: {
  p: BroadbandPoint;
  onEdit: () => void; onDelete: () => void;
  onCopy: (text: string, label: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeColor = Colors.warning;
  const hasPhone = !!p.clientPhone;
  const hasMap = !!p.locationUrl;

  return (
    <View style={[card.card, { borderLeftColor: typeColor }]}>

      {/* ══ رأس البطاقة ══ */}
      <View style={card.head}>
        <Text style={card.num}>{p.name}</Text>
        <View style={[card.typeBadge, { backgroundColor: typeColor + "22" }]}>
          <Text style={[card.typeBadgeText, { color: typeColor }]}>برودباند</Text>
        </View>
        {p.subscriptionFee ? (
          <Text style={card.fee}>{Number(p.subscriptionFee).toLocaleString()} ر</Text>
        ) : null}
        <View style={[card.statusDot, { backgroundColor: typeColor }]} />
      </View>

      <View style={card.divider} />

      {/* ══ معلومات الاشتراك + الجهاز ══ */}
      <View style={card.metaRow}>
        {p.subscriptionName ? (
          <View style={card.deviceBadge}>
            <Ionicons name="wifi-outline" size={12} color={Colors.info} />
            <Text style={[card.deviceText, { color: Colors.info }]}>{p.subscriptionName}</Text>
          </View>
        ) : null}
        {p.deviceName ? (
          <View style={card.deviceBadge}>
            <Ionicons name="hardware-chip-outline" size={12} color={Colors.textSecondary} />
            <Text style={card.deviceText}>{p.deviceName}</Text>
          </View>
        ) : null}
        <View style={[card.ownerBadge, { backgroundColor: p.isClientOwned ? Colors.info + "20" : Colors.primary + "15" }]}>
          <Text style={[card.ownerText, { color: p.isClientOwned ? Colors.info : Colors.primary }]}>
            {p.isClientOwned ? "ملك العميل" : "ملك الشبكة"}
          </Text>
        </View>
      </View>

      {/* ══ اسم العميل ══ */}
      {p.clientName ? (
        <View style={card.row}>
          <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
          <Text style={card.rowText}>{p.clientName}</Text>
        </View>
      ) : (
        <View style={card.row}>
          <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
          <Text style={[card.rowText, { color: Colors.textMuted, fontStyle: "italic" }]}>لا يوجد مشترك</Text>
        </View>
      )}

      {/* ══ الجوال مع أيقونة نسخ ══ */}
      {hasPhone ? (
        <View style={card.row}>
          <TouchableOpacity onPress={() => onCopy(p.clientPhone!, "رقم الجوال")} style={card.copyIconBtn}>
            <Ionicons name="copy-outline" size={13} color={Colors.textMuted} />
          </TouchableOpacity>
          <Ionicons name="call-outline" size={14} color={Colors.success} />
          <Text style={[card.rowText, { color: Colors.success, flex: 1 }]}>{p.clientPhone}</Text>
        </View>
      ) : null}

      {/* ══ الموقع مع أيقونة نسخ ══ */}
      {p.location && p.location !== "-" ? (
        <View style={card.row}>
          <TouchableOpacity onPress={() => onCopy(p.locationUrl || p.location, "الموقع")} style={card.copyIconBtn}>
            <Ionicons name="copy-outline" size={13} color={Colors.textMuted} />
          </TouchableOpacity>
          <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
          <Text style={[card.rowText, { flex: 1 }]} numberOfLines={2}>{p.location}</Text>
        </View>
      ) : null}

      {/* ══ التفاصيل الموسّعة ══ */}
      {expanded && (
        <View style={card.expandedBox}>
          {p.subscriptionFee ? <InfoRow icon="cash-outline" label="الاشتراك" value={`${Number(p.subscriptionFee).toLocaleString()} ر`} color={Colors.success} /> : null}
          {p.locationUrl ? <InfoRow icon="link-outline" label="رابط الخريطة" value={p.locationUrl.substring(0, 40) + "..."} color={Colors.info} /> : null}
          {p.notes ? <InfoRow icon="document-text-outline" label="ملاحظات" value={p.notes} /> : null}
          <InfoRow icon="information-circle-outline" label="الحالة" value={p.status} />
        </View>
      )}

      {/* ══ صف ثانوي ══ */}
      <View style={card.secRow}>
        <TouchableOpacity style={card.secBtn} onPress={() => setExpanded(e => !e)}>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={Colors.textSecondary} />
          <Text style={[card.secBtnText, { color: Colors.textSecondary }]}>{expanded ? "إخفاء" : "تفاصيل"}</Text>
        </TouchableOpacity>
      </View>

      {/* ══ صف رئيسي ══ */}
      <View style={card.mainRow}>
        {hasPhone ? (
          <TouchableOpacity style={[card.btn, { backgroundColor: Colors.success + "20", borderColor: Colors.success + "55" }]}
            onPress={() => Linking.openURL(`tel:${p.clientPhone!.replace(/\D/g, "")}`)}>
            <Ionicons name="call" size={16} color={Colors.success} />
            <Text style={[card.btnText, { color: Colors.success }]}>اتصال</Text>
          </TouchableOpacity>
        ) : null}
        {hasMap ? (
          <TouchableOpacity style={[card.btn, { backgroundColor: Colors.info + "20", borderColor: Colors.info + "55" }]}
            onPress={() => openMap(p.locationUrl!)}>
            <Ionicons name="map" size={16} color={Colors.info} />
            <Text style={[card.btnText, { color: Colors.info }]}>خريطة</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[card.btn, { backgroundColor: Colors.primary + "20", borderColor: Colors.primary + "55" }]}
          onPress={onEdit}>
          <Ionicons name="pencil" size={16} color={Colors.primary} />
          <Text style={[card.btnText, { color: Colors.primary }]}>تعديل</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[card.btn, { backgroundColor: Colors.error + "18", borderColor: Colors.error + "55" }]}
          onPress={onDelete}>
          <Ionicons name="trash" size={16} color={Colors.error} />
          <Text style={[card.btnText, { color: Colors.error }]}>حذف</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════
   أنماط الكروت (card)
════════════════════════════════════════════════ */
const card = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4,
    overflow: "hidden", paddingHorizontal: 14, paddingVertical: 12, gap: 8,
  },
  head: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  num: { fontSize: 18, fontWeight: "bold", color: Colors.text },
  typeBadge: { flex: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start" },
  typeBadgeText: { fontSize: 12, fontWeight: "bold" },
  fee: { fontSize: 14, fontWeight: "bold", color: Colors.success },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  divider: { height: 1, backgroundColor: Colors.border },
  metaRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6, flexWrap: "wrap" },
  deviceBadge: { flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: Colors.background, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  deviceText: { fontSize: 11, color: Colors.textSecondary, fontWeight: "600" },
  ownerBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  ownerText: { fontSize: 11, fontWeight: "bold" },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  rowText: { fontSize: 13, color: Colors.textSecondary, textAlign: "right" },
  copyIconBtn: { width: 26, height: 26, borderRadius: 6, backgroundColor: Colors.background, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  expandedBox: { backgroundColor: Colors.background, borderRadius: 10, padding: 10, gap: 6 },
  infoRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  infoLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: "600" },
  infoValue: { fontSize: 12, color: Colors.textSecondary, flex: 1, textAlign: "right" },
  photoBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 6, justifyContent: "center", padding: 8, borderRadius: 8, backgroundColor: Colors.info + "15", borderWidth: 1, borderColor: Colors.info + "50" },
  photoBtnText: { fontSize: 13, fontWeight: "bold" },
  /* صف ثانوي */
  secRow: { flexDirection: "row-reverse", gap: 8 },
  secBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  secBtnText: { fontSize: 12, fontWeight: "600" },
  /* صف رئيسي */
  mainRow: { flexDirection: "row-reverse", gap: 6, flexWrap: "wrap" },
  btn: { flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  btnText: { fontSize: 12, fontWeight: "bold" },
});

/* ════════════════════════════════════════════════
   الشاشة الرئيسية
════════════════════════════════════════════════ */
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

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [addType, setAddType] = useState<TabType>("hotspot");
  const [hForm, setHForm] = useState(blankH());
  const [bForm, setBForm] = useState(blankB());
  const [saving, setSaving] = useState(false);

  const [editItem, setEditItem] = useState<HotspotPoint | BroadbandPoint | null>(null);
  const [editHForm, setEditHForm] = useState<any>(null);
  const [editBForm, setEditBForm] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ id: number; type: TabType; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [showEmpty, setShowEmpty] = useState(false);
  const [emptyNums, setEmptyNums] = useState<number[]>([]);
  const [emptyMax, setEmptyMax] = useState(0);

  const [photoUri, setPhotoUri] = useState("");
  const [showPhoto, setShowPhoto] = useState(false);

  const [alertVis, setAlertVis] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMsg, setAlertMsg] = useState("");
  const showAlert = (t: string, m = "") => { setAlertTitle(t); setAlertMsg(m); setAlertVis(true); };

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const doFetchHotspot = async (off: number, append: boolean, tok: string, s: string, f: HotspotFilter) => {
    const typeParam = f === "all" ? "" : `&type=${f}`;
    const searchParam = s ? `&search=${encodeURIComponent(s)}` : "";
    const json = await apiFetch(`/network/hotspot-points?limit=${PAGE_SIZE}&offset=${off}${typeParam}${searchParam}`, tok);
    const data: HotspotPoint[] = Array.isArray(json.data) ? json.data : [];
    setHotspotTotal(Number(json.total) || 0);
    setHotspotOffset(off + data.length);
    setHotspotPoints(prev => append ? [...prev, ...data] : data);
    return data.length;
  };

  const doFetchBroadband = async (off: number, append: boolean, tok: string, s: string) => {
    const searchParam = s ? `&search=${encodeURIComponent(s)}` : "";
    const json = await apiFetch(`/network/broadband-points?limit=${PAGE_SIZE}&offset=${off}${searchParam}`, tok);
    const data: BroadbandPoint[] = Array.isArray(json.data) ? json.data : [];
    setBroadbandTotal(Number(json.total) || 0);
    setBroadbandOffset(off + data.length);
    setBroadbandPoints(prev => append ? [...prev, ...data] : data);
    return data.length;
  };

  const fetchHotspotRef = useRef(doFetchHotspot);
  const fetchBroadbandRef = useRef(doFetchBroadband);
  fetchHotspotRef.current = doFetchHotspot;
  fetchBroadbandRef.current = doFetchBroadband;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true); setFetchError(null);
    (async () => {
      try {
        if (tab === "hotspot") await doFetchHotspot(0, false, token, debouncedSearch, hotspotFilter);
        else await doFetchBroadband(0, false, token, debouncedSearch);
      } catch (e: any) { if (!cancelled) setFetchError(e?.message ?? "خطأ في تحميل البيانات"); }
      if (!cancelled) { setLoading(false); setRefreshing(false); }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tab, hotspotFilter, debouncedSearch]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      if (tab === "hotspot" && hotspotOffset < hotspotTotal) await fetchHotspotRef.current(hotspotOffset, true, token!, debouncedSearch, hotspotFilter);
      else if (tab === "broadband" && broadbandOffset < broadbandTotal) await fetchBroadbandRef.current(broadbandOffset, true, token!, debouncedSearch);
    } catch { }
    setLoadingMore(false);
  };

  const openEmptyNumbers = async () => {
    setShowEmpty(true);
    try {
      const endpoint = tab === "hotspot" ? "hotspot-points" : "broadband-points";
      const nums: number[] = await apiFetch(`/network/${endpoint}/flash-numbers`, token);
      const used = new Set(nums);
      const max = nums.length ? Math.max(...nums) : 0;
      const empty: number[] = [];
      for (let i = 1; i <= max; i++) if (!used.has(i)) empty.push(i);
      setEmptyNums(empty); setEmptyMax(max);
    } catch { showAlert("خطأ", "فشل تحميل الأرقام"); }
  };

  const copyText = async (text: string, label = "") => {
    await Clipboard.setStringAsync(text);
    showAlert("تم النسخ ✓", label ? `${label}: ${text.substring(0, 50)}` : text.substring(0, 60));
  };

  const pickPhoto = async (onPick: (base64: string) => void) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showAlert("تنبيه", "يجب السماح بالوصول إلى المعرض"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.3 });
    if (!result.canceled && result.assets?.[0]?.base64) onPick(`data:image/jpeg;base64,${result.assets[0].base64}`);
  };

  const handleAdd = async () => {
    setSaving(true);
    try {
      if (addType === "hotspot") {
        if (!hForm.flashNumber) { showAlert("خطأ", "أدخل رقم الجهاز"); return; }
        const p: any = {
          flashNumber: parseInt(hForm.flashNumber), name: `فلاش ${hForm.flashNumber}`,
          hotspotType: hForm.hotspotType, deviceName: hForm.deviceName || null,
          location: hForm.location || "-", locationUrl: hForm.locationUrl || null, isClientOwned: hForm.isClientOwned,
        };
        if (hForm.hotspotType === "internal") {
          p.clientName = hForm.clientName || null;
          p.clientPhone = hForm.clientPhone.replace(/\D/g, "") || null;
          p.subscriptionFee = hForm.subscriptionFee || null;
          p.ipAddress = hForm.ipAddress || null;
        } else {
          p.installPhoto = hForm.installPhoto || null;
        }
        /* حقول مشتركة بين الداخلي والخارجي */
        p.installedByName = hForm.installedByName || null;
        p.installDate = hForm.installDate ? new Date(hForm.installDate).toISOString() : null;
        const added = await apiPost("/network/hotspot-points", token, p);
        setHotspotPoints(prev => [added, ...prev]); setHotspotTotal(t => t + 1);
      } else {
        if (!bForm.flashNumber) { showAlert("خطأ", "أدخل رقم الفلاش"); return; }
        const p = {
          flashNumber: parseInt(bForm.flashNumber), name: `فلاش P${bForm.flashNumber}`,
          subscriptionName: bForm.subscriptionName || null, deviceName: bForm.deviceName || null,
          clientName: bForm.clientName || null, clientPhone: bForm.clientPhone.replace(/\D/g, "") || null,
          subscriptionFee: bForm.subscriptionFee || null, location: bForm.location || "-", locationUrl: bForm.locationUrl || null,
          installedByName: bForm.installedByName || null,
          installDate: bForm.installDate ? new Date(bForm.installDate).toISOString() : null,
        };
        const added = await apiPost("/network/broadband-points", token, p);
        setBroadbandPoints(prev => [added, ...prev]); setBroadbandTotal(t => t + 1);
      }
      setShowAdd(false); setHForm(blankH()); setBForm(blankB()); setAddStep(1);
    } catch (e: any) { showAlert("خطأ في الأرشفة", e.message ?? "فشل الحفظ"); }
    finally { setSaving(false); }
  };

  const openEdit = (item: HotspotPoint | BroadbandPoint) => {
    setEditItem(item);
    if (tab === "hotspot") {
      const h = item as HotspotPoint;
      setEditHForm({ flashNumber: h.flashNumber ? String(h.flashNumber) : "", deviceName: h.deviceName ?? "", hotspotType: h.hotspotType ?? "internal", clientName: h.clientName ?? "", clientPhone: h.clientPhone ?? "", subscriptionFee: h.subscriptionFee ?? "", ipAddress: h.ipAddress ?? "", isClientOwned: h.isClientOwned ?? false, locationUrl: h.locationUrl ?? "", location: h.location ?? "", installPhoto: h.installPhoto ?? "", installedByName: h.installedByName ?? "", installDate: h.installDate ? h.installDate.substring(0, 10) : "" });
    } else {
      const b = item as BroadbandPoint;
      setEditBForm({ flashNumber: b.flashNumber ? String(b.flashNumber) : "", subscriptionName: b.subscriptionName ?? "", deviceName: b.deviceName ?? "", clientName: b.clientName ?? "", clientPhone: b.clientPhone ?? "", subscriptionFee: b.subscriptionFee ?? "", locationUrl: b.locationUrl ?? "", location: b.location ?? "", installedByName: b.installedByName ?? "", installDate: b.installDate ? b.installDate.substring(0, 10) : "" });
    }
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    setEditSaving(true);
    try {
      if (tab === "hotspot") {
        const f = editHForm;
        const p: any = { flashNumber: f.flashNumber ? parseInt(f.flashNumber) : null, name: `فلاش ${f.flashNumber}`, hotspotType: f.hotspotType, deviceName: f.deviceName || null, location: f.location || "-", locationUrl: f.locationUrl || null, clientName: f.clientName || null, clientPhone: f.clientPhone.replace(/\D/g, "") || null, subscriptionFee: f.subscriptionFee || null, ipAddress: f.ipAddress || null, isClientOwned: f.isClientOwned, installPhoto: f.installPhoto || null, installedByName: f.installedByName || null, installDate: f.installDate ? new Date(f.installDate).toISOString() : null };
        const updated = await apiPut(`/network/hotspot-points/${editItem.id}`, token, p);
        setHotspotPoints(prev => prev.map(x => x.id === updated.id ? updated : x));
      } else {
        const f = editBForm;
        const p = { flashNumber: f.flashNumber ? parseInt(f.flashNumber) : null, name: `فلاش P${f.flashNumber}`, subscriptionName: f.subscriptionName || null, deviceName: f.deviceName || null, clientName: f.clientName || null, clientPhone: f.clientPhone.replace(/\D/g, "") || null, subscriptionFee: f.subscriptionFee || null, location: f.location || "-", locationUrl: f.locationUrl || null, installedByName: f.installedByName || null, installDate: f.installDate ? new Date(f.installDate).toISOString() : null };
        const updated = await apiPut(`/network/broadband-points/${editItem.id}`, token, p);
        setBroadbandPoints(prev => prev.map(x => x.id === updated.id ? updated : x));
      }
      setEditItem(null);
    } catch (e: any) { showAlert("خطأ", e.message ?? "فشل التعديل"); }
    finally { setEditSaving(false); }
  };

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

  const list = tab === "hotspot" ? hotspotPoints : broadbandPoints;
  const total = tab === "hotspot" ? hotspotTotal : broadbandTotal;
  const offset = tab === "hotspot" ? hotspotOffset : broadbandOffset;
  const hasMore = offset < total;

  return (
    <View style={[sc.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* Header */}
      <View style={sc.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-forward" size={24} color={Colors.text} /></TouchableOpacity>
        <Text style={sc.title}>قاعدة البيانات</Text>
        <View style={{ flexDirection: "row-reverse", gap: 8, alignItems: "center" }}>
          <TouchableOpacity onPress={openEmptyNumbers} style={sc.emptyBtn}><Ionicons name="grid-outline" size={20} color={Colors.warning} /></TouchableOpacity>
          <TouchableOpacity onPress={() => { setShowAdd(true); setAddStep(1); setAddType(tab); }} style={sc.addBtn}><Ionicons name="add" size={22} color="#FFF" /></TouchableOpacity>
        </View>
      </View>

      {/* Main tabs */}
      <View style={sc.mainTabs}>
        {(["hotspot", "broadband"] as TabType[]).reverse().map(t => (
          <TouchableOpacity key={t} style={[sc.mainTab, tab === t && sc.mainTabActive]}
            onPress={() => { setTab(t); setSearch(""); setDebouncedSearch(""); }}>
            <Text style={[sc.mainTabText, tab === t && sc.mainTabTextActive]}>
              {t === "hotspot" ? "هوتسبوت" : "برودباند"} ({t === "hotspot" ? hotspotTotal : broadbandTotal})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sub filter */}
      {tab === "hotspot" && (
        <View style={sc.subFilter}>
          {(["all", "internal", "external"] as HotspotFilter[]).map(f => (
            <TouchableOpacity key={f} style={[sc.subBtn, hotspotFilter === f && sc.subBtnActive]} onPress={() => setHotspotFilter(f)}>
              <Text style={[sc.subBtnText, hotspotFilter === f && sc.subBtnTextActive]}>{f === "all" ? "الكل" : f === "internal" ? "داخلي" : "خارجي"}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search */}
      <View style={sc.searchBox}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput style={sc.searchInput} placeholder="بحث..." placeholderTextColor={Colors.textMuted} value={search} onChangeText={setSearch} textAlign="right" />
        {search ? <TouchableOpacity onPress={() => setSearch("")}><Ionicons name="close-circle" size={18} color={Colors.textMuted} /></TouchableOpacity> : null}
      </View>

      {/* Count */}
      <View style={sc.countRow}>
        <Text style={sc.countText}>{loading ? "جاري التحميل..." : `${list.length} من ${total} نقطة`}</Text>
        {tab === "hotspot" && !loading && (
          <Text style={sc.countSmall}>{list.filter(p => (p as HotspotPoint).hotspotType === "internal").length} داخلي · {list.filter(p => (p as HotspotPoint).hotspotType === "external").length} خارجي</Text>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ color: Colors.textMuted, marginTop: 12 }}>جاري تحميل البيانات...</Text>
        </View>
      ) : fetchError ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Ionicons name="warning-outline" size={48} color={Colors.error} />
          <Text style={{ color: Colors.error, marginTop: 12, textAlign: "center" }}>{fetchError}</Text>
          <TouchableOpacity style={{ marginTop: 16, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 }}
            onPress={async () => { setFetchError(null); setLoading(true); try { if (tab === "hotspot") await fetchHotspotRef.current(0, false, token!, debouncedSearch, hotspotFilter); else await fetchBroadbandRef.current(0, false, token!, debouncedSearch); } catch (e: any) { setFetchError(e?.message); } setLoading(false); }}>
            <Text style={{ color: "#FFF" }}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
            if (!token) return; setRefreshing(true); setFetchError(null);
            try { if (tab === "hotspot") await fetchHotspotRef.current(0, false, token, debouncedSearch, hotspotFilter); else await fetchBroadbandRef.current(0, false, token, debouncedSearch); } catch (e: any) { setFetchError(e?.message ?? "خطأ"); }
            setRefreshing(false);
          }} />}
        >
          {list.length === 0 ? (
            <View style={{ alignItems: "center", marginTop: 60, gap: 12 }}>
              <Ionicons name="search-outline" size={48} color={Colors.textMuted} />
              <Text style={{ color: Colors.textMuted, fontSize: 15 }}>لا توجد نتائج</Text>
            </View>
          ) : (
            <>
              {tab === "hotspot"
                ? (list as HotspotPoint[]).map(p => (
                  <HotspotCard key={p.id} p={p}
                    onEdit={() => openEdit(p)}
                    onDelete={() => setDeleteTarget({ id: p.id, type: "hotspot", name: p.name })}
                    onViewPhoto={(uri) => { setPhotoUri(uri); setShowPhoto(true); }}
                    onCopy={copyText}
                  />
                ))
                : (list as BroadbandPoint[]).map(p => (
                  <BroadbandCard key={p.id} p={p}
                    onEdit={() => openEdit(p)}
                    onDelete={() => setDeleteTarget({ id: p.id, type: "broadband", name: p.name })}
                    onCopy={copyText}
                  />
                ))}
              {hasMore && (
                <TouchableOpacity style={sc.loadMoreBtn} onPress={loadMore} disabled={loadingMore}>
                  {loadingMore ? <ActivityIndicator color={Colors.primary} /> : <Text style={sc.loadMoreText}>تحميل المزيد ({total - offset} متبقي)</Text>}
                </TouchableOpacity>
              )}
            </>
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {/* ─── Add Modal ─── */}
      <Modal visible={showAdd} transparent animationType="slide">
        <View style={sc.overlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
            <View style={sc.modalBox}>
              <Text style={sc.modalTitle}>إضافة نقطة جديدة</Text>
              {addStep === 1 ? (
                <>
                  <Text style={fs.label}>نوع الشبكة</Text>
                  <View style={[sc.choiceRow, { marginBottom: 16 }]}>
                    {(["hotspot", "broadband"] as TabType[]).reverse().map(t => (
                      <TouchableOpacity key={t} style={[sc.choiceBtn, addType === t && sc.choiceBtnActive]} onPress={() => setAddType(t)}>
                        <Ionicons name={t === "hotspot" ? "radio" : "wifi"} size={20} color={addType === t ? "#FFF" : Colors.textSecondary} />
                        <Text style={[sc.choiceBtnText, addType === t && { color: "#FFF" }]}>{t === "hotspot" ? "هوتسبوت" : "برودباند"}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {addType === "hotspot" && (
                    <>
                      <Text style={fs.label}>نوع البث</Text>
                      <View style={sc.choiceRow}>
                        {(["internal", "external"] as const).map(f => (
                          <TouchableOpacity key={f} style={[sc.choiceBtn, hForm.hotspotType === f && sc.choiceBtnActive]}
                            onPress={() => setHForm(x => ({ ...x, hotspotType: f }))}>
                            <Text style={[sc.choiceBtnText, hForm.hotspotType === f && { color: "#FFF" }]}>{f === "internal" ? "داخلي" : "خارجي"}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                  <View style={sc.modalBtns}>
                    <TouchableOpacity style={sc.cancelBtn} onPress={() => setShowAdd(false)}><Text style={sc.cancelBtnText}>إلغاء</Text></TouchableOpacity>
                    <TouchableOpacity style={sc.nextBtn} onPress={() => setAddStep(2)}><Text style={sc.nextBtnText}>التالي ←</Text></TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  {addType === "hotspot" ? (
                    <>
                      <FInput label="رقم الجهاز *" value={hForm.flashNumber} onChangeText={(v: string) => setHForm(f => ({ ...f, flashNumber: v.replace(/\D/g, "") }))} keyboardType="numeric" placeholder="مثال: 15" />
                      <DeviceDropdown value={hForm.deviceName} onChange={(v) => setHForm(f => ({ ...f, deviceName: v }))} />
                      <FInput label="وصف الموقع" value={hForm.location} onChangeText={(v: string) => setHForm(f => ({ ...f, location: v }))} placeholder="حي، شارع..." />
                      <FInput label="رابط خرائط جوجل" value={hForm.locationUrl} onChangeText={(v: string) => setHForm(f => ({ ...f, locationUrl: v }))} placeholder="https://maps.google.com/..." />
                      {hForm.hotspotType === "internal" ? (
                        <>
                          <FInput label="اسم العميل" value={hForm.clientName} onChangeText={(v: string) => setHForm(f => ({ ...f, clientName: v }))} />
                          <FInput label="رقم الجوال" value={hForm.clientPhone} onChangeText={(v: string) => setHForm(f => ({ ...f, clientPhone: v.replace(/\D/g, "") }))} keyboardType="phone-pad" />
                          <FInput label="رسوم الاشتراك (ر)" value={hForm.subscriptionFee} onChangeText={(v: string) => setHForm(f => ({ ...f, subscriptionFee: v.replace(/\D/g, "") }))} keyboardType="numeric" />
                          <FInput label="عنوان IP" value={hForm.ipAddress} onChangeText={(v: string) => setHForm(f => ({ ...f, ipAddress: v }))} placeholder="192.168.0.x" />
                          <View style={sc.switchRow}><Switch value={hForm.isClientOwned} onValueChange={v => setHForm(f => ({ ...f, isClientOwned: v }))} trackColor={{ true: Colors.primary }} /><Text style={sc.switchLabel}>الجهاز ملك العميل</Text></View>
                          <View style={sc.extSection}><Text style={sc.extSectionTitle}>بيانات التركيب (اختياري)</Text></View>
                          <FInput label="اسم المهندس المركّب" value={hForm.installedByName} onChangeText={(v: string) => setHForm(f => ({ ...f, installedByName: v }))} />
                          <FInput label="تاريخ التركيب" value={hForm.installDate} onChangeText={(v: string) => setHForm(f => ({ ...f, installDate: v }))} placeholder="2025-01-15" />
                        </>
                      ) : (
                        <>
                          <View style={sc.extSection}><Text style={sc.extSectionTitle}>بيانات التركيب (اختياري)</Text></View>
                          <FInput label="اسم المهندس المركّب" value={hForm.installedByName} onChangeText={(v: string) => setHForm(f => ({ ...f, installedByName: v }))} />
                          <FInput label="تاريخ التركيب" value={hForm.installDate} onChangeText={(v: string) => setHForm(f => ({ ...f, installDate: v }))} placeholder="2025-01-15" />
                          <Text style={fs.label}>صورة التركيب</Text>
                          {hForm.installPhoto ? (
                            <View style={{ marginBottom: 12 }}>
                              <Image source={{ uri: hForm.installPhoto }} style={{ width: "100%", height: 160, borderRadius: 10, marginBottom: 6 }} resizeMode="cover" />
                              <TouchableOpacity style={sc.removePhotoBtn} onPress={() => setHForm(f => ({ ...f, installPhoto: "" }))}><Text style={{ color: Colors.error, fontWeight: "bold" }}>× حذف الصورة</Text></TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity style={sc.pickPhotoBtn} onPress={() => pickPhoto(b64 => setHForm(f => ({ ...f, installPhoto: b64 })))}>
                              <Ionicons name="camera-outline" size={22} color={Colors.primary} />
                              <Text style={sc.pickPhotoText}>إضافة صورة التركيب</Text>
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <FInput label="رقم الفلاش *" value={bForm.flashNumber} onChangeText={(v: string) => setBForm(f => ({ ...f, flashNumber: v.replace(/\D/g, "") }))} keyboardType="numeric" placeholder="مثال: 5" />
                      <FInput label="اسم الاشتراك" value={bForm.subscriptionName} onChangeText={(v: string) => setBForm(f => ({ ...f, subscriptionName: v }))} placeholder="andls123" />
                      <DeviceDropdown value={bForm.deviceName} onChange={(v) => setBForm(f => ({ ...f, deviceName: v }))} />
                      <FInput label="اسم العميل" value={bForm.clientName} onChangeText={(v: string) => setBForm(f => ({ ...f, clientName: v }))} />
                      <FInput label="رقم الجوال" value={bForm.clientPhone} onChangeText={(v: string) => setBForm(f => ({ ...f, clientPhone: v.replace(/\D/g, "") }))} keyboardType="phone-pad" />
                      <FInput label="رسوم الاشتراك (ر)" value={bForm.subscriptionFee} onChangeText={(v: string) => setBForm(f => ({ ...f, subscriptionFee: v.replace(/\D/g, "") }))} keyboardType="numeric" />
                      <FInput label="وصف الموقع" value={bForm.location} onChangeText={(v: string) => setBForm(f => ({ ...f, location: v }))} />
                      <FInput label="رابط خرائط جوجل" value={bForm.locationUrl} onChangeText={(v: string) => setBForm(f => ({ ...f, locationUrl: v }))} />
                      <View style={sc.extSection}><Text style={sc.extSectionTitle}>بيانات التركيب (اختياري)</Text></View>
                      <FInput label="اسم المهندس المركّب" value={bForm.installedByName} onChangeText={(v: string) => setBForm(f => ({ ...f, installedByName: v }))} />
                      <FInput label="تاريخ التركيب" value={bForm.installDate} onChangeText={(v: string) => setBForm(f => ({ ...f, installDate: v }))} placeholder="2025-01-15" />
                    </>
                  )}
                  <View style={sc.modalBtns}>
                    <TouchableOpacity style={sc.cancelBtn} onPress={() => setAddStep(1)}><Text style={sc.cancelBtnText}>→ رجوع</Text></TouchableOpacity>
                    <TouchableOpacity style={[sc.nextBtn, saving && { opacity: 0.6 }]} onPress={handleAdd} disabled={saving}>
                      {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={sc.nextBtnText}>أرشفة وحفظ</Text>}
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
        <View style={sc.overlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
            <View style={sc.modalBox}>
              <Text style={sc.modalTitle}>تعديل — {editItem?.name}</Text>
              {tab === "hotspot" && editHForm ? (
                <>
                  <FInput label="رقم الجهاز" value={editHForm.flashNumber} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, flashNumber: v.replace(/\D/g, "") }))} keyboardType="numeric" />
                  <DeviceDropdown value={editHForm.deviceName} onChange={(v) => setEditHForm((f: any) => ({ ...f, deviceName: v }))} />
                  <FInput label="وصف الموقع" value={editHForm.location} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, location: v }))} />
                  <FInput label="رابط الخريطة" value={editHForm.locationUrl} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, locationUrl: v }))} />
                  <Text style={fs.label}>نوع البث</Text>
                  <View style={[sc.choiceRow, { marginBottom: 12 }]}>
                    {(["internal", "external"] as const).map(t => (
                      <TouchableOpacity key={t} style={[sc.choiceBtn, editHForm.hotspotType === t && sc.choiceBtnActive]}
                        onPress={() => setEditHForm((f: any) => ({ ...f, hotspotType: t }))}>
                        <Text style={[sc.choiceBtnText, editHForm.hotspotType === t && { color: "#FFF" }]}>{t === "internal" ? "داخلي" : "خارجي"}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {editHForm.hotspotType === "internal" ? (
                    <>
                      <FInput label="اسم العميل" value={editHForm.clientName} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, clientName: v }))} />
                      <FInput label="رقم الجوال" value={editHForm.clientPhone} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, clientPhone: v.replace(/\D/g, "") }))} keyboardType="phone-pad" />
                      <FInput label="رسوم الاشتراك" value={editHForm.subscriptionFee} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, subscriptionFee: v.replace(/\D/g, "") }))} keyboardType="numeric" />
                      <FInput label="عنوان IP" value={editHForm.ipAddress} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, ipAddress: v }))} />
                      <View style={sc.switchRow}><Switch value={editHForm.isClientOwned} onValueChange={v => setEditHForm((f: any) => ({ ...f, isClientOwned: v }))} trackColor={{ true: Colors.primary }} /><Text style={sc.switchLabel}>الجهاز ملك العميل</Text></View>
                      <View style={sc.extSection}><Text style={sc.extSectionTitle}>بيانات التركيب (اختياري)</Text></View>
                      <FInput label="اسم المهندس المركّب" value={editHForm.installedByName} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, installedByName: v }))} />
                      <FInput label="تاريخ التركيب" value={editHForm.installDate} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, installDate: v }))} placeholder="2025-01-15" />
                    </>
                  ) : (
                    <>
                      <FInput label="اسم المهندس المركّب" value={editHForm.installedByName} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, installedByName: v }))} />
                      <FInput label="تاريخ التركيب" value={editHForm.installDate} onChangeText={(v: string) => setEditHForm((f: any) => ({ ...f, installDate: v }))} />
                      <Text style={fs.label}>صورة التركيب</Text>
                      {editHForm.installPhoto ? (
                        <View style={{ marginBottom: 12 }}>
                          <Image source={{ uri: editHForm.installPhoto }} style={{ width: "100%", height: 160, borderRadius: 10, marginBottom: 6 }} resizeMode="cover" />
                          <TouchableOpacity style={sc.removePhotoBtn} onPress={() => setEditHForm((f: any) => ({ ...f, installPhoto: "" }))}><Text style={{ color: Colors.error, fontWeight: "bold" }}>× حذف الصورة</Text></TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity style={sc.pickPhotoBtn} onPress={() => pickPhoto(b64 => setEditHForm((f: any) => ({ ...f, installPhoto: b64 })))}>
                          <Ionicons name="camera-outline" size={22} color={Colors.primary} />
                          <Text style={sc.pickPhotoText}>إضافة صورة التركيب</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </>
              ) : tab === "broadband" && editBForm ? (
                <>
                  <FInput label="رقم الفلاش" value={editBForm.flashNumber} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, flashNumber: v.replace(/\D/g, "") }))} keyboardType="numeric" />
                  <FInput label="اسم الاشتراك" value={editBForm.subscriptionName} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, subscriptionName: v }))} />
                  <DeviceDropdown value={editBForm.deviceName} onChange={(v) => setEditBForm((f: any) => ({ ...f, deviceName: v }))} />
                  <FInput label="اسم العميل" value={editBForm.clientName} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, clientName: v }))} />
                  <FInput label="رقم الجوال" value={editBForm.clientPhone} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, clientPhone: v.replace(/\D/g, "") }))} keyboardType="phone-pad" />
                  <FInput label="رسوم الاشتراك" value={editBForm.subscriptionFee} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, subscriptionFee: v.replace(/\D/g, "") }))} keyboardType="numeric" />
                  <FInput label="وصف الموقع" value={editBForm.location} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, location: v }))} />
                  <FInput label="رابط الخريطة" value={editBForm.locationUrl} onChangeText={(v: string) => setEditBForm((f: any) => ({ ...f, locationUrl: v }))} />
                </>
              ) : null}
              <View style={sc.modalBtns}>
                <TouchableOpacity style={sc.cancelBtn} onPress={() => setEditItem(null)}><Text style={sc.cancelBtnText}>إلغاء</Text></TouchableOpacity>
                <TouchableOpacity style={[sc.nextBtn, editSaving && { opacity: 0.6 }]} onPress={handleSaveEdit} disabled={editSaving}>
                  {editSaving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={sc.nextBtnText}>حفظ</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ─── Delete Confirm ─── */}
      <Modal visible={!!deleteTarget} transparent animationType="fade">
        <View style={sc.overlay}>
          <View style={[sc.modalBox, { margin: 30, borderRadius: 16 }]}>
            <Ionicons name="warning" size={40} color={Colors.error} style={{ alignSelf: "center", marginBottom: 12 }} />
            <Text style={[sc.modalTitle, { textAlign: "center" }]}>تأكيد الحذف</Text>
            <Text style={{ color: Colors.textSecondary, textAlign: "center", marginBottom: 20 }}>هل تريد حذف "{deleteTarget?.name}"؟{"\n"}لا يمكن التراجع.</Text>
            <View style={sc.modalBtns}>
              <TouchableOpacity style={sc.cancelBtn} onPress={() => setDeleteTarget(null)}><Text style={sc.cancelBtnText}>إلغاء</Text></TouchableOpacity>
              <TouchableOpacity style={[sc.nextBtn, { backgroundColor: Colors.error }, deleting && { opacity: 0.6 }]} onPress={handleDelete} disabled={deleting}>
                {deleting ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={sc.nextBtnText}>حذف</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Empty Numbers Modal ─── */}
      <Modal visible={showEmpty} transparent animationType="fade">
        <View style={sc.overlay}>
          <View style={[sc.modalBox, { margin: 20, maxHeight: "80%", borderRadius: 20 }]}>
            <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <TouchableOpacity onPress={() => setShowEmpty(false)}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
              <Text style={sc.modalTitle}>الأرقام الشاغرة — {tab === "hotspot" ? "هوتسبوت" : "برودباند"}</Text>
            </View>
            <Text style={{ color: Colors.textMuted, textAlign: "right", marginBottom: 12, fontSize: 12 }}>من 1 إلى {emptyMax} · {emptyNums.length} رقم شاغر</Text>
            <ScrollView>
              {emptyNums.length === 0 ? (
                <Text style={{ color: Colors.textMuted, textAlign: "center", margin: 20 }}>لا توجد أرقام شاغرة 🎉</Text>
              ) : (
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

      <PhotoViewModal uri={photoUri} visible={showPhoto} onClose={() => setShowPhoto(false)} />
      <AlertModal title={alertTitle} msg={alertMsg} visible={alertVis} onClose={() => setAlertVis(false)} />
    </View>
  );
}

/* ─── أنماط الشاشة الرئيسية (sc) ─── */
const sc = StyleSheet.create({
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

  loadMoreBtn: { marginTop: 8, padding: 14, alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.primary + "15" },
  loadMoreText: { color: Colors.primary, fontWeight: "bold", fontSize: 14 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: Colors.text, textAlign: "right", marginBottom: 16 },
  modalBtns: { flexDirection: "row-reverse", gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, padding: 13, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: "bold" },
  nextBtn: { flex: 1, padding: 13, alignItems: "center", borderRadius: 10, backgroundColor: Colors.primary },
  nextBtnText: { color: "#FFF", fontWeight: "bold" },

  choiceRow: { flexDirection: "row-reverse", gap: 10 },
  choiceBtn: { flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, gap: 4 },
  choiceBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  choiceBtnText: { fontSize: 14, fontWeight: "bold", color: Colors.textSecondary },

  switchRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12, marginBottom: 12 },
  switchLabel: { color: Colors.text, fontSize: 14 },

  extSection: { backgroundColor: Colors.warning + "15", borderRadius: 8, padding: 8, marginBottom: 10, borderWidth: 1, borderColor: Colors.warning + "40" },
  extSectionTitle: { color: Colors.warning, fontWeight: "bold", textAlign: "right", fontSize: 13 },
  pickPhotoBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary, borderStyle: "dashed", padding: 14, justifyContent: "center", marginBottom: 12 },
  pickPhotoText: { color: Colors.primary, fontWeight: "bold", fontSize: 14 },
  removePhotoBtn: { alignItems: "center", padding: 8, borderRadius: 8, backgroundColor: Colors.error + "15", borderWidth: 1, borderColor: Colors.error + "40" },
});
