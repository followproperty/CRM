"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import {
  getLocalityList,
  getProjectsForLocality,
  updateProjectGpsAndPhotos,
  searchProjectsByName,
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
  distance?: number;
}

interface GpsCollectorClientProps {
  userName: string;
}

export default function GpsCollectorClient({ userName }: GpsCollectorClientProps) {
  // Silence unused prop warnings
  useEffect(() => {
    console.log("Logged in as collector:", userName);
  }, [userName]);

  // GPS switch state (ON = GPS search is active, OFF = GPS search is disabled completely)
  const [gpsActive, setGpsActive] = useState<boolean>(true);

  // Collect state
  const [localities, setLocalities] = useState<string[]>([]);
  const [selectedLocality, setSelectedLocality] = useState<string>("");
  const [searchLocality, setSearchLocality] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);

  // GPS-based batch sector limit and loading states
  const [currentSectorLimit, setCurrentSectorLimit] = useState<number>(3);
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(false);

  // Global projects search state
  const [searchedProjects, setSearchedProjects] = useState<ProjectItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Pagination state (limit to 10 by default)
  const [visibleCount, setVisibleCount] = useState<number>(10);

  // Decoupled GPS States:
  // 1. User Position (Strictly for distance sorting and proximity checks)
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  // 2. Form Coordinates (Strictly captured for submission / drafts)
  const [formLat, setFormLat] = useState<number | null>(null);
  const [formLng, setFormLng] = useState<number | null>(null);
  const [formAccuracy, setFormAccuracy] = useState<number | null>(null);

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

  // Load persistent GPS switch state on mount
  useEffect(() => {
    const saved = localStorage.getItem("gps_active_state");
    if (saved !== null) {
      setGpsActive(saved === "true");
    }
  }, []);

  // Save GPS switch state when it changes
  useEffect(() => {
    localStorage.setItem("gps_active_state", String(gpsActive));
  }, [gpsActive]);

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

  // Fetch matching projects globally based on search text (debounced 300ms)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchLocality.trim().length >= 2) {
        setIsSearching(true);
        startTransition(async () => {
          try {
            const res = await searchProjectsByName(searchLocality);
            setSearchedProjects(res);
          } catch (e) {
            console.error("Search projects error:", e);
          } finally {
            setIsSearching(false);
          }
        });
      } else {
        setSearchedProjects([]);
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchLocality]);

  // Fetch projects when locality changes
  useEffect(() => {
    if (!selectedLocality) return;
    
    // Only reset project selection if the currently selected project doesn't belong to the new sector
    if (!selectedProject || selectedProject.locality !== selectedLocality) {
      setSelectedProject(null);
    }
    
    clearPhotosAndNotes(); // Clear photos/notes
    setVisibleCount(10); // Reset pagination limit to 10

    startTransition(async () => {
      try {
        const data = await getProjectsForLocality(selectedLocality);
        setProjects(data);
      } catch {
        setErrorMessage("Failed to load projects for this locality.");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          setFormLat(draft.latitude);
          setFormLng(draft.longitude);
          setFormAccuracy(draft.gpsAccuracy || null);
        }
        setNotes(draft.notes || "");
        setPhotos(draft.photos || []);
      } catch (e) {
        console.error("Error parsing saved draft", e);
      }
    } else {
      // Clear coordinate form inputs by default
      setFormLat(null);
      setFormLng(null);
      setFormAccuracy(null);
      setNotes("");
      setPhotos([]);
    }
  }, [selectedProject]);

  // Save draft to localStorage whenever coordinate or photos change
  useEffect(() => {
    if (!selectedProject) return;

    const draftKey = `gps_draft_${selectedProject._id}`;
    if (formLat || formLng || photos.length > 0 || notes) {
      const draft = {
        latitude: formLat,
        longitude: formLng,
        gpsAccuracy: formAccuracy,
        notes,
        // Map photos array to only save preview/base64 strings, excluding non-serializable File objects
        photos: photos.map(p => ({ id: p.id, preview: p.preview, base64: p.base64 })),
      };
      try {
        localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch (err) {
        console.warn("Could not save draft to local storage:", err);
      }
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [formLat, formLng, formAccuracy, photos, notes, selectedProject]);

  const clearPhotosAndNotes = () => {
    setPhotos([]);
    setNotes("");
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const clearFullForm = () => {
    setFormLat(null);
    setFormLng(null);
    setFormAccuracy(null);
    setGpsError(null);
    setPhotos([]);
    setNotes("");
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const deleteDraft = (projectId: string) => {
    localStorage.removeItem(`gps_draft_${projectId}`);
  };

  // Helper to load nearby projects sorted by distance
  const loadNearbyProjects = (lat: number, lng: number, sectorLimit = 3) => {
    if (localities.length === 0) return;
    
    setIsLoadingProjects(true);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        // Sort sectors by proximity to user
        const sortedSectors = [...localities].map((loc) => {
          const coords = getLocalityCoordinates(loc);
          const dist = calculateDistance(lat, lng, coords.lat, coords.lng);
          return { loc, dist };
        }).sort((a, b) => a.dist - b.dist);

        // Fetch projects for top closest sectors only to avoid heavy database payloads
        const topSectors = sortedSectors.slice(0, sectorLimit).map((s) => s.loc);
        const sectorsString = topSectors.join(",");
        const data = await getProjectsForLocality(sectorsString);

        // Calculate distance for each project based on its locality/sector coordinates
        const withDistance = data.map((proj: ProjectItem) => {
          const coords = getLocalityCoordinates(proj.locality);
          const dist = calculateDistance(lat, lng, coords.lat, coords.lng);
          return { ...proj, distance: dist };
        });

        // Sort from nearest to farthest, then alphabetically
        withDistance.sort((a: ProjectItem, b: ProjectItem) => {
          const distA = a.distance ?? 0;
          const distB = b.distance ?? 0;
          if (distA !== distB) {
            return distA - distB;
          }
          return a.projectName.localeCompare(b.projectName);
        });

        setProjects(withDistance);
      } catch (e) {
        console.error("Failed to load nearby projects:", e);
        setErrorMessage("Failed to load nearby projects.");
      } finally {
        setIsLoadingProjects(false);
      }
    });
  };

  // Helper to trigger GPS location capture automatically
  const autoCaptureGps = () => {
    if (!navigator.geolocation || !gpsActive) return;
    
    setIsCapturingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // Update user coordinates strictly for sorting distances
        setUserLat(lat);
        setUserLng(lng);
        setIsCapturingGps(false);

        if (!selectedLocality) {
          loadNearbyProjects(lat, lng, currentSectorLimit);
        }
      },
      (error) => {
        console.warn("Auto GPS capture warning:", error.message);
        setGpsError("Could not retrieve GPS coordinates. Please enable device location settings.");
        setIsCapturingGps(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      }
    );
  };

  // Manual GPS capture / refresh coordinates inside the form
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
        
        // Lock these coordinates strictly for the active ingestion form
        setFormLat(lat);
        setFormLng(lng);
        setFormAccuracy(position.coords.accuracy);

        // Also update user position to keep distance lists accurate
        setUserLat(lat);
        setUserLng(lng);
        setIsCapturingGps(false);

        if (!selectedLocality) {
          loadNearbyProjects(lat, lng, currentSectorLimit);
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

  // Compress image helper using HTML5 Canvas
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // Max dimension 1200px to avoid large memory footprint
          const MAX_FROM_DIM = 1200;
          if (width > height) {
            if (width > MAX_FROM_DIM) {
              height = Math.round((height * MAX_FROM_DIM) / width);
              width = MAX_FROM_DIM;
            }
          } else {
            if (height > MAX_FROM_DIM) {
              width = Math.round((width * MAX_FROM_DIM) / height);
              height = MAX_FROM_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          // Compress as JPEG with 0.7 quality to reduce file sizes to ~150KB
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          resolve(dataUrl);
        };
        img.onerror = () => {
          resolve(event.target?.result as string);
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        resolve("");
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle Photo Selection with automatic Canvas Compression
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(async (file) => {
      // Check if file is already added safely (p.file might be undefined if loaded from draft cache)
      if (photos.some((p) => p.file && p.file.name === file.name && p.file.size === file.size)) {
        return;
      }

      try {
        const compressedBase64 = await compressImage(file);
        if (!compressedBase64) return;
        setPhotos((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            file,
            preview: URL.createObjectURL(file),
            base64: compressedBase64,
          },
        ]);
      } catch (err) {
        console.error("Compression error:", err);
      }
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

    if (!formLat || !formLng) {
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
        const gpsStr = `${formLat.toFixed(6)},${formLng.toFixed(6)}`;
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

  return (
    <div className="bg-slate-50 text-slate-800 p-0 pb-10 font-sans min-h-[85vh]">
      {/* General Error Banner */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-750 p-3.5 rounded-xl text-xs font-semibold mb-6">
          ⚠️ Error: {errorMessage}
        </div>
      )}

      {/* GPS Error Toaster Alert */}
      {gpsError && (
        <div className="bg-amber-50 border border-amber-300 text-amber-950 p-4 rounded-2xl text-xs font-semibold mb-6 flex items-start gap-2.5 shadow-2xs">
          <span className="text-sm">⚠️</span>
          <div>
            <p className="font-extrabold text-amber-950">Location Access Disabled</p>
            <p className="text-[10px] text-amber-800 mt-1 leading-normal font-medium">
              Please enable Location / GPS permissions in your browser or device settings to automatically load nearest projects, or turn GPS OFF to search manually.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Locality Finder */}
        <div className={`lg:col-span-5 ${selectedProject ? "hidden lg:block" : "block"}`}>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-xs">
            <h2 className="text-base md:text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
              📍 Locality Finder
            </h2>
            
            {/* 1. Autocomplete Search input container with click-outside ref */}
            <div ref={searchRef} className="relative mt-3 z-30">
              <input
                type="text"
                placeholder={gpsActive ? "Search sector or project name..." : "Type sector or project name manually..."}
                value={searchLocality}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchLocality(val);
                  setIsDropdownOpen(val.trim().length >= 2);
                  if (val.trim() === "") {
                    setSelectedLocality("");
                    if (gpsActive && userLat !== null && userLng !== null) {
                      loadNearbyProjects(userLat, userLng, 3);
                      setCurrentSectorLimit(3);
                    } else {
                      setProjects([]);
                    }
                  }
                }}
                onFocus={() => setIsDropdownOpen(true)}
                className="w-full bg-white border border-slate-350 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 text-slate-900 placeholder-slate-400 shadow-2xs"
              />
              
              {isDropdownOpen && searchLocality.trim().length >= 2 && (
                <ul className="absolute left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-40">
                  {isSearching ? (
                    <li className="px-4 py-4 text-xs text-slate-500 text-center flex items-center justify-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                      Searching database...
                    </li>
                  ) : searchedProjects.length > 0 ? (
                    searchedProjects.map((proj) => {
                      const hasGPS = gpsActive && userLat !== null && userLng !== null;
                      let distanceStr = "";
                      if (hasGPS && proj.locality) {
                        const coords = getLocalityCoordinates(proj.locality);
                        const dist = calculateDistance(userLat!, userLng!, coords.lat, coords.lng);
                        distanceStr = `(~${dist.toFixed(1)} km away)`;
                      }
                      return (
                        <li
                          key={proj._id}
                          onClick={() => {
                            setSelectedLocality(proj.locality);
                            setSearchLocality(proj.projectName); // Fill search box with selected project name
                            setProjects([proj]); // Prefill the left-side list with just this searched project
                            setSelectedProject(proj); // Auto-open this project in the ingestion form
                            setIsDropdownOpen(false);
                          }}
                          className="px-4 py-3.5 text-sm cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-0 flex justify-between items-center text-slate-700"
                        >
                          <div className="flex flex-col pr-3">
                            <span className="font-semibold text-slate-800 text-xs sm:text-sm">🏢 {proj.projectName}</span>
                            <span className="text-[10px] text-slate-450 mt-1 font-medium">
                              {proj.locality} {proj.location && proj.location.toLowerCase() !== proj.locality.toLowerCase() && `• ${proj.location}`}
                            </span>
                          </div>
                          {distanceStr && (
                            <span className="text-[10px] text-slate-400 font-mono font-medium whitespace-nowrap">
                              {distanceStr}
                            </span>
                          )}
                        </li>
                      );
                    })
                  ) : (
                    <li className="px-4 py-4 text-xs text-slate-400 text-center">
                      No matching projects found.
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* 2. GPS Toggle Switch (ON / OFF) */}
            <div className="flex justify-between items-center bg-slate-50 border border-slate-200/80 rounded-xl p-3 shadow-2xs mt-4">
              <div className="flex flex-col gap-0.5 pr-2">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  📡 GPS Auto-Locator
                </span>
                <span className="text-[9.5px] text-slate-500 leading-normal">
                  Find nearest projects automatically.
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
                    setUserLat(null);
                    setUserLng(null);
                    setFormLat(null);
                    setFormLng(null);
                    setFormAccuracy(null);
                    setSelectedLocality("");
                    setSearchLocality("");
                    setProjects([]);
                    setCurrentSectorLimit(3);
                  }
                }}
                className={`relative inline-flex h-5.5 w-10 flex-shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer outline-none border-0 ${
                  gpsActive ? "bg-slate-800" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    gpsActive ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Total count details */}
            {(selectedLocality || (gpsActive && userLat && userLng)) && (
              <div className="flex justify-between items-center mt-6 mb-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                    {selectedLocality ? `Projects in ${selectedLocality}` : "Nearest Pending Projects"}
                  </span>
                </div>
                <span className="text-[11px] bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 font-medium self-start">
                  {projects.filter((p) => p.isCompleted).length} / {projects.length} Done
                </span>
              </div>
            )}

            {/* Projects List (paginated or lazy loaded depending on GPS) */}
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {isLoadingProjects ? (
                // Dynamic Scanning GPS Proximity Loader
                <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl bg-white space-y-3 mt-4">
                  <div className="w-8 h-8 border-3 border-indigo-650/30 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                  <h4 className="font-bold text-slate-750 text-xs">📡 Scanning Sector Proximity...</h4>
                  <p className="text-[10.5px] text-slate-450 max-w-[220px] mx-auto leading-relaxed">
                    Analyzing Gurgaon sector distances and fetching projects closest to your position.
                  </p>
                </div>
              ) : !selectedLocality && (!gpsActive || !userLat || !userLng) ? (
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
                      Type the locality or project name in the search box above to load pending projects manually.
                    </p>
                  </div>
                )
              ) : (
                <>
                  {projects.length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-sm">
                      No projects found.
                    </div>
                  )}
                  {projects.slice(0, selectedLocality ? visibleCount : projects.length).map((proj) => {
                    const hasGPS = gpsActive && userLat !== null && userLng !== null;
                    let distanceStr = "";
                    if (hasGPS) {
                      const coords = getLocalityCoordinates(proj.locality);
                      const dist = calculateDistance(userLat!, userLng!, coords.lat, coords.lng);
                      distanceStr = `~${dist.toFixed(1)} km away`;
                    }
                    const showLocation = proj.location && proj.location.toLowerCase() !== proj.locality.toLowerCase();
                    return (
                      <div
                        key={proj._id}
                        onClick={() => setSelectedProject(proj)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex justify-between items-center gap-3 ${
                          selectedProject?._id === proj._id
                            ? "bg-indigo-50/50 border-indigo-400 shadow-2xs"
                            : "bg-white border-slate-200 hover:bg-slate-50/50 hover:border-slate-350"
                        }`}
                      >
                        <div className="space-y-0.5 pr-2 flex-1 min-w-0">
                          <h4 className="font-bold text-slate-800 text-sm leading-snug truncate">{proj.projectName}</h4>
                          <p className="text-slate-500 text-xs truncate">
                            {proj.locality} {showLocation && `• ${proj.location}`}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {distanceStr && (
                            <span className="text-[10px] text-indigo-600 font-bold font-mono whitespace-nowrap">
                              {distanceStr}
                            </span>
                          )}
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-md font-extrabold tracking-wider uppercase ${
                              proj.isCompleted
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-250"
                                : "bg-amber-50 text-amber-700 border border-amber-250"
                            }`}
                          >
                            {proj.isCompleted ? "Completed" : "Pending"}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* View More Button */}
                  {((selectedLocality && projects.length > visibleCount) || (!selectedLocality && projects.length > 0)) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedLocality) {
                          setVisibleCount((prev) => prev + 10);
                        } else {
                          const nextLimit = currentSectorLimit + 3;
                          setCurrentSectorLimit(nextLimit);
                          if (userLat && userLng) {
                            loadNearbyProjects(userLat, userLng, nextLimit);
                          }
                        }
                      }}
                      className="w-full mt-2.5 bg-slate-100 hover:bg-slate-200 text-indigo-700 font-bold py-3 rounded-xl text-xs border border-slate-200 transition-all duration-150 cursor-pointer text-center"
                    >
                      View More Projects
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
              className="bg-white border border-slate-200 rounded-2xl p-3 md:p-6 shadow-xs space-y-6 flex flex-col min-h-[550px]"
            >
              {/* Form Header */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div className="space-y-1 min-w-0 flex-1 pr-3">
                  <span className="text-[9px] uppercase font-extrabold tracking-widest text-indigo-600">
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
                
                {formLat && formLng ? (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
                    <p className="text-[9px] text-indigo-600 uppercase font-bold tracking-wider">
                      Current Coordinates Locked
                    </p>
                    <p className="text-base md:text-lg font-mono font-bold text-indigo-700 mt-1">
                      {formLat.toFixed(6)}, {formLng.toFixed(6)}
                    </p>
                    {formAccuracy && (
                      <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                        Accuracy: ±{formAccuracy.toFixed(1)} meters
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-350 rounded-xl py-6 px-4 text-center text-slate-500 text-xs md:text-sm bg-white leading-relaxed">
                    📍 <strong>Stand close to the building:</strong> Move within 2m to 10m of the main entrance or building facade, then tap the button below to capture coordinates.
                  </div>
                )}

                <button
                  type="button"
                  onClick={captureGps}
                  disabled={isCapturingGps}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl text-xs md:text-sm transition-all duration-200 shadow-2xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCapturingGps ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Locking GPS signal...
                    </>
                  ) : formLat && formLng ? (
                    <>🔄 Recapture GPS Location</>
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
                <div className="bg-rose-50 border border-rose-200 text-rose-750 p-4 rounded-xl text-xs font-medium">
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
                  disabled={isPending || !formLat || !formLng || photos.length < 4}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-4 rounded-xl text-xs md:text-sm transition-all duration-200 shadow-2xs flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
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
