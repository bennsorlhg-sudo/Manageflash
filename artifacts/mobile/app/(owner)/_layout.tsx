import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, ActivityIndicator } from "react-native";
import { useColors } from "@/context/ThemeContext";
import { useRoleGuard } from "@/hooks/useRoleGuard";

export default function OwnerTabLayout() {
  const { isLoading, isAuthorized } = useRoleGuard("owner");
  const Colors = useColors();

  if (isLoading || !isAuthorized) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const tabBarStyle = isWeb
    ? {
        position: "absolute" as const,
        backgroundColor: Colors.tabBar,
        borderTopColor: Colors.tabBarBorder,
        borderTopWidth: 1,
        elevation: 0,
        height: 80,
        paddingBottom: 12,
        paddingTop: 8,
      }
    : isIOS
      ? {
          position: "absolute" as const,
          backgroundColor: "transparent",
          borderTopColor: Colors.tabBarBorder,
          borderTopWidth: 1,
          elevation: 0,
          paddingTop: 8,
        }
      : {
          backgroundColor: Colors.tabBar,
          borderTopColor: Colors.tabBarBorder,
          borderTopWidth: 1,
          elevation: 0,
          paddingTop: 8,
        };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        headerShown: false,
        tabBarStyle,
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          ) : null,
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "لوحة التحكم",
          tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="network"
        options={{
          title: "الشبكة",
          tabBarIcon: ({ color }) => <Ionicons name="wifi-outline" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: "الفريق",
          tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "حسابي",
          tabBarIcon: ({ color }) => <Ionicons name="person-circle-outline" size={26} color={color} />,
        }}
      />
      <Tabs.Screen name="report"      options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="sales"       options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="expenses"    options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="custody-log" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
