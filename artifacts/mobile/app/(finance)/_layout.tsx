import { Stack } from "expo-router";
import React from "react";
import { useColors } from "@/context/ThemeContext";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { View, ActivityIndicator } from "react-native";

export default function FinanceLayout() {
  const { isLoading, isAuthorized } = useRoleGuard("finance_manager");
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
        animation: "slide_from_left",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="sell" />
      <Stack.Screen name="disburse" />
      <Stack.Screen name="collect" />
      <Stack.Screen name="custody" />
      <Stack.Screen name="sales" />
      <Stack.Screen name="expenses" />
      <Stack.Screen name="operations" />
      <Stack.Screen name="sales-points" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
