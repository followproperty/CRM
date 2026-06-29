import React from "react";
import dbConnect from "@/lib/db";
import User from "@/models/user.model";
import LoginSession from "@/models/login-session.model";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { UserRole } from "@/types/user";
import { SessionStatus } from "@/types/login-session";
import { formatToIST } from "@/lib/date";
import Link from "next/link";

export const metadata = {
  title: "Employee Session Audit | FollowProperty CRM",
  description: "Audit employee logins, logouts, session states, and request environment details.",
};

interface PageProps {
  searchParams: Promise<{
    employee?: string;
    status?: string;
    date?: string;
  }>;
}

interface PopulatedUser {
  _id: string;
  name: string;
  role: string;
}

interface PopulatedLoginSession {
  _id: string;
  userId: PopulatedUser | null;
  sessionId: string;
  loginAt: Date;
  logoutAt: Date | null;
  ipAddress: string;
  userAgent: string;
  browser: string;
  os: string;
  device: string;
  status: SessionStatus;
}

export default async function SessionAuditPage(props: PageProps) {
  const session = await getSession();
  if (!session || session.role !== UserRole.SUPER_ADMIN) {
    redirect("/login");
  }

  const searchParams = await props.searchParams;
  const filterEmployee = searchParams.employee || "";
  const filterStatus = searchParams.status || "";
  
  // Format today's date in IST (YYYY-MM-DD)
  const now = new Date();
  const istTime = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
  const todayISTStr = istTime.toISOString().split("T")[0]; // YYYY-MM-DD

  // Default to today if date is not specified (undefined or empty)
  const filterDate = searchParams.date === undefined ? todayISTStr : (searchParams.date || "");

  let employees: Array<{ _id: string; name: string }> = [];
  let sessions: PopulatedLoginSession[] = [];
  let error: string | null = null;

  try {
    await dbConnect();

    // Automatically clean up/expire all active sessions older than 4 hours database-wide
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    await LoginSession.updateMany(
      {
        status: SessionStatus.ACTIVE,
        loginAt: { $lt: fourHoursAgo },
      },
      [
        {
          $set: {
            status: SessionStatus.EXPIRED,
            logoutAt: { $add: ["$loginAt", 4 * 60 * 60 * 1000] },
          },
        },
      ],
      { updatePipeline: true }
    );

    // Retroactively populate logoutAt for already-EXPIRED sessions that have logoutAt as null
    await LoginSession.updateMany(
      {
        status: SessionStatus.EXPIRED,
        logoutAt: null,
      },
      [
        {
          $set: {
            logoutAt: { $add: ["$loginAt", 4 * 60 * 60 * 1000] },
          },
        },
      ],
      { updatePipeline: true }
    );

    const devUsers = await User.find({ isDev: true }).select("_id").lean();
    const devUserIds = devUsers.map(u => u._id);

    // 1. Fetch all employees for filter dropdown (excluding dev users)
    employees = await User.find({ isActive: true, isDev: { $ne: true } })
      .select("_id name")
      .sort({ name: 1 })
      .lean() as unknown as Array<{ _id: string; name: string }>;

    // 2. Build the query object
    const query: Record<string, unknown> = {
      userId: { $nin: devUserIds }
    };

    if (filterEmployee) {
      query.userId = filterEmployee;
    }

    if (filterStatus) {
      query.status = filterStatus;
    }

    if (filterDate) {
      const selectedDate = new Date(filterDate);
      if (!isNaN(selectedDate.getTime())) {
        // Range check for the selected day in Indian Standard Time (IST)
        // Set start of day in UTC
        const start = new Date(Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0));
        // We adjust for the IST offset (subtract 5.5 hours to align with IST start of day)
        const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
        const startUTC = new Date(start.getTime() - istOffsetMs);
        const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);

        query.loginAt = {
          $gte: startUTC,
          $lt: endUTC,
        };
      }
    }

    // 3. Query Mongoose & populate user details
    const rawSessions = await LoginSession.find(query)
      .sort({ loginAt: -1 })
      .populate("userId", "name role")
      .lean();

    sessions = rawSessions.map((s) => {
      const user = s.userId as unknown as PopulatedUser | null;
      return {
        ...s,
        _id: s._id.toString(),
        userId: user ? {
          _id: user._id.toString(),
          name: user.name,
          role: user.role,
        } : null,
      };
    }) as unknown as PopulatedLoginSession[];

  } catch (err) {
    console.error("Failed to load session audit records:", err);
    error = "Could not fetch session audit registry from database.";
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Employee Session Audit</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor system user authentication sessions, IP addresses, and device environments.
          </p>
        </div>
        <Link
          href="/super-admin"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg text-xs font-semibold shadow-sm transition-all"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      {error && (
        <div className="bg-red-550/10 border border-red-500/20 text-red-700 text-sm p-4 rounded-xl flex items-center gap-3">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {!error && (
        <div className="space-y-6">
          {/* Filters Form Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <form method="GET" action="/super-admin/sessions" className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
              {/* Employee Filter */}
              <div className="space-y-1.5">
                <label htmlFor="employee" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Employee
                </label>
                <select
                  id="employee"
                  name="employee"
                  defaultValue={filterEmployee}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all"
                >
                  <option value="">All Employees</option>
                  {employees.map((emp) => (
                    <option key={emp._id.toString()} value={emp._id.toString()}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="space-y-1.5">
                <label htmlFor="status" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Session Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={filterStatus}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all"
                >
                  <option value="">All Statuses</option>
                  <option value={SessionStatus.ACTIVE}>Active</option>
                  <option value={SessionStatus.LOGGED_OUT}>Logged Out</option>
                  <option value={SessionStatus.EXPIRED}>Expired</option>
                </select>
              </div>

              {/* Date Filter */}
              <div className="space-y-1.5">
                <label htmlFor="date" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Login Date
                </label>
                <input
                  id="date"
                  type="date"
                  name="date"
                  defaultValue={filterDate}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all text-center cursor-pointer"
                >
                  Filter
                </button>
                <Link
                  href="/super-admin/sessions"
                  className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all text-center"
                >
                  Clear
                </Link>
              </div>
            </form>
          </div>

          {/* Session Data Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">Audit Logs ({sessions.length})</h2>
              <span className="text-xs text-slate-400 font-medium font-mono">Sorted by Newest First</span>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Login Time</th>
                    <th className="px-6 py-4">Logout Time</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">IP Address</th>
                    <th className="px-6 py-4">Environment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 text-sm text-slate-700">
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-slate-400 italic py-12 text-center text-sm">
                        No login session records found matching the filters.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((s) => {
                      const employeeName = s.userId?.name || "System/Unknown User";
                      const roleLabel = s.userId?.role ? s.userId.role.replace("_", " ") : "N/A";

                      let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
                      if (s.status === SessionStatus.ACTIVE) {
                        badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-250 animate-pulse";
                      } else if (s.status === SessionStatus.LOGGED_OUT) {
                        badgeColor = "bg-indigo-50 text-indigo-700 border-indigo-250";
                      } else if (s.status === SessionStatus.EXPIRED) {
                        badgeColor = "bg-red-50 text-red-705 border-red-250";
                      }

                      return (
                        <tr key={s._id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900">{employeeName}</div>
                            <div className="text-[10px] text-slate-450 uppercase font-bold tracking-wide mt-0.5">
                              {roleLabel}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-600">
                            {formatToIST(s.loginAt)}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-600">
                            {s.logoutAt ? formatToIST(s.logoutAt) : <span className="text-slate-400 italic">Ongoing</span>}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase ${badgeColor}`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-550">
                            {s.ipAddress}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600">
                            <div className="font-semibold">{s.browser} on {s.os}</div>
                            <div className="text-slate-400 text-[10.5px] mt-0.5">{s.device} device</div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden divide-y divide-slate-100">
              {sessions.length === 0 ? (
                <div className="text-slate-400 italic py-12 text-center text-sm">
                  No login session records found matching the filters.
                </div>
              ) : (
                sessions.map((s) => {
                  const employeeName = s.userId?.name || "System/Unknown User";
                  const roleLabel = s.userId?.role ? s.userId.role.replace("_", " ") : "N/A";

                  let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
                  if (s.status === SessionStatus.ACTIVE) {
                    badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-250";
                  } else if (s.status === SessionStatus.LOGGED_OUT) {
                    badgeColor = "bg-indigo-50 text-indigo-700 border-indigo-250";
                  } else if (s.status === SessionStatus.EXPIRED) {
                    badgeColor = "bg-red-50 text-red-705 border-red-250";
                  }

                  return (
                    <div key={s._id} className="p-4 space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{employeeName}</div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">
                            {roleLabel}
                          </span>
                        </div>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase shrink-0 ${badgeColor}`}>
                          {s.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs py-2.5 border-t border-b border-slate-100">
                        <div>
                          <span className="text-slate-400 block mb-0.5">Login Time</span>
                          <span className="font-mono text-slate-700">{formatToIST(s.loginAt)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Logout Time</span>
                          <span className="font-mono text-slate-700">
                            {s.logoutAt ? formatToIST(s.logoutAt) : <span className="text-slate-400 italic">Ongoing</span>}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">IP Address</span>
                          <span className="font-mono text-slate-700">{s.ipAddress}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Platform</span>
                          <span className="text-slate-750">{s.browser} / {s.os}</span>
                        </div>
                      </div>

                      <div className="text-[10.5px] text-slate-400">
                        Device type: <span className="font-semibold text-slate-500 uppercase">{s.device}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
