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
} from "../../services/firestoreService";

interface SettingsModuleProps {
  currentUser: User;
}

const SettingsModule: React.FC<SettingsModuleProps> = ({ currentUser }) => {
  const [tab, setTab] = useState<"STORES" | "USERS">("STORES");
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

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
      const [s, u] = await Promise.all([getStores(), getUsers()]);
      setStores(s || []);
      setUsers(u || []);
    } catch (err) {
      console.error("Failed to fetch settings data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
          onClick={() => setTab("USERS")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${tab === "USERS" ? "border-rose-600 text-rose-600 dark:text-rose-400" : "text-slate-400"}`}
        >
          System Access
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
                  : isEditingUser
                    ? `Modify Account: ${userForm.username}`
                    : "New User Account"}
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
                    className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20"
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
                    className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono dark:text-white focus:ring-2 ring-rose-500/20"
                  />
                </div>
                <button
                  disabled={loading}
                  type="submit"
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-600/20 transition-all"
                >
                  {loading ? "Processing..." : "Register Store"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleUserSubmit} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                    Full Display Name
                  </label>
                  <input
                    value={userForm.name}
                    onChange={(e) =>
                      setUserForm({ ...userForm, name: e.target.value })
                    }
                    placeholder="e.g. Ahmed Manager"
                    className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20"
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
                      className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20 disabled:opacity-50"
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
                        className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20"
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
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-600/20 transition-all"
                >
                  {loading
                    ? "Processing..."
                    : isEditingUser
                      ? "Confirm Account Changes"
                      : "Register New User"}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* LIST SIDE */}
        <div className="lg:col-span-7">
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
        </div>
      </div>
    </div>
  );
};

export default SettingsModule;
