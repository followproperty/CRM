"use client";

import React, { useState, useTransition } from "react";
import { login } from "../actions/auth";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await login(formData);
      if (result.success && result.redirectTo) {
        window.location.href = result.redirectTo;
      } else if (result.error) {
        setError(result.error);
      } else {
        setError("An unexpected error occurred.");
      }
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 text-slate-750 p-6 md:p-12 relative overflow-hidden">
      {/* Background radial gradient glow for aesthetics */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full z-10 space-y-8">
        {/* Branding & Subtitle */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-semibold text-indigo-700">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-550 animate-pulse" />
            CRM Portal Authentication
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700">
            Welcome to FollowProperty CRM
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Sign in to access your role-based dashboard.
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 transition-all duration-305 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-550/10 border border-red-500/20 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-bold text-slate-605 uppercase tracking-wider">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                disabled={isPending}
                placeholder="e.g. superadmin@crm.com"
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-bold text-slate-605 uppercase tracking-wider">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                disabled={isPending}
                placeholder="Enter password"
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center py-3 px-4 bg-indigo-600 hover:bg-indigo-755 disabled:bg-indigo-800/50 text-white text-sm font-semibold rounded-xl cursor-pointer hover:shadow-lg hover:shadow-indigo-500/10 transition-all active:scale-[0.98]"
            >
              {isPending ? (
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

      </div>
    </main>
  );
}
