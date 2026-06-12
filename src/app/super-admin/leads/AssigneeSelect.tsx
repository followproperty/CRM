"use client";

import React, { useTransition } from "react";
import { assignLeadAction } from "../../actions/leads";

interface EligibleUser {
  _id: string;
  name: string;
  role: string;
  activeCount?: number;
}

interface AssigneeSelectProps {
  leadId: string;
  currentAssigneeId?: string;
  eligibleUsers: EligibleUser[];
  activeCap?: number;
}

export default function AssigneeSelect({ 
  leadId, 
  currentAssigneeId = "", 
  eligibleUsers,
  activeCap = 80
}: AssigneeSelectProps) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    const targetAssigneeId = value === "" ? null : value;

    startTransition(async () => {
      const result = await assignLeadAction(leadId, targetAssigneeId);
      if (!result.success && result.error) {
        alert(result.error);
      }
    });
  }

  return (
    <div className="relative inline-block w-full min-w-[160px]">
      <select
        value={currentAssigneeId}
        disabled={isPending}
        onChange={handleChange}
        className={`w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none transition-all cursor-pointer ${
          isPending ? "opacity-50 cursor-wait" : ""
        }`}
      >
        <option value="">Unassigned</option>
        {eligibleUsers.map((user) => {
          const isCaller = user.role === "CALLER";
          const count = user.activeCount ?? 0;
          const isFull = isCaller && count >= activeCap;
          const isDisabled = isFull && user._id !== currentAssigneeId;

          return (
            <option key={user._id} value={user._id} disabled={isDisabled}>
              {user.name} ({count}/{isCaller ? activeCap : "∞"}{isFull ? " FULL" : ""})
            </option>
          );
        })}
      </select>
      {isPending && (
        <span className="absolute right-7 top-1/2 -translate-y-1/2 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
        </span>
      )}
    </div>
  );
}
