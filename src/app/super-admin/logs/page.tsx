import React from "react";
import dbConnect from "@/lib/db";
import User from "@/models/user.model";
import Activity from "@/models/activity.model";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { UserRole } from "@/types/user";
import { redirect } from "next/navigation";
import mongoose from "mongoose";

// Register Mongoose schemas to avoid lazy loading missing model errors
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _models = { User };

export const revalidate = 0;

export default async function SuperAdminLogsPage() {
  const session = await getSession();
  if (!session || session.role !== UserRole.SUPER_ADMIN) {
    redirect("/login");
  }

  await dbConnect();

  interface PopulatedUser {
    _id: string | mongoose.Types.ObjectId;
    name: string;
  }

  interface PopulatedActivity {
    _id: mongoose.Types.ObjectId;
    action: string;
    note?: string;
    userId?: PopulatedUser | null;
    createdAt?: Date;
  }

  // Retrieve the latest 100 logs for review
  const activitiesRaw = (await Activity.find({})
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("userId")
    .lean()) as unknown as PopulatedActivity[];

  const activities = activitiesRaw.map((act: PopulatedActivity) => {
    const userObj = act.userId;
    const userName = userObj && typeof userObj === "object" ? userObj.name : "System";
    return {
      id: act._id.toString(),
      action: act.action,
      note: act.note || "",
      userName,
      createdAt: act.createdAt ? new Date(act.createdAt).toISOString() : new Date().toISOString(),
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">System Activity Logs</h1>
          <p className="text-sm text-slate-500 mt-1">Audit log history of global CRM operations and state changes.</p>
        </div>
        <Link
          href="/super-admin"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg text-xs font-semibold shadow-sm transition-all"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* Logs Console Container */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
          <h2 className="text-base font-bold text-slate-850">System Logs History ({activities.length})</h2>
          <span className="text-xs text-slate-400 font-medium font-mono">Latest 100 entries</span>
        </div>

        <div className="divide-y divide-slate-100">
          {activities.length === 0 ? (
            <div className="text-slate-400 italic py-12 text-center text-sm">No CRM activities logged in the system.</div>
          ) : (
            activities.map((act) => {
              let badgeColor = "bg-slate-100 text-slate-600";
              if (act.action.includes("WON") || act.action.includes("SCHEDULED")) {
                badgeColor = "bg-emerald-50 text-emerald-700";
              } else if (act.action.includes("LOST") || act.action.includes("DND")) {
                badgeColor = "bg-red-50 text-red-700";
              } else if (act.action.includes("ASSIGN") || act.action.includes("CREAT")) {
                badgeColor = "bg-purple-50 text-purple-700";
              }
              return (
                <div key={act.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider shrink-0 ${badgeColor}`}>
                      {act.action.replace("_", " ")}
                    </span>
                    <div className="truncate">
                      <span className="font-semibold text-slate-700">{act.userName}</span>
                      {act.note && <span className="text-slate-500 ml-1.5 hidden sm:inline">- {act.note}</span>}
                      {act.note && <p className="text-slate-500 text-[10.5px] mt-0.5 sm:hidden truncate">{act.note}</p>}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                    {new Date(act.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
