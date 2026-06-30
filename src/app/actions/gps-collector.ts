"use server";

// Read environment variables directly
const COM_SITE_API_URL = (process.env.COM_SITE_API_URL || "http://localhost:3001").trim();
const FIELD_COLLECTOR_API_KEY = (process.env.FIELD_COLLECTOR_API_KEY || "fp_field_collector_secret_2026_x92").trim();

/**
 * Helper for authenticated HTTP requests to the .com API.
 */
async function callComApi(path: string, options: RequestInit = {}) {
  const url = `${COM_SITE_API_URL}${path}`;
  const headers = {
    ...options.headers,
    "Authorization": `Bearer ${FIELD_COLLECTOR_API_KEY}`,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Request failed.");
  }

  return result;
}

/**
 * Fetch distinct, non-empty localities from the .com site.
 */
export async function getLocalityList(): Promise<string[]> {
  try {
    const result = await callComApi("/api/field-collector/localities", {
      cache: "no-store",
    });
    return result.localities || [];
  } catch (error: any) {
    console.error("Error fetching localities from .com API:", error);
    throw new Error(error.message || "Failed to load localities from .com backend.");
  }
}

/**
 * Fetch all projects in a specific locality from the .com site.
 */
export async function getProjectsForLocality(locality: string) {
  try {
    const result = await callComApi(
      `/api/field-collector/projects?locality=${encodeURIComponent(locality.trim())}`,
      { cache: "no-store" }
    );
    return result.projects || [];
  } catch (error: any) {
    console.error(`Error fetching projects for locality ${locality} from .com API:`, error);
    throw new Error(error.message || "Failed to load projects from .com backend.");
  }
}

/**
 * Sends coordinates and raw base64 photos to the .com API to save to the database.
 */
export async function updateProjectGpsAndPhotos(
  projectId: string,
  gps: string,
  base64Photos: string[]
) {
  try {
    const result = await callComApi("/api/field-collector/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        gps: gps.trim(),
        photos: base64Photos,
      }),
    });

    return {
      success: true,
      projectId: result.projectId,
      projectName: result.projectName,
      gps: result.gps,
      imagesCount: result.imagesCount,
    };
  } catch (error: any) {
    console.error(`Error updating project ${projectId} via .com API:`, error);
    throw new Error(error.message || "Failed to submit coordinates and images to .com backend.");
  }
}

/**
 * Fetch field collector stats from the .com site.
 */
export async function getFieldCollectorStats() {
  try {
    const result = await callComApi("/api/field-collector/stats", {
      cache: "no-store",
    });
    return result.stats;
  } catch (error: any) {
    console.error("Error fetching stats from .com API:", error);
    throw new Error(error.message || "Failed to load performance metrics from .com backend.");
  }
}
