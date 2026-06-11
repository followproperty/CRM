import React from "react";
import dbConnect from "@/lib/db";
import Lead from "@/models/lead.model";
import { LeadStatus } from "@/types/lead";

export const revalidate = 0;

export default async function DataEntryDashboard() {
  await dbConnect();

  // 1. Live Database Queries
  const totalLeads = await Lead.countDocuments({});

  // Query validation warnings (e.g. leads missing email, or with empty/null field)
  const validationWarnings = await Lead.countDocuments({
    $or: [{ name: "" }, { phone: "" }],
  });

  // Fetch the latest created lead for sync timestamp
  const latestLead = await Lead.findOne({}).sort({ createdAt: -1 }).lean();
  const lastSyncStr = latestLead ? new Date(latestLead.createdAt).toLocaleString() : "Never";
  const lastSyncName = latestLead ? `Latest: ${latestLead.name}` : "No leads in system";

  // Fetch the 5 most recently created leads
  const recentLeads = await Lead.find({}).sort({ createdAt: -1 }).limit(5).lean();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Lead Ingestion Console</h1>
        <p className="text-sm text-slate-500 mt-1">Import new lead lists, verify fields, and validate spreadsheet data formats.</p>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Ingested */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Ingested</span>
            <span className="text-amber-600 bg-amber-50 p-1.5 rounded-lg border border-amber-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{totalLeads}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
            <span>Dynamic DB record count</span>
          </div>
        </div>

        {/* Validation Errors */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Validation Warnings</span>
            <span className={`p-1.5 rounded-lg border ${validationWarnings > 0 ? "text-rose-700 bg-rose-50 border-rose-200" : "text-emerald-700 bg-emerald-50 border-emerald-100"}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{validationWarnings}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
            <span>Missing critical fields (name/phone)</span>
          </div>
        </div>

        {/* Last Upload */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Last Sync</span>
            <span className="text-emerald-600 bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
          </div>
          <p className="text-lg font-bold text-slate-800 mt-2.5 truncate">{lastSyncStr}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-450 truncate">
            <span>{lastSyncName}</span>
          </div>
        </div>
      </div>

      {/* Upload & History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload box */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 lg:col-span-1 space-y-4 flex flex-col justify-between shadow-sm">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-800">Import Spreadsheet</h2>
            <p className="text-xs text-slate-500">Upload bulk lead files from Google Sheets, Excel or CSV format.</p>
          </div>

          <div className="border-2 border-dashed border-slate-200 hover:border-amber-500/50 rounded-xl p-6 text-center cursor-pointer bg-slate-50 hover:bg-slate-50/50 transition-all py-10 my-3">
            <div className="flex flex-col items-center gap-3">
              <span className="text-slate-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-700">Drag file here</p>
                <p className="text-[11px] text-slate-400 mt-1">or click to browse local folders</p>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <span>Limit: 10MB per file</span>
            <span className="text-amber-600 hover:underline cursor-pointer font-semibold">Download Template</span>
          </div>
        </div>

        {/* Ingestion Logs */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 lg:col-span-2 space-y-4 shadow-sm">
          <h2 className="text-base font-bold text-slate-800">Ingestion History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="py-2.5">Lead Name</th>
                  <th className="py-2.5">Phone</th>
                  <th className="py-2.5">Source</th>
                  <th className="py-2.5">Created At</th>
                  <th className="py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {recentLeads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                      No leads ingested yet in database registry.
                    </td>
                  </tr>
                ) : (
                  recentLeads.map((lead) => {
                    let statusColor = "text-indigo-700 bg-indigo-50 border border-indigo-200";
                    if (lead.status === LeadStatus.NEW) {
                      statusColor = "text-blue-700 bg-blue-50 border border-blue-200";
                    } else if (lead.status === LeadStatus.CUSTOMER) {
                      statusColor = "text-emerald-700 bg-emerald-50 border border-emerald-200";
                    } else if (lead.status === LeadStatus.NOT_INTERESTED || lead.status === LeadStatus.DND) {
                      statusColor = "text-rose-700 bg-rose-50 border border-rose-200";
                    }
                    return (
                      <tr key={lead._id.toString()} className="hover:bg-slate-50/50">
                        <td className="py-3 font-semibold text-slate-800">{lead.name}</td>
                        <td className="py-3 text-slate-500 font-mono">{lead.phone}</td>
                        <td className="py-3 text-slate-600">{lead.source}</td>
                        <td className="py-3 text-slate-400">{new Date(lead.createdAt).toLocaleString()}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${statusColor}`}>
                            {lead.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
