import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 text-slate-750 p-6 md:p-12 relative overflow-hidden">
      {/* Background radial gradient glow for aesthetics */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl w-full z-10 space-y-10">
        {/* Branding & Subtitle */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-semibold text-indigo-700">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-550 animate-pulse" />
            Dashboard Architecture Ready
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-805 to-slate-700">
            FollowProperty CRM
          </h1>
          <p className="text-base text-slate-500 max-w-lg mx-auto font-medium">
            Next.js 15 Role-Based Portal Architecture. Select a dashboard interface to inspect the responsive layouts, sidebar menus, and dashboard views.
          </p>
        </div>

        {/* Portals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Super Admin */}
          <Link href="/super-admin" className="group relative bg-white hover:bg-slate-50/50 border border-slate-200 hover:border-purple-300 rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between hover:shadow-xl hover:shadow-purple-500/5">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-xs px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200">
                  Super Admin
                </span>
                <span className="text-slate-400 group-hover:text-purple-600 transition-colors">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-805">System Diagnostics Portal</h2>
              <p className="text-xs text-slate-550 leading-relaxed font-medium">
                Access server resource monitoring, Mongo connectivity stats, log rotation scripts, and admin user credentials.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs text-purple-650 font-semibold gap-1 group-hover:translate-x-1 transition-transform">
              Launch Dashboard &rarr;
            </div>
          </Link>

          {/* Admin */}
          <Link href="/admin" className="group relative bg-white hover:bg-slate-50/50 border border-slate-200 hover:border-indigo-300 rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between hover:shadow-xl hover:shadow-indigo-500/5">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-xs px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200">
                  Admin
                </span>
                <span className="text-slate-400 group-hover:text-indigo-650 transition-colors">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-805">Operations & Caller Manager</h2>
              <p className="text-xs text-slate-555 leading-relaxed font-medium">
                Monitor caller activity queue, allocate leads to callers, track team performance KPIs, and view channel conversions.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs text-indigo-650 font-semibold gap-1 group-hover:translate-x-1 transition-transform">
              Launch Dashboard &rarr;
            </div>
          </Link>

          {/* Caller */}
          <Link href="/caller" className="group relative bg-white hover:bg-slate-50/50 border border-slate-200 hover:border-emerald-300 rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between hover:shadow-xl hover:shadow-emerald-500/5">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-xs px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200">
                  Caller
                </span>
                <span className="text-slate-400 group-hover:text-emerald-600 transition-colors">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-805">Caller Desk</h2>
              <p className="text-xs text-slate-555 leading-relaxed font-medium">
                View assigned daily leads queue, launch phone client panel, log feedback comments, and view callback reminders.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs text-emerald-650 font-semibold gap-1 group-hover:translate-x-1 transition-transform">
              Launch Dashboard &rarr;
            </div>
          </Link>

          {/* Data Entry */}
          <Link href="/data-entry" className="group relative bg-white hover:bg-slate-50/50 border border-slate-200 hover:border-amber-300 rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between hover:shadow-xl hover:shadow-amber-500/5">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-xs px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200">
                  Data Entry
                </span>
                <span className="text-slate-400 group-hover:text-amber-600 transition-colors">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a2 2 0 00-2-2H5a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v8m-6 0a2 2 0 002 2h2a2 2 0 002-2m-6 0V9a2 2 0 002-2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-805">Lead Ingestion Console</h2>
              <p className="text-xs text-slate-555 leading-relaxed font-medium">
                Upload raw xlsx/csv caller lists, parse and dry-run validate sheet fields, and inspect recent file submission histories.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs text-amber-650 font-semibold gap-1 group-hover:translate-x-1 transition-transform">
              Launch Dashboard &rarr;
            </div>
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 pt-4 border-t border-slate-200">
          Tailwind CSS v4 • Next.js 15 App Router
        </div>
      </div>
    </main>
  );
}
