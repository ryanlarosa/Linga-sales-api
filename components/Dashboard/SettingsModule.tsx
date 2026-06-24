import React, { useState, useEffect } from "react";
import { User, Store } from "../../types";
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
} from "../../services/firestoreService";
import { MailerSettings } from "../../types";

interface SettingsModuleProps {
  currentUser: User;
}

const SettingsModule: React.FC<SettingsModuleProps> = ({ currentUser }) => {
  const [tab, setTab] = useState<"STORES" | "USERS" | "AUTOMATION" | "MAILER">("STORES");
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  
  // Automation settings state
  const [autoSettings, setAutoSettings] = useState({ enabled: true, fetchTime: "08:00" });

  // Mailer settings state
  const [mailerSettings, setMailerSettings] = useState<MailerSettings>({
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    smtpPass: "",
    reportRecipients: "",
    googleDriveFolderId: "",
    googleServiceAccountKey: "",
  });

  // Store Form State
  const [newStore, setNewStore] = useState({ id: "", name: "" });

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
      const [s, u, auto, mailer] = await Promise.all([
        getStores(),
        getUsers(),
        getAutomationSettings(),
        getMailerSettings()
      ]);
      setStores(s || []);
      setUsers(u || []);
      setAutoSettings(auto || { enabled: true, fetchTime: "08:00" });
      if (mailer) {
        setMailerSettings(mailer);
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

  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStore.id || !newStore.name) return;
    setLoading(true);
    try {
      await addStore(newStore);
      setNewStore({ id: "", name: "" });
      setMsg("Store added successfully");
      fetchData();
    } catch (err) {
      setMsg("Failed to add store");
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
      </div>

      {msg && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 p-3 rounded-lg text-sm font-medium animate-fadeIn">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* FORM SIDE */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
            <h3 className="text-xs font-bold uppercase text-slate-400 mb-6 tracking-wider flex justify-between items-center">
              <span>
                {tab === "STORES"
                  ? "New Store Location"
                  : tab === "USERS"
                    ? (isEditingUser ? `Modify Account: ${userForm.username}` : "New User Account")
                    : tab === "AUTOMATION"
                      ? "Configure Automation"
                      : "Mailer Configurations"}
              </span>
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
                    placeholder="Paste ID from Linga Dashboard"
                    className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono dark:text-white focus:ring-2 ring-rose-500/20 outline-none"
                  />
                </div>
                <button
                  disabled={loading}
                  type="submit"
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
                >
                  {loading ? "Processing..." : "Register Store"}
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
                    <div className="space-y-2 animate-fadeIn">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                        Report Distribution Time (Dubai Time / UTC+4)
                      </label>
                      <select
                        value={autoSettings.fetchTime}
                        onChange={(e) => setAutoSettings({ ...autoSettings, fetchTime: e.target.value })}
                        className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20 outline-none"
                      >
                        {Array.from({ length: 24 }).map((_, idx) => {
                          const hour = String(idx).padStart(2, "0");
                          const label = idx === 0 
                            ? "12:00 AM (Midnight)" 
                            : idx === 12 
                              ? "12:00 PM (Noon)" 
                              : idx < 12 
                                ? `${idx}:00 AM` 
                                : `${idx - 12}:00 PM`;
                          return (
                            <option key={hour} value={`${hour}:00`}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    </div>
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
            ) : (
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
                              <p className="text-[10px] font-mono text-slate-400">
                                {item.id}
                              </p>
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
    </div>
  );
};

export default SettingsModule;
