import React, { useState, useEffect } from "react";
import { AuthContext } from "./AuthContextInstance";
import type { User } from "./AuthContextTypes";
import { validateStoredAuth, setupTokenRefresh } from "../utils/auth-validation";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    // Validate stored authentication on mount
    const authData = validateStoredAuth();
    
    if (authData) {
      setUser(authData.user as unknown as User);
    } else {
      // Clear any stale data
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }
    
    setIsValidating(false);

    // Setup automatic token refresh and expiration check
    const cleanup = setupTokenRefresh(() => {
      const token = localStorage.getItem("token");
      const userData = localStorage.getItem("user");
      const hasValidSessionArtifacts =
        Boolean(token && token !== "null" && token !== "undefined") ||
        Boolean(userData && userData !== "null" && userData !== "undefined");

      if (!hasValidSessionArtifacts) {
        return;
      }

      // Token expired or refresh failed
      setUser(null);
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    });

    return cleanup;
  }, []);

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  // Show loading state while validating
  if (isValidating) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}


