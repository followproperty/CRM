import { NextResponse } from "next/server";
import { getMyNotificationsAction } from "@/app/actions/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getMyNotificationsAction();
  return NextResponse.json(result);
}
