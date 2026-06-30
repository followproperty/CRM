"use client";

import React, { useState, useEffect, useTransition } from "react";
import { getFieldCollectorStats } from "@/app/actions/gps-collector";

interface StatsData {
  total: number;
  completed: number;
  remaining: number;
  completedToday: number;
}

interface PerformanceClientProps {
  userName: string;
}

export default function PerformanceClient({ userName }: PerformanceClientProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadStats = () => {
    startTransition(async () => {
      try {
        setStatsError(null);
        const data = await getFieldCollectorStats();
        setStats(data);
      } catch (error: unknown) {
        const err = error as Error;
        setStatsError(err.message || "Failed to load performance metrics.");
      }
    });
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="bg-slate-50 text-slate-800 p-3 md:p-6 pb-20 font-sans min-h-[85vh]">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-8 shadow-xs space-y-8">
        <div className="border-b border-slate-100 pb-5">
          <h2 className="text-lg md:text-xl font-extrabold text-slate-900 tracking-tight">
            📈 My Collection Performance
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Live tracking metrics for geotagged residential and commercial projects in Gurgaon database.
          </p>
        </div>

        {statsError && (
          <div className="bg-rose-50 border border-rose-250 rounded-xl p-4 text-rose-700 text-xs">
            ⚠️ {statsError}
          </div>
        )}

        {isPending && !stats ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-8 h-8 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Fetching real-time metrics...</p>
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Circular Completion Ring */}
            <div className="md:col-span-4 flex flex-col items-center justify-center text-center p-4">
              <div className="relative w-36 h-36 flex items-center justify-center">
                {/* SVG Ring */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    className="stroke-slate-100 fill-none"
                    strokeWidth="10"
                  />
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    className="stroke-indigo-600 fill-none transition-all duration-1000 ease-out"
                    strokeWidth="10"
                    strokeDasharray={2 * Math.PI * 60}
                    strokeDashoffset={
                      2 * Math.PI * 60 * (1 - (stats.completed / (stats.total || 1)))
                    }
                    strokeLinecap="round"
                  />
                </svg>
                {/* Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-slate-900 leading-none">
                    {Math.round((stats.completed / (stats.total || 1)) * 100)}%
                  </span>
                  <span className="text-[9px] text-slate-450 uppercase font-extrabold tracking-wider mt-1">
                    Completed
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <h4 className="font-bold text-slate-800 text-sm">Registry Coverage</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal max-w-[180px]">
                  Keep it up, {userName}! You have geotagged {stats.completed} out of {stats.total} total Gurgaon projects.
                </p>
              </div>
            </div>

            {/* Numerical Metrics Cards Grid */}
            <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50/50 border border-slate-200 p-4.5 rounded-2xl flex flex-col justify-between">
                <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">
                  Total Projects
                </span>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-800">{stats.total}</span>
                  <span className="text-[10px] font-bold text-slate-400">in Database</span>
                </div>
              </div>

              <div className="bg-emerald-50/40 border border-emerald-150 p-4.5 rounded-2xl flex flex-col justify-between">
                <span className="text-[9px] uppercase font-bold text-emerald-700 tracking-wider">
                  Completed Geotagging
                </span>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-800">{stats.completed}</span>
                  <span className="text-[10px] font-bold text-emerald-600">Updated Live</span>
                </div>
              </div>

              <div className="bg-amber-50/40 border border-amber-150 p-4.5 rounded-2xl flex flex-col justify-between">
                <span className="text-[9px] uppercase font-bold text-amber-700 tracking-wider">
                  Remaining Projects
                </span>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-amber-800">{stats.remaining}</span>
                  <span className="text-[10px] font-bold text-amber-600">Pending Field Visits</span>
                </div>
              </div>

              <div className="bg-indigo-50/40 border border-indigo-150 p-4.5 rounded-2xl flex flex-col justify-between">
                <span className="text-[9px] uppercase font-bold text-indigo-700 tracking-wider">
                  Ingested Today
                </span>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-indigo-800">{stats.completedToday}</span>
                  <span className="text-[10px] font-bold text-indigo-600">Projects Today</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-slate-400 text-sm">
            No stats available.
          </div>
        )}

        <div className="flex justify-end pt-3">
          <button
            onClick={loadStats}
            disabled={isPending}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2.5 px-5 rounded-xl text-xs border border-indigo-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            🔄 Refresh Live Metrics
          </button>
        </div>
      </div>
    </div>
  );
}
