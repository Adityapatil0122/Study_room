import React from "react";
import LucideIcon from "../icons/LucideIcon.jsx";
import { VIEW_DEFINITIONS } from "../../constants/views.js";

function Sidebar({
  activeView,
  onNavigate,
  branding = { logoUrl: "/images/abhyasika-logo.png" },
  allowedViews = [],
}) {
  const allowedList =
    allowedViews && allowedViews.length
      ? allowedViews
      : VIEW_DEFINITIONS.map((item) => item.id);
  const visibleItems = VIEW_DEFINITIONS.filter((item) =>
    allowedList.includes(item.id)
  );
  const logoSrc = branding?.logoUrl || "/images/abhyasika-logo.png";
  return (
    <aside className="relative hidden w-64 flex-none bg-white/70 px-5 py-6 shadow-2xl shadow-indigo-100/70 backdrop-blur-2xl transition-colors duration-300 dark:bg-gray-900/80 dark:text-slate-100 dark:shadow-black/50 lg:flex">
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-gradient-to-b from-indigo-100/70 via-white/70 to-white dark:from-gray-900/80 dark:via-gray-900/60 dark:to-gray-950/80" />
      <div className="flex h-full flex-col">
        <div className="">
          <div className="mx-auto bg-gradient-to-br flex h-12 w-15 items-center justify-center rounded-3xl ">
            <img
              src={logoSrc}
              alt="Aaradhya Abhyasika"
              className="h-20 w-20 w-auto rounded-3xl"
            />
          </div>
          {/* <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400">Welcome to</p>
          <h1 className="text-base font-semibold text-slate-800">Aaradhya Abhyasika</h1> */}
        </div>
 
        <nav className="mt-8 flex-1 space-y-2">
          {visibleItems.length === 0 ? (
            <p className="rounded-2xl border border-slate-100 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-500">
              No sections assigned to this role.
            </p>
          ) : null}
          {visibleItems.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`group relative flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition-colors duration-200 ${
                  active
                    ? "bg-gradient-to-r from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/30"
                    : "text-slate-500 hover:bg-white/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-gray-800/80 dark:hover:text-white"
                }`}
              >
                <div
                  className={`flex h-6 w-8 items-center justify-center rounded-xl text-sm transition ${
                    active
                      ? "border-white/30 bg-white/20 text-white"
                      : "border-slate-200 bg-white text-slate-600 group-hover:border-indigo-200 group-hover:text-indigo-600 dark:border-gray-700 dark:bg-gray-900 dark:text-slate-300 dark:group-hover:border-indigo-500 dark:group-hover:text-indigo-300"
                  }`}
                >
                  <LucideIcon name={item.icon} className="h-4 w-4" strokeWidth={2} />
                </div>
                <span className="text-sm font-semibold">{item.label}</span>
                {active ? (
                  <span className="ml-auto h-2 w-2 rounded-full bg-white" />
                ) : null}
              </button>
            );
          })}
        </nav>
{/* 
        {admin ? (
          <div className="mt-6 rounded-3xl border border-white/60 bg-white/80 p-4 text-sm text-slate-700 shadow-lg shadow-indigo-100/50">
            <p className="text-xs uppercase tracking-wide text-slate-400">Logged in as</p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {admin.name || admin.email}
            </p>
            <p className="text-xs text-slate-500">{admin.email}</p>
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-100/60 px-3 py-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 text-slate-600">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Live sync
              </span>
              <span>v1.0</span>
            </div>
            <button
              onClick={onLogout}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <LucideIcon name="Power" className="h-3.5 w-3.5" />
              Log out
            </button>
          </div>
        ) : null} */}
      </div>
    </aside>
  );
}

export default Sidebar;
