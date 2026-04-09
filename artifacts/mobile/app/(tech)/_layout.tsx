import { Stack } from "expo-router";
import React from "react";
import { View, ActivityIndicator } from "react-native";
import { useColors } from "@/context/ThemeContext";
import { useRoleGuard } from "@/hooks/useRoleGuard";

export default function TechLayout() {
  const { isLoading, isAuthorized } = useRoleGuard("tech_engineer");
  const Colors = useColors();

  if (isLoading || !isAuthorized) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
