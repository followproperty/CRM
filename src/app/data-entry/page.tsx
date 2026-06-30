import { getSession } from "@/lib/session";
import GpsCollectorClient from "./GpsCollectorClient";
import { redirect } from "next/navigation";

export default async function DataEntryDashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <GpsCollectorClient userName={session.name || "Collector"} />;
}
