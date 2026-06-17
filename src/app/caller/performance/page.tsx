import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCallerPerformanceAction } from "@/app/actions/performance";
import { UserRole } from "@/types/user";
import PerformanceView from "@/components/performance/PerformanceView";

export const revalidate = 0;

export default async function CallerPerformancePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (session.role !== UserRole.CALLER) {
    redirect("/login");
  }

  const result = await getCallerPerformanceAction(session.userId);
  if (!result.success || !result.metrics) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-xl">
        {result.error || "Failed to load performance metrics."}
      </div>
    );
  }

  return <PerformanceView metrics={result.metrics} />;
}
