"use client";

import React from "react";
import { CallerPerformanceMetrics } from "@/app/actions/performance";
import { LEAD_STATUS_LABELS, LeadStatus } from "@/types/lead";
import { formatToISTShort } from "@/lib/date";

interface PerformanceViewProps {
  metrics: CallerPerformanceMetrics;
  showTitle?: boolean;
  period?: "today" | "week" | "month" | "year" | "lifetime";
  customDate?: string;
}

export default function PerformanceView({ 
  metrics, 
  showTitle = true,
  period = "today",
  customDate
}: PerformanceViewProps) {
  const {
    callerName,
    totalAssigned,
    activeLeads,
    actionedLeads,
    assignedToday,
    calledToday,
    callsToday,
    totalCalls,
    statusBreakdown,
    recentActivities,
    // Dynamic filtered fields
    assignedPeriod,
    calledPeriod,
    callsPeriod,
    callsTargetDate,
    callsYesterday,
    callsDayBeforeYesterday
  } = metrics;

  // Date Parsing & Formatting Helper
  const formatHeaderDate = (dateStr: string, offsetDays: number = 0) => {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dt = new Date(Date.UTC(y, m, d + offsetDays, 12, 0, 0));
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  const defaultDate = () => {
    const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
    return new Date(Date.now() + istOffsetMs).toISOString().split("T")[0];
  };

  const activeDate = customDate || defaultDate();

  const periodLabel = period === "week" ? "This Week" 
                    : period === "month" ? "This Month" 
                    : period === "year" ? "This Year" 
                    : period === "lifetime" ? "Lifetime"
                    : formatHeaderDate(activeDate, 0);

  // Fallback to today fields if action was queried without filters
  const activeAssignedPeriod = assignedPeriod !== undefined ? assignedPeriod : assignedToday;
  const activeCalledPeriod = calledPeriod !== undefined ? calledPeriod : calledToday;
  const activeCallsPeriod = callsPeriod !== undefined ? callsPeriod : callsToday;

  // Calculate percentages safely
  const periodProgressPct = activeAssignedPeriod > 0 ? Math.round((activeCalledPeriod / activeAssignedPeriod) * 100) : 0;
  const actionedPct = totalAssigned > 0 ? Math.round((actionedLeads / totalAssigned) * 100) : 0;
  const activePct = totalAssigned > 0 ? Math.round((activeLeads / totalAssigned) * 100) : 0;

  // Calculate total leads in status breakdown for the current period
  const totalInBreakdown = Object.values(statusBreakdown).reduce((sum, val) => sum + val, 0);

  // Define status progress bar colors
  const statusColors: Record<LeadStatus, string> = {
    [LeadStatus.NEW]: "bg-slate-400",
    [LeadStatus.CALLED]: "bg-cyan-500",
    [LeadStatus.INTERESTED]: "bg-emerald-500",
    [LeadStatus.FOLLOW_UP]: "bg-indigo-500",
    [LeadStatus.WHATSAPP_SHARED]: "bg-teal-500",
    [LeadStatus.ADMIN_FOLLOWUP]: "bg-purple-500",
    [LeadStatus.SITE_VISIT]: "bg-fuchsia-500",
    [LeadStatus.NEGOTIATION]: "bg-violet-500",
    [LeadStatus.CUSTOMER]: "bg-amber-500",
    [LeadStatus.LOST]: "bg-zinc-500",
    [LeadStatus.NOT_INTERESTED]: "bg-rose-500",
    [LeadStatus.WRONG_NUMBER]: "bg-orange-500",
    [LeadStatus.DND]: "bg-red-500",
    [LeadStatus.NOT_ANSWERED]: "bg-yellow-500",
    [LeadStatus.MAYBE_LATER]: "bg-pink-500",
  };

  const getStatusColor = (status: LeadStatus) => {
    return statusColors[status] || "bg-indigo-500";
  };

  const breakdownSubtitle = period === "lifetime" 
    ? "Distribution of all-time assigned leads by status."
    : period === "week" ? "Distribution of leads assigned or updated this week by status."
    : period === "year" ? "Distribution of leads assigned or updated this year by status."
    : period === "month" ? "Distribution of leads assigned or updated this month by status."
    : `Distribution of leads assigned or updated today by status.`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {showTitle && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">My Performance</h1>
            <p className="text-xs text-slate-500 mt-0.5">Real-time insight into calling actions, assignments, and pipelines.</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl px-4 py-2 text-xs font-semibold shrink-0">
            Caller: <span className="font-bold">{callerName}</span>
          </div>
        </div>
      )}

      {/* Primary KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Timeframe Calls */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Calls Made ({periodLabel})
            </p>
            <p className="text-3xl font-extrabold text-slate-800 mt-1.5">{activeCallsPeriod}</p>
          </div>
          <div className="mt-4 text-[10px] text-slate-550 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-550 animate-pulse" />
            <span>Active timeframe stats</span>
          </div>
        </div>

        {/* Timeframe Calling Progress */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Calling Progress ({periodLabel})
            </p>
            <p className="text-3xl font-extrabold text-slate-800 mt-1.5">
              {activeCalledPeriod}<span className="text-slate-400 text-sm font-medium">/{activeAssignedPeriod}</span>
            </p>
          </div>
          <div className="mt-4 space-y-1">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${periodProgressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-405 font-bold">
              <span>{periodProgressPct}% completed</span>
              <span>assigned</span>
            </div>
          </div>
        </div>

        {/* Active In-Progress Leads (All Time) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Leads</p>
            <p className="text-3xl font-extrabold text-slate-800 mt-1.5">
              {activeLeads}<span className="text-slate-400 text-sm font-medium">/{totalAssigned}</span>
            </p>
          </div>
          <div className="mt-4 space-y-1">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${activePct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
              <span>{activePct}% active</span>
              <span>still pending</span>
            </div>
          </div>
        </div>

        {/* Actioned Leads (All Time) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actioned Leads</p>
            <p className="text-3xl font-extrabold text-slate-800 mt-1.5">
              {actionedLeads}<span className="text-slate-400 text-sm font-medium">/{totalAssigned}</span>
            </p>
          </div>
          <div className="mt-4 space-y-1">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                style={{ width: `${actionedPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
              <span>{actionedPct}% actioned</span>
              <span>total calls: {totalCalls}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Day Call Trend Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm">
        <div>
          <h3 className="text-xs font-bold text-slate-705 uppercase tracking-wider">3-Day Call Summary</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Call frequency comparison surrounding the target date.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 md:gap-4 mt-3">
          {/* Day Before Yesterday */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
            <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
              {formatHeaderDate(activeDate, -2)}
            </span>
            <span className="text-xl md:text-2xl font-extrabold text-slate-750 block mt-1">
              {callsDayBeforeYesterday ?? 0}
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5">calls made</span>
          </div>

          {/* Yesterday */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
            <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
              {formatHeaderDate(activeDate, -1)}
            </span>
            <span className="text-xl md:text-2xl font-extrabold text-slate-750 block mt-1">
              {callsYesterday ?? 0}
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5">calls made</span>
          </div>

          {/* Target Date */}
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 text-center ring-1 ring-indigo-500/10">
            <span className="text-[9px] md:text-[10px] font-bold text-indigo-650 uppercase tracking-wider block truncate">
              {formatHeaderDate(activeDate, 0)} (Target)
            </span>
            <span className="text-xl md:text-2xl font-extrabold text-indigo-700 block mt-1">
              {callsTargetDate !== undefined ? callsTargetDate : activeCallsPeriod}
            </span>
            <span className="text-[9px] text-indigo-500 font-bold block mt-0.5">calls made</span>
          </div>
        </div>
      </div>

      {/* Main Content Sections: Pipeline Breakdown & Recent Work */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Pipeline Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm md:col-span-5 space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-705 uppercase tracking-wider">Pipeline Status Breakdown</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{breakdownSubtitle}</p>
          </div>

          <div className="space-y-3.5 pt-2">
            {Object.values(LeadStatus).map((status) => {
              const count = statusBreakdown[status] || 0;
              if (count === 0 && status !== LeadStatus.NEW) return null; // Show New always, hide other empty ones
              const percent = totalInBreakdown > 0 ? Math.round((count / totalInBreakdown) * 100) : 0;
              return (
                <div key={status} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-650">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${getStatusColor(status)}`} />
                      {LEAD_STATUS_LABELS[status] || status}
                    </span>
                    <span className="text-slate-700">
                      {count} <span className="text-slate-400 text-[10px] font-medium">({percent}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full ${getStatusColor(status)} rounded-full transition-all duration-300`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm md:col-span-7 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-705 uppercase tracking-wider">
                Call History ({periodLabel})
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Your most recent logging activities in the selected timeframe.</p>
            </div>

            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[360px] pr-1.5 space-y-3 pt-1">
              {recentActivities.map((act) => {
                const formattedTime = formatToISTShort(act.createdAt);
                return (
                  <div key={act._id} className="pt-3 first:pt-0 flex flex-col gap-1 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-800 truncate max-w-[180px]">{act.leadName}</span>
                      <span className="text-slate-400 font-mono font-medium shrink-0">{formattedTime}</span>
                    </div>
                    {act.leadPhone && (
                      <div className="text-[10px] text-slate-405 font-mono">{act.leadPhone}</div>
                    )}
                    <div className="text-slate-500 font-medium leading-relaxed mt-0.5 bg-slate-50/50 p-2 rounded border border-slate-100">
                      {act.note || act.action}
                    </div>
                  </div>
                );
              })}

              {recentActivities.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-xs text-slate-400 italic">No calls logged in this period.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Updates will display here immediately when you submit caller actions.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
