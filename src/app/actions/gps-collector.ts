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
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Error fetching localities from .com API:", err);
    throw new Error(err.message || "Failed to load localities from .com backend.");
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
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`Error fetching projects for locality ${locality} from .com API:`, err);
    throw new Error(err.message || "Failed to load projects from .com backend.");
  }
}

/**
 * Fetch all projects from the .com site.
 */
export async function getAllProjects() {
  try {
    const result = await callComApi(
      "/api/field-collector/projects",
      { cache: "no-store" }
    );
    return result.projects || [];
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Error fetching all projects from .com API:", err);
    throw new Error(err.message || "Failed to load projects from .com backend.");
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
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`Error updating project ${projectId} via .com API:`, err);
    throw new Error(err.message || "Failed to submit coordinates and images to .com backend.");
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
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Error fetching stats from .com API:", err);
    throw new Error(err.message || "Failed to load performance metrics from .com backend.");
  }
}

/**
 * Search projects globally by name from the .com site.
 */
export async function searchProjectsByName(query: string) {
  try {
    const result = await callComApi(
      `/api/field-collector/search?q=${encodeURIComponent(query.trim())}`,
      { cache: "no-store" }
    );
    return result.projects || [];
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`Error searching projects for query ${query} from .com API:`, err);
    throw new Error(err.message || "Failed to search projects from .com backend.");
  }
}
