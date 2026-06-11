"use client";

import React, { useState, useTransition } from "react";
import { createUserAction } from "../../actions/users";
import { UserRole } from "@/types/user";

export default function CreateUserForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await createUserAction(formData);
      if (result.success) {
        setSuccess(true);
        form.reset();
      } else {
        setError(result.error || "An error occurred.");
      }
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-800">Create New User</h2>
        <p className="text-xs text-slate-550 mt-1">Register a new ADMIN, CALLER, or DATA_ENTRY account.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-lg flex items-center gap-2">
            <span>User account created successfully!</span>
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="name" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Name</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            disabled={isPending}
            placeholder="John Doe"
            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            disabled={isPending}
            placeholder="john@example.com"
            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            disabled={isPending}
            placeholder="••••••••"
            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="role" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Role</label>
          <select
            id="role"
            name="role"
            required
            disabled={isPending}
            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all cursor-pointer"
          >
            <option value={UserRole.CALLER}>Caller Desk</option>
            <option value={UserRole.ADMIN}>Admin / Operations</option>
            <option value={UserRole.DATA_ENTRY}>Data Entry Console</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="isActive" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</label>
          <select
            id="isActive"
            name="isActive"
            required
            disabled={isPending}
            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all cursor-pointer"
          >
            <option value="true">Active</option>
            <option value="false">Inactive / Blocked</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full flex items-center justify-center py-2.5 px-4 bg-indigo-600 hover:bg-indigo-755 disabled:bg-indigo-800/50 text-white text-sm font-semibold rounded-lg cursor-pointer hover:shadow-lg hover:shadow-indigo-500/10 transition-all active:scale-[0.98]"
        >
          {isPending ? (
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Creating User...</span>
            </div>
          ) : (
            "Create User"
          )}
        </button>
      </form>
    </div>
  );
}
