"use client";

import React, { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface SocialLead {
  _id: string;
  source: "Reddit" | "NCR Reddit" | "Twitter";
  author: string;
  reddit_id?: string | null;
  subreddit?: string | null;
  title?: string;
  text: string;
  city?: string | null;
  price?: string | null;
  bhk?: number | null;
  score: number;
  lead_type: string;
  created_at: string;
  url: string;
}

interface SocialLeadsTableProps {
  leads: SocialLead[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  redditCount: number;
  ncrCount: number;
  twitterCount: number;
  totalSocialLeads: number;
  cities: string[];
  leadTypes: string[];
}

function getSourceStyles(source: string) {
  switch (source) {
    case "Reddit":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "Twitter":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "NCR Reddit":
      return "bg-purple-50 text-purple-700 border-purple-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function getLeadTypeStyles(type: string) {
  const cleanType = String(type || "").toLowerCase().trim();
  switch (cleanType) {
    case "buyer":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "seller":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "complaint":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "discussion":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    default:
      return "bg-slate-50 text-slate-650 border-slate-200";
  }
}

export default function SocialLeadsTable({
  leads,
  totalCount,
  currentPage,
  totalPages,
  redditCount,
  ncrCount,
  twitterCount,
  totalSocialLeads,
  cities,
  leadTypes,
}: SocialLeadsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Selected lead for detail modal
  const [activeLead, setActiveLead] = useState<SocialLead | null>(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentSearch = searchParams.get("search") || "";
  const currentSource = searchParams.get("source") || "ALL";
  const currentLeadType = searchParams.get("lead_type") || "ALL";
  const currentCity = searchParams.get("city") || "ALL";
  const currentSort = searchParams.get("sort") || "NEWEST";

  function handleFilterChange(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL" && value !== "") {
      params.set(name, value);
    } else {
      params.delete(name);
    }
    // Always reset to page 1 on filter change
    params.delete("page");

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleCopyUrl(url: string) {
    if (!url) return;
    navigator.clipboard.writeText(url).then(
      () => {
        setToastMessage("Post URL successfully copied to clipboard!");
        setTimeout(() => setToastMessage(null), 3000);
      },
      () => {
        setToastMessage("Failed to copy URL. Please copy it manually.");
        setTimeout(() => setToastMessage(null), 3000);
      }
    );
  }

  const capitalize = (s: string) => {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Scraped Leads Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Scraped Leads</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{totalSocialLeads}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-650 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
        </div>

        {/* Reddit Leads Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reddit Leads</p>
            <p className="text-2xl font-bold text-slate-805 mt-1">{redditCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 shrink-0">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504l-.04-.153-.021-.19-.007-.116c-.021-.497.002-1.047.078-1.595l.385-2.289c-.066-.134-.117-.282-.149-.436-.046-.226-.062-.452-.047-.67l.142-.843c.006-.03.016-.06.027-.087-.015-.05-.028-.106-.037-.165-.015-.1-.018-.21-.01-.323l.081-.486c.006-.037.018-.073.033-.107l-.027-.091c-.015-.055-.022-.112-.022-.17l.006-.217c.01-.264.062-.516.149-.74l.118-.3c.123-.314.316-.583.56-.78l.424-.343a4.7 4.7 0 011.666-.677c.4-.083.811-.1 1.21-.052l.481.058c.241.029.475.086.696.168l.204.076c.404.148.77.387 1.074.697l.322.329c.25.255.441.562.56.903l.092.261c.078.223.116.458.113.693l-.004.22c-.006.182-.03.359-.071.53l-.117.487c-.035.148-.09.289-.161.419l-.337 2.012c-.006.037-.01.076-.01.115l.001.066c.01.218.067.426.165.61l.169.317c.182.342.274.72.266 1.103l-.007.387c-.004.256-.051.51-.137.747l-.071.196c-.144.398-.382.744-.688 1.013l-.403.354a4.7 4.7 0 01-1.63.753c-.398.093-.81.121-1.213.082l-.488-.046a3.86 3.86 0 01-.734-.143l-.224-.07a3.17 3.17 0 01-1.047-.645l-.307-.294a2.76 2.76 0 01-.622-.888l-.096-.239a2.38 2.38 0 01-.157-.751l-.001-.202c.002-.132.017-.26.044-.384l.208-1.24c.007-.037.018-.073.033-.107zm6.75 3.3c.09 0 .16-.07.16-.16v-.21c0-.09-.07-.16-.16-.16s-.16.07-.16.16v.21c0 .09.07.16.16.16z" />
            </svg>
          </div>
        </div>

        {/* Twitter Leads Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Twitter/X Leads</p>
            <p className="text-2xl font-bold text-slate-805 mt-1">{twitterCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-650 shrink-0">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
        </div>

        {/* NCR Leads Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">NCR Leads</p>
            <p className="text-2xl font-bold text-slate-805 mt-1">{ncrCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-650 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="flex flex-col xl:flex-row gap-4 items-center justify-between bg-white border border-slate-200 rounded-xl p-4 shadow-sm w-full">
        {/* Search Input */}
        <div className="w-full xl:max-w-xs relative">
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
            placeholder="Search by keywords..."
            defaultValue={currentSearch}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-550/50 focus:bg-white rounded-lg pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
          />
        </div>

        {/* Filters Select Grid */}
        <div className="w-full xl:w-auto flex flex-wrap items-center gap-4 justify-end">
          {/* Source Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label htmlFor="source-select" className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
              Source:
            </label>
            <select
              id="source-select"
              value={currentSource}
              onChange={(e) => handleFilterChange("source", e.target.value)}
              className="w-full sm:w-auto bg-slate-50 border border-slate-200 focus:border-indigo-550/50 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-805 focus:outline-none transition-all cursor-pointer min-w-[130px]"
            >
              <option value="ALL">All Sources</option>
              <option value="Reddit">Reddit</option>
              <option value="NCR Reddit">NCR Reddit</option>
              <option value="Twitter">Twitter</option>
            </select>
          </div>

          {/* Lead Type Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label htmlFor="type-select" className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
              Lead Type:
            </label>
            <select
              id="type-select"
              value={currentLeadType}
              onChange={(e) => handleFilterChange("lead_type", e.target.value)}
              className="w-full sm:w-auto bg-slate-50 border border-slate-200 focus:border-indigo-550/50 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-805 focus:outline-none transition-all cursor-pointer min-w-[140px]"
            >
              <option value="ALL">All Lead Types</option>
              {leadTypes.map((type) => (
                <option key={type} value={type}>
                  {capitalize(type)}
                </option>
              ))}
            </select>
          </div>

          {/* City Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label htmlFor="city-select" className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
              City:
            </label>
            <select
              id="city-select"
              value={currentCity}
              onChange={(e) => handleFilterChange("city", e.target.value)}
              className="w-full sm:w-auto bg-slate-50 border border-slate-200 focus:border-indigo-550/50 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-805 focus:outline-none transition-all cursor-pointer min-w-[140px]"
            >
              <option value="ALL">All Cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {capitalize(city)}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label htmlFor="sort-select" className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
              Sort:
            </label>
            <select
              id="sort-select"
              value={currentSort}
              onChange={(e) => handleFilterChange("sort", e.target.value)}
              className="w-full sm:w-auto bg-slate-50 border border-slate-200 focus:border-indigo-550/50 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-805 focus:outline-none transition-all cursor-pointer min-w-[140px]"
            >
              <option value="NEWEST">Newest First</option>
              <option value="OLDEST">Oldest First</option>
              <option value="HIGHEST_SCORE">Highest Score</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Feed */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm relative">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-[9999] flex items-center justify-between gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-805 rounded-xl shadow-2xl animate-slide-in min-w-[280px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-semibold">{toastMessage}</p>
            </div>
          </div>
        )}

        {/* Card Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-805">Unified Opportunities Feed ({totalCount})</h2>
          <span className="text-xs text-slate-400 font-medium font-mono">Live DB Stream</span>
        </div>

        {leads.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center p-12 text-center space-y-3 bg-white">
            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-200">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5a2 2 0 012-2h2a2 2 0 002-2V7a2 2 0 012-2h4a2 2 0 012 2v2a2 2 0 002 2h2a2 2 0 012 2z" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-750">No social leads found</p>
              <p className="text-xs text-slate-500 max-w-sm">
                Try adjusting your search criteria or resetting the filters.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4 w-28">Source</th>
                    <th className="px-6 py-4 w-48">Author / Channel</th>
                    <th className="px-6 py-4">Content Title & Excerpt</th>
                    <th className="px-6 py-4 w-32">City</th>
                    <th className="px-6 py-4 w-36">Budget</th>
                    <th className="px-6 py-4 w-28">Lead Type</th>
                    <th className="px-6 py-4 w-24 text-center">Score</th>
                    <th className="px-6 py-4 w-36">Scraped At</th>
                    <th className="px-6 py-4 w-36 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 text-sm text-slate-705">
                  {leads.map((lead) => {
                    const formattedDate = lead.created_at
                      ? new Date(lead.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "N/A";

                    const isReddit = lead.source.includes("Reddit");
                    const authorLabel = isReddit
                      ? `r/${lead.subreddit || "Property"}`
                      : `@${lead.author}`;
                    const contentTitle = isReddit ? lead.title : "";
                    const contentText = lead.text || "";
                    const excerpt =
                      contentText.length > 120
                        ? contentText.slice(0, 120) + "..."
                        : contentText;

                    return (
                      <tr key={lead._id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold border uppercase tracking-wide ${getSourceStyles(lead.source)}`}>
                            {lead.source}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-805 truncate max-w-[170px]" title={authorLabel}>
                              {authorLabel}
                            </span>
                            {isReddit && lead.reddit_id && (
                              <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                ID: {lead.reddit_id}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 max-w-md">
                          <button
                            onClick={() => setActiveLead(lead)}
                            className="text-left group cursor-pointer block focus:outline-none"
                          >
                            {contentTitle && (
                              <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 group-hover:underline text-sm leading-snug">
                                {contentTitle}
                              </h4>
                            )}
                            <p className={`text-xs text-slate-500 leading-relaxed ${contentTitle ? "mt-1.5" : "font-medium text-slate-750 group-hover:text-indigo-650"}`}>
                              {excerpt}
                            </p>
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          {lead.city ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                              {lead.city}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-xs">Unspecified</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {lead.price ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100 uppercase">
                              {lead.price}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-xs">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getLeadTypeStyles(lead.lead_type)}`}>
                            {lead.lead_type || "discussion"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center font-mono font-bold text-slate-700">
                          {lead.score || 0}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400 font-medium">
                          {formattedDate}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <a
                              href={lead.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded text-xs font-bold transition-all active:scale-[0.96]"
                            >
                              Open
                            </a>
                            <button
                              onClick={() => handleCopyUrl(lead.url)}
                              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-205 text-slate-650 rounded text-xs font-bold transition-all active:scale-[0.96] cursor-pointer"
                            >
                              Copy
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden divide-y divide-slate-100 bg-white">
              {leads.map((lead) => {
                const formattedDate = lead.created_at
                  ? new Date(lead.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "N/A";

                const isReddit = lead.source.includes("Reddit");
                const authorLabel = isReddit
                  ? `r/${lead.subreddit || "Property"}`
                  : `@${lead.author}`;
                const contentTitle = isReddit ? lead.title : "";
                const contentText = lead.text || "";
                const excerpt =
                  contentText.length > 100
                    ? contentText.slice(0, 100) + "..."
                    : contentText;

                return (
                  <div key={lead._id} className="p-4 space-y-3 hover:bg-slate-50/50 transition-colors">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold border uppercase tracking-wide ${getSourceStyles(lead.source)}`}>
                        {lead.source}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${getLeadTypeStyles(lead.lead_type)}`}>
                        {lead.lead_type || "discussion"}
                      </span>
                    </div>

                    {/* Excerpt clickable body */}
                    <button
                      onClick={() => setActiveLead(lead)}
                      className="text-left block w-full focus:outline-none group"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800 mb-1 leading-none">{authorLabel}</span>
                        {contentTitle && (
                          <h4 className="font-bold text-slate-900 group-hover:text-indigo-650 group-hover:underline text-xs leading-snug">
                            {contentTitle}
                          </h4>
                        )}
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{excerpt}</p>
                      </div>
                    </button>

                    {/* Meta badges */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {lead.city && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-650 border border-slate-150 capitalize">
                          {lead.city}
                        </span>
                      )}
                      {lead.price && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 uppercase">
                          {lead.price}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-450 font-medium ml-auto font-mono">Score: {lead.score}</span>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 font-mono font-medium">{formattedDate}</span>
                      <div className="flex items-center gap-2">
                        <a
                          href={lead.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded text-xs font-bold transition-all active:scale-[0.96]"
                        >
                          Open Original
                        </a>
                        <button
                          onClick={() => handleCopyUrl(lead.url)}
                          className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-205 text-slate-650 rounded text-xs font-bold transition-all active:scale-[0.96] cursor-pointer"
                        >
                          Copy Link
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Grid */}
            <div className="px-6 py-4 border-t border-slate-205 flex items-center justify-between flex-wrap gap-4 text-sm bg-slate-50">
              <div className="text-xs text-slate-500 font-medium">
                Showing <span className="font-bold text-slate-700">{leads.length}</span> of{" "}
                <span className="font-bold text-slate-700">{totalCount}</span> matching records
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1 || isPending}
                    className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-705 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:hover:bg-white cursor-pointer active:scale-[0.97]"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100/60 px-2.5 py-1.5 rounded-md border border-slate-200/60">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages || isPending}
                    className="px-3 py-1.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-705 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:hover:bg-white cursor-pointer active:scale-[0.97]"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Details View Modal */}
      {activeLead && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/60 transition-opacity backdrop-blur-xs" 
            onClick={() => setActiveLead(null)}
          />

          <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-6">
            <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-2xl border border-slate-100 flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-150 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold border uppercase tracking-wide ${getSourceStyles(activeLead.source)}`}>
                      {activeLead.source}
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      {activeLead.source.includes("Reddit") ? `r/${activeLead.subreddit || "Property"}` : `@${activeLead.author}`}
                    </span>
                  </div>
                  {activeLead.title && (
                    <h3 className="text-base font-bold text-slate-905 mt-2 leading-tight">
                      {activeLead.title}
                    </h3>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveLead(null)}
                  className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 cursor-pointer ml-4 shrink-0 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-5 overflow-y-auto space-y-4 flex-1 text-slate-800 whitespace-pre-wrap leading-relaxed text-sm break-words bg-slate-50/50">
                {activeLead.text}
              </div>

              {/* Modal Metadata Summary */}
              <div className="px-6 py-3 bg-slate-100/60 border-t border-b border-slate-150 text-xs text-slate-500 font-medium grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">City</span>
                  <span className="text-slate-800 font-semibold capitalize">{activeLead.city || "Unspecified"}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">Price / Budget</span>
                  <span className="text-slate-800 font-bold uppercase">{activeLead.price || "—"}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">Lead Type</span>
                  <span className="text-slate-805 font-bold uppercase">{activeLead.lead_type || "discussion"}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">Source Score</span>
                  <span className="text-slate-800 font-mono font-bold">{activeLead.score || 0}</span>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center flex-wrap gap-3">
                <span className="text-[11px] text-slate-400 font-mono font-medium">
                  Created: {activeLead.created_at ? new Date(activeLead.created_at).toLocaleString() : "N/A"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyUrl(activeLead.url)}
                    className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-205 text-slate-650 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                  >
                    Copy Post Link
                  </button>
                  <a
                    href={activeLead.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all active:scale-[0.98]"
                  >
                    Open Original Post
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
