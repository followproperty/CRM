"use client";

import React, { useTransition } from "react";
import { toggleUserStatusAction } from "../../actions/users";

interface UserStatusButtonProps {
  userId: string;
  isActive: boolean;
  disabled: boolean;
}

export default function UserStatusButton({ userId, isActive, disabled }: UserStatusButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    if (disabled || isPending) return;

    startTransition(async () => {
      const result = await toggleUserStatusAction(userId, isActive);
      if (!result.success && result.error) {
        alert(result.error);
      }
    });
  }

  if (disabled) {
    return (
      <span className="text-xs text-slate-400 font-semibold px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md cursor-not-allowed">
        Self Account
      </span>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`text-xs font-semibold px-2.5 py-1 rounded-md border cursor-pointer active:scale-[0.95] transition-all flex items-center gap-1.5 ${
        isActive
          ? "bg-red-50 text-red-750 border-red-200 hover:bg-red-100"
          : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
      }`}
    >
      {isPending ? (
        <>
          <span className="w-3.5 h-3.5 border-2 border-slate-350 border-t-slate-600 rounded-full animate-spin" />
          <span>Updating...</span>
        </>
      ) : isActive ? (
        "Deactivate"
      ) : (
        "Activate"
      )}
    </button>
  );
}
