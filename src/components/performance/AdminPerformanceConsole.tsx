"use client";

import React, { useState, useTransition } from "react";
import { CallerSummaryItem, getCallerPerformanceAction, CallerPerformanceMetrics } from "@/app/actions/performance";
import PerformanceView from "./PerformanceView";

interface AdminPerformanceConsoleProps {
  callers: CallerSummaryItem[];
}

export default function AdminPerformanceConsole({ callers }: AdminPerformanceConsoleProps) {
  const [selectedCallerId, setSelectedCallerId] = useState<string | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<CallerPerformanceMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSelectCaller = (callerId: string) => {
    setError(null);
    setSelectedCallerId(callerId);
    setSelectedMetrics(null);

    startTransition(async () => {
      const result = await getCallerPerformanceAction(callerId);
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

      {/* Summary Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-xs font-bold text-slate-705 uppercase tracking-wider">Callers Summary Overview</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-205 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                <th className="px-5 py-3.5">Caller Name</th>
                <th className="px-5 py-3.5 text-center">Calls Made Today</th>
                <th className="px-5 py-3.5 text-center">Today's Calling Progress</th>
                <th className="px-5 py-3.5 text-center">Active Leads / Total Assigned</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {callers.map((c) => {
                const todayProgressPct = c.assignedToday > 0 ? Math.round((c.calledToday / c.assignedToday) * 100) : 0;
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
                    <td className="px-5 py-3.5 text-center font-bold text-slate-800 text-sm">
                      {c.callsToday}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="font-bold text-slate-700">
                          {c.calledToday} <span className="text-slate-400 font-normal">/ {c.assignedToday}</span>
                        </span>
                        {c.assignedToday > 0 && (
                          <span className="text-[9px] font-extrabold text-emerald-650 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-100 mt-1">
                            {todayProgressPct}% Done
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

              {callers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400 italic">
                    No active callers found in the system.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Loading State Overlay */}
      {isPending && !selectedMetrics && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center space-y-3">
          <div className="flex h-6 w-6">
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
          <PerformanceView metrics={selectedMetrics} showTitle={false} />
        </div>
      )}
    </div>
  );
}
