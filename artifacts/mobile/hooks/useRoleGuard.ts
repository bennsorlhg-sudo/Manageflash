import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/context/AuthContext";

export function useRoleGuard(requiredRole: UserRole) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace("/login" as never);
      return;
    }

    if (user.role !== requiredRole) {
      const ROLE_ROUTES: Record<UserRole, string> = {
        supervisor: "/(supervisor)",
        tech_engineer: "/(tech)",
      };
      router.replace(ROLE_ROUTES[user.role] as never);
    }
  }, [user, isLoading, requiredRole, router]);

  return { user, isLoading, isAuthorized: !isLoading && user?.role === requiredRole };
}
