import React, { useState, useEffect, useMemo } from "react";
import { User, Store, MailerSettings, ReportLog } from "../../types";
import {
  getStores,
  getUsers,
  addUser,
  addStore,
  deleteUser,
  deleteStore,
  updateUser,
  getAutomationSettings,
  updateAutomationSettings,
  getMailerSettings,
  updateMailerSettings,
  getReportLogs,
} from "../../services/firestoreService";

interface SettingsModuleProps {
  currentUser: User;
}

const SettingsModule: React.FC<SettingsModuleProps> = ({ currentUser }) => {
  const [tab, setTab] = useState<"STORES" | "USERS" | "AUTOMATION" | "MAILER" | "LOGS" | "CACHING">("STORES");
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [reportLogs, setReportLogs] = useState<ReportLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  
  // Caching Backfill States
  const [syncFromDate, setSyncFromDate] = useState("2026-06-01");
  const [syncToDate, setSyncToDate] = useState("2026-06-30");
  const [statusLoading, setStatusLoading] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<{
    status: "idle" | "running" | "paused" | "completed" | "failed";
    completedDays: number;
    totalDays: number;
    currentDate: string;
    totalSaved: number;
    rangeStart?: string;
    rangeEnd?: string;
    error?: string;
  }>({
    status: "idle",
    completedDays: 0,
    totalDays: 0,
    currentDate: "",
    totalSaved: 0
  });

  const fetchBackfillStatus = async () => {
    try {
      const response = await fetch("/api/v1/backfill/status");
      if (response.ok) {
        const data = await response.json();
        setBackfillStatus(data);
      }
    } catch (e) {
      console.error("Failed to fetch backfill status:", e);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (tab === "CACHING") {
      fetchBackfillStatus();
      interval = setInterval(() => {
        fetchBackfillStatus();
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [tab]);
  
  // Automation settings state
  const [autoSettings, setAutoSettings] = useState<{
    enabled: boolean;
    fetchTime: string;
    reportTypes: ("Covers" | "Sales")[];
    selectedStores: string[];
  }>({
    enabled: true,
    fetchTime: "08:00",
    reportTypes: ["Covers"],
    selectedStores: [],
  });

  // Mailer settings state
  const [mailerSettings, setMailerSettings] = useState<MailerSettings>({
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    smtpPass: "",
    reportRecipients: "",
    googleDriveFolderId: "",
    googleServiceAccountKey: "",
    emailSubjectTemplate: "{type} Report - {date}",
    emailBodyTemplate: "Hello,\n\nPlease find attached the Consolidated {type} Report for {date}.\n\nThis is an automated system message.",
  });

  // Store Form State
  const [newStore, setNewStore] = useState({ id: "", name: "", brand: "", active: true });
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);

  const uniqueBrands = useMemo(() => {
    const brands = new Set<string>();
    stores.forEach((s: any) => {
      if (s.brand) brands.add(s.brand);
    });
    // Add default brands
    const defaults = [
      "Common Grounds",
      "Encounter Coffee",
      "The Sum of Us",
      "Tom and Serg",
      "Byron Bathers Club",
      "Splendour Fields",
      "Hawkerboi",
      "The Guild Restaurant",
      "Harvest & Co"
    ];
    defaults.forEach(d => brands.add(d));
    return Array.from(brands).sort();
  }, [stores]);

  // User Form State
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [userForm, setUserForm] = useState<Partial<User>>({
    username: "",
    password: "",
    role: "user",
    name: "",
    allowedStores: [],
  });

  const [editingPassword, setEditingPassword] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, u, auto, mailer, logs] = await Promise.all([
        getStores(),
        getUsers(),
        getAutomationSettings(),
        getMailerSettings(),
        getReportLogs(),
      ]);
      setStores(s || []);
      setUsers(u || []);
      const defaultAuto = {
        enabled: true,
        fetchTime: "08:00",
        reportTypes: ["Covers"] as ("Covers" | "Sales")[],
        selectedStores: [] as string[]
      };
      setAutoSettings({
        ...defaultAuto,
        ...(auto || {}),
      });
      setReportLogs(logs || []);
      if (mailer) {
        setMailerSettings({
          emailSubjectTemplate: "{type} Report - {date}",
          emailBodyTemplate: "Hello,\n\nPlease find attached the Consolidated {type} Report for {date}.\n\nThis is an automated system message.",
          ...mailer
        });
      }
    } catch (err) {
      console.error("Failed to fetch settings data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartSync = async () => {
    setStatusLoading(true);
    setMsg("Initiating database sync...");
    try {
      const response = await fetch("/api/v1/backfill/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate: syncFromDate, toDate: syncToDate }),
      });
      if (response.ok) {
        setMsg("Database sync initiated successfully!");
        fetchBackfillStatus();
      } else {
        const err = await response.json();
        setMsg(`Failed to start sync: ${err.error || "Unknown error"}`);
      }
    } catch (e: any) {
      setMsg(`Error triggering sync: ${e.message}`);
    } finally {
      setStatusLoading(false);
      setTimeout(() => setMsg(""), 5000);
    }
  };

  const handlePauseSync = async () => {
    setStatusLoading(true);
    try {
      const response = await fetch("/api/v1/backfill/pause", { method: "POST" });
      if (response.ok) {
        setMsg("Pausing signal sent. Sync will halt shortly.");
        fetchBackfillStatus();
      } else {
        setMsg("Failed to pause sync.");
      }
    } catch (e: any) {
      setMsg(`Error pausing sync: ${e.message}`);
    } finally {
      setStatusLoading(false);
      setTimeout(() => setMsg(""), 5000);
    }
  };

  const handleResetCache = async () => {
    if (!window.confirm("Are you sure you want to clear all cached sales, discounts, and reports data? This will wipe the database cache completely and start fresh!")) return;
    setStatusLoading(true);
    setMsg("Wiping all cache collections from Firestore (this might take up to a minute)...");
    try {
      const response = await fetch("/api/v1/backfill/reset", { method: "POST" });
      if (response.ok) {
        setMsg("All cached data cleared from Firestore successfully!");
        fetchBackfillStatus();
      } else {
        const err = await response.json();
        setMsg(`Wipe failed: ${err.error}`);
      }
    } catch (e: any) {
      setMsg(`Error clearing cache: ${e.message}`);
    } finally {
      setStatusLoading(false);
      setTimeout(() => setMsg(""), 5000);
    }
  };

  const handleAutomationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateAutomationSettings(autoSettings);
      setMsg("Automation settings saved successfully");
      fetchData();
    } catch (err) {
      setMsg("Failed to save automation settings");
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const handleMailerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateMailerSettings(mailerSettings);
      setMsg("Mailer configurations saved successfully");
      fetchData();
    } catch (err) {
      setMsg("Failed to save mailer configurations");
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const handleStartEditStore = (store: any) => {
    setEditingStoreId(store.id);
    setNewStore({
      id: store.id,
      name: store.name,
      brand: store.brand || "",
      active: store.active !== false
    });
  };

  const handleCancelEditStore = () => {
    setEditingStoreId(null);
    setNewStore({ id: "", name: "", brand: "", active: true });
  };

  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStore.id || !newStore.name) return;
    setLoading(true);
    try {
      await addStore(newStore);
      const isEdit = !!editingStoreId;
      setNewStore({ id: "", name: "", brand: "", active: true });
      setEditingStoreId(null);
      setMsg(isEdit ? "Store updated successfully" : "Store added successfully");
      fetchData();
    } catch (err) {
      setMsg("Failed to save store");
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.username || (!isEditingUser && !userForm.password)) return;

    setLoading(true);
    try {
      if (isEditingUser) {
        const { username, ...updates } = userForm;
        await updateUser(username!, updates);
        setMsg("User updated successfully");
      } else {
        await addUser(userForm as User);
        setMsg("User created successfully");
      }
      resetUserForm();
      fetchData();
    } catch (err) {
      setMsg("Error saving user");
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const resetUserForm = () => {
    setIsEditingUser(false);
    setUserForm({
      username: "",
      password: "",
      role: "user",
      name: "",
      allowedStores: [],
    });
  };

  const handleEditUser = (user: User) => {
    setIsEditingUser(true);
    setUserForm({
      username: user.username,
      name: user.name || "",
      role: user.role,
      allowedStores: user.allowedStores || [],
    });
    setTab("USERS");
  };

  const toggleStoreAccess = (storeId: string) => {
    const current = userForm.allowedStores || [];
    if (current.includes(storeId)) {
      setUserForm({
        ...userForm,
        allowedStores: current.filter((id) => id !== storeId),
      });
    } else {
      setUserForm({ ...userForm, allowedStores: [...current, storeId] });
    }
  };

  const handleResetPassword = async (username: string) => {
    if (!newPassword) return;
    setLoading(true);
    await updateUser(username, { password: newPassword });
    setEditingPassword(null);
    setNewPassword("");
    setMsg(`Password updated for ${username}`);
    setTimeout(() => setMsg(""), 3000);
    setLoading(false);
  };

  const handleDeleteUser = async (username: string) => {
    if (username === currentUser.username) return alert("Cannot delete self.");
    if (!confirm(`Delete user ${username}?`)) return;
    await deleteUser(username);
    fetchData();
  };

  const handleDeleteStore = async (id: string) => {
    if (!confirm(`Delete store ${id}?`)) return;
    await deleteStore(id);
    fetchData();
  };

  return (
    <div className="p-8 space-y-6 animate-fadeIn max-w-[1400px] mx-auto transition-colors duration-300">
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 pb-1 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => {
            setTab("STORES");
            resetUserForm();
          }}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${tab === "STORES" ? "border-rose-600 text-rose-600 dark:text-rose-400" : "text-slate-400"}`}
        >
          Store Locations
        </button>
        <button
          onClick={() => {
            setTab("USERS");
            resetUserForm();
          }}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${tab === "USERS" ? "border-rose-600 text-rose-600 dark:text-rose-400" : "text-slate-400"}`}
        >
          System Access
        </button>
        <button
          onClick={() => {
            setTab("AUTOMATION");
            resetUserForm();
          }}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${tab === "AUTOMATION" ? "border-rose-600 text-rose-600 dark:text-rose-400" : "text-slate-400"}`}
        >
          Report Automation
        </button>
        <button
          onClick={() => {
            setTab("MAILER");
            resetUserForm();
          }}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${tab === "MAILER" ? "border-rose-600 text-rose-600 dark:text-rose-400" : "text-slate-400"}`}
        >
          Mailer Setup
        </button>
        <button
          onClick={() => {
            setTab("LOGS");
            resetUserForm();
          }}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${tab === "LOGS" ? "border-rose-600 text-rose-600 dark:text-rose-400" : "text-slate-400"}`}
        >
          Logs History
        </button>
        <button
          onClick={() => {
            setTab("CACHING");
            resetUserForm();
          }}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${tab === "CACHING" ? "border-rose-600 text-rose-600 dark:text-rose-400" : "text-slate-400"}`}
        >
          Database Cache
        </button>
      </div>

      {msg && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 p-3 rounded-lg text-sm font-medium animate-fadeIn">
          {msg}
        </div>
      )}

      {tab === "CACHING" ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm transition-all space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 dark:border-slate-800 pb-6 gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Historical Database Caching
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Wipe, backfill, and monitor Firestore caching layers for high-speed offline analytics.
              </p>
            </div>
            <button
              onClick={handleResetCache}
              disabled={statusLoading || backfillStatus.status === "running"}
              className="px-4 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all disabled:opacity-50"
            >
              Reset & Clear Cache
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Range Pickers */}
            <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Range Configuration
              </h4>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={syncFromDate}
                  onChange={(e) => setSyncFromDate(e.target.value)}
                  disabled={backfillStatus.status === "running"}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={syncToDate}
                  onChange={(e) => setSyncToDate(e.target.value)}
                  disabled={backfillStatus.status === "running"}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all dark:text-white"
                />
              </div>
              <div className="pt-2">
                {backfillStatus.status === "running" ? (
                  <button
                    onClick={handlePauseSync}
                    disabled={statusLoading}
                    className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 shadow-md shadow-amber-500/10 active:scale-[0.98] transition-all text-sm"
                  >
                    Pause Synchronization
                  </button>
                ) : (
                  <button
                    onClick={handleStartSync}
                    disabled={statusLoading}
                    className="w-full py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 shadow-md shadow-rose-600/10 active:scale-[0.98] transition-all text-sm"
                  >
                    Start Synchronization
                  </button>
                )}
              </div>
            </div>

            {/* Sync Progress Status */}
            <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4 md:col-span-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Synchronization Progress
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Status</span>
                  <p className="text-lg font-black mt-1 capitalize text-rose-600 dark:text-rose-400">
                    {backfillStatus.status}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Current Day</span>
                  <p className="text-lg font-black mt-1 text-slate-800 dark:text-slate-100">
                    {backfillStatus.currentDate || "—"}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Days Synced</span>
                  <p className="text-lg font-black mt-1 text-slate-800 dark:text-slate-100">
                    {backfillStatus.completedDays} / {backfillStatus.totalDays}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Documents Cached</span>
                  <p className="text-lg font-black mt-1 text-slate-800 dark:text-slate-100">
                    {backfillStatus.totalSaved}
                  </p>
                </div>
              </div>

              {backfillStatus.status === "running" || backfillStatus.status === "paused" || backfillStatus.status === "completed" ? (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Overall Progress</span>
                    <span>
                      {backfillStatus.totalDays > 0
                        ? `${Math.round((backfillStatus.completedDays / backfillStatus.totalDays) * 100)}%`
                        : "0%"}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-600 h-full transition-all duration-500 rounded-full"
                      style={{
                        width: `${
                          backfillStatus.totalDays > 0
                            ? (backfillStatus.completedDays / backfillStatus.totalDays) * 100
                            : 0
                        }%`,
                      }}
                    ></div>
                  </div>
                  {backfillStatus.rangeStart && (
                    <p className="text-[10px] text-slate-400 italic">
                      Target Range: {backfillStatus.rangeStart} to {backfillStatus.rangeEnd}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-sm text-slate-400 italic">
                  Synchronization is currently idle. Configure a range on the left and click "Start Sync" to begin.
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Important Caching Guidelines
            </h4>
            <ul className="list-disc pl-5 text-xs text-slate-500 dark:text-slate-400 space-y-1.5 leading-relaxed">
              <li><strong>Safe Speeds</strong>: The sync fetches 4 venues concurrently and delays requests slightly. A one-month sync covers ~120 API requests per store and takes about 1-2 minutes to complete.</li>
              <li><strong>Offline Availability</strong>: Once a day is marked as cached in Firestore, your dashboard, manual exports, and automated daily mailing distributions will load immediately without querying the external LingaPOS servers.</li>
              <li><strong>Resiliency</strong>: If you pause or close the dashboard, you can resume later. The system skips already-cached days automatically.</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* FORM SIDE */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
            <h3 className="text-xs font-bold uppercase text-slate-400 mb-6 tracking-wider flex justify-between items-center">
              <span>
                {tab === "STORES"
                  ? (editingStoreId ? `Modify Store: ${newStore.id}` : "New Store Location")
                  : tab === "USERS"
                    ? (isEditingUser ? `Modify Account: ${userForm.username}` : "New User Account")
                    : tab === "AUTOMATION"
                      ? "Configure Automation"
                      : tab === "MAILER"
                        ? "Mailer Configurations"
                        : "Execution Summary"}
              </span>
              {tab === "STORES" && editingStoreId && (
                <button
                  onClick={handleCancelEditStore}
                  className="text-rose-600 normal-case font-bold hover:underline"
                >
                  Cancel Edit
                </button>
              )}
              {tab === "USERS" && isEditingUser && (
                <button
                  onClick={resetUserForm}
                  className="text-rose-600 normal-case font-bold hover:underline"
                >
                  Cancel Edit
                </button>
              )}
            </h3>

            {tab === "STORES" ? (
              <form onSubmit={handleAddStore} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                    Location Name
                  </label>
                  <input
                    value={newStore.name}
                    onChange={(e) =>
                      setNewStore({ ...newStore, name: e.target.value })
                    }
                    placeholder="e.g. Common Grounds MOE"
                    className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                    Linga Store ID
                  </label>
                  <input
                    value={newStore.id}
                    onChange={(e) =>
                      setNewStore({ ...newStore, id: e.target.value })
                    }
                    disabled={!!editingStoreId}
                    placeholder="Paste ID from Linga Dashboard"
                    className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono dark:text-white focus:ring-2 ring-rose-500/20 disabled:opacity-50 outline-none"
                  />
                </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                     Brand Name
                   </label>
                   <div className="flex flex-col gap-2">
                     <select
                       value={uniqueBrands.includes(newStore.brand || "") && (newStore.brand || "") !== "" ? (newStore.brand || "") : (newStore.brand === "" ? "" : "CUSTOM")}
                       onChange={(e) => {
                         const val = e.target.value;
                         if (val === "CUSTOM") {
                           setNewStore({ ...newStore, brand: "New Brand" });
                         } else {
                           setNewStore({ ...newStore, brand: val });
                         }
                       }}
                       className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20 outline-none"
                     >
                       <option value="">-- No Brand (Other) --</option>
                       {uniqueBrands.map((b: string) => (
                         <option key={b} value={b}>{b}</option>
                       ))}
                       <option value="CUSTOM">-- Create New Custom Brand --</option>
                     </select>
                     
                     {(!uniqueBrands.includes(newStore.brand || "") || newStore.brand === "New Brand" || !uniqueBrands.includes(newStore.brand)) && newStore.brand !== "" && (
                       <input
                         value={newStore.brand === "New Brand" ? "" : newStore.brand}
                         onChange={(e) =>
                           setNewStore({ ...newStore, brand: e.target.value })
                         }
                         placeholder="Enter custom brand name..."
                         className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20 outline-none"
                       />
                     )}
                   </div>
                 </div>
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Active Status</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Toggle to query/sync or ignore this venue location.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-auto">
                    <input
                      type="checkbox"
                      checked={newStore.active !== false}
                      onChange={(e) =>
                        setNewStore({ ...newStore, active: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-rose-600"></div>
                  </label>
                </div>
                <button
                  disabled={loading}
                  type="submit"
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
                >
                  {loading ? "Processing..." : (editingStoreId ? "Update Store" : "Register Store")}
                </button>
              </form>
            ) : tab === "USERS" ? (
              <form onSubmit={handleUserSubmit} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                    Full Display Name
                  </label>
                  <input
                    value={userForm.name || ""}
                    onChange={(e) =>
                      setUserForm({ ...userForm, name: e.target.value })
                    }
                    placeholder="e.g. Ahmed Manager"
                    className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                      User ID (Username)
                    </label>
                    <input
                      value={userForm.username}
                      onChange={(e) =>
                        setUserForm({ ...userForm, username: e.target.value })
                      }
                      disabled={isEditingUser}
                      placeholder="Login ID"
                      className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20 disabled:opacity-50 outline-none"
                    />
                  </div>
                  {!isEditingUser && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                        Initial Passkey
                      </label>
                      <input
                        value={userForm.password}
                        onChange={(e) =>
                          setUserForm({ ...userForm, password: e.target.value })
                        }
                        type="password"
                        placeholder="••••••••"
                        className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20 outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                    System Privilege Level
                  </label>
                  <select
                    value={userForm.role}
                    onChange={(e) =>
                      setUserForm({ ...userForm, role: e.target.value as any })
                    }
                    className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20 outline-none"
                  >
                    <option value="user">
                      Restricted User (Specific Store Access)
                    </option>
                    <option value="admin">
                      Administrator (All Stores, No System Edits)
                    </option>
                    <option value="superuser">
                      Super Admin (Full System Access)
                    </option>
                  </select>
                </div>

                {userForm.role === "user" && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                      Store Assignment (Multi-Select)
                    </label>
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 max-h-48 overflow-y-auto custom-scrollbar space-y-2">
                      {stores.map((store) => (
                        <label
                          key={store.id}
                          className="flex items-center gap-3 cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            checked={userForm.allowedStores?.includes(store.id)}
                            onChange={() => toggleStoreAccess(store.id)}
                            className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                          <span className="text-sm dark:text-slate-300 group-hover:text-rose-600 transition-colors">
                            {store.name}
                          </span>
                        </label>
                      ))}
                      {stores.length === 0 && (
                        <p className="text-xs text-slate-400 italic text-center py-2">
                          No registered stores found.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <button
                  disabled={loading}
                  type="submit"
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
                >
                  {loading
                    ? "Processing..."
                    : isEditingUser
                      ? "Confirm Account Changes"
                      : "Register New User"}
                </button>
              </form>
            ) : tab === "AUTOMATION" ? (
              <form onSubmit={handleAutomationSubmit} className="space-y-6 animate-fadeIn">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Daily Automated Email</span>
                      <span className="text-xs text-slate-400">Enable/disable automatic reports</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoSettings.enabled}
                        onChange={(e) => setAutoSettings({ ...autoSettings, enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                    </label>
                  </div>

                  {autoSettings.enabled && (
                    <>
                      <div className="space-y-2 animate-fadeIn">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                          Automated Report Types
                        </label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={autoSettings.reportTypes?.includes("Covers")}
                              onChange={(e) => {
                                const current = autoSettings.reportTypes || [];
                                const next = e.target.checked
                                  ? [...current, "Covers"]
                                  : current.filter((r) => r !== "Covers");
                                setAutoSettings({ ...autoSettings, reportTypes: next as any });
                              }}
                              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            />
                            <span className="text-sm dark:text-slate-300">Covers Report</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={autoSettings.reportTypes?.includes("Sales")}
                              onChange={(e) => {
                                const current = autoSettings.reportTypes || [];
                                const next = e.target.checked
                                  ? [...current, "Sales"]
                                  : current.filter((r) => r !== "Sales");
                                setAutoSettings({ ...autoSettings, reportTypes: next as any });
                              }}
                              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            />
                            <span className="text-sm dark:text-slate-300">Sales Report</span>
                          </label>
                        </div>
                      </div>

                      <div className="space-y-2 animate-fadeIn">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                          Included Store Locations (Multi-Select)
                        </label>
                        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 max-h-48 overflow-y-auto custom-scrollbar space-y-2">
                          {stores.map((store) => {
                            const isChecked = autoSettings.selectedStores?.includes(store.id) ?? false;
                            return (
                              <label
                                key={store.id}
                                className="flex items-center gap-3 cursor-pointer group"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    const current = autoSettings.selectedStores || [];
                                    const next = current.includes(store.id)
                                      ? current.filter((id) => id !== store.id)
                                      : [...current, store.id];
                                    setAutoSettings({ ...autoSettings, selectedStores: next });
                                  }}
                                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                                />
                                <span className="text-sm dark:text-slate-300 group-hover:text-rose-600 transition-colors">
                                  {store.name}
                                </span>
                              </label>
                            );
                          })}
                          {stores.length === 0 && (
                            <p className="text-xs text-slate-400 italic text-center py-2">
                              No registered stores found.
                            </p>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 ml-1">Leave all unchecked to include all stores by default.</p>
                      </div>

                      <div className="space-y-2 animate-fadeIn">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                          Report Distribution Time (Dubai Time / UTC+4)
                        </label>
                        <input
                          type="time"
                          value={autoSettings.fetchTime}
                          onChange={(e) => setAutoSettings({ ...autoSettings, fetchTime: e.target.value })}
                          className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20 outline-none"
                        />
                      </div>
                    </>
                  )}
                </div>

                <button
                  disabled={loading}
                  type="submit"
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
                >
                  {loading ? "Processing..." : "Save Automation Settings"}
                </button>
              </form>
            ) : tab === "MAILER" ? (
              <form onSubmit={handleMailerSubmit} className="space-y-4 animate-fadeIn">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                    SMTP Host
                  </label>
                  <input
                    value={mailerSettings.smtpHost || ""}
                    onChange={(e) => setMailerSettings({ ...mailerSettings, smtpHost: e.target.value })}
                    placeholder="e.g. smtp.hostinger.com"
                    className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20 outline-none"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                      SMTP Sender Username
                    </label>
                    <input
                      value={mailerSettings.smtpUser || ""}
                      onChange={(e) => setMailerSettings({ ...mailerSettings, smtpUser: e.target.value })}
                      placeholder="reports@yourdomain.com"
                      className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                      Port
                    </label>
                    <input
                      value={mailerSettings.smtpPort || ""}
                      onChange={(e) => setMailerSettings({ ...mailerSettings, smtpPort: e.target.value })}
                      placeholder="587"
                      className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20 outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                    SMTP Password / App Password
                  </label>
                  <input
                    type="password"
                    value={mailerSettings.smtpPass || ""}
                    onChange={(e) => setMailerSettings({ ...mailerSettings, smtpPass: e.target.value })}
                    placeholder="••••••••••••••••"
                    className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                    Email Subject Template
                  </label>
                  <input
                    value={mailerSettings.emailSubjectTemplate || ""}
                    onChange={(e) => setMailerSettings({ ...mailerSettings, emailSubjectTemplate: e.target.value })}
                    placeholder="e.g. {type} Report - {date}"
                    className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 ml-1">Supported placeholders: <code>{`{type}`}</code>, <code>{`{date}`}</code></p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                    Email Body Template
                  </label>
                  <textarea
                    value={mailerSettings.emailBodyTemplate || ""}
                    onChange={(e) => setMailerSettings({ ...mailerSettings, emailBodyTemplate: e.target.value })}
                    placeholder="Hello, please find attached the report..."
                    rows={4}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20 outline-none resize-none"
                  />
                  <p className="text-[10px] text-slate-400 ml-1">Supported placeholders: <code>{`{type}`}</code>, <code>{`{date}`}</code></p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                    Recipients List (Comma-Separated)
                  </label>
                  <input
                    value={mailerSettings.reportRecipients || ""}
                    onChange={(e) => setMailerSettings({ ...mailerSettings, reportRecipients: e.target.value })}
                    placeholder="boss@domain.com, accounts@domain.com"
                    className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20 outline-none"
                  />
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 my-4 pt-4 space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400">Google Drive Upload (Optional)</h4>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                      Folder ID
                    </label>
                    <input
                      value={mailerSettings.googleDriveFolderId || ""}
                      onChange={(e) => setMailerSettings({ ...mailerSettings, googleDriveFolderId: e.target.value })}
                      placeholder="Paste your Google Drive Folder ID"
                      className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                      Service Account JSON Key
                    </label>
                    <textarea
                      value={mailerSettings.googleServiceAccountKey || ""}
                      onChange={(e) => setMailerSettings({ ...mailerSettings, googleServiceAccountKey: e.target.value })}
                      placeholder='{"type": "service_account", ...}'
                      rows={4}
                      className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono dark:text-white focus:ring-2 ring-rose-500/20 outline-none resize-none"
                    />
                  </div>
                </div>
                <button
                  disabled={loading}
                  type="submit"
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
                >
                  {loading ? "Processing..." : "Save Mailer Settings"}
                </button>
              </form>
            ) : (
              <div className="space-y-6 animate-fadeIn text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Total Executions</p>
                    <p className="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-200">{reportLogs.length}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Successful Runs</p>
                    <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                      {reportLogs.filter(l => l.status === "SUCCESS").length}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Failed Runs</p>
                    <p className="text-2xl font-bold mt-1 text-rose-600 dark:text-rose-400">
                      {reportLogs.filter(l => l.status === "FAILED").length}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Success Rate</p>
                    <p className="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-200">
                      {reportLogs.length > 0
                        ? `${Math.round((reportLogs.filter(l => l.status === "SUCCESS").length / reportLogs.length) * 100)}%`
                        : "0%"}
                    </p>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Last Execution Timestamp</p>
                  <p className="text-sm font-semibold dark:text-slate-300">
                    {reportLogs[0] ? new Date(reportLogs[0].timestamp).toLocaleString() : "No runs logged yet."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
          {/* LIST SIDE */}
        <div className="lg:col-span-7">
          {tab === "AUTOMATION" ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 transition-colors h-full flex flex-col justify-between">
              <div className="space-y-6">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                  How Report Automation Works
                </h3>
                
                <div className="space-y-5 text-sm text-slate-600 dark:text-slate-400">
                  <div className="flex gap-4 items-start">
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-900/20 rounded-xl text-rose-600 dark:text-rose-400 font-bold shrink-0 text-xs">
                      1
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Yesterday's Date by Default</h4>
                      <p className="mt-1 text-xs leading-relaxed">The automation queries Linga API for the complete calendar day of <strong>yesterday</strong>. This avoids incomplete metrics or timezone mismatches from today's running sales.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-900/20 rounded-xl text-rose-600 dark:text-rose-400 font-bold shrink-0 text-xs">
                      2
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Automated Schedule & Timing</h4>
                      <p className="mt-1 text-xs leading-relaxed">If enabled, the script compares the current hour in Dubai (GST / UTC+4) with your configured Hour. At the target hour, the server fetches data from the registered venues, creates the Excel report, uploads it to Google Drive, and sends email notifications.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-900/20 rounded-xl text-rose-600 dark:text-rose-400 font-bold shrink-0 text-xs">
                      3
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Required Configuration</h4>
                      <p className="mt-1 text-xs leading-relaxed">
                        To enable automated reporting distributions and backup saves, please navigate to the <strong>Mailer Setup</strong> tab and input your SMTP credentials and Google Service Account Key.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : tab === "MAILER" ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 transition-colors h-full flex flex-col justify-between">
              <div className="space-y-6">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                  How Mailer Setup Works
                </h3>
                
                <div className="space-y-5 text-sm text-slate-600 dark:text-slate-400">
                  <div className="flex gap-4 items-start">
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-900/20 rounded-xl text-rose-600 dark:text-rose-400 font-bold shrink-0 text-xs">
                      1
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">SMTP Server Integration</h4>
                      <p className="mt-1 text-xs leading-relaxed">Enter your SMTP server host, port (commonly 587 for TLS or 465 for SSL), email address, and password. If you use Gmail/Outlook, remember to generate and use an <strong>App Password</strong> rather than your personal password.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-900/20 rounded-xl text-rose-600 dark:text-rose-400 font-bold shrink-0 text-xs">
                      2
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Automated and Manual Recipients</h4>
                      <p className="mt-1 text-xs leading-relaxed">Specify a comma-separated list of emails (e.g. <code>manager@brand.com, finance@brand.com</code>) to receive the Excel summaries. These recipients will be used when you click "Email & Save to Drive" in the tracker modules as well as during automated daily runs.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-900/20 rounded-xl text-rose-600 dark:text-rose-400 font-bold shrink-0 text-xs">
                      3
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Google Drive Permissions</h4>
                      <p className="mt-1 text-xs leading-relaxed">If utilizing Google Drive storage, enter the Folder ID and paste the entire JSON content of your Google Cloud Service Account credentials key. Be sure to share the Google Drive folder with the Service Account email address as an <strong>Editor</strong>.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : tab === "LOGS" ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-colors h-full flex flex-col">
              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                  Report Execution History
                </h3>
                <button
                  onClick={fetchData}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold transition-all"
                >
                  Refresh Logs
                </button>
              </div>
              <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-[10px] font-bold sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4">Run Details</th>
                      <th className="px-6 py-4">Status & Destination</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {reportLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                      >
                        <td className="px-6 py-4 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {log.reportType} Tracker
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider ${
                              log.type === "Automated"
                                ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                                : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                            }`}>
                              {log.type}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Data Date: <strong className="font-semibold">{log.reportDate}</strong>
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Run at: {new Date(log.timestamp).toLocaleString()}
                          </p>
                        </td>
                        <td className="px-6 py-4 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              log.status === "SUCCESS"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400"
                            }`}>
                              {log.status}
                            </span>
                          </div>
                          {log.status === "SUCCESS" ? (
                            <div className="text-[10px] space-y-0.5">
                              <p className="text-slate-400 truncate max-w-[200px]" title={log.recipients}>
                                To: <span className="text-slate-600 dark:text-slate-300 font-medium">{log.recipients}</span>
                              </p>
                              {log.driveLink && (
                                <a
                                  href={log.driveLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-rose-600 dark:text-rose-400 hover:underline font-bold inline-flex items-center gap-0.5"
                                >
                                  Google Drive File
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              )}
                            </div>
                          ) : (
                            <p className="text-[10px] text-rose-600 dark:text-rose-400 font-mono line-clamp-2 max-w-[250px]" title={log.errorMsg || ""}>
                              {log.errorMsg}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                    {reportLogs.length === 0 && (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-6 py-12 text-center text-slate-400 italic"
                        >
                          No execution logs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-colors h-full flex flex-col">
              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                  Active{" "}
                  {tab === "STORES" ? "Venue Registry" : "Authorized Personnel"}
                </h3>
              </div>
              <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-[10px] font-bold sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4">
                        {tab === "STORES" ? "Venue Details" : "Identity & Rights"}
                      </th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(tab === "STORES" ? stores : users).map((item: any) => (
                      <tr
                        key={item.id || item.username}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <p className="font-bold text-slate-800 dark:text-slate-200">
                              {item.name || item.username}
                            </p>
                            {tab === "STORES" ? (
                              <div className="space-y-1">
                                <p className="text-[10px] font-mono text-slate-400">
                                  ID: {item.id}
                                </p>
                                <div className="flex gap-2 items-center">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider ${
                                    item.active !== false
                                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                                      : "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
                                  }`}>
                                    {item.active !== false ? "Active" : "Inactive"}
                                  </span>
                                  {item.brand && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                      Brand: {item.brand}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2 items-center mt-1">
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider ${
                                    item.role === "superuser"
                                      ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
                                      : item.role === "admin"
                                        ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                  }`}
                                >
                                  {item.role}
                                </span>
                                {item.role === "user" && (
                                  <p className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[150px]">
                                    {item.allowedStores?.length || 0} Venues
                                    Assigned
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-wrap items-center gap-3 justify-end">
                            {tab === "USERS" &&
                            editingPassword === item.username ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="password"
                                  value={newPassword}
                                  onChange={(e) => setNewPassword(e.target.value)}
                                  placeholder="New Pass"
                                  className="w-24 h-9 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 ring-rose-500/20"
                                />
                                <button
                                  onClick={() =>
                                    handleResetPassword(item.username)
                                  }
                                  className="text-emerald-600 font-black text-[10px] uppercase hover:underline"
                                >
                                  Apply
                                </button>
                                <button
                                  onClick={() => setEditingPassword(null)}
                                  className="text-slate-400 font-black text-[10px] uppercase hover:underline"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : tab === "STORES" ? (
                              <button
                                onClick={() => handleStartEditStore(item)}
                                className="text-slate-500 hover:text-rose-600 font-black text-[10px] uppercase transition-all flex items-center gap-1"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                                Edit
                              </button>
                            ) : tab === "USERS" ? (
                              <>
                                <button
                                  onClick={() => handleEditUser(item)}
                                  className="text-slate-500 hover:text-rose-600 font-black text-[10px] uppercase transition-all flex items-center gap-1"
                                >
                                  <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                  </svg>
                                  Edit
                                </button>
                                <button
                                  onClick={() =>
                                    setEditingPassword(item.username)
                                  }
                                  className="text-slate-500 hover:text-rose-600 font-black text-[10px] uppercase transition-all flex items-center gap-1"
                                >
                                  <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                    />
                                  </svg>
                                  Pin
                                </button>
                              </>
                            ) : null}
                            <button
                              onClick={() =>
                                tab === "STORES"
                                  ? handleDeleteStore(item.id)
                                  : handleDeleteUser(item.username)
                              }
                              className="text-slate-300 group-hover:text-red-500 font-black text-[10px] uppercase transition-colors"
                              title="Remove Permanently"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(tab === "STORES" ? stores : users).length === 0 && (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-6 py-12 text-center text-slate-400 italic"
                        >
                          Inventory empty. No entries to display.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);
};

export default SettingsModule;
