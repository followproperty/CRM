import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { UserRole } from "@/types/user";

import { getSession } from "@/lib/session";

interface LayoutProps {
  children: React.ReactNode;
}

export const metadata = {
  title: "Data Entry Dashboard | FollowProperty CRM",
  description: "Upload lead lists and entry history logs",
};

export default async function DataEntryLayout({ children }: LayoutProps) {
  const session = await getSession();
  return (
    <DashboardLayout
      role={UserRole.DATA_ENTRY}
      userName={session?.name}
      userEmail={session?.email}
    >
      {children}
    </DashboardLayout>
  );
}
