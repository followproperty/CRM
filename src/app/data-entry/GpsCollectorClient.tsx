"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import {
  getLocalityList,
  getProjectsForLocality,
  updateProjectGpsAndPhotos,
} from "@/app/actions/gps-collector";
import {
  getLocalityCoordinates,
  calculateDistance,
  formatDistance,
} from "@/lib/gurgaonSectors";

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

interface GpsCollectorClientProps {
  userName: string;
}

export default function GpsCollectorClient({ userName }: GpsCollectorClientProps) {
  // GPS switch state (ON = GPS search is active, OFF = GPS search is disabled completely)
  const [gpsActive, setGpsActive] = useState<boolean>(true);

  // Collect state
  const [localities, setLocalities] = useState<string[]>([]);
  const [selectedLocality, setSelectedLocality] = useState<string>("");
  const [searchLocality, setSearchLocality] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);

  // Pagination state (limit to 10 by default)
  const [visibleCount, setVisibleCount] = useState<number>(10);

  // GPS state
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isCapturingGps, setIsCapturingGps] = useState<boolean>(false);

  // Photos state
  const [photos, setPhotos] = useState<{ id: string; file: File; preview: string; base64: string }[]>([]);
  const [notes, setNotes] = useState<string>("");

  // Search box click-outside ref
  const searchRef = useRef<HTMLDivElement>(null);

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
      } catch {
        setErrorMessage("Failed to load localities from database.");
      }
    });
  }, []);

  // AUTO-GPS TRIGGER: Auto-capture location on load if GPS switch is ON
  useEffect(() => {
    if (localities.length > 0 && gpsActive) {
      autoCaptureGps();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localities, gpsActive]);

  // Click outside to close recommendations dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch projects when locality changes
  useEffect(() => {
    if (!selectedLocality) return;
    
    setSelectedProject(null);
    clearPhotosAndNotes(); // Clear photos/notes, but preserve coordinates if we have locked them
    setVisibleCount(10); // Reset pagination limit to 10

    startTransition(async () => {
      try {
        const data = await getProjectsForLocality(selectedLocality);
        setProjects(data);
      } catch {
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
        if (draft.latitude && draft.longitude) {
          setLatitude(draft.latitude);
          setLongitude(draft.longitude);
          setGpsAccuracy(draft.gpsAccuracy || null);
        }
        setNotes(draft.notes || "");
        setPhotos(draft.photos || []);
      } catch (e) {
        console.error("Error parsing saved draft", e);
      }
    } else {
      setNotes("");
      setPhotos([]);
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

  const clearPhotosAndNotes = () => {
    setPhotos([]);
    setNotes("");
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const clearFullForm = () => {
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

  // Helper to trigger GPS location capture automatically
  const autoCaptureGps = () => {
    if (!navigator.geolocation || !gpsActive) return;
    
    setIsCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLatitude(lat);
        setLongitude(lng);
        setGpsAccuracy(position.coords.accuracy);
        setIsCapturingGps(false);

        // Find and select closest locality automatically
        if (localities.length > 0) {
          let closestLoc = localities[0];
          let minDistance = Infinity;

          localities.forEach((loc) => {
            const locCoords = getLocalityCoordinates(loc);
            const dist = calculateDistance(lat, lng, locCoords.lat, locCoords.lng);
            if (dist < minDistance) {
              minDistance = dist;
              closestLoc = loc;
            }
          });

          if (closestLoc) {
            setSelectedLocality(closestLoc);
            setSearchLocality(closestLoc);
          }
        }
      },
      (error) => {
        console.warn("Auto GPS capture warning:", error.message);
        setIsCapturingGps(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      }
    );
  };

  // Manual GPS capture / refresh coordinates
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
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLatitude(lat);
        setLongitude(lng);
        setGpsAccuracy(position.coords.accuracy);
        setIsCapturingGps(false);

        // Auto-select nearest sector based on distance
        if (localities.length > 0) {
          let closestLoc = localities[0];
          let minDistance = Infinity;

          localities.forEach((loc) => {
            const locCoords = getLocalityCoordinates(loc);
            const dist = calculateDistance(lat, lng, locCoords.lat, locCoords.lng);
            if (dist < minDistance) {
              minDistance = dist;
              closestLoc = loc;
            }
          });

          if (closestLoc && closestLoc !== selectedLocality) {
            setSelectedLocality(closestLoc);
            setSearchLocality(closestLoc);
          }
        }
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
          clearFullForm();
        }, 1500);

      } catch (error: unknown) {
        const err = error as Error;
        setErrorMessage(err.message || "An error occurred during submission.");
      } finally {
        setUploadStatus("");
      }
    });
  };

  // Calculate distance from current position to selected locality
  const getSelectedLocalityDistanceStr = () => {
    if (!gpsActive || !latitude || !longitude || !selectedLocality) return "";
    const coords = getLocalityCoordinates(selectedLocality);
    const dist = calculateDistance(latitude, longitude, coords.lat, coords.lng);
    return formatDistance(dist);
  };

  const filteredLocalities = localities.filter((loc) =>
    loc.toLowerCase().includes(searchLocality.toLowerCase())
  );

  return (
    <div className="bg-slate-50 text-slate-800 p-3 md:p-6 pb-20 font-sans min-h-[85vh]">
      {/* General Error Banner */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-750 p-3.5 rounded-xl text-xs font-semibold mb-6">
          ⚠️ Error: {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Locality Finder */}
        <div className={`lg:col-span-5 ${selectedProject ? "hidden lg:block" : "block"}`}>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-xs">
            
            {/* GPS Toggle Switch (ON / OFF) */}
            <div className="flex justify-between items-center bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 mb-5 shadow-2xs">
              <div className="flex flex-col gap-0.5 pr-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  📡 GPS Auto-Locator
                </span>
                <span className="text-[10px] text-slate-500 leading-normal">
                  Auto-detect nearest sector center on load.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextState = !gpsActive;
                  setGpsActive(nextState);
                  if (nextState) {
                    autoCaptureGps();
                  } else {
                    // Turn OFF: 0 consumption and clear all coordinates
                    setLatitude(null);
                    setLongitude(null);
                    setGpsAccuracy(null);
                    setSelectedLocality("");
                    setSearchLocality("");
                    setProjects([]);
                  }
                }}
                className={`relative inline-flex h-6.5 w-13 flex-shrink-0 items-center rounded-full transition-colors duration-250 cursor-pointer outline-none border-0 ${
                  gpsActive ? "bg-indigo-650" : "bg-slate-400"
                }`}
              >
                <span className={`text-[8.5px] font-black absolute transition-all duration-200 ${
                  gpsActive ? "left-2.5 text-white" : "right-2.5 text-slate-800"
                }`}>
                  {gpsActive ? "ON" : "OFF"}
                </span>
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    gpsActive ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <h2 className="text-base md:text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
              📍 Locality Finder
            </h2>
            
            {/* Autocomplete Search input container with click-outside ref */}
            <div ref={searchRef} className="relative mt-3 z-30">
              <input
                type="text"
                placeholder={gpsActive ? "Locating nearest sector..." : "Type sector/locality manually..."}
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
                  {filteredLocalities.map((loc) => {
                    const hasGPS = gpsActive && latitude !== null && longitude !== null;
                    let distanceStr = "";
                    if (hasGPS) {
                      const coords = getLocalityCoordinates(loc);
                      const dist = calculateDistance(latitude!, longitude!, coords.lat, coords.lng);
                      distanceStr = ` (${formatDistance(dist)})`;
                    }
                    return (
                      <li
                        key={loc}
                        onClick={() => {
                          setSelectedLocality(loc);
                          setSearchLocality(loc);
                          setIsDropdownOpen(false); // Close dropdown recommendations immediately on click
                        }}
                        className={`px-4 py-3.5 text-sm cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-0 flex justify-between items-center ${
                          selectedLocality === loc ? "bg-indigo-50 text-indigo-700 font-bold" : "text-slate-700"
                        }`}
                      >
                        <span>{loc}</span>
                        {distanceStr && <span className="text-[10px] text-slate-400 font-mono font-medium">{distanceStr}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Total count details */}
            {selectedLocality && (
              <div className="flex justify-between items-center mt-6 mb-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                    Projects in {selectedLocality}
                  </span>
                </div>
                <span className="text-[11px] bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 font-medium self-start">
                  {projects.filter((p) => p.isCompleted).length} / {projects.length} Done
                </span>
              </div>
            )}

            {/* Projects List (paginated to show 10 at a time) */}
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {!selectedLocality ? (
                // Display placeholder depending on GPS state
                gpsActive ? (
                  <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl bg-white space-y-3 mt-4">
                    <span className="text-3xl animate-pulse">📡</span>
                    <h4 className="font-bold text-slate-750 text-sm">Location Not Active</h4>
                    <p className="text-[11px] text-slate-450 max-w-[240px] mx-auto leading-relaxed">
                      Please enable GPS/location services on your device to automatically load nearby projects, or toggle GPS <strong>OFF</strong> to search manually.
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl bg-white space-y-2 mt-4">
                    <span className="text-3xl">🔍</span>
                    <h4 className="font-bold text-slate-750 text-sm">Search for a Locality</h4>
                    <p className="text-[11px] text-slate-450 max-w-[240px] mx-auto leading-relaxed">
                      Type the locality name (e.g. Sector 89) in the search box above to load pending projects manually.
                    </p>
                  </div>
                )
              ) : (
                <>
                  {projects.length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-sm">
                      No projects found in this locality.
                    </div>
                  )}
                  {projects.slice(0, visibleCount).map((proj) => (
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
                        <p className="text-slate-500 text-xs truncate">
                          {proj.location} {gpsActive && latitude && longitude && getSelectedLocalityDistanceStr() && `• ${getSelectedLocalityDistanceStr()}`}
                        </p>
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

                  {/* View More Button */}
                  {projects.length > visibleCount && (
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + 10)}
                      className="w-full mt-2.5 bg-slate-100 hover:bg-slate-250 text-indigo-700 font-bold py-3 rounded-xl text-xs border border-slate-200 transition-all duration-150 cursor-pointer text-center"
                    >
                      View More Projects (+10)
                    </button>
                  )}
                </>
              )}
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
                    {isCapturingGps ? "Auto-capturing GPS position..." : "No coordinates locked yet. Use the capture button below."}
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
    </div>
  );
}
