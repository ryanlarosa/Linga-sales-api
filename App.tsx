import React, { useState, PropsWithChildren } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginScreen from "./components/LoginScreen";
import Dashboard from "./components/Dashboard";
import { User } from "./types";

interface ProtectedRouteProps {
  isAllowed: boolean;
}

const ProtectedRoute = ({ isAllowed, children }: PropsWithChildren<ProtectedRouteProps>) => {
  if (!isAllowed) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  const handleLogin = (userData: User) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginScreen onLogin={handleLogin} />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute isAllowed={!!user}>
              <Dashboard user={user!} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </Router>
  );
}

export default App;