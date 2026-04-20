import React from "react";
import LucideIcon from "../icons/LucideIcon.jsx";
import { VIEW_DEFINITIONS } from "../../constants/views.js";

function MobileNav({
  activeView,
  onNavigate,
  allowedViews = [],
  branding = { logoUrl: "/images/abhyasika-logo.png" },
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
    <div className="sticky top-0 z-40 border-b border-white/60 bg-white/90 px-3 py-3 shadow-sm backdrop-blur transition-colors duration-300 dark:border-gray-800 dark:bg-gray-950/70 lg:hidden">
      <div className="mb-2 flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900/70">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-white shadow ring-2 ring-indigo-100 flex items-center justify-center overflow-hidden">
            <img
              src={logoSrc}
              alt="Aradhya Abhyasika"
              className="h-10 w-10 object-contain"
              onError={(e) => { e.currentTarget.src = "/images/abhyasika-logo.png"; }}
            />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight">Aradhya Abhyasika</p>
            <p className="text-[10px] uppercase tracking-widest text-indigo-400">Admin Panel</p>
          </div>
        </div>
        {allowedList.includes("settings") ? (
          <button
            onClick={() => onNavigate("settings")}
            className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 dark:border-gray-700 dark:text-slate-300 dark:hover:border-indigo-400 dark:hover:text-indigo-200"
          >
            <LucideIcon name="Settings2" className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {visibleItems.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                active
                  ? "border-slate-900 bg-slate-900 text-white shadow dark:border-indigo-400 dark:bg-indigo-500"
                  : "border-slate-200 bg-white/70 text-slate-600 hover:border-indigo-200 hover:text-indigo-600 dark:border-gray-700 dark:bg-gray-900/70 dark:text-slate-300 dark:hover:border-indigo-400 dark:hover:text-indigo-200"
              }`}
            >
              <LucideIcon name={item.icon} className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MobileNav;
