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
  COORDINATOR_PERMISSIONS,
  COORDINATOR_VIEW_IDS,
  buildPermissionTemplate,
  normalizePermissions,
} from "../constants/views.js";
import { ALL_VIEW_IDS } from "../constants/views.js";
import {
  clearStoredSession,
  getStoredSession,
  getStoredUserType,
  setStoredSession,
  setStoredUserType,
} from "../lib/sessionStorage.js";

const AuthContext = createContext(null);

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

const isCoordinatorSession = (session) => {
  const roleNames = session?.user?.user_metadata?.role_names ?? [];
  return roleNames.some(
    (role) => role?.trim?.().toLowerCase() === "coordinator"
  );
};

export function AuthProvider({ children }) {
  const api = useMemo(() => createApiClient(), []);
  const [session, setSession] = useState(null);
  const [userType, setUserType] = useState(null);
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

  const applySession = useCallback((nextSession, nextUserType) => {
    const resolvedUserType =
      nextUserType === "admin" && isCoordinatorSession(nextSession)
        ? "coordinator"
        : nextUserType;

    setSession(nextSession);
    setUserType(resolvedUserType ?? null);

    if (
      nextSession?.user &&
      (resolvedUserType === "admin" || resolvedUserType === "coordinator")
    ) {
      const { user } = nextSession;
      setAdmin({
        email: user.email,
        name: user.user_metadata?.name ?? user.email,
        id: user.id,
      });
      setStudent(null);
      setAuthError("");
      setStoredSession(nextSession);
      setStoredUserType(resolvedUserType);
      if (resolvedUserType === "coordinator") {
        setAllowedViews(COORDINATOR_VIEW_IDS);
        setRolePermissions(COORDINATOR_PERMISSIONS);
      } else {
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
    } else if (nextSession?.user && resolvedUserType === "student") {
      const { user } = nextSession;
      setStudent({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name ?? user.email,
        phone: user.user_metadata?.phone ?? null,
      });
      setAdmin(null);
      setAuthError("");
      setStoredSession(nextSession);
      setStoredUserType("student");
    } else {
      setAdmin(null);
      setStudent(null);
      clearStoredSession();
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapSession() {
      const stored = getStoredSession();
      const storedType = getStoredUserType();
      if (!stored?.access_token) {
        if (isMounted) {
          applySession(null, null);
          setAuthInitializing(false);
        }
        return;
      }

      try {
        const refreshed =
          storedType === "student"
            ? await api.getStudentSession()
            : await api.getCurrentSession();
        if (!isMounted) return;
        applySession(refreshed, storedType === "student" ? "student" : "admin");
      } catch {
        if (!isMounted) return;
        applySession(null, null);
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
      if (userType !== "admin" && userType !== "coordinator") {
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
          if (userType === "coordinator") {
            setAllowedViews(COORDINATOR_VIEW_IDS);
            setRolePermissions(COORDINATOR_PERMISSIONS);
          } else {
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
        }
        return;
      }

      try {
        const roles = await api.listRoles();
        if (!isMounted) return;
        const role = roles.find((item) => item.id === roleId);
        if (!role) {
          setActiveRole(null);
          if (userType === "coordinator") {
            setAllowedViews(COORDINATOR_VIEW_IDS);
            setRolePermissions(COORDINATOR_PERMISSIONS);
          } else {
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

        const normalizedPermissions = normalizePermissions(role.permissions);
        setActiveRole(role);
        setRolePermissions(normalizedPermissions);
        const allowed = Object.entries(normalizedPermissions)
          .filter(([, perms]) => perms.view)
          .map(([viewId]) => viewId);
        setAllowedViews(
          allowed.length
            ? allowed
            : userType === "coordinator"
            ? COORDINATOR_VIEW_IDS
            : ALL_VIEW_IDS
        );
      } catch {
        if (!isMounted) return;
        setActiveRole(null);
        if (userType === "coordinator") {
          setAllowedViews(COORDINATOR_VIEW_IDS);
          setRolePermissions(COORDINATOR_PERMISSIONS);
        } else {
          setAllowedViews(ALL_VIEW_IDS);
        }
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
        applySession(nextSession, "admin");
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
        applySession(nextSession, "student");
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

  const unifiedLogin = useCallback(
    async (email, password) => {
      setAuthError("");
      setAuthLoading(true);
      try {
        try {
          const adminSession = await api.login(email, password);
          const resolvedUserType = isCoordinatorSession(adminSession)
            ? "coordinator"
            : "admin";
          applySession(adminSession, resolvedUserType);
          return { userType: resolvedUserType, user: adminSession?.user ?? null };
        } catch (adminErr) {
          try {
            const studentSession = await api.studentLogin(email, password);
            applySession(studentSession, "student");
            return { userType: "student", user: studentSession?.user ?? null };
          } catch (studentErr) {
            const message =
              studentErr?.message ??
              adminErr?.message ??
              "Invalid email or password.";
            setAuthError(message);
            throw new Error(message);
          }
        }
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
        applySession(nextSession, "student");
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
    applySession(null, null);
  }, [applySession]);

  const getAccessToken = useCallback(async () => {
    return session?.access_token ?? null;
  }, [session?.access_token]);

  const hasPermission = useCallback(
    (viewId, action = "view") => {
      if (userType !== "admin" && userType !== "coordinator") return false;
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
      unifiedLogin,
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
      unifiedLogin,
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
