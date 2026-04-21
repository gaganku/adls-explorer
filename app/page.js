"use client";

import { useState, useRef, useEffect } from "react";
import {
  Folder, File, Download, ChevronRight, HardDrive, LogOut,
  ArrowLeft, Trash2, FolderPlus, UploadCloud, Loader2,
  BookmarkPlus, Bookmark, ChevronDown, X, Check,
  Eye, Table2, Database, Play, ChevronLeft, ChevronRight as ChevronRightIcon, AlertCircle
} from "lucide-react";
import { executeSQL } from "../lib/sqlEngine";

const PROFILES_KEY = "adls_explorer_profiles";

function loadProfiles() {
  try {
    return JSON.parse(localStorage.getItem(PROFILES_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveProfiles(profiles) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export default function Home() {
  const [config, setConfig] = useState({
    storageAccount: "",
    containerName: "",
    sasToken: "",
  });
  const [isConnected, setIsConnected] = useState(false);
  const [currentPath, setCurrentPath] = useState("");
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  // Profile state
  const [profiles, setProfiles] = useState({});
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [savedFeedback, setSavedFeedback] = useState(false);
  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);

  // Preview state
  const [previewFile, setPreviewFile] = useState(null); // { name, path }
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [previewData, setPreviewData] = useState(null); // { rows, schema, columns, totalRows, fileSizeBytes, ext }
  const [previewTab, setPreviewTab] = useState("data"); // "data" | "schema" | "query"
  const [previewPage, setPreviewPage] = useState(1);
  const [sqlQuery, setSqlQuery] = useState("");
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState(null);
  const PREVIEW_PAGE_SIZE = 100;


  // Load profiles from localStorage on mount
  useEffect(() => {
    setProfiles(loadProfiles());
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSaveProfile = () => {
    if (!profileName.trim()) return;
    const updated = {
      ...profiles,
      [profileName.trim()]: { ...config },
    };
    saveProfiles(updated);
    setProfiles(updated);
    setProfileName("");
    setShowSaveDialog(false);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const handleLoadProfile = (name) => {
    setConfig({ ...profiles[name] });
    setShowProfileDropdown(false);
    setError(null);
  };

  const handleDeleteProfile = (name, e) => {
    e.stopPropagation();
    const updated = { ...profiles };
    delete updated[name];
    saveProfiles(updated);
    setProfiles(updated);
  };

  const profileCount = Object.keys(profiles).length;

  // ── Core ADLS actions ─────────────────────────────────────────────────────

  const fetchItems = async (prefix = "") => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, prefix }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setItems(data.items || []);
      setCurrentPath(prefix);
      setIsConnected(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = (e) => {
    e.preventDefault();
    fetchItems("");
  };

  const handleNavigate = (folderName) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    fetchItems(newPath);
  };

  const handleNavigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split("/");
    parts.pop();
    fetchItems(parts.join("/"));
  };

  const handleDownload = async (filePath, basename) => {
    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, filePath }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to download");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = basename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert("Download failed: " + err.message);
    }
  };

  const handleCreateFolder = async () => {
    const folderName = prompt("Enter new folder name:");
    if (!folderName) return;
    const folderPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    try {
      const res = await fetch("/api/create-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, folderPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create folder");
      fetchItems(currentPath);
    } catch (err) {
      alert("Failed to create folder: " + err.message);
    }
  };

  const handleDelete = async (path, isDirectory) => {
    if (!confirm(`Are you sure you want to delete this ${isDirectory ? "folder and all its contents" : "file"}?\nThis action cannot be undone.`)) return;
    try {
      const res = await fetch("/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, path, isDirectory }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      fetchItems(currentPath);
    } catch (err) {
      alert("Failed to delete: " + err.message);
    }
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("storageAccount", config.storageAccount);
      formData.append("containerName", config.containerName);
      formData.append("sasToken", config.sasToken);
      formData.append("filePath", filePath);
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload file");
      fetchItems(currentPath);
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const formatSize = (bytes) => {
    if (bytes === undefined || bytes === null) return "-";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // ── Preview handlers ───────────────────────────────────────────────────────

  const handlePreview = async (filePath, basename) => {
    const ext = basename.split(".").pop().toLowerCase();
    if (!["csv", "parquet"].includes(ext)) {
      alert(`Preview is only available for CSV and Parquet files.`);
      return;
    }
    setPreviewFile({ name: basename, path: filePath });
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewData(null);
    setPreviewTab("data");
    setPreviewPage(1);
    setSqlQuery(`SELECT * FROM data LIMIT 100`);
    setQueryResult(null);
    setQueryError(null);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, filePath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to preview file");
      setPreviewData(data);
    } catch (err) {
      setPreviewError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRunQuery = () => {
    if (!previewData || !sqlQuery.trim()) return;
    setQueryError(null);
    setQueryResult(null);
    try {
      const result = executeSQL(sqlQuery, previewData.rows);
      setQueryResult(result);
    } catch (err) {
      setQueryError(err.message);
    }
  };


  const closePreview = () => {
    setPreviewFile(null);
    setPreviewData(null);
    setPreviewError(null);
  };

  // ── Login screen ──────────────────────────────────────────────────────────


  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 flex items-center justify-center p-4 text-slate-100 font-sans">
        <div className="w-full max-w-4xl flex gap-5 items-start">

          {/* ── LEFT: Saved Profiles Panel (always visible) ── */}
          <div className="w-72 flex-shrink-0 bg-slate-900/50 backdrop-blur-2xl rounded-3xl border border-slate-800/80 shadow-2xl ring-1 ring-white/5 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-800/60 flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-300">Saved Profiles</span>
              {profileCount > 0 && (
                <span className="ml-auto text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full px-2 py-0.5 font-medium">
                  {profileCount}
                </span>
              )}
            </div>

            <div className="flex-grow overflow-y-auto p-3 space-y-2 max-h-[420px]">
              {profileCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center border border-slate-700/50">
                    <BookmarkPlus className="w-6 h-6 text-slate-600" />
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">No profiles saved yet. Fill in your credentials and click <span className="text-blue-400 font-medium">Save as profile</span>.</p>
                </div>
              ) : (
                Object.keys(profiles).map((name) => (
                  <div
                    key={name}
                    onClick={() => handleLoadProfile(name)}
                    className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                      config.storageAccount === profiles[name].storageAccount && config.containerName === profiles[name].containerName
                        ? "bg-blue-500/10 border-blue-500/40 shadow-inner"
                        : "bg-slate-800/30 border-slate-700/40 hover:bg-slate-800/70 hover:border-slate-600/60"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-200 group-hover:text-white truncate">{name}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{profiles[name].storageAccount}</p>
                      <p className="text-xs text-slate-600 truncate">{profiles[name].containerName}</p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteProfile(name, e)}
                      className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 ml-2"
                      title="Delete profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── RIGHT: Connection Form ── */}
          <div className="flex-grow bg-slate-900/40 backdrop-blur-2xl rounded-3xl border border-slate-800/80 p-8 shadow-2xl ring-1 ring-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-400"></div>

          <div className="flex flex-col items-center gap-3 mb-8 text-center">
            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-inner mb-2">
              <HardDrive className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400">ADLS Explorer</h1>
            <p className="text-sm text-slate-400">Connect to your Azure Data Lake Storage</p>
          </div>


          {/* ── Connection Form ── */}
          <form onSubmit={handleConnect} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">Storage Account Name</label>
              <input
                type="text"
                required
                className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600 shadow-inner"
                placeholder="e.g. mystorageaccount"
                value={config.storageAccount}
                onChange={(e) => setConfig({ ...config, storageAccount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">Container Name</label>
              <input
                type="text"
                required
                className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600 shadow-inner"
                placeholder="e.g. mycontainer"
                value={config.containerName}
                onChange={(e) => setConfig({ ...config, containerName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">SAS Token</label>
              <textarea
                required
                rows={3}
                className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600 resize-none shadow-inner"
                placeholder="e.g. sp=r&st=...&sig=..."
                value={config.sasToken}
                onChange={(e) => setConfig({ ...config, sasToken: e.target.value })}
              />
            </div>

            {error && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                {error}
              </div>
            )}

            {/* ── Save Profile inline dialog ── */}
            {showSaveDialog ? (
              <div className="flex items-center gap-2 p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                <BookmarkPlus className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <input
                  autoFocus
                  type="text"
                  className="flex-grow bg-transparent text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
                  placeholder="Profile name (e.g. Production)"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSaveProfile(); } if (e.key === "Escape") setShowSaveDialog(false); }}
                />
                <button type="button" onClick={handleSaveProfile} disabled={!profileName.trim()} className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-40">
                  <Check className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setShowSaveDialog(false)} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSaveDialog(true)}
                disabled={!config.storageAccount || !config.containerName || !config.sasToken}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-slate-400 hover:text-blue-400 border border-slate-700/60 hover:border-blue-500/40 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {savedFeedback ? (
                  <><Check className="w-4 h-4 text-emerald-400" /><span className="text-emerald-400">Profile saved!</span></>
                ) : (
                  <><BookmarkPlus className="w-4 h-4" />Save as profile</>
                )}
              </button>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium rounded-xl px-4 py-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Connect & Explore"}
            </button>
          </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Explorer screen ───────────────────────────────────────────────────────

  return (
    <>
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 font-sans">
      <div className="max-w-6xl mx-auto h-full flex flex-col">
        <header className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800/60">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-xl shadow-lg shadow-blue-500/20">
              <HardDrive className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">{config.storageAccount}</h1>
              <p className="text-sm text-slate-400 mt-0.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                {config.containerName}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsConnected(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl transition-all border border-transparent hover:border-slate-700/50"
          >
            <LogOut className="w-4 h-4" />
            Disconnect
          </button>
        </header>

        <div className="bg-slate-900/40 rounded-3xl border border-slate-800/60 shadow-2xl overflow-hidden backdrop-blur-xl flex-grow flex flex-col ring-1 ring-white/5 relative">

          {/* Upload Progress Overlay */}
          {isUploading && (
            <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
              <p className="text-lg font-medium">Uploading file...</p>
            </div>
          )}

          <div className="flex items-center justify-between px-6 py-4 bg-slate-900/80 border-b border-slate-800/60 gap-4">
            <div className="flex items-center overflow-hidden flex-grow">
              {currentPath && (
                <button
                  onClick={handleNavigateUp}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white mr-2 flex-shrink-0"
                  title="Go up"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <div className="flex items-center text-sm font-medium text-slate-400 overflow-x-auto whitespace-nowrap hide-scrollbar flex-grow">
                <button onClick={() => fetchItems("")} className="px-2 py-1 hover:text-white hover:bg-slate-800 rounded-md transition-all">root</button>
                {currentPath.split("/").filter(Boolean).map((part, index, arr) => {
                  const isLast = index === arr.length - 1;
                  const pathSoFar = arr.slice(0, index + 1).join("/");
                  return (
                    <div key={index} className="flex items-center">
                      <ChevronRight className="w-4 h-4 mx-0.5 text-slate-600 flex-shrink-0" />
                      <button
                        onClick={() => !isLast && fetchItems(pathSoFar)}
                        className={`px-2 py-1 rounded-md transition-all ${isLast ? "text-blue-400 bg-blue-500/10 cursor-default" : "hover:text-white hover:bg-slate-800"}`}
                      >
                        {part}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleCreateFolder}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700/50"
              >
                <FolderPlus className="w-4 h-4" />
                <span className="hidden sm:inline">New Folder</span>
              </button>
              <button
                onClick={handleUploadClick}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg shadow-blue-500/20"
              >
                <UploadCloud className="w-4 h-4" />
                <span className="hidden sm:inline">Upload File</span>
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            </div>
          </div>

          <div className="p-4 flex-grow overflow-y-auto">
            {isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-4">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <p>Loading contents...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-3">
                <Folder className="w-12 h-12 text-slate-700" />
                <p>This folder is empty.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {items.map((item) => (
                  <div
                    key={item.name}
                    className="group relative flex items-center p-3.5 bg-slate-900/20 rounded-2xl hover:bg-slate-800 border border-slate-800/40 hover:border-slate-700/60 transition-all cursor-pointer shadow-sm hover:shadow-md"
                    onClick={() => item.isDirectory ? handleNavigate(item.basename) : null}
                  >
                    <div className="flex-shrink-0 mr-4">
                      {item.isDirectory ? (
                        <div className="p-2.5 bg-amber-500/10 rounded-xl group-hover:bg-amber-500/20 transition-colors">
                          <Folder className="w-6 h-6 text-amber-500" />
                        </div>
                      ) : (
                        <div className="p-2.5 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                          <File className="w-6 h-6 text-blue-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-grow min-w-0 pr-16">
                      <h3 className="text-sm font-semibold text-slate-200 truncate group-hover:text-white transition-colors" title={item.basename}>
                        {item.basename}
                      </h3>
                      {!item.isDirectory && (
                        <p className="text-xs text-slate-500 mt-1 font-medium">{formatSize(item.contentLength)}</p>
                      )}
                    </div>

                    {/* Action icons */}
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 absolute right-3 transition-opacity">
                      {!item.isDirectory && ["csv","parquet"].includes(item.basename.split(".").pop().toLowerCase()) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePreview(item.name, item.basename); }}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-violet-500 rounded-lg transition-colors"
                          title="Preview data"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {!item.isDirectory && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(item.name, item.basename); }}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-blue-500 rounded-lg transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.name, item.isDirectory); }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-red-500 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* ═══════════════════════════════════════════════════════════════
           FILE PREVIEW MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col">

          {/* Modal header */}
          <div className="flex items-center gap-4 px-6 py-4 bg-slate-900/80 border-b border-slate-800/60 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-violet-500/10 rounded-lg border border-violet-500/20">
                <Eye className="w-5 h-5 text-violet-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-white truncate">{previewFile.name}</h2>
                {previewData && (
                  <p className="text-xs text-slate-500">
                    {previewData.totalRows.toLocaleString()} rows · {formatSize(previewData.fileSizeBytes)} · {previewData.ext.toUpperCase()}
                  </p>
                )}
              </div>
            </div>

            {/* Tabs */}
            {previewData && (
              <div className="flex items-center gap-1 ml-6 bg-slate-800/60 p-1 rounded-xl">
                {[["data", Table2, "Data"], ["schema", Database, "Schema"], ["query", Play, "Query"]].map(([id, Icon, label]) => (
                  <button
                    key={id}
                    onClick={() => setPreviewTab(id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      previewTab === id
                        ? "bg-slate-700 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={closePreview}
              className="ml-auto p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal body */}
          <div className="flex-grow overflow-hidden flex flex-col">

            {/* Loading */}
            {previewLoading && (
              <div className="flex-grow flex flex-col items-center justify-center gap-4 text-slate-400">
                <Loader2 className="w-10 h-10 animate-spin text-violet-500" />
                <p className="text-sm">Loading {previewFile.name}…</p>
              </div>
            )}

            {/* Error */}
            {previewError && (
              <div className="flex-grow flex flex-col items-center justify-center gap-4 px-8">
                <AlertCircle className="w-12 h-12 text-red-400" />
                <p className="text-red-400 text-center text-sm max-w-lg">{previewError}</p>
              </div>
            )}

            {/* ── DATA TAB ── */}
            {previewData && previewTab === "data" && (() => {
              const totalPages = Math.ceil(previewData.rows.length / PREVIEW_PAGE_SIZE);
              const pageRows = previewData.rows.slice((previewPage - 1) * PREVIEW_PAGE_SIZE, previewPage * PREVIEW_PAGE_SIZE);
              return (
                <div className="flex-grow overflow-hidden flex flex-col">
                  {/* Pagination bar */}
                  <div className="flex items-center justify-between px-5 py-2.5 bg-slate-900/40 border-b border-slate-800/40 flex-shrink-0">
                    <span className="text-xs text-slate-500">
                      Showing {((previewPage - 1) * PREVIEW_PAGE_SIZE) + 1}–{Math.min(previewPage * PREVIEW_PAGE_SIZE, previewData.rows.length)} of {previewData.rows.length.toLocaleString()} rows
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={previewPage === 1}
                        onClick={() => setPreviewPage(p => p - 1)}
                        className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-800 rounded-lg transition-colors"
                      ><ChevronLeft className="w-4 h-4" /></button>
                      <span className="text-xs text-slate-400 font-medium px-2">Page {previewPage} / {totalPages}</span>
                      <button
                        disabled={previewPage === totalPages}
                        onClick={() => setPreviewPage(p => p + 1)}
                        className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-800 rounded-lg transition-colors"
                      ><ChevronRightIcon className="w-4 h-4" /></button>
                    </div>
                  </div>
                  {/* Table */}
                  <div className="flex-grow overflow-auto">
                    <table className="w-full text-xs text-left border-collapse" style={{minWidth: previewData.columns.length * 140}}>
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-900">
                          <th className="px-3 py-2.5 text-slate-500 font-semibold border-b border-slate-800 w-14 text-right">#</th>
                          {previewData.columns.map(col => (
                            <th key={col} className="px-3 py-2.5 text-slate-300 font-semibold border-b border-slate-800 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                {col}
                                <span className="text-slate-600 font-normal text-[10px]">
                                  {previewData.schema.find(s => s.name === col)?.type}
                                </span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row, ri) => (
                          <tr key={ri} className={ri % 2 === 0 ? "bg-slate-950/40" : "bg-slate-900/20"}>
                            <td className="px-3 py-2 text-slate-600 text-right border-b border-slate-800/30">{(previewPage - 1) * PREVIEW_PAGE_SIZE + ri + 1}</td>
                            {previewData.columns.map(col => (
                              <td key={col} className="px-3 py-2 text-slate-300 border-b border-slate-800/30 max-w-xs truncate" title={String(row[col] ?? "")}>
                                {row[col] === null || row[col] === undefined ? (
                                  <span className="text-slate-600 italic">null</span>
                                ) : String(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* ── SCHEMA TAB ── */}
            {previewData && previewTab === "schema" && (
              <div className="flex-grow overflow-auto p-6">
                <div className="max-w-3xl mx-auto">
                  <div className="mb-4 grid grid-cols-3 gap-4">
                    {[
                      ["Columns", previewData.columns.length],
                      ["Total Rows", previewData.totalRows.toLocaleString()],
                      ["File Size", formatSize(previewData.fileSizeBytes)],
                    ].map(([label, val]) => (
                      <div key={label} className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4">
                        <p className="text-xs text-slate-500 mb-1">{label}</p>
                        <p className="text-lg font-bold text-white">{val}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-900/40 rounded-2xl border border-slate-800/60 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-900">
                          {["Column Name", "Data Type", "Nullable", "Null Count", "Non-Null"].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 border-b border-slate-800">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.schema.map((col, i) => (
                          <tr key={col.name} className={i % 2 === 0 ? "bg-slate-950/30" : ""}>
                            <td className="px-4 py-3 font-semibold text-slate-200 border-b border-slate-800/30">{col.name}</td>
                            <td className="px-4 py-3 border-b border-slate-800/30">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                                col.type === "integer" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" :
                                col.type === "float" ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" :
                                col.type === "boolean" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                                col.type === "datetime" ? "bg-purple-500/10 text-purple-400 border-purple-500/30" :
                                "bg-slate-700/40 text-slate-400 border-slate-600/40"
                              }`}>{col.type}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-400 border-b border-slate-800/30">{col.nullable ? "Yes" : "No"}</td>
                            <td className="px-4 py-3 text-slate-400 border-b border-slate-800/30">{col.nullCount}</td>
                            <td className="px-4 py-3 text-slate-400 border-b border-slate-800/30">{col.totalCount - col.nullCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── QUERY TAB ── */}
            {previewData && previewTab === "query" && (
              <div className="flex-grow overflow-hidden flex flex-col gap-0">
                {/* Query editor area */}
                <div className="flex-shrink-0 bg-slate-900/60 border-b border-slate-800/60 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-grow">
                      <p className="text-xs text-slate-500 mb-2 font-medium">
                        Table name: <code className="text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">data</code>
                        <span className="ml-3 text-slate-600">Columns: {previewData.columns.join(", ")}</span>
                      </p>
                      <textarea
                        value={sqlQuery}
                        onChange={e => setSqlQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleRunQuery(); } }}
                        rows={4}
                        className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 resize-none"
                        placeholder="SELECT * FROM data WHERE column = 'value' LIMIT 100"
                        spellCheck={false}
                      />
                    </div>
                    <button
                      onClick={handleRunQuery}
                      className="flex items-center gap-2 px-5 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-violet-500/20 mt-6"
                    >
                      <Play className="w-4 h-4" />
                      Run
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 mt-2">Tip: Press <kbd className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-slate-400">Ctrl+Enter</kbd> to run</p>
                </div>

                {/* Query results */}
                <div className="flex-grow overflow-auto">
                  {queryError && (
                    <div className="p-6 flex items-start gap-3 text-red-400">
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <p className="text-sm font-mono">{queryError}</p>
                    </div>
                  )}
                  {queryResult && queryResult.length === 0 && (
                    <div className="p-8 text-center text-slate-500 text-sm">Query returned 0 rows.</div>
                  )}
                  {queryResult && queryResult.length > 0 && (() => {
                    const qCols = Object.keys(queryResult[0]);
                    return (
                      <div>
                        <div className="px-5 py-2 bg-slate-900/40 border-b border-slate-800/40">
                          <span className="text-xs text-slate-500">{queryResult.length.toLocaleString()} rows returned</span>
                        </div>
                        <table className="w-full text-xs text-left border-collapse" style={{minWidth: qCols.length * 140}}>
                          <thead className="sticky top-0">
                            <tr className="bg-slate-900">
                              <th className="px-3 py-2.5 text-slate-500 font-semibold border-b border-slate-800 w-14 text-right">#</th>
                              {qCols.map(col => (
                                <th key={col} className="px-3 py-2.5 text-slate-300 font-semibold border-b border-slate-800 whitespace-nowrap">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {queryResult.map((row, ri) => (
                              <tr key={ri} className={ri % 2 === 0 ? "bg-slate-950/40" : "bg-slate-900/20"}>
                                <td className="px-3 py-2 text-slate-600 text-right border-b border-slate-800/30">{ri + 1}</td>
                                {qCols.map(col => (
                                  <td key={col} className="px-3 py-2 text-slate-300 border-b border-slate-800/30 max-w-xs truncate" title={String(row[col] ?? "")}>
                                    {row[col] === null || row[col] === undefined ? <span className="text-slate-600 italic">null</span> : String(row[col])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
