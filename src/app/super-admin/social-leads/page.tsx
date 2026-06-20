/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { redirect } from "next/navigation";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { getSession } from "@/lib/session";
import { UserRole } from "@/types/user";
import SocialLeadsTable from "./SocialLeadsTable";

export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{
    search?: string;
    source?: string;
    lead_type?: string;
    city?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function SuperAdminSocialLeadsPage({ searchParams }: PageProps) {
  // 1. Role Verification Guard
  const session = await getSession();
  if (!session || session.role !== UserRole.SUPER_ADMIN) {
    redirect("/login");
  }

  const params = await searchParams;
  const search = params.search || "";
  const sourceFilter = params.source || "ALL";
  const leadTypeFilter = params.lead_type || "ALL";
  const cityFilter = params.city || "ALL";
  const sortFilter = params.sort || "NEWEST";
  const currentPage = Math.max(1, parseInt(params.page || "1") || 1);
  const LIMIT = 20;

  let leads: any[] = [];
  let totalCount = 0;
  let redditCount = 0;
  let ncrCount = 0;
  let twitterCount = 0;
  let totalSocialLeads = 0;
  let cities: string[] = [];
  let leadTypes: string[] = [];
  let error: string | null = null;

  try {
    // 2. Connect and Switch DB
    await dbConnect();
    const scraperDb = (mongoose.connection as any).client.db("property_leads");

    // 3. Live counts for metric cards
    const [rc, nc, tc] = await Promise.all([
      scraperDb.collection("reddit_leads").countDocuments(),
      scraperDb.collection("ncr_reddit_leads").countDocuments(),
      scraperDb.collection("twitter_leads").countDocuments()
    ]);
    redditCount = rc;
    ncrCount = nc;
    twitterCount = tc;
    totalSocialLeads = rc + nc + tc;

    // 4. Dynamic City Extraction from all 3 collections
    const [redditCities, ncrCities, twitterCities] = await Promise.all([
      scraperDb.collection("reddit_leads").distinct("city"),
      scraperDb.collection("ncr_reddit_leads").distinct("city"),
      scraperDb.collection("twitter_leads").distinct("city")
    ]);
    
    cities = Array.from(
      new Set(
        [...redditCities, ...ncrCities, ...twitterCities]
          .filter(Boolean)
          .map((c) => String(c).toLowerCase().trim())
          .filter((c) => c !== "null" && c !== "")
      )
    ).sort();

    // 5. Dynamic Lead Types Extraction
    const [redditTypes, ncrTypes, twitterTypes] = await Promise.all([
      scraperDb.collection("reddit_leads").distinct("lead_type"),
      scraperDb.collection("ncr_reddit_leads").distinct("lead_type"),
      scraperDb.collection("twitter_leads").distinct("lead_type")
    ]);
    
    leadTypes = Array.from(
      new Set(
        [...redditTypes, ...ncrTypes, ...twitterTypes]
          .filter(Boolean)
          .map((t) => String(t).toLowerCase().trim())
          .filter((t) => t !== "null" && t !== "")
      )
    ).sort();

    // 6. Unified Aggregation Pipeline
    const redditLeadsCol = scraperDb.collection("reddit_leads");
    const pipeline: any[] = [
      // Primary projection for reddit_leads
      {
        $project: {
          _id: 1,
          source: { $literal: "Reddit" },
          author: "$subreddit",
          reddit_id: "$reddit_id",
          subreddit: "$subreddit",
          title: "$title",
          text: "$text",
          city: "$city",
          price: "$price",
          bhk: "$bhk",
          score: "$score",
          lead_type: "$lead_type",
          created_at: { $toDate: { $multiply: ["$reddit_created_utc", 1000] } },
          url: "$url"
        }
      },
      // Union with ncr_reddit_leads
      {
        $unionWith: {
          coll: "ncr_reddit_leads",
          pipeline: [
            {
              $project: {
                _id: 1,
                source: { $literal: "NCR Reddit" },
                author: "$subreddit",
                reddit_id: "$reddit_id",
                subreddit: "$subreddit",
                title: "$title",
                text: "$text",
                city: "$city",
                price: "$price",
                bhk: "$bhk",
                score: "$score",
                lead_type: "$lead_type",
                created_at: { $toDate: { $multiply: ["$reddit_created_utc", 1000] } },
                url: "$url"
              }
            }
          ]
        }
      },
      // Union with twitter_leads
      {
        $unionWith: {
          coll: "twitter_leads",
          pipeline: [
            {
              $project: {
                _id: 1,
                source: { $literal: "Twitter" },
                author: "$username",
                reddit_id: { $literal: null },
                subreddit: { $literal: null },
                title: { $literal: "" },
                text: "$content",
                city: "$city",
                price: "$price",
                bhk: { $literal: null },
                score: "$score",
                lead_type: "$lead_type",
                created_at: "$created_at",
                url: "$url"
              }
            }
          ]
        }
      }
    ];

    // 7. Apply Filters Post-Union
    const matchStage: any = {};

    if (search) {
      matchStage.$or = [
        { title: { $regex: search, $options: "i" } },
        { text: { $regex: search, $options: "i" } }
      ];
    }

    if (sourceFilter && sourceFilter !== "ALL") {
      matchStage.source = sourceFilter;
    }

    if (leadTypeFilter && leadTypeFilter !== "ALL") {
      matchStage.lead_type = leadTypeFilter;
    }

    if (cityFilter && cityFilter !== "ALL") {
      matchStage.city = { $regex: `^${cityFilter}$`, $options: "i" };
    }

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // 8. Sorting
    let sortStage: any = { created_at: -1 };
    if (sortFilter === "OLDEST") {
      sortStage = { created_at: 1 };
    } else if (sortFilter === "HIGHEST_SCORE") {
      sortStage = { score: -1 };
    }
    pipeline.push({ $sort: sortStage });

    // 9. Fetch Total Count of Filtered Records
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await redditLeadsCol.aggregate(countPipeline).toArray();
    totalCount = countResult.length > 0 ? countResult[0].total : 0;

    // 10. Fetch Paginated Records using lean raw projection
    const paginatedPipeline = [
      ...pipeline,
      { $skip: (currentPage - 1) * LIMIT },
      { $limit: LIMIT }
    ];

    const rawLeadsDocs = await redditLeadsCol.aggregate(paginatedPipeline).toArray();
    leads = rawLeadsDocs.map((doc: any) => ({
      ...doc,
      _id: doc._id.toString(),
      created_at: doc.created_at ? new Date(doc.created_at).toISOString() : null
    }));

  } catch (err) {
    console.error("Failed to query social leads:", err);
    error = "Could not load scraped feeds from the property_leads database.";
  }

  const totalPages = Math.ceil(totalCount / LIMIT);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Social Leads</h1>
        <p className="text-sm text-slate-500 mt-1">Read-only monitoring dashboard for scraped Reddit posts and Twitter tweets.</p>
      </div>

      {error && (
        <div className="bg-red-550/10 border border-red-500/20 text-red-700 text-sm p-4 rounded-xl flex items-center gap-3">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {!error && (
        <SocialLeadsTable
          leads={leads}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          redditCount={redditCount}
          ncrCount={ncrCount}
          twitterCount={twitterCount}
          totalSocialLeads={totalSocialLeads}
          cities={cities}
          leadTypes={leadTypes}
        />
      )}
    </div>
  );
}
