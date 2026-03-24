"use client";

import { useEffect, useState } from "react";
import DashboardView from "./DashboardView";
import LoginScreen from "./LoginScreen";
import { loadAppState, saveAppState, SESSION_KEY } from "@/lib/storage";

export default function AppShell() {
  const [hydrated, setHydrated] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [state, setState] = useState(null);

  useEffect(() => {
    const session = window.localStorage.getItem(SESSION_KEY) === "true";
    setIsLoggedIn(session);
    setState(loadAppState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !state) return;
    saveAppState(state);
  }, [hydrated, state]);

  const handleLogin = () => {
    window.localStorage.setItem(SESSION_KEY, "true");
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    window.localStorage.removeItem(SESSION_KEY);
    setIsLoggedIn(false);
  };

  if (!hydrated || !state) {
    return <main className="login-page" />;
  }

  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <DashboardView state={state} setState={setState} onLogout={handleLogout} />;
}