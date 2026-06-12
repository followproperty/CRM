import React from "react";
import dbConnect from "@/lib/db";
import User from "@/models/user.model";
import { getSession } from "@/lib/session";
import CreateUserForm from "./CreateUserForm";
import UserStatusButton from "./UserStatusButton";
import { redirect } from "next/navigation";
import { IUser, UserRole } from "@/types/user";

export const metadata = {
  title: "User Management | FollowProperty CRM",
  description: "Create and manage system user credentials and roles.",
};

export default async function SuperAdminUsersPage() {
  const session = await getSession();
  if (!session || session.role !== UserRole.SUPER_ADMIN) {
    redirect("/login");
  }

  let users: IUser[] = [];
  let error: string | null = null;

  try {
    await dbConnect();
    users = (await User.find({}).sort({ createdAt: -1 }).lean()) as unknown as IUser[];
  } catch (err) {
    console.error("Failed to load users for management:", err);
    error = "Could not fetch user registry from database.";
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">User Management</h1>
        <p className="text-sm text-slate-500 mt-1">Provision user accounts and manage status states.</p>
      </div>

      {error && (
        <div className="bg-red-550/10 border border-red-500/20 text-red-700 text-sm p-4 rounded-xl flex items-center gap-3">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Grid Layout: Table on left, Form on right */}
      {!error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Table Container (2/3 width) */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">System Users ({users.length})</h2>
              <span className="text-xs text-slate-400 font-medium font-mono">Real-time DB query</span>
            </div>

            {/* Desktop Users Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 text-sm text-slate-700">
                  {users.map((user) => {
                    const isSelf = user._id?.toString() === session.userId;
                    const roleLabel = user.role.replace("_", " ");

                    return (
                      <tr key={user._id?.toString()} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{user.name}</span>
                            {isSelf && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md uppercase font-bold">
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-550">{user.email}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-0.5 rounded text-[11px] font-bold uppercase border ${
                            user.role === UserRole.SUPER_ADMIN ? "bg-purple-50 text-purple-700 border-purple-200" :
                            user.role === UserRole.ADMIN ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                            user.role === UserRole.CALLER ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            {roleLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                            user.isActive ? "text-emerald-700" : "text-red-700"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                            {user.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <UserStatusButton
                            userId={user._id?.toString() || ""}
                            isActive={user.isActive}
                            disabled={isSelf}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Users Card Layout */}
            <div className="md:hidden divide-y divide-slate-100">
              {users.map((user) => {
                const isSelf = user._id?.toString() === session.userId;
                const roleLabel = user.role.replace("_", " ");

                return (
                  <div key={user._id?.toString()} className="p-4 space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">{user.name}</span>
                          {isSelf && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-indigo-50 text-indigo-755 border border-indigo-200 rounded uppercase font-bold">
                              You
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[11px] text-slate-450 block mt-0.5 truncate">{user.email}</span>
                      </div>
                      
                      {/* Role Badge */}
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase border shrink-0 ${
                        user.role === UserRole.SUPER_ADMIN ? "bg-purple-50 text-purple-700 border-purple-200" :
                        user.role === UserRole.ADMIN ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                        user.role === UserRole.CALLER ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        {roleLabel}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs pt-2.5 border-t border-slate-100/70">
                      {/* Status */}
                      <span className={`inline-flex items-center gap-1 font-semibold ${
                        user.isActive ? "text-emerald-705" : "text-red-705"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                        {user.isActive ? "Active" : "Inactive"}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {/* Edit Button (disabled visual placeholder per guidelines) */}
                        <button
                          disabled
                          className="text-xs font-semibold px-2.5 py-1 bg-slate-50 text-slate-400 border border-slate-200 rounded-md cursor-not-allowed"
                        >
                          Edit
                        </button>
                        {/* Activate/Deactivate */}
                        <UserStatusButton
                          userId={user._id?.toString() || ""}
                          isActive={user.isActive}
                          disabled={isSelf}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form Container (1/3 width) */}
          <div className="lg:col-span-1">
            <CreateUserForm />
          </div>
        </div>
      )}
    </div>
  );
}
