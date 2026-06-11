"use client";

import { useState, useEffect, useTransition } from "react";
import { Sidebar } from "./Sidebar";
import { UserRole } from "@/types/user";
import {
  getMyNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/app/actions/notifications";
import { getLeadByIdAction } from "@/app/actions/leads";
import LeadDetailsModal from "@/components/leads/LeadDetailsModal";
import { ILead } from "@/types/lead";

interface ClientNotification {
  _id: string;
  title: string;
  message: string;
  userId: string;
  leadId?: string;
  isRead: boolean;
  createdAt: string;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: UserRole;
  userName?: string;
  userEmail?: string;
}

export function DashboardLayout({ children, role, userName, userEmail }: DashboardLayoutProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<ILead | null>(null);
  const [isPending, startTransition] = useTransition();

  // Load & poll notifications
  useEffect(() => {
    let active = true;

    const fetchNotifications = async () => {
      const result = await getMyNotificationsAction();
      if (active && result.success && result.notifications) {
        setNotifications(result.notifications);
        setUnreadCount(result.unreadCount ?? 0);
      }
    };

    fetchNotifications();

    const interval = setInterval(fetchNotifications, 30000); // 30s poll
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Click outside to close notifications dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".notif-dropdown-container")) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    startTransition(async () => {
      const result = await markNotificationReadAction(id);
      if (result.success) {
        setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    });
  };

  const handleMarkAllAsRead = async () => {
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (result.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    });
  };

  const handleNotificationClick = async (n: ClientNotification) => {
    if (!n.isRead) {
      await handleMarkAsRead(n._id);
    }
    if (n.leadId) {
      const result = await getLeadByIdAction(n.leadId);
      if (result.success && result.lead) {
        setSelectedLead(result.lead);
        setIsNotifOpen(false); // Close dropdown
      }
    }
  };

  function formatTime(dateStr: string) {
    try {
      const date = new Date(dateStr);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  }

  // Styling helper for headers depending on roles
  const themeAccent: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: "from-purple-500 to-transparent",
    [UserRole.ADMIN]: "from-indigo-500 to-transparent",
    [UserRole.CALLER]: "from-emerald-500 to-transparent",
    [UserRole.DATA_ENTRY]: "from-amber-500 to-transparent",
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800 font-sans">
      {/* Desktop Sidebar (Left side, fixed width) */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar role={role} userName={userName} userEmail={userEmail} />
      </div>

      {/* Mobile Drawer Overlay Backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-600/40 backdrop-blur-xs md:hidden transition-opacity duration-300"
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 md:hidden transform transition-transform duration-300 ease-in-out ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar role={role} userName={userName} userEmail={userEmail} onCloseMobile={() => setIsMobileOpen(false)} />
      </div>

      {/* Main Container */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between px-6 border-b border-slate-200 bg-white backdrop-blur-md relative z-10">
          <div className="flex items-center gap-4">
            {/* Hamburger Button for mobile */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 md:hidden transition-colors"
              aria-label="Open sidebar"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Quick role-specific glow indicator */}
            <div className={`absolute left-0 bottom-0 right-0 h-[1.5px] bg-gradient-to-r ${themeAccent[role]}`} />
          </div>

          {/* User tools / Quick switcher for developers to test different dashboards */}
          <div className="flex items-center gap-4">
            {/* Bell Notifications */}
            <div className="relative notif-dropdown-container">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                aria-label="View notifications"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-extrabold text-white animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden z-50 animate-fade-in">
                  {/* Dropdown Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        disabled={isPending}
                        className="text-xs font-semibold text-cyan-600 hover:text-cyan-850 hover:underline cursor-pointer"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  {/* Dropdown Body */}
                  <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400 italic">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n._id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-4 flex gap-3 hover:bg-slate-50 transition-colors cursor-pointer relative group ${
                            !n.isRead ? "bg-slate-50/50" : ""
                          }`}
                        >
                          {/* Unread indicator */}
                          {!n.isRead && (
                            <span className="absolute left-3 top-5 w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                          )}
                          
                          <div className="flex-1 min-w-0 pl-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-xs font-bold truncate ${!n.isRead ? "text-slate-850" : "text-slate-500"}`}>
                                {n.title}
                              </span>
                              <span className="text-[9px] text-slate-400 shrink-0 font-mono">
                                {formatTime(n.createdAt)}
                              </span>
                            </div>
                            <p className={`text-xs mt-1 leading-relaxed ${!n.isRead ? "text-slate-700" : "text-slate-500"}`}>
                              {n.message}
                            </p>
                            {n.leadId && (
                              <span className="inline-flex text-[9px] font-bold text-cyan-600 mt-1.5 hover:underline">
                                View Lead Details →
                              </span>
                            )}
                          </div>

                          {/* Individual read toggle */}
                          {!n.isRead && (
                            <button
                              onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsRead(n._id);
                              }}
                              title="Mark as read"
                              disabled={isPending}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-cyan-600 hover:bg-slate-100 rounded-lg transition-all self-start shrink-0 cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* User Info Header Dropdown Mockup */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 p-1.5 rounded-lg">
                <span className="w-8 h-8 rounded-lg bg-slate-150 flex items-center justify-center font-bold text-xs border border-slate-200 text-slate-700">
                  {(userName || "User").substring(0, 2).toUpperCase()}
                </span>
                <span className="hidden md:block text-sm font-medium text-slate-650">{userName || "User"}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Main Content Scroll Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6 relative">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
      {selectedLead && (
        <LeadDetailsModal
          leadId={selectedLead._id ? selectedLead._id.toString() : ""}
          lead={selectedLead}
          isOpen={!!selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </div>
  );
}
