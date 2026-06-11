import React from "react";
import dbConnect from "@/lib/db";
import User from "@/models/user.model";
import Lead from "@/models/lead.model";
import Activity from "@/models/activity.model";
import { UserRole } from "@/types/user";
import { LeadStatus } from "@/types/lead";
import mongoose from "mongoose";
import Link from "next/link";

export const revalidate = 0;

export default async function SuperAdminDashboard() {
  await dbConnect();

  // Real CRM Database Queries
  const totalLeads = await Lead.countDocuments({});
  const wonCustomers = await Lead.countDocuments({ status: LeadStatus.CUSTOMER });
  const siteVisitsCount = await Lead.countDocuments({ status: LeadStatus.SITE_VISIT });
  const totalUsers = await User.countDocuments({});
  const adminCount = await User.countDocuments({ role: UserRole.ADMIN });
  const callerCount = await User.countDocuments({ role: UserRole.CALLER });

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

  const recentActivitiesRaw = (await Activity.find({})
    .sort({ createdAt: -1 })
    .limit(5)
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

      {/* Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Leads Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total CRM Leads</span>
            <span className="text-purple-600 bg-purple-50 p-1.5 rounded-lg border border-purple-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{totalLeads}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
            <span>Ingested into system</span>
          </div>
        </div>

        {/* Total Customers Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customers Won</span>
            <span className="text-emerald-600 bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{wonCustomers}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-emerald-600 font-medium">
            <span>Successful conversions</span>
          </div>
        </div>

        {/* Active Site Visits Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Site Visits</span>
            <span className="text-blue-600 bg-blue-50 p-1.5 rounded-lg border border-blue-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{siteVisitsCount}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
            <span>Scheduled visits pending</span>
          </div>
        </div>

        {/* Total Accounts Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">User Accounts</span>
            <span className="text-purple-655 bg-purple-50 p-1.5 rounded-lg border border-purple-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{totalUsers}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
            <span>{adminCount} Admins</span>
            <span>•</span>
            <span>{callerCount} Callers</span>
          </div>
        </div>
      </div>

      {/* Main Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Actions panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 lg:col-span-1 space-y-4 shadow-sm">
          <h2 className="text-base font-bold text-slate-800">Quick Navigation</h2>
          <div className="space-y-2.5">
            <Link href="/super-admin/leads" className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-purple-50/50 rounded-lg text-sm text-slate-700 border border-slate-200 hover:border-purple-300 transition-all text-left font-medium">
              <span>Leads Registry</span>
              <span className="text-purple-600 font-bold">&rarr;</span>
            </Link>
            <Link href="/super-admin/followups" className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-purple-50/50 rounded-lg text-sm text-slate-700 border border-slate-200 hover:border-purple-300 transition-all text-left font-medium">
              <span>Follow-up Registry</span>
              <span className="text-purple-600 font-bold">&rarr;</span>
            </Link>
            <Link href="/super-admin/site-visits" className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-purple-50/50 rounded-lg text-sm text-slate-700 border border-slate-200 hover:border-purple-300 transition-all text-left font-medium">
              <span>Site Visits</span>
              <span className="text-purple-600 font-bold">&rarr;</span>
            </Link>
            <Link href="/super-admin/users" className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-purple-50/50 rounded-lg text-sm text-slate-700 border border-slate-200 hover:border-purple-300 transition-all text-left font-medium">
              <span>User Management</span>
              <span className="text-purple-600 font-bold">&rarr;</span>
            </Link>
          </div>
        </div>

        {/* Activity Logs Console */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 lg:col-span-2 space-y-4 shadow-sm">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-800">Recent System Activities</h2>
            <span className="text-xs text-slate-400 font-medium">Live Audit Log</span>
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
                  <div key={act.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-start gap-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider shrink-0 ${badgeColor}`}>
                        {act.action.replace("_", " ")}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-700">{act.userName}</p>
                        {act.note && <p className="text-slate-500 mt-0.5">{act.note}</p>}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono self-end sm:self-center">
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
