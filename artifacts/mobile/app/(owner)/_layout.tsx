import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { useRoleGuard } from "@/hooks/useRoleGuard";

export default function OwnerTabLayout() {
  const { isLoading, isAuthorized } = useRoleGuard("owner");

  if (isLoading || !isAuthorized) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : Colors.tabBar,
          borderTopColor: Colors.tabBarBorder,
          borderTopWidth: 1,
          elevation: 0,
          height: isWeb ? 80 : 62,
          paddingBottom: isWeb ? 12 : 6,
          paddingTop: 8,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.tabBar }]} />
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
          tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={30} color={color} />,
        }}
      />
      <Tabs.Screen
        name="network"
        options={{
          title: "الشبكة",
          tabBarIcon: ({ color }) => <Ionicons name="wifi-outline" size={30} color={color} />,
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: "الفريق",
          tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={30} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "حسابي",
          tabBarIcon: ({ color }) => <Ionicons name="person-circle-outline" size={30} color={color} />,
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
