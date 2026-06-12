import React from "react";
import dbConnect from "@/lib/db";
import User from "@/models/user.model";
import Lead from "@/models/lead.model";
import Activity from "@/models/activity.model";
import { LeadStatus } from "@/types/lead";
import mongoose from "mongoose";
import Link from "next/link";

// Register Mongoose schemas to avoid lazy loading missing model errors
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _models = { User };

export const revalidate = 0;

export default async function SuperAdminDashboard() {
  await dbConnect();

  // Real CRM Database Queries for Operational Metrics
  const interestedLeadsCount = await Lead.countDocuments({ status: LeadStatus.INTERESTED });
  const pendingFollowupsCount = await Lead.countDocuments({ status: LeadStatus.FOLLOW_UP });
  const whatsappRequestsCount = await Lead.countDocuments({ handedOffToAdmin: true });
  const siteVisitsCount = await Lead.countDocuments({ status: LeadStatus.SITE_VISIT });

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

  // Show latest 10 records on dashboard
  const recentActivitiesRaw = (await Activity.find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("userId")
    .lean()) as unknown as PopulatedActivity[];

  const recentActivities = recentActivitiesRaw.map((act: PopulatedActivity) => {
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
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">System Overview</h1>
        <p className="text-sm text-slate-500 mt-1">Global CRM operations, caller status monitoring, and system activity logs.</p>
      </div>

      {/* Grid Stats - Operational focus */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Interested Leads Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Interested Leads</span>
            <span className="text-emerald-600 bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{interestedLeadsCount}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
            <span>Warm prospects</span>
          </div>
        </div>

        {/* Pending Followups Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Followups</span>
            <span className="text-indigo-650 bg-indigo-50 p-1.5 rounded-lg border border-indigo-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{pendingFollowupsCount}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
            <span>Scheduled callbacks</span>
          </div>
        </div>

        {/* WhatsApp Requests Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">WhatsApp Requests</span>
            <span className="text-teal-600 bg-teal-50 p-1.5 rounded-lg border border-teal-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{whatsappRequestsCount}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
            <span>Handoffs to admin</span>
          </div>
        </div>

        {/* Site Visits Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Site Visits</span>
            <span className="text-purple-600 bg-purple-50 p-1.5 rounded-lg border border-purple-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{siteVisitsCount}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
            <span>Active visits pending</span>
          </div>
        </div>
      </div>

      {/* Main Section - Console expanded to full width */}
      <div className="grid grid-cols-1 gap-6">
        {/* Activity Logs Console */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-800">Recent System Activities</h2>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-xs text-slate-400 font-medium font-mono">Live Audit Log</span>
              <Link href="/super-admin/logs" className="text-xs font-semibold text-purple-650 hover:text-purple-800 hover:underline">
                View All Logs →
              </Link>
            </div>
          </div>
          <div className="divide-y divide-slate-100 min-h-[140px]">
            {recentActivities.length === 0 ? (
              <div className="text-slate-400 italic py-8 text-center text-sm">No recent CRM activities logged.</div>
            ) : (
              recentActivities.map((act) => {
                let badgeColor = "bg-slate-100 text-slate-600";
                if (act.action.includes("WON") || act.action.includes("SCHEDULED")) {
                  badgeColor = "bg-emerald-50 text-emerald-700";
                } else if (act.action.includes("LOST") || act.action.includes("DND")) {
                  badgeColor = "bg-red-50 text-red-700";
                } else if (act.action.includes("ASSIGN") || act.action.includes("CREAT")) {
                  badgeColor = "bg-purple-50 text-purple-700";
                }
                return (
                  <div key={act.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
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
    </div>
  );
}
