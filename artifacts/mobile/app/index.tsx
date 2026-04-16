import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function IndexRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen message="جاري التحميل..." />;

  if (!user) return <Redirect href="/login" />;

  switch (user.role) {
    case "supervisor":
      return <Redirect href="/(supervisor)" />;
    case "tech_engineer":
      return <Redirect href="/(tech)" />;
    default:
      return <Redirect href="/login" />;
  }
}
