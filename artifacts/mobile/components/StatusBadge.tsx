import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, STATUS_LABELS, type PointStatus } from "@/constants/colors";

interface StatusBadgeProps {
  status: PointStatus;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const color = Colors.status[status];
  const bg = Colors.statusLight[status];
  const label = STATUS_LABELS[status];

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: color }, size === "sm" && styles.badgeSm]}>
      <View style={[styles.dot, { backgroundColor: color }, size === "sm" && styles.dotSm]} />
      <Text style={[styles.text, { color }, size === "sm" && styles.textSm]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
    alignSelf: "flex-start",
  },
  badgeSm: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotSm: {
    width: 5,
    height: 5,
  },
  text: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  textSm: {
    fontSize: 11,
  },
});
