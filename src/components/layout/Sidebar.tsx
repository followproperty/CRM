"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRole } from "@/types/user";

interface SidebarProps {
  role: UserRole;
  userName?: string;
  userEmail?: string;
  onCloseMobile?: () => void;
}

interface MenuItem {
  title: string;
  href: string;
  icon: React.ReactNode;
}

export function Sidebar({ role, userName, userEmail, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  // Helper icons as SVG components
  const Icons = {
    Dashboard: () => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
      </svg>
    ),
    Users: () => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    Logs: () => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    Database: () => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
    Settings: () => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    Leads: () => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    Phone: () => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
    Analytics: () => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    Upload: () => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
    Form: () => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    Verify: () => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    Chat: () => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  };

  // Define menu items based on role
  const menuConfig: Record<UserRole, MenuItem[]> = {
    [UserRole.SUPER_ADMIN]: [
      { title: "System Overview", href: "/super-admin", icon: <Icons.Dashboard /> },
      { title: "Leads Registry", href: "/super-admin/leads", icon: <Icons.Leads /> },
      { title: "Follow-ups", href: "/super-admin/followups", icon: <Icons.Phone /> },
      { title: "Site Visits", href: "/super-admin/site-visits", icon: <Icons.Verify /> },
      { title: "WhatsApp Follow-ups", href: "/super-admin/whatsapp", icon: <Icons.Chat /> },
      { title: "User Management", href: "/super-admin/users", icon: <Icons.Users /> },
    ],
    [UserRole.ADMIN]: [
      { title: "Overview", href: "/admin", icon: <Icons.Dashboard /> },
      { title: "Leads Registry", href: "/admin/leads", icon: <Icons.Leads /> },
      { title: "Follow-ups", href: "/admin/followups", icon: <Icons.Phone /> },
      { title: "Site Visits", href: "/admin/site-visits", icon: <Icons.Verify /> },
      { title: "WhatsApp Follow-ups", href: "/admin/whatsapp", icon: <Icons.Chat /> },
    ],
    [UserRole.CALLER]: [
      { title: "My Dashboard", href: "/caller", icon: <Icons.Dashboard /> },
      { title: "Assigned Leads", href: "/caller/leads", icon: <Icons.Leads /> },
    ],
    [UserRole.DATA_ENTRY]: [
      { title: "Dashboard", href: "/data-entry", icon: <Icons.Dashboard /> },
    ],
  };

  const menuItems = menuConfig[role] || [];

  // Theme accent colors based on role (light mode pastels)
  const roleStyles: Record<UserRole, { badge: string; text: string; activeLinkBg: string; activeLinkBorder: string }> = {
    [UserRole.SUPER_ADMIN]: {
      badge: "bg-purple-50 text-purple-700 border-purple-200",
      text: "text-purple-600",
      activeLinkBg: "bg-purple-50 text-purple-700",
      activeLinkBorder: "border-l-4 border-purple-600",
    },
    [UserRole.ADMIN]: {
      badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
      text: "text-indigo-600",
      activeLinkBg: "bg-indigo-50 text-indigo-700",
      activeLinkBorder: "border-l-4 border-indigo-600",
    },
    [UserRole.CALLER]: {
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
      text: "text-emerald-600",
      activeLinkBg: "bg-emerald-50 text-emerald-700",
      activeLinkBorder: "border-l-4 border-emerald-600",
    },
    [UserRole.DATA_ENTRY]: {
      badge: "bg-amber-50 text-amber-700 border-amber-200",
      text: "text-amber-600",
      activeLinkBg: "bg-amber-50 text-amber-700",
      activeLinkBorder: "border-l-4 border-amber-600",
    },
  };

  const currentStyle = roleStyles[role] || roleStyles[UserRole.CALLER];

  return (
    <aside className="flex flex-col w-64 h-full bg-white border-r border-slate-200 text-slate-700">
      {/* Brand Header */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-200">
        <div className={`p-1.5 rounded-lg bg-gradient-to-tr from-slate-100 to-slate-50 border border-slate-200 ${currentStyle.text}`}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div>
          <h1 className="font-bold text-base text-slate-800 leading-none">FollowProperty CRM</h1>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Real Estate portal</span>
        </div>
      </div>

      {/* Role Badge */}
      <div className="px-6 py-4 border-b border-slate-100">
        <div className={`flex items-center justify-center py-1 px-3 rounded-full text-xs font-semibold border ${currentStyle.badge}`}>
          {role.replace("_", " ")}
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.title}
              href={item.href}
              onClick={onCloseMobile}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? `${currentStyle.activeLinkBg} ${currentStyle.activeLinkBorder}`
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className={`transition-colors duration-200 ${isActive ? "" : "text-slate-400 group-hover:text-slate-650"}`}>
                {item.icon}
              </span>
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Footer / Quick Info */}
      <div className="p-4 border-t border-slate-200 space-y-3">
        {role === UserRole.CALLER ? (
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-xs font-bold text-slate-700">Caller: {userName || "Agent"}</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-200">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 border border-slate-350 shrink-0">
              {(userName || "User").substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{userName || "User"}</p>
              <p className="text-[10px] text-slate-400 truncate">{userEmail || "user@system.local"}</p>
            </div>
          </div>
        )}
        <button
          onClick={async () => {
            const { logout } = await import("@/app/actions/auth");
            await logout();
            window.location.href = "/login";
          }}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-50 hover:bg-red-50 hover:text-red-650 border border-slate-200 hover:border-red-200 rounded-lg text-xs font-medium text-slate-600 cursor-pointer transition-all active:scale-[0.98]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
