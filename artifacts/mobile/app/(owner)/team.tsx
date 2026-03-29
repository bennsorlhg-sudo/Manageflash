import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, ROLE_LABELS, type UserRole } from "@/constants/colors";
import { RoleBadge } from "@/components/RoleBadge";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, apiPut, apiFetch } from "@/utils/api";

interface UserProfile {
  id: number;
  name: string;
  phone: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const ROLE_OPTIONS: { value: Exclude<UserRole, "owner">; label: string }[] = [
  { value: "finance_manager", label: "مدير مالي" },
  { value: "supervisor", label: "مشرف" },
  { value: "tech_engineer", label: "مهندس تقني" },
];

type CreateForm = { name: string; phone: string; password: string; role: Exclude<UserRole, "owner"> };
type EditForm = { name: string; phone: string; role: Exclude<UserRole, "owner"> };

export default function TeamScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({
    name: "",
    phone: "",
    password: "",
    role: "supervisor",
  });
  const [editForm, setEditForm] = useState<EditForm>({ name: "", phone: "", role: "supervisor" });
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await apiGet("/users", token);
      setUsers(data);
    } catch {} finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async () => {
    const cleanPhone = createForm.phone.replace(/\D/g, "");
    if (!createForm.name.trim() || !cleanPhone || !createForm.password) {
      Alert.alert("خطأ", "جميع الحقول مطلوبة");
      return;
    }
    setSaving(true);
    try {
      await apiPost("/users", token, { ...createForm, phone: cleanPhone });
      setShowCreateModal(false);
      setCreateForm({ name: "", phone: "", password: "", role: "supervisor" });
      fetchUsers();
    } catch (e: any) {
      Alert.alert("خطأ", e?.message ?? "فشل إنشاء المستخدم");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    const cleanPhone = editForm.phone.replace(/\D/g, "");
    if (!editingUser || !editForm.name.trim() || !cleanPhone) {
      Alert.alert("خطأ", "الاسم ورقم الهاتف مطلوبان");
      return;
    }
    setSaving(true);
    try {
      await apiPut(`/users/${editingUser.id}`, token, { ...editForm, phone: cleanPhone });
      setShowEditModal(false);
      setEditingUser(null);
      fetchUsers();
    } catch (e: any) {
      Alert.alert("خطأ", e?.message ?? "فشل تحديث المستخدم");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      phone: user.phone,
      role: user.role as Exclude<UserRole, "owner">,
    });
    setShowEditModal(true);
  };

  const handleToggle = (id: number, isActive: boolean) => {
    const action = isActive ? "تعطيل" : "تفعيل";
    Alert.alert(`${action} المستخدم`, `هل أنت متأكد من ${action} هذا المستخدم؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: action,
        style: isActive ? "destructive" : "default",
        onPress: async () => {
          try {
            await apiPost(`/users/${id}/toggle-active`, token, {});
            fetchUsers();
          } catch {
            Alert.alert("خطأ", "فشل تحديث حالة المستخدم");
          }
        },
      },
    ]);
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert("حذف المستخدم", `هل أنت متأكد من حذف "${name}" نهائياً؟ لا يمكن التراجع.`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/users/${id}`, token, { method: "DELETE" });
            fetchUsers();
          } catch (e: any) {
            Alert.alert("خطأ", e?.message ?? "فشل الحذف");
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="person-add" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>الفريق</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 80 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchUsers(); }}
              tintColor={Colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {users.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>لا يوجد أعضاء في الفريق بعد</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreateModal(true)}>
                <Text style={styles.emptyBtnText}>إضافة عضو</Text>
              </TouchableOpacity>
            </View>
          ) : (
            users.map((u) => (
              <View key={u.id} style={[styles.card, !u.isActive && styles.cardInactive]}>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={() => openEditModal(u)}
                    style={styles.editBtn}
                  >
                    <Ionicons name="pencil" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleToggle(u.id, u.isActive)}
                    style={[
                      styles.toggleBtn,
                      { backgroundColor: u.isActive ? Colors.success + "22" : Colors.error + "22" },
                    ]}
                  >
                    <Ionicons
                      name={u.isActive ? "checkmark-circle" : "close-circle"}
                      size={18}
                      color={u.isActive ? Colors.success : Colors.error}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(u.id, u.name)}
                    style={styles.deleteBtn}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.error} />
                  </TouchableOpacity>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.userName, !u.isActive && styles.textInactive]}>{u.name}</Text>
                  <Text style={styles.userPhone}>{u.phone}</Text>
                  <RoleBadge role={u.role as UserRole} />
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <UserFormModal
        visible={showCreateModal}
        title="إضافة عضو جديد"
        confirmLabel="إضافة"
        insets={insets}
        form={createForm}
        showPasswordField
        saving={saving}
        onChangeField={(key, value) => setCreateForm((prev) => ({ ...prev, [key]: value }))}
        onConfirm={handleCreate}
        onClose={() => setShowCreateModal(false)}
      />

      <UserFormModal
        visible={showEditModal}
        title="تعديل بيانات العضو"
        confirmLabel="حفظ التعديلات"
        insets={insets}
        form={editForm}
        showPasswordField={false}
        saving={saving}
        onChangeField={(key, value) => setEditForm((prev) => ({ ...prev, [key]: value }))}
        onConfirm={handleEdit}
        onClose={() => { setShowEditModal(false); setEditingUser(null); }}
      />
    </View>
  );
}

interface FormData {
  name: string;
  phone: string;
  role: Exclude<UserRole, "owner">;
  password?: string;
}

function UserFormModal({
  visible,
  title,
  confirmLabel,
  insets,
  form,
  showPasswordField,
  saving,
  onChangeField,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  confirmLabel: string;
  insets: { bottom: number };
  form: FormData;
  showPasswordField: boolean;
  saving: boolean;
  onChangeField: (key: string, value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="pageSheet">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{title}</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalForm}>
              <Field label="الاسم" value={form.name} onChangeText={(v) => onChangeField("name", v)} placeholder="الاسم الكامل" />
              <Field label="رقم الهاتف" value={form.phone} onChangeText={(v) => onChangeField("phone", v)} placeholder="05xxxxxxxx" keyboardType="phone-pad" />
              {showPasswordField && (
                <Field
                  label="كلمة المرور"
                  value={form.password ?? ""}
                  onChangeText={(v) => onChangeField("password", v)}
                  placeholder="••••••••"
                  secureTextEntry
                />
              )}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>الدور</Text>
                <View style={styles.roleOptions}>
                  {ROLE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.roleOption, form.role === opt.value && styles.roleOptionActive]}
                      onPress={() => onChangeField("role", opt.value)}
                    >
                      <Text style={[styles.roleOptionText, form.role === opt.value && styles.roleOptionTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={onConfirm}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>{confirmLabel}</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "phone-pad" | "email-address" | "numeric";
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        textAlign="right"
        keyboardType={keyboardType ?? "default"}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 10 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    flexDirection: "row-reverse",
    gap: 12,
    alignItems: "center",
  },
  cardInactive: { opacity: 0.5 },
  cardActions: { alignItems: "center", gap: 8 },
  toggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  editBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary + "22",
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.error + "22",
  },
  cardInfo: { flex: 1, gap: 4, alignItems: "flex-end" },
  userName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text },
  textInactive: { color: Colors.textMuted },
  userPhone: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  emptyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  emptyBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  modalForm: { padding: 20, gap: 16 },
  fieldGroup: { gap: 6 },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textAlign: "right",
  },
  fieldInput: {
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  roleOptions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  roleOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  roleOptionActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  roleOptionText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  roleOptionTextActive: { color: Colors.primary },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
