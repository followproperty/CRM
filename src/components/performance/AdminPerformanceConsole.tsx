"use client";

import React, { useState, useEffect, useTransition } from "react";
import { 
  CallerSummaryItem, 
  getCallerPerformanceAction, 
  getAllCallersPerformanceSummaryAction,
  CallerPerformanceMetrics 
} from "@/app/actions/performance";
import PerformanceView from "./PerformanceView";

interface AdminPerformanceConsoleProps {
  callers: CallerSummaryItem[];
}

export default function AdminPerformanceConsole({ callers }: AdminPerformanceConsoleProps) {
  const [selectedCallerId, setSelectedCallerId] = useState<string | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<CallerPerformanceMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filters State
  const [period, setPeriod] = useState<"today" | "week" | "month" | "year">("today");
  const [customDate, setCustomDate] = useState<string>(() => {
    const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
    const istDate = new Date(Date.now() + istOffsetMs);
    return istDate.toISOString().split("T")[0];
  });

  const [callersList, setCallersList] = useState<CallerSummaryItem[]>(callers);
  const [isPendingSummary, startSummaryTransition] = useTransition();

  // Date Formatting Helper
  const formatHeaderDate = (dateStr: string, offsetDays: number = 0) => {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dt = new Date(Date.UTC(y, m, d + offsetDays, 12, 0, 0));
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  const getPeriodLabel = () => {
    if (period === "week") return "This Week";
    if (period === "month") return "This Month";
    if (period === "year") return "This Year";
    return formatHeaderDate(customDate, 0);
  };

  const getYesterdayLabel = () => {
    return formatHeaderDate(customDate, -1);
  };

  const getDbyLabel = () => {
    return formatHeaderDate(customDate, -2);
  };

  // Fetch summaries and metrics when filters change
  useEffect(() => {
    const filterParams = { date: customDate, period };

    startSummaryTransition(async () => {
      setError(null);
      const result = await getAllCallersPerformanceSummaryAction(filterParams);
      if (result.success && result.callers) {
        setCallersList(result.callers);
      } else {
        setError(result.error || "Failed to load callers performance summary.");
      }
    });

    if (selectedCallerId) {
      startTransition(async () => {
        const result = await getCallerPerformanceAction(selectedCallerId, filterParams);
        if (result.success && result.metrics) {
          setSelectedMetrics(result.metrics);
        } else {
          setError(result.error || "Failed to load performance metrics.");
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customDate]);

  const handleSelectCaller = (callerId: string) => {
    setError(null);
    setSelectedCallerId(callerId);
    setSelectedMetrics(null);

    startTransition(async () => {
      const result = await getCallerPerformanceAction(callerId, { date: customDate, period });
      if (result.success && result.metrics) {
        setSelectedMetrics(result.metrics);
      } else {
        setError(result.error || "Failed to load performance metrics.");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-805 tracking-tight">Caller Performance Console</h1>
        <p className="text-xs text-slate-500 mt-0.5">Global monitoring of caller activity log frequencies, daily assignments, and pipeline loads.</p>
      </div>

      {/* Date & Period Filters Dashboard */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Period Filter Buttons */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timeframe Period</label>
            <div className="inline-flex p-1 bg-slate-100/80 rounded-xl w-fit">
              {(["today", "week", "month", "year"] as const).map((p) => {
                const label = {
                  today: "Today",
                  week: "Weekly",
                  month: "Monthly",
                  year: "Yearly"
                }[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      period === p
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Date Input */}
          <div className="flex flex-col gap-1.5 min-w-[245px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Custom Target Date (IST)</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setCustomDate(e.target.value);
                    // Reset to today period to show date details
                    setPeriod("today");
                  }
                }}
                className="flex-1 bg-white border border-slate-205 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
                  const todayStr = new Date(Date.now() + istOffsetMs).toISOString().split("T")[0];
                  setCustomDate(todayStr);
                  setPeriod("today");
                }}
                className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-205 text-slate-655 font-bold rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm relative">
        {/* Loading indicator overlay for summaries */}
        {isPendingSummary && (
          <div className="absolute inset-0 bg-white/60 z-20 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping mr-2"></span>
            <span className="text-xs text-slate-550 font-bold">Updating callers list...</span>
          </div>
        )}

        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-xs font-bold text-slate-705 uppercase tracking-wider">
            Callers Summary Overview {period !== "today" && `(${getPeriodLabel()})`}
          </h2>
        </div>

        {/* Desktop View Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-205 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                <th className="px-5 py-3.5">Caller Name</th>
                <th className="px-4 py-3.5 text-center bg-indigo-50/30">Calls ({getPeriodLabel()})</th>
                <th className="px-4 py-3.5 text-center">Yesterday ({getYesterdayLabel()})</th>
                <th className="px-4 py-3.5 text-center">Day Before ({getDbyLabel()})</th>
                <th className="px-5 py-3.5 text-center">Calling Progress</th>
                <th className="px-5 py-3.5 text-center">Active / Assigned</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {callersList.map((c) => {
                const periodProgressPct = c.assignedPeriod > 0 ? Math.round((c.calledPeriod / c.assignedPeriod) * 100) : 0;
                const isSelected = selectedCallerId === c.callerId;

                return (
                  <tr 
                    key={c.callerId} 
                    className={`hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-indigo-50/20' : ''}`}
                  >
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-bold text-slate-800">{c.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{c.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-indigo-700 text-sm bg-indigo-50/10">
                      {c.callsPeriod}
                    </td>
                    <td className="px-4 py-3.5 text-center text-slate-600 font-bold">
                      {c.callsYesterday}
                    </td>
                    <td className="px-4 py-3.5 text-center text-slate-500">
                      {c.callsDayBeforeYesterday}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="font-bold text-slate-700">
                          {c.calledPeriod} <span className="text-slate-400 font-normal">/ {c.assignedPeriod}</span>
                        </span>
                        {c.assignedPeriod > 0 && (
                          <span className="text-[9px] font-extrabold text-emerald-650 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-100 mt-1">
                            {periodProgressPct}% Done
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="font-bold text-slate-700">
                          {c.activeLeads} <span className="text-slate-400 font-normal">/ {c.totalAssigned}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleSelectCaller(c.callerId)}
                        disabled={isPending && isSelected}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-655 border border-slate-205 active:scale-[0.98]"
                        }`}
                      >
                        {isPending && isSelected ? "Loading..." : "View Performance"}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {callersList.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400 italic">
                    No active callers found in the system.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View List */}
        <div className="md:hidden divide-y divide-slate-100 bg-white">
          {callersList.map((c) => {
            const periodProgressPct = c.assignedPeriod > 0 ? Math.round((c.calledPeriod / c.assignedPeriod) * 100) : 0;
            const isSelected = selectedCallerId === c.callerId;

            return (
              <div 
                key={c.callerId} 
                className={`p-4 space-y-3.5 ${isSelected ? 'bg-indigo-50/10' : ''}`}
              >
                <div className="flex justify-between items-start gap-2.5">
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{c.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{c.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectCaller(c.callerId)}
                    disabled={isPending && isSelected}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-655 border border-slate-205 active:scale-[0.98]"
                    }`}
                  >
                    {isPending && isSelected ? "Loading..." : "View Performance"}
                  </button>
                </div>

                {/* Primary Stats Grid */}
                <div className="grid grid-cols-3 gap-2 text-center pt-2 text-slate-700 border-t border-slate-100/70">
                  <div>
                    <span className="text-slate-455 block text-[9px] font-bold uppercase tracking-wider mb-0.5">Calls ({period === 'today' ? 'Today' : 'Period'})</span>
                    <span className="font-extrabold text-indigo-700 text-sm">{c.callsPeriod}</span>
                  </div>
                  <div>
                    <span className="text-slate-455 block text-[9px] font-bold uppercase tracking-wider mb-0.5">Progress</span>
                    <div className="inline-flex flex-col items-center">
                      <span className="font-bold text-slate-700 text-xs">
                        {c.calledPeriod} <span className="text-slate-400 font-normal">/ {c.assignedPeriod}</span>
                      </span>
                      {c.assignedPeriod > 0 && (
                        <span className="text-[9px] font-extrabold text-emerald-650 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-100 mt-0.5">
                          {periodProgressPct}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-455 block text-[9px] font-bold uppercase tracking-wider mb-0.5">Active/Total</span>
                    <span className="font-bold text-slate-700 text-xs">
                      {c.activeLeads} <span className="text-slate-400 font-normal">/ {c.totalAssigned}</span>
                    </span>
                  </div>
                </div>

                {/* Relative Days Small Row */}
                <div className="grid grid-cols-2 gap-2 pt-2 bg-slate-50/50 rounded-xl p-2 text-center text-xs">
                  <div>
                    <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider mb-0.5">Yesterday ({getYesterdayLabel()})</span>
                    <span className="font-bold text-slate-700">{c.callsYesterday}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider mb-0.5">Day Before ({getDbyLabel()})</span>
                    <span className="font-bold text-slate-600">{c.callsDayBeforeYesterday}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {callersList.length === 0 && (
            <div className="p-8 text-center text-slate-400 italic text-xs">
              No active callers found in the system.
            </div>
          )}
        </div>
      </div>

      {/* Loading State Overlay */}
      {isPending && !selectedMetrics && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center space-y-3">
          <div className="flex h-6 w-6 relative">
            <span className="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-6 w-6 bg-indigo-500"></span>
          </div>
          <p className="text-xs text-slate-450 font-bold">Querying caller metrics from database...</p>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-red-55 bg-opacity-10 border border-red-200 text-red-700 text-xs p-4 rounded-xl">
          {error}
        </div>
      )}

      {/* Selected Caller detailed stats view */}
      {selectedMetrics && (
        <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-5 relative">
          <div className="absolute top-4 right-4 z-10">
            <button
              type="button"
              onClick={() => {
                setSelectedCallerId(null);
                setSelectedMetrics(null);
              }}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 rounded-lg text-[10px] font-bold shadow-sm transition-all cursor-pointer"
            >
              ✕ Close Detail View
            </button>
          </div>
          <div className="mb-4 pb-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Detailed Insight</p>
              <h2 className="text-sm font-bold text-slate-805 mt-0.5">
                Detailed Performance: <span className="text-indigo-650">{selectedMetrics.callerName}</span>
              </h2>
            </div>
          </div>
          <PerformanceView 
            metrics={selectedMetrics} 
            showTitle={false} 
            period={period}
            customDate={customDate}
          />
        </div>
      )}
    </div>
  );
}
