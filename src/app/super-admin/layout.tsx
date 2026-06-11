import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { UserRole } from "@/types/user";

import { getSession } from "@/lib/session";

interface LayoutProps {
  children: React.ReactNode;
}

export const metadata = {
  title: "Super Admin Dashboard | FollowProperty CRM",
  description: "System administration and configuration dashboard",
};

export default async function SuperAdminLayout({ children }: LayoutProps) {
  const session = await getSession();
  return (
    <DashboardLayout
      role={UserRole.SUPER_ADMIN}
      userName={session?.name}
      userEmail={session?.email}
    >
      {children}
    </DashboardLayout>
  );
}
