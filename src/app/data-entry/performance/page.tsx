import { getSession } from "@/lib/session";
import PerformanceClient from "./PerformanceClient";
import { redirect } from "next/navigation";

export default async function DataEntryPerformancePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <PerformanceClient userName={session.name || "Collector"} />;
}
