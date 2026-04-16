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
  getStoredUserType,
  setStoredUserType,
} from "../lib/sessionStorage.js";

const AuthContext = createContext(null);

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:4000/api";

export function AuthProvider({ children }) {
  const api = useMemo(() => createApiClient(), []);
  const [session, setSession] = useState(null);
  const [userType, setUserType] = useState(null); // "admin" | "student" | null
  const [admin, setAdmin] = useState(null);
  const [student, setStudent] = useState(null);
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

  const applySession = useCallback(async (nextSession, nextUserType) => {
    setSession(nextSession);
    setUserType(nextUserType ?? null);

    if (nextSession?.user && nextUserType === "admin") {
      const { user } = nextSession;
      setAdmin({
        email: user.email,
        name: user.user_metadata?.name ?? user.email,
        id: user.id,
      });
      setStudent(null);
      setAuthError("");
      await setStoredSession(nextSession).catch(() => {});
      await setStoredUserType("admin").catch(() => {});
    } else if (nextSession?.user && nextUserType === "student") {
      const { user } = nextSession;
      setStudent({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name ?? user.email,
        phone: user.user_metadata?.phone ?? null,
      });
      setAdmin(null);
      setAuthError("");
      await setStoredSession(nextSession).catch(() => {});
      await setStoredUserType("student").catch(() => {});
    } else {
      setAdmin(null);
      setStudent(null);
      await clearStoredSession().catch(() => {});
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapSession() {
      const stored = await getStoredSession();
      const storedType = await getStoredUserType();

      if (!stored?.access_token) {
        if (isMounted) {
          await applySession(null, null);
          setAuthInitializing(false);
        }
        return;
      }

      try {
        let refreshed;
        if (storedType === "student") {
          refreshed = await api.getStudentSession();
        } else {
          refreshed = await api.getCurrentSession();
        }
        if (!isMounted) return;
        await applySession(refreshed, storedType ?? "admin");
      } catch {
        if (!isMounted) return;
        await applySession(null, null);
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
  }, [api, applySession]);

  useEffect(() => {
    let isMounted = true;
    async function loadRole() {
      if (userType !== "admin") {
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
  }, [api, userType, session?.user?.user_metadata?.role_ids]);

  const login = useCallback(
    async (email, password) => {
      setAuthError("");
      setAuthLoading(true);
      try {
        const nextSession = await api.login(email, password);
        await applySession(nextSession, "admin");
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
    [api, applySession]
  );

  const studentLogin = useCallback(
    async (email, password) => {
      setAuthError("");
      setAuthLoading(true);
      try {
        const nextSession = await api.studentLogin(email, password);
        await applySession(nextSession, "student");
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
    [api, applySession]
  );

  const studentRegister = useCallback(
    async (payload) => {
      setAuthError("");
      setAuthLoading(true);
      try {
        const nextSession = await api.studentRegister(payload);
        await applySession(nextSession, "student");
        return nextSession?.user ?? null;
      } catch (err) {
        const message = err?.message ?? "Unable to create your account.";
        setAuthError(message);
        throw new Error(message);
      } finally {
        setAuthLoading(false);
      }
    },
    [api, applySession]
  );

  const logout = useCallback(async () => {
    setAuthError("");
    await applySession(null, null);
  }, [applySession]);

  const getAccessToken = useCallback(async () => {
    return session?.access_token ?? null;
  }, [session?.access_token]);

  const hasPermission = useCallback(
    (viewId, action = "view") => {
      if (userType !== "admin") return false;
      if (!viewId) return false;
      const perms = rolePermissions?.[viewId];
      if (!perms) return false;
      return Boolean(perms[action]);
    },
    [rolePermissions, userType]
  );

  const value = useMemo(
    () => ({
      apiBaseUrl: API_BASE_URL,
      api,
      session,
      token: session?.access_token ?? null,
      userType,
      admin,
      student,
      activeRole,
      allowedViews,
      rolePermissions,
      isAuthenticated: Boolean(session?.access_token),
      authInitializing,
      authLoading,
      authError,
      login,
      studentLogin,
      studentRegister,
      logout,
      getAccessToken,
      hasPermission,
      clearAuthError: () => setAuthError(""),
    }),
    [
      api,
      session,
      userType,
      admin,
      student,
      activeRole,
      allowedViews,
      rolePermissions,
      authInitializing,
      authLoading,
      authError,
      login,
      studentLogin,
      studentRegister,
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
