import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createApiClient } from "../lib/apiClient.js";
import {
  buildPermissionTemplate,
  normalizePermissions,
  ALL_VIEW_IDS,
} from "../constants/views.js";
import {
  clearStoredSession,
  getStoredSession,
  setStoredSession,
} from "../lib/sessionStorage.js";

const AuthContext = createContext(null);

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:4000/api";

export function AuthProvider({ children }) {
  const api = useMemo(() => createApiClient(), []);
  const [session, setSession] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [authInitializing, setAuthInitializing] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [activeRole, setActiveRole] = useState(null);
  const [allowedViews, setAllowedViews] = useState(ALL_VIEW_IDS);
  const [rolePermissions, setRolePermissions] = useState(() =>
    buildPermissionTemplate({
      view: true,
      add: true,
      edit: true,
      delete: true,
    })
  );

  const syncFromSession = useCallback((nextSession) => {
    setSession(nextSession);
    if (nextSession?.user) {
      const { user } = nextSession;
      setAdmin({
        email: user.email,
        name: user.user_metadata?.name ?? user.email,
        id: user.id,
      });
      setAuthError("");
      setStoredSession(nextSession).catch(() => {});
    } else {
      setAdmin(null);
      clearStoredSession().catch(() => {});
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapSession() {
      const stored = await getStoredSession();
      if (!stored?.access_token) {
        if (isMounted) {
          syncFromSession(null);
          setAuthInitializing(false);
        }
        return;
      }

      try {
        const refreshed = await api.getCurrentSession();
        if (!isMounted) return;
        syncFromSession(refreshed);
      } catch {
        if (!isMounted) return;
        syncFromSession(null);
      } finally {
        if (isMounted) {
          setAuthInitializing(false);
        }
      }
    }

    bootstrapSession();
    return () => {
      isMounted = false;
    };
  }, [api, syncFromSession]);

  useEffect(() => {
    let isMounted = true;
    async function loadRole() {
      const roleId = session?.user?.user_metadata?.role_ids?.[0];
      if (!roleId) {
        if (isMounted) {
          setActiveRole(null);
          setAllowedViews(ALL_VIEW_IDS);
          setRolePermissions(
            buildPermissionTemplate({
              view: true,
              add: true,
              edit: true,
              delete: true,
            })
          );
        }
        return;
      }

      try {
        const roles = await api.listRoles();
        if (!isMounted) return;
        const role = roles.find((item) => item.id === roleId);
        if (!role) {
          setActiveRole(null);
          setAllowedViews(ALL_VIEW_IDS);
          return;
        }
        const normalizedPermissions = normalizePermissions(role.permissions);
        setActiveRole(role);
        setRolePermissions(normalizedPermissions);
        const allowed = Object.entries(normalizedPermissions)
          .filter(([, perms]) => perms.view)
          .map(([viewId]) => viewId);
        setAllowedViews(allowed.length ? allowed : ALL_VIEW_IDS);
      } catch {
        if (!isMounted) return;
        setActiveRole(null);
        setAllowedViews(ALL_VIEW_IDS);
      }
    }

    loadRole();
    return () => {
      isMounted = false;
    };
  }, [api, session?.user?.user_metadata?.role_ids]);

  const login = useCallback(
    async (email, password) => {
      setAuthError("");
      setAuthLoading(true);
      try {
        const nextSession = await api.login(email, password);
        syncFromSession(nextSession);
        return nextSession?.user ?? null;
      } catch (err) {
        const message =
          err?.message ?? "Unable to sign in. Please check your credentials.";
        setAuthError(message);
        throw new Error(message);
      } finally {
        setAuthLoading(false);
      }
    },
    [api, syncFromSession]
  );

  const logout = useCallback(async () => {
    setAuthError("");
    syncFromSession(null);
  }, [syncFromSession]);

  const getAccessToken = useCallback(async () => {
    return session?.access_token ?? null;
  }, [session?.access_token]);

  const hasPermission = useCallback(
    (viewId, action = "view") => {
      if (!viewId) return false;
      const perms = rolePermissions?.[viewId];
      if (!perms) return false;
      return Boolean(perms[action]);
    },
    [rolePermissions]
  );

  const value = useMemo(
    () => ({
      apiBaseUrl: API_BASE_URL,
      session,
      token: session?.access_token ?? null,
      admin,
      activeRole,
      allowedViews,
      rolePermissions,
      isAuthenticated: Boolean(session?.access_token),
      authInitializing,
      authLoading,
      authError,
      login,
      logout,
      getAccessToken,
      hasPermission,
    }),
    [
      session,
      admin,
      activeRole,
      allowedViews,
      rolePermissions,
      authInitializing,
      authLoading,
      authError,
      login,
      logout,
      getAccessToken,
      hasPermission,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider />");
  }
  return ctx;
}
