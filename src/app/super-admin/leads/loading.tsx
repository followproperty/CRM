import React from "react";

export default function LeadsLoading() {
  return (
    <div className="space-y-6">
      {/* Title block skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 bg-slate-800 rounded-lg animate-pulse" />
        <div className="h-4 w-72 bg-slate-850 rounded-lg animate-pulse" />
      </div>

      {/* Filter placeholder skeleton */}
      <div className="h-16 w-full bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />

      {/* Table skeleton */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="h-5 w-32 bg-slate-800 rounded animate-pulse" />
          <div className="h-5 w-24 bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/20">
                <th className="p-4"><div className="h-4 w-16 bg-slate-800 rounded animate-pulse" /></th>
                <th className="p-4"><div className="h-4 w-24 bg-slate-800 rounded animate-pulse" /></th>
                <th className="p-4"><div className="h-4 w-28 bg-slate-800 rounded animate-pulse" /></th>
                <th className="p-4"><div className="h-4 w-16 bg-slate-800 rounded animate-pulse" /></th>
                <th className="p-4"><div className="h-4 w-24 bg-slate-800 rounded animate-pulse" /></th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="border-b border-slate-800/50">
                  <td className="p-4"><div className="h-4 w-28 bg-slate-850 rounded animate-pulse" /></td>
                  <td className="p-4"><div className="h-4 w-24 bg-slate-850 rounded animate-pulse" /></td>
                  <td className="p-4"><div className="h-4 w-32 bg-slate-850 rounded animate-pulse" /></td>
                  <td className="p-4"><div className="h-6 w-16 bg-slate-850 rounded-full animate-pulse" /></td>
                  <td className="p-4"><div className="h-4 w-24 bg-slate-850 rounded animate-pulse" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
