import { Stack } from "expo-router";
import React from "react";
import { View, ActivityIndicator } from "react-native";
import { useColors } from "@/context/ThemeContext";
import { useRoleGuard } from "@/hooks/useRoleGuard";

export default function SupervisorLayout() {
  const { isLoading, isAuthorized } = useRoleGuard("supervisor");
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
      <Stack.Screen name="repair-ticket" />
      <Stack.Screen name="installation-tickets" />
      <Stack.Screen name="purchase-request" />
      <Stack.Screen name="database" />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="engineer-management" />
      <Stack.Screen name="subscription-delivery" />
      <Stack.Screen name="finance-audit" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
