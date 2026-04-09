/* ═══════════════════════════════════════════════
   Flash Net — Color System (Dark + Light themes)
═══════════════════════════════════════════════ */

export const DarkColors = {
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

export const LightColors = {
  primary: "#1565C0",
  primaryDark: "#0D47A1",
  primaryLight: "#42A5F5",
  background: "#EEF2F8",
  surface: "#FFFFFF",
  surfaceElevated: "#F5F8FD",
  border: "#D0DFF0",
  text: "#0A1628",
  textSecondary: "#3A5A7A",
  textMuted: "#7A9CBB",

  status: {
    active: "#1565C0",
    active_incomplete: "#E65100",
    ready: "#2E7D32",
    empty: "#C62828",
    stopped: "#546E7A",
  },

  statusLight: {
    active: "rgba(21, 101, 192, 0.12)",
    active_incomplete: "rgba(230, 81, 0, 0.12)",
    ready: "rgba(46, 125, 50, 0.12)",
    empty: "rgba(198, 40, 40, 0.12)",
    stopped: "rgba(84, 110, 122, 0.12)",
  },

  roles: {
    owner: "#6A1B9A",
    finance_manager: "#1565C0",
    supervisor: "#2E7D32",
    tech_engineer: "#E65100",
  },

  success: "#2E7D32",
  warning: "#E65100",
  error: "#C62828",
  info: "#1565C0",

  tabBar: "#FFFFFF",
  tabBarBorder: "#D0DFF0",
  tabActive: "#1565C0",
  tabInactive: "#7A9CBB",

  inputBackground: "#F5F8FD",
  inputBorder: "#C5D8ED",
  inputFocusBorder: "#1565C0",

  card: "#FFFFFF",
  cardBorder: "#D0DFF0",
  divider: "#D0DFF0",
  overlay: "rgba(10, 22, 40, 0.5)",
};

export type ThemeColors = typeof DarkColors;

export const Colors = DarkColors;
export default Colors;

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
