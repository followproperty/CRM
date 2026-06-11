import React from "react";
import dbConnect from "@/lib/db";
import Lead from "@/models/lead.model";
import User from "@/models/user.model";
import { UserRole, IUser } from "@/types/user";
import { LeadStatus } from "@/types/lead";

export const revalidate = 0;

export default async function AdminDashboard() {
  await dbConnect();

  // 1. Fetch metrics from DB
  const totalLeads = await Lead.countDocuments({});
  const unassignedLeads = await Lead.countDocuments({ assignedTo: null });
  const activeCallersCount = await User.countDocuments({ role: UserRole.CALLER, isActive: true });
  const dealsClosed = await Lead.countDocuments({ status: LeadStatus.CUSTOMER });

  // 2. Fetch caller team details with live assigned / won stats
  const callers = (await User.find({ role: UserRole.CALLER }).lean()) as unknown as IUser[];
  const callersWithStats = await Promise.all(
    callers.map(async (caller: IUser) => {
      const assignedCount = await Lead.countDocuments({ assignedTo: caller._id });
      const wonCount = await Lead.countDocuments({ assignedTo: caller._id, status: LeadStatus.CUSTOMER });
      return {
        id: caller._id ? caller._id.toString() : "",
        name: caller.name,
        email: caller.email,
        isActive: caller.isActive,
        assignedCount,
        wonCount,
      };
    })
  );

  // 3. Fetch lead source distribution
  interface SourceStat {
    _id: string | null;
    count: number;
  }

  const sourceStats = (await Lead.aggregate([
    { $group: { _id: "$source", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ])) as unknown as SourceStat[];

  const sources = sourceStats.map((stat: SourceStat) => {
    const pct = totalLeads > 0 ? Math.round((stat.count / totalLeads) * 100) : 0;
    return {
      name: stat._id || "Unknown/Direct",
      count: stat.count,
      percentage: pct,
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Operations & Managerial Hub</h1>
        <p className="text-sm text-slate-500 mt-1">Distribute leads, track caller teams, and view performance stats.</p>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Leads */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Leads</span>
            <span className="text-indigo-600 bg-indigo-50 p-1.5 rounded-lg border border-indigo-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{totalLeads}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
            <span>Database registry count</span>
          </div>
        </div>

        {/* Unassigned Leads */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unassigned Leads</span>
            <span className="text-amber-600 bg-amber-50 p-1.5 rounded-lg border border-amber-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{unassignedLeads}</p>
          <div className="flex items-center gap-1.5 mt-2">
            {unassignedLeads > 0 ? (
              <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-250 font-bold animate-pulse">
                NEEDS ALLOCATION
              </span>
            ) : (
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-250 font-bold">
                ALLOCATION COMPLETE
              </span>
            )}
          </div>
        </div>

        {/* Active Callers */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Callers</span>
            <span className="text-emerald-600 bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{activeCallersCount} Active</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
            <span>Registered callers in system</span>
          </div>
        </div>

        {/* Lead Conversions */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Deals Closed</span>
            <span className="text-indigo-600 bg-indigo-50 p-1.5 rounded-lg border border-indigo-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1M10 6h4" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{dealsClosed}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-indigo-600 font-medium">
            <span>Converted customer won status</span>
          </div>
        </div>
      </div>

      {/* Team Dashboard Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Caller Monitoring List */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 lg:col-span-2 space-y-4 shadow-sm">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-800">Caller Team Status</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {callersWithStats.length === 0 ? (
              <div className="text-slate-400 italic py-4 text-center text-sm">No callers registered in the system.</div>
            ) : (
              callersWithStats.map((caller) => (
                <div key={caller.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-700 border border-slate-200">
                      {caller.name.substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{caller.name}</p>
                      <p className="text-xs text-slate-450">
                        Assigned: <span className="font-semibold text-slate-750">{caller.assignedCount}</span> | Won: <span className="font-semibold text-emerald-600">{caller.wonCount}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-450 truncate max-w-[120px] sm:max-w-none">{caller.email}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${caller.isActive ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-slate-500 bg-slate-50 border-slate-200"}`}>
                      {caller.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Lead Sources panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 lg:col-span-1 space-y-4 shadow-sm">
          <h2 className="text-base font-bold text-slate-800">Lead Source Distribution</h2>
          <div className="space-y-4">
            {sources.length === 0 ? (
              <div className="text-slate-400 italic py-4 text-center text-xs">No lead data to display distribution.</div>
            ) : (
              sources.slice(0, 5).map((src, idx) => {
                const colors = [
                  "bg-indigo-500",
                  "bg-violet-500",
                  "bg-emerald-500",
                  "bg-amber-500",
                  "bg-rose-500",
                ];
                const colorClass = colors[idx % colors.length];
                return (
                  <div key={src.name}>
                    <div className="flex justify-between text-xs text-slate-550 mb-1">
                      <span>{src.name}</span>
                      <span className="font-bold text-slate-800">{src.percentage}% ({src.count})</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${colorClass} rounded-full`} style={{ width: `${src.percentage}%` }} />
                    </div>
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
