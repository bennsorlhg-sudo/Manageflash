export const Colors = {
  primary: "#1E88E5",
  primaryDark: "#1565C0",
  primaryLight: "#64B5F6",
  background: "#0A1628",
  surface: "#0F2040",
  surfaceElevated: "#162845",
  border: "#1E3A5F",
  text: "#FFFFFF",
  textSecondary: "#8BA8CC",
  textMuted: "#4A6B8C",

  status: {
    active: "#1E88E5",
    active_incomplete: "#F9A825",
    ready: "#43A047",
    empty: "#E53935",
    stopped: "#757575",
  },

  statusLight: {
    active: "rgba(30, 136, 229, 0.15)",
    active_incomplete: "rgba(249, 168, 37, 0.15)",
    ready: "rgba(67, 160, 71, 0.15)",
    empty: "rgba(229, 57, 53, 0.15)",
    stopped: "rgba(117, 117, 117, 0.15)",
  },

  roles: {
    owner: "#9C27B0",
    finance_manager: "#1E88E5",
    supervisor: "#43A047",
    tech_engineer: "#F9A825",
  },

  success: "#43A047",
  warning: "#F9A825",
  error: "#E53935",
  info: "#1E88E5",

  tabBar: "#0A1628",
  tabBarBorder: "#1E3A5F",
  tabActive: "#1E88E5",
  tabInactive: "#4A6B8C",

  inputBackground: "#162845",
  inputBorder: "#1E3A5F",
  inputFocusBorder: "#1E88E5",

  card: "#0F2040",
  cardBorder: "#1E3A5F",
  divider: "#1E3A5F",
  overlay: "rgba(0, 0, 0, 0.7)",
};

export type PointStatus = "active" | "active_incomplete" | "ready" | "empty" | "stopped";
export type UserRole = "owner" | "finance_manager" | "supervisor" | "tech_engineer";

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "المالك",
  finance_manager: "مدير مالي",
  supervisor: "مشرف",
  tech_engineer: "مهندس تقني",
};

export const STATUS_LABELS: Record<PointStatus, string> = {
  active: "نشط",
  active_incomplete: "نشط - ناقص",
  ready: "جاهز",
  empty: "فارغ",
  stopped: "متوقف",
};

export default Colors;
