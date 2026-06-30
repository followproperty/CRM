"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  getLocalityList,
  getProjectsForLocality,
  updateProjectGpsAndPhotos,
  getFieldCollectorStats,
} from "@/app/actions/gps-collector";

interface ProjectItem {
  _id: string;
  projectName: string;
  location: string;
  locality: string;
  city: string;
  state: string;
  gps: string;
  images: string[];
  status: string;
  isCompleted: boolean;
}

interface StatsData {
  total: number;
  completed: number;
  remaining: number;
  completedToday: number;
}

interface GpsCollectorClientProps {
  userName: string;
}

export default function GpsCollectorClient({ userName }: GpsCollectorClientProps) {
  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<"collect" | "performance">("collect");

  // Collect tab state
  const [localities, setLocalities] = useState<string[]>([]);
  const [selectedLocality, setSelectedLocality] = useState<string>("");
  const [searchLocality, setSearchLocality] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);

  // GPS state
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isCapturingGps, setIsCapturingGps] = useState<boolean>(false);

  // Photos state
  const [photos, setPhotos] = useState<{ id: string; file: File; preview: string; base64: string }[]>([]);
  const [notes, setNotes] = useState<string>("");

  // Stats tab state
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  // General loading/error
  const [isPending, startTransition] = useTransition();
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load distinct localities on mount
  useEffect(() => {
    startTransition(async () => {
      try {
        const list = await getLocalityList();
        setLocalities(list);
        if (list.length > 0) {
          const defaultLoc = list.includes("Sector 89") ? "Sector 89" : list[0];
          setSelectedLocality(defaultLoc);
          setSearchLocality(defaultLoc);
        }
      } catch (err) {
        setErrorMessage("Failed to load localities from database.");
      }
    });
  }, []);

  // Fetch stats on mount and whenever tab switches to "performance"
  const loadStats = () => {
    startTransition(async () => {
      try {
        setStatsError(null);
        const data = await getFieldCollectorStats();
        setStats(data);
      } catch (err: any) {
        setStatsError(err.message || "Failed to load performance metrics.");
      }
    });
  };

  useEffect(() => {
    if (activeTab === "performance") {
      loadStats();
    }
  }, [activeTab]);

  // Fetch projects when locality changes
  useEffect(() => {
    if (!selectedLocality) return;
    
    setSelectedProject(null);
    clearEntryForm();

    startTransition(async () => {
      try {
        const data = await getProjectsForLocality(selectedLocality);
        setProjects(data);
      } catch (err) {
        setErrorMessage("Failed to load projects for this locality.");
      }
    });
  }, [selectedLocality]);

  // Load draft from localStorage on project selection
  useEffect(() => {
    if (!selectedProject) return;

    const draftKey = `gps_draft_${selectedProject._id}`;
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        setLatitude(draft.latitude || null);
        setLongitude(draft.longitude || null);
        setGpsAccuracy(draft.gpsAccuracy || null);
        setNotes(draft.notes || "");
        setPhotos(draft.photos || []);
      } catch (e) {
        console.error("Error parsing saved draft", e);
      }
    } else {
      clearEntryForm();
    }
  }, [selectedProject]);

  // Save draft to localStorage whenever coordinate or photos change
  useEffect(() => {
    if (!selectedProject) return;

    const draftKey = `gps_draft_${selectedProject._id}`;
    if (latitude || longitude || photos.length > 0 || notes) {
      const draft = {
        latitude,
        longitude,
        gpsAccuracy,
        notes,
        photos,
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [latitude, longitude, gpsAccuracy, photos, notes, selectedProject]);

  const clearEntryForm = () => {
    setLatitude(null);
    setLongitude(null);
    setGpsAccuracy(null);
    setGpsError(null);
    setPhotos([]);
    setNotes("");
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const deleteDraft = (projectId: string) => {
    localStorage.removeItem(`gps_draft_${projectId}`);
  };

  // Get GPS Coordinates using browser API
  const captureGps = () => {
    setIsCapturingGps(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      setIsCapturingGps(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setGpsAccuracy(position.coords.accuracy);
        setIsCapturingGps(false);
      },
      (error) => {
        console.error("GPS error:", error);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError("Permission denied. Please allow location access in your browser settings.");
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsError("Location information is unavailable. Try turning on device location service.");
            break;
          case error.TIMEOUT:
            setGpsError("Request timed out. Please try again.");
            break;
          default:
            setGpsError("An unknown error occurred while retrieving coordinates.");
        }
        setIsCapturingGps(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Handle Photo Selection
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (photos.some((p) => p.file.name === file.name && p.file.size === file.size)) {
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPhotos((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            file,
            preview: URL.createObjectURL(file),
            base64,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Remove photo from queue
  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      const removed = prev.find((p) => p.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return filtered;
    });
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    if (!latitude || !longitude) {
      setErrorMessage("Please capture the GPS coordinates first.");
      return;
    }

    if (photos.length < 4) {
      setErrorMessage(`Please upload at least 4 photos (current: ${photos.length}).`);
      return;
    }

    setUploadStatus("Uploading photos and saving to database...");
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const gpsStr = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
        const base64Photos = photos.map((p) => p.base64);
        
        const result = await updateProjectGpsAndPhotos(selectedProject._id, gpsStr, base64Photos);

        setProjects((prev) =>
          prev.map((proj) =>
            proj._id === selectedProject._id
              ? { ...proj, gps: gpsStr, images: new Array(result.imagesCount).fill(""), isCompleted: true }
              : proj
          )
        );

        setSuccessMessage("Project coordinates and images updated successfully!");
        deleteDraft(selectedProject._id);
        
        setTimeout(() => {
          setSelectedProject(null);
          clearEntryForm();
        }, 1500);

      } catch (err: any) {
        setErrorMessage(err.message || "An error occurred during submission.");
      } finally {
        setUploadStatus("");
      }
    });
  };

  const filteredLocalities = localities.filter((loc) =>
    loc.toLowerCase().includes(searchLocality.toLowerCase())
  );

  return (
    <div className="bg-slate-50 text-slate-800 p-3 md:p-6 pb-20 font-sans min-h-[85vh]">
      {/* Top Polish Tabs Switcher */}
      <div className="flex bg-slate-200/60 p-1.5 rounded-xl max-w-sm mb-6 border border-slate-200">
        <button
          onClick={() => setActiveTab("collect")}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all duration-200 text-center cursor-pointer ${
            activeTab === "collect"
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          📍 Collect Data
        </button>
        <button
          onClick={() => setActiveTab("performance")}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all duration-200 text-center cursor-pointer ${
            activeTab === "performance"
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          📈 My Performance
        </button>
      </div>

      {activeTab === "collect" ? (
        <>
          {/* Geotag Reminder Banner with Dynamic Name */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4.5 mb-6 shadow-sm animate-fade-in">
            <div className="flex gap-3 items-start">
              <span className="text-xl">💡</span>
              <div>
                <h4 className="font-bold text-amber-800 text-sm">Action Required: Geotag Verification</h4>
                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                  Hi <strong>{userName}</strong>, please ensure that <strong>Geotagging (Location Services)</strong> is enabled in your phone's native Camera settings. This will store the GPS coordinates inside the clicked images for backend verification.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Side: Locality Finder */}
            <div className={`lg:col-span-5 ${selectedProject ? "hidden lg:block" : "block"}`}>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-xs">
                <h2 className="text-base md:text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  📍 Locality Finder
                </h2>
                
                {/* Custom Locality Autocomplete Search */}
                <div className="relative mt-3 z-30">
                  <input
                    type="text"
                    placeholder="Type locality (e.g. Sector 89)..."
                    value={searchLocality}
                    onChange={(e) => {
                      setSearchLocality(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    className="w-full bg-white border border-slate-350 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 text-slate-900 placeholder-slate-400 shadow-2xs"
                  />
                  
                  {isDropdownOpen && filteredLocalities.length > 0 && (
                    <ul className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-40">
                      {filteredLocalities.map((loc) => (
                        <li
                          key={loc}
                          onClick={() => {
                            setSelectedLocality(loc);
                            setSearchLocality(loc);
                            setIsDropdownOpen(false);
                          }}
                          className={`px-4 py-3.5 text-sm cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-0 ${
                            selectedLocality === loc ? "bg-indigo-50 text-indigo-700 font-bold" : "text-slate-700"
                          }`}
                        >
                          {loc}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Total count details */}
                {selectedLocality && (
                  <div className="flex justify-between items-center mt-6 mb-3">
                    <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                      Projects in {selectedLocality}
                    </span>
                    <span className="text-[11px] bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 font-medium">
                      {projects.filter((p) => p.isCompleted).length} / {projects.length} Done
                    </span>
                  </div>
                )}

                {/* Projects List */}
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {projects.length === 0 && selectedLocality && (
                    <div className="text-center py-10 text-slate-400 text-sm">
                      No projects found in this locality.
                    </div>
                  )}
                  {projects.map((proj) => (
                    <div
                      key={proj._id}
                      onClick={() => setSelectedProject(proj)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex justify-between items-center ${
                        selectedProject?._id === proj._id
                          ? "bg-indigo-50/50 border-indigo-400 shadow-2xs"
                          : "bg-white border-slate-200 hover:bg-slate-50/50 hover:border-slate-350"
                      }`}
                    >
                      <div className="space-y-0.5 pr-3 flex-1 min-w-0">
                        <h4 className="font-bold text-slate-800 text-sm leading-snug truncate">{proj.projectName}</h4>
                        <p className="text-slate-500 text-xs truncate">{proj.location}</p>
                      </div>
                      <span
                        className={`text-[10px] px-2.5 py-1 rounded-md font-bold flex-shrink-0 ${
                          proj.isCompleted
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-250"
                            : "bg-amber-50 text-amber-700 border border-amber-250"
                        }`}
                      >
                        {proj.isCompleted ? "🟢 Completed" : "🟡 Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Side: Data Collection Form */}
            <div className={`lg:col-span-7 ${!selectedProject ? "hidden lg:block" : "block"}`}>
              {selectedProject ? (
                <form
                  onSubmit={handleSubmit}
                  className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-xs space-y-6 flex flex-col min-h-[550px]"
                >
                  {/* Form Header */}
                  <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                    <div className="space-y-1 min-w-0 flex-1 pr-3">
                      <span className="text-[9px] uppercase font-extrabold tracking-widest text-indigo-650">
                        Active Ingestion Form
                      </span>
                      <h2 className="text-lg md:text-xl font-extrabold text-slate-900 leading-tight truncate">
                        {selectedProject.projectName}
                      </h2>
                      <p className="text-xs text-slate-500 truncate">
                        {selectedProject.location || selectedProject.locality}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProject(null)}
                      className="bg-slate-100 hover:bg-slate-250 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                    >
                      ← Back
                    </button>
                  </div>

                  {/* Status Banner */}
                  {selectedProject.isCompleted && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-2.5">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <div>
                        <h5 className="font-bold text-xs text-emerald-800">Project Already Geotagged</h5>
                        <p className="text-[10.5px] text-emerald-700 mt-0.5">
                          GPS coordinates are set to <code>{selectedProject.gps}</code> with {selectedProject.images.length} photos. Re-submission will update database records.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 1. GPS Coordinates */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                    <h3 className="font-bold text-xs text-slate-450 uppercase tracking-widest">
                      1. High-Accuracy Location Coordinate
                    </h3>
                    
                    {latitude && longitude ? (
                      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
                        <p className="text-[9px] text-indigo-600 uppercase font-bold tracking-wider">
                          Current Coordinates Locked
                        </p>
                        <p className="text-base md:text-lg font-mono font-bold text-indigo-700 mt-1">
                          {latitude.toFixed(6)}, {longitude.toFixed(6)}
                        </p>
                        {gpsAccuracy && (
                          <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                            Accuracy: ±{gpsAccuracy.toFixed(1)} meters
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="border border-dashed border-slate-300 rounded-xl py-6 text-center text-slate-400 text-xs md:text-sm bg-white">
                        No coordinates locked yet. Use the capture button below.
                      </div>
                    )}

                    {gpsError && (
                      <div className="bg-rose-50 border border-rose-250 rounded-xl p-3 text-rose-700 text-xs">
                        ⚠️ {gpsError}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={captureGps}
                      disabled={isCapturingGps}
                      className="w-full bg-indigo-650 hover:bg-indigo-600 text-white font-bold py-3.5 px-4 rounded-xl text-xs md:text-sm transition-all duration-200 shadow-2xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCapturingGps ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Locking GPS signal...
                        </>
                      ) : (
                        <>📍 Capture Current GPS Location</>
                      )}
                    </button>
                  </div>

                  {/* 2. Photo Upload Box */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-xs text-slate-450 uppercase tracking-widest">
                        2. Add Building Photographs
                      </h3>
                      <span className="text-[11px] font-bold text-slate-600">
                        {photos.length} / 5 Photos
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {/* Photo Thumbnails */}
                      {photos.map((photo) => (
                        <div
                          key={photo.id}
                          className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group bg-white"
                        >
                          <img
                            src={photo.preview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(photo.id)}
                            className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full text-xs shadow-md transition-colors cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}

                      {/* Add Photo Button */}
                      {photos.length < 5 && (
                        <label className="aspect-square border-2 border-dashed border-slate-350 hover:border-indigo-500 rounded-xl flex flex-col justify-center items-center gap-1 cursor-pointer bg-white hover:bg-slate-50 transition-colors">
                          <span className="text-xl text-slate-400">＋</span>
                          <span className="text-[10px] font-bold text-slate-450">Camera / File</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            capture="environment"
                            onChange={handlePhotoChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    <p className="text-[10.5px] text-slate-450 mt-1 leading-snug">
                      * Capture at least 4 photos showing different angles, facades, or viewpoints of the property.
                    </p>
                  </div>

                  {/* 3. Notes */}
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase font-bold text-slate-450 tracking-wider">3. Observations / Field Notes</label>
                    <textarea
                      placeholder="Example: Gate locked. Clicked photos from Sector road side."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 text-slate-900 placeholder-slate-400 h-20 resize-none shadow-2xs"
                    />
                  </div>

                  {/* Error and Success Notifications */}
                  {errorMessage && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-xs font-medium">
                      Error: {errorMessage}
                    </div>
                  )}
                  {successMessage && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl text-xs font-medium">
                      {successMessage}
                    </div>
                  )}

                  {/* Submit Buttons */}
                  <div className="pt-2 mt-auto">
                    <button
                      type="submit"
                      disabled={isPending || !latitude || !longitude || photos.length < 4}
                      className="w-full bg-emerald-650 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-4 rounded-xl text-xs md:text-sm transition-all duration-200 shadow-2xs flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>{uploadStatus || "Updating records..."}</span>
                        </>
                      ) : (
                        <>✓ Submit to .com Site Database</>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-10 text-center flex flex-col justify-center items-center gap-4 text-slate-400 min-h-[550px] shadow-xs">
                  <span className="text-4xl animate-bounce">📱</span>
                  <div>
                    <h3 className="font-bold text-slate-700 text-sm">No Project Selected</h3>
                    <p className="text-xs text-slate-450 mt-1 max-w-[280px] mx-auto leading-relaxed">
                      Choose a locality from the left-side list, and click on any pending project to begin coordinates and photograph submission.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Performance Dashboard Tab */
        <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-8 shadow-xs space-y-8 animate-fade-in">
          <div className="border-b border-slate-100 pb-5">
            <h2 className="text-lg md:text-xl font-extrabold text-slate-900 tracking-tight">
              📈 My Collection Performance
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Live tracking metrics for geotagged residential and commercial projects in Gurgaon database.
            </p>
          </div>

          {statsError && (
            <div className="bg-rose-50 border border-rose-250 rounded-xl p-4 text-rose-700 text-xs">
              ⚠️ {statsError}
            </div>
          )}

          {isPending && !stats ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <div className="w-8 h-8 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Fetching real-time metrics...</p>
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              {/* Circular Completion Ring */}
              <div className="md:col-span-4 flex flex-col items-center justify-center text-center p-4">
                <div className="relative w-36 h-36 flex items-center justify-center">
                  {/* SVG Ring */}
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="72"
                      cy="72"
                      r="60"
                      className="stroke-slate-100 fill-none"
                      strokeWidth="10"
                    />
                    <circle
                      cx="72"
                      cy="72"
                      r="60"
                      className="stroke-indigo-650 fill-none transition-all duration-1000 ease-out"
                      strokeWidth="10"
                      strokeDasharray={2 * Math.PI * 60}
                      strokeDashoffset={
                        2 * Math.PI * 60 * (1 - (stats.completed / (stats.total || 1)))
                      }
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* Center Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-slate-900 leading-none">
                      {Math.round((stats.completed / (stats.total || 1)) * 100)}%
                    </span>
                    <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider mt-1">
                      Completed
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="font-bold text-slate-800 text-sm">Registry Coverage</h4>
                  <p className="text-[11px] text-slate-450 mt-0.5 leading-normal max-w-[180px]">
                    Keep it up, {userName}! You have geotagged {stats.completed} out of {stats.total} total Gurgaon projects.
                  </p>
                </div>
              </div>

              {/* Numerical Metrics Cards Grid */}
              <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50/50 border border-slate-200 p-4.5 rounded-2xl flex flex-col justify-between">
                  <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">
                    Total Projects
                  </span>
                  <div className="mt-2.5 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-800">{stats.total}</span>
                    <span className="text-[10px] font-bold text-slate-400">in Database</span>
                  </div>
                </div>

                <div className="bg-emerald-50/40 border border-emerald-150 p-4.5 rounded-2xl flex flex-col justify-between">
                  <span className="text-[9px] uppercase font-bold text-emerald-700 tracking-wider">
                    Completed Geotagging
                  </span>
                  <div className="mt-2.5 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-emerald-800">{stats.completed}</span>
                    <span className="text-[10px] font-bold text-emerald-600">Updated Live</span>
                  </div>
                </div>

                <div className="bg-amber-50/40 border border-amber-150 p-4.5 rounded-2xl flex flex-col justify-between">
                  <span className="text-[9px] uppercase font-bold text-amber-700 tracking-wider">
                    Remaining Projects
                  </span>
                  <div className="mt-2.5 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-amber-800">{stats.remaining}</span>
                    <span className="text-[10px] font-bold text-amber-600">Pending Field Visits</span>
                  </div>
                </div>

                <div className="bg-indigo-50/40 border border-indigo-150 p-4.5 rounded-2xl flex flex-col justify-between">
                  <span className="text-[9px] uppercase font-bold text-indigo-700 tracking-wider">
                    Ingested Today
                  </span>
                  <div className="mt-2.5 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-indigo-800">{stats.completedToday}</span>
                    <span className="text-[10px] font-bold text-indigo-600">Projects Today</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400 text-sm">
              No stats available.
            </div>
          )}

          <div className="flex justify-end pt-3">
            <button
              onClick={loadStats}
              disabled={isPending}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2.5 px-5 rounded-xl text-xs border border-indigo-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              🔄 Refresh Live Metrics
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
