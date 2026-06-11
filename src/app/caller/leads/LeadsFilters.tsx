"use client";

import React, { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { LeadStatus } from "@/types/lead";

export default function LeadsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("status") || "ALL";

  function handleFilterChange(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL") {
      params.set(name, value);
    } else {
      params.delete(name);
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      {/* Search Input */}
      <div className="w-full sm:max-w-xs relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
          {isPending ? (
            <span className="w-4 h-4 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </span>
        <input
          type="text"
          placeholder="Search by name or phone..."
          defaultValue={currentSearch}
          onChange={(e) => handleFilterChange("search", e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-550/50 focus:bg-white rounded-lg pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
        />
      </div>

      {/* Status Filter */}
      <div className="w-full sm:w-auto flex items-center gap-2">
        <label htmlFor="status-select" className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
          Status:
        </label>
        <select
          id="status-select"
          value={currentStatus}
          onChange={(e) => handleFilterChange("status", e.target.value)}
          className="bg-slate-50 border border-slate-200 focus:border-indigo-550/50 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all cursor-pointer min-w-[150px]"
        >
          <option value="ALL">All Leads</option>
          {Object.values(LeadStatus).map((status) => (
            <option key={status} value={status}>
              {status.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
