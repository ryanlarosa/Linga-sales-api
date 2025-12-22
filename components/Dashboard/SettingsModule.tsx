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

  const [newStore, setNewStore] = useState({ id: "", name: "" });
  const [newUser, setNewUser] = useState<Partial<User>>({
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
    await addStore(newStore);
    setNewStore({ id: "", name: "" });
    setMsg("Store added successfully");
    fetchData();
    setTimeout(() => setMsg(""), 3000);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) return;
    setLoading(true);
    await addUser(newUser as User);
    setNewUser({
      username: "",
      password: "",
      role: "user",
      name: "",
      allowedStores: [],
    });
    setMsg("User created successfully");
    fetchData();
    setTimeout(() => setMsg(""), 3000);
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
    <div className="p-8 space-y-6 animate-fadeIn max-w-[1200px] mx-auto transition-colors duration-300">
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 pb-1">
        <button
          onClick={() => setTab("STORES")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
            tab === "STORES"
              ? "border-rose-600 text-rose-600 dark:text-rose-400"
              : "text-slate-400"
          }`}
        >
          Store Locations
        </button>
        <button
          onClick={() => setTab("USERS")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
            tab === "USERS"
              ? "border-rose-600 text-rose-600 dark:text-rose-400"
              : "text-slate-400"
          }`}
        >
          System Access
        </button>
      </div>

      {msg && (
        <div className="bg-emerald-50 text-emerald-600 border border-emerald-100 p-3 rounded-lg text-sm font-medium transition-all">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-fit transition-colors">
          <h3 className="text-xs font-bold uppercase text-slate-400 mb-4 tracking-wider">
            {tab === "STORES" ? "New Store Location" : "New User Account"}
          </h3>
          <form
            onSubmit={tab === "STORES" ? handleAddStore : handleAddUser}
            className="space-y-4"
          >
            {tab === "STORES" ? (
              <>
                <input
                  value={newStore.name}
                  onChange={(e) =>
                    setNewStore({ ...newStore, name: e.target.value })
                  }
                  placeholder="Location Name"
                  className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20"
                />
                <input
                  value={newStore.id}
                  onChange={(e) =>
                    setNewStore({ ...newStore, id: e.target.value })
                  }
                  placeholder="Linga Store ID"
                  className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono dark:text-white focus:ring-2 ring-rose-500/20"
                />
              </>
            ) : (
              <>
                <input
                  value={newUser.name}
                  onChange={(e) =>
                    setNewUser({ ...newUser, name: e.target.value })
                  }
                  placeholder="Full Display Name"
                  className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    value={newUser.username}
                    onChange={(e) =>
                      setNewUser({ ...newUser, username: e.target.value })
                    }
                    placeholder="User ID"
                    className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20"
                  />
                  <input
                    value={newUser.password}
                    onChange={(e) =>
                      setNewUser({ ...newUser, password: e.target.value })
                    }
                    type="password"
                    placeholder="Passkey"
                    className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm dark:text-white focus:ring-2 ring-rose-500/20"
                  />
                </div>
              </>
            )}
            <button
              disabled={loading}
              type="submit"
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-600/20 transition-all"
            >
              {loading ? "Saving..." : "Confirm Addition"}
            </button>
          </form>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-colors">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase text-[10px] font-bold">
              <tr>
                <th className="px-6 py-4">
                  {tab === "STORES" ? "Store Name" : "Identity"}
                </th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(tab === "STORES" ? stores : users).map((item: any) => (
                <tr
                  key={item.id || item.username}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <p className="font-medium dark:text-slate-200">
                      {item.name || item.username}
                    </p>
                    {item.role && (
                      <p className="text-[10px] text-slate-400 uppercase font-bold">
                        {item.role}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    {tab === "USERS" && editingPassword === item.username ? (
                      <div className="flex items-center gap-2 justify-end">
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="New Pass"
                          className="w-24 h-8 px-2 text-xs border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950"
                        />
                        <button
                          onClick={() => handleResetPassword(item.username)}
                          className="text-emerald-600 font-bold text-xs uppercase"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingPassword(null)}
                          className="text-slate-400 font-bold text-xs uppercase"
                        >
                          X
                        </button>
                      </div>
                    ) : tab === "USERS" ? (
                      <button
                        onClick={() => setEditingPassword(item.username)}
                        className="text-rose-600 font-bold text-xs uppercase hover:underline"
                      >
                        Reset Pass
                      </button>
                    ) : null}
                    <button
                      onClick={() =>
                        tab === "STORES"
                          ? handleDeleteStore(item.id)
                          : handleDeleteUser(item.username)
                      }
                      className="text-slate-400 hover:text-red-500 font-bold text-xs uppercase transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SettingsModule;
