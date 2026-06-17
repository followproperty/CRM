/**
 * Utility functions to format dates to Indian Standard Time (IST, Asia/Kolkata).
 */

export function formatToIST(
  date: Date | string | number | undefined | null,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }
): string {
  if (!date) return "";
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return "";

  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    ...options,
  });
}

/**
 * Formats date and time without year for smaller layouts
 */
export function formatToISTShort(date: Date | string | number | undefined | null): string {
  return formatToIST(date, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
