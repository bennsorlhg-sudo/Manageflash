import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";
import type { UserRole } from "@/context/AuthContext";

function getLoginUrl(): string {
  if (Platform.OS === "web") return "/api/auth/login";

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api/auth/login`;

  const hostUri: string = (Constants.expoConfig as any)?.hostUri ?? "";
  if (hostUri) {
    const withoutPort = hostUri.split(":")[0];
    const cleanDomain = withoutPort.replace("expo.", "");
    if (cleanDomain) return `https://${cleanDomain}/api/auth/login`;
  }
  return "/api/auth/login";
}

const ROLE_ROUTES: Record<UserRole, string> = {
  owner: "/(owner)",
  finance_manager: "/(finance)",
  supervisor: "/(supervisor)",
  tech_engineer: "/(tech)",
};

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const validate = () => {
    let valid = true;
    setPhoneError("");
    setPasswordError("");

    if (!phone.trim()) {
      setPhoneError("رقم الهاتف مطلوب");
      valid = false;
    }
    if (!password) {
      setPasswordError("كلمة المرور مطلوبة");
      valid = false;
    }
    return valid;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setIsLoading(true);
    try {
      const url = getLoginUrl();
      const cleanPhone = phone.replace(/\D/g, "").trim();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (Platform.OS !== "web") {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        if (res.status === 401) {
          Alert.alert("خطأ", data.message ?? "رقم الهاتف أو كلمة المرور غير صحيحة");
        } else {
          Alert.alert("خطأ", data.message ?? "حدث خطأ، يرجى المحاولة مرة أخرى");
        }
        return;
      }

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await login(data.token, data.user);
      router.replace(ROLE_ROUTES[data.user.role as UserRole] as never);
    } catch {
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert("خطأ في الاتصال", "تعذر الاتصال بالخادم، يرجى التحقق من الاتصال بالإنترنت");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top + 40,
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Ionicons name="flash" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>Flash Net</Text>
          <Text style={styles.tagline}>نظام إدارة الشبكة</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>تسجيل الدخول</Text>
          <Text style={styles.cardSubtitle}>أدخل بيانات حسابك للمتابعة</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>رقم الهاتف</Text>
            <View style={[styles.inputWrapper, phoneError ? styles.inputError : null]}>
              <Ionicons name="call-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(t) => { setPhone(t.replace(/\D/g, "")); setPhoneError(""); }}
                placeholder="05xxxxxxxx"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                textAlign="right"
                testID="phone-input"
              />
            </View>
            {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>كلمة المرور</Text>
            <View style={[styles.inputWrapper, passwordError ? styles.inputError : null]}>
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.inputIcon}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={(t) => { setPassword(t); setPasswordError(""); }}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPassword}
                textAlign="right"
                testID="password-input"
              />
            </View>
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
            testID="login-button"
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginBtnText}>دخول</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footerNote}>Flash Net © 2025</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    gap: 32,
  },
  logoArea: {
    alignItems: "center",
    gap: 8,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  appName: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    gap: 16,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textAlign: "right",
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "right",
    marginTop: -8,
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textAlign: "right",
  },
  inputWrapper: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputError: {
    borderColor: Colors.error,
  },
  inputIcon: {
    padding: 4,
  },
  input: {
    flex: 1,
    height: 48,
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 8,
  },
  errorText: {
    color: Colors.error,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
  },
  loginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  footerNote: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
