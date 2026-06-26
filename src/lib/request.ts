import { headers } from "next/headers";

export interface RequestMetadata {
  ip: string;
  userAgent: string;
  browser: string;
  os: string;
  device: string;
}

/**
 * Resolves request metadata (IP, user agent, browser, OS, and device type)
 * from the current Next.js server context.
 */
export async function getClientRequestMetadata(): Promise<RequestMetadata> {
  const headerList = await headers();

  // 1. Resolve client IP address with fallbacks
  const xForwardedFor = headerList.get("x-forwarded-for");
  const ip = xForwardedFor
    ? xForwardedFor.split(",")[0].trim()
    : headerList.get("x-real-ip") ||
      headerList.get("cf-connecting-ip") ||
      headerList.get("x-vercel-forwarded-for") ||
      "127.0.0.1";

  // 2. Fetch raw User-Agent
  const userAgent = headerList.get("user-agent") || "unknown";

  // 3. Simple, lightweight parser to avoid heavy external dependencies
  const { browser, os, device } = parseUserAgent(userAgent);

  return { ip, userAgent, browser, os, device };
}

function parseUserAgent(ua: string) {
  let browser = "Unknown Browser";
  let os = "Unknown OS";
  let device = "Desktop";

  // Browser Detection
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr|opios/i.test(ua)) {
    browser = "Chrome";
  } else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) {
    browser = "Safari";
  } else if (/firefox|fxios/i.test(ua)) {
    browser = "Firefox";
  } else if (/edge|edg/i.test(ua)) {
    browser = "Edge";
  } else if (/opr|opios/i.test(ua)) {
    browser = "Opera";
  }

  // OS Detection
  if (/windows/i.test(ua)) {
    os = "Windows";
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = "macOS";
  } else if (/android/i.test(ua)) {
    os = "Android";
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = "iOS";
  } else if (/linux/i.test(ua)) {
    os = "Linux";
  }

  // Device Detection
  if (/mobi|android|iphone|ipod/i.test(ua)) {
    device = "Mobile";
  } else if (/ipad|tablet/i.test(ua)) {
    device = "Tablet";
  }

  return { browser, os, device };
}
