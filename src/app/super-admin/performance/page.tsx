import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAllCallersPerformanceSummaryAction } from "@/app/actions/performance";
import { UserRole } from "@/types/user";
import AdminPerformanceConsole from "@/components/performance/AdminPerformanceConsole";

export const revalidate = 0;

export default async function SuperAdminPerformancePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (session.role !== UserRole.SUPER_ADMIN) {
    redirect("/login");
  }

  const result = await getAllCallersPerformanceSummaryAction();
  if (!result.success || !result.callers) {
    return (
      <div className="bg-red-55/10 border border-red-200 text-red-700 text-xs p-4 rounded-xl">
        {result.error || "Failed to load callers performance summary."}
      </div>
    );
  }

  return <AdminPerformanceConsole callers={result.callers} />;
}
