import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { UserRole } from "@/types/user";

import { getSession } from "@/lib/session";

interface LayoutProps {
  children: React.ReactNode;
}

export const metadata = {
  title: "Admin Dashboard | FollowProperty CRM",
  description: "Lead distribution and caller team management",
};

export default async function AdminLayout({ children }: LayoutProps) {
  const session = await getSession();
  return (
    <DashboardLayout
      role={UserRole.ADMIN}
      userName={session?.name}
      userEmail={session?.email}
    >
      {children}
    </DashboardLayout>
  );
}
