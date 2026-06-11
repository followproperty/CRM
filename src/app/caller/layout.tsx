import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { UserRole } from "@/types/user";

import { getSession } from "@/lib/session";

interface LayoutProps {
  children: React.ReactNode;
}

export const metadata = {
  title: "Caller Dashboard | FollowProperty CRM",
  description: "Calling queue and customer relationship status",
};

export default async function CallerLayout({ children }: LayoutProps) {
  const session = await getSession();
  return (
    <DashboardLayout
      role={UserRole.CALLER}
      userName={session?.name}
      userEmail={session?.email}
    >
      {children}
    </DashboardLayout>
  );
}
