import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authAPI } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");
    if (token) {
      authAPI
        .getMe()
        .then((u) => { if (!cancelled) setUser(u); })
        .catch(() => { if (!cancelled) localStorage.removeItem("token"); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    // Always schedule setLoading(false) for the no-token path via microtask
    if (!token) {
      Promise.resolve().then(() => { if (!cancelled) setLoading(false); });
    }
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email, password) => {
    const { user, token } = await authAPI.login(email, password);
    localStorage.setItem("token", token);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (name, email, password, phone) => {
    const { user, token } = await authAPI.register(name, email, password, phone);
    localStorage.setItem("token", token);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
