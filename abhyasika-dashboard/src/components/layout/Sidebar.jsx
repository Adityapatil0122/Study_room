import React, { useState, useEffect } from "react";
import PhosphorIcon from "../icons/PhosphorIcon.jsx";
import { VIEW_DEFINITIONS } from "../../constants/views.js";

const PHOSPHOR_ICONS = {
  coordinator: "ClipboardText",
  dashboard: "ChartBar",
  students: "Users",
  seats: "Armchair",
  payments: "CreditCard",
  paymentRequests: "PaperPlaneTilt",
  renewals: "CalendarCheck",
  reports: "ChartPie",
  admissions: "QrCode",
  history: "ClockCounterClockwise",
  expenses: "Wallet",
  settings: "GearSix",
};

function Sidebar({
  activeView,
  onNavigate,
  branding = { logoUrl: "/images/abhyasika-logo.png" },
  allowedViews = [],
  onLogout,
  sidebarOpen,
}) {
  const [collapsed, setCollapsed] = useState(false);

  // When hamburger toggles sidebarOpen, expand the sidebar
  useEffect(() => {
    if (sidebarOpen) setCollapsed(false);
    else setCollapsed(true);
  }, [sidebarOpen]);

  const allowedList =
    allowedViews && allowedViews.length
      ? allowedViews
      : VIEW_DEFINITIONS.map((item) => item.id);
  const visibleItems = VIEW_DEFINITIONS.filter((item) =>
    allowedList.includes(item.id)
  );
  const logoSrc = branding?.logoUrl || "/images/abhyasika-logo.png";

  return (
    <aside
      className={`
        relative flex flex-col bg-white border-r border-slate-100 flex-shrink-0
        transition-all duration-300 ease-in-out
        ${collapsed ? "w-14" : "w-56"}
      `}
      style={{ height: "100vh", position: "sticky", top: 0 }}
    >
      <div className="flex h-full flex-col overflow-hidden">

        {/* Logo / Branding */}
        <div className={`flex items-center border-b border-slate-100 py-3 ${collapsed ? "justify-center px-2" : "gap-2 px-3"}`}>
          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl bg-white flex items-center justify-center">
            <img
              src={logoSrc}
              alt="Logo"
              className="h-10 w-10 object-contain"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          </div>
          <div className={`min-w-0 overflow-hidden transition-all duration-300 ease-in-out ${collapsed ? "w-0 opacity-0" : "flex-1 opacity-100"}`}>
            <h1 className="text-xs font-bold leading-tight text-slate-700 truncate whitespace-nowrap">
              Aradhya Abhyasika
            </h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-2 flex-1 space-y-0.5 px-1.5 py-2 overflow-y-auto">
          {visibleItems.map((item) => {
            const active = activeView === item.id;
            const iconName = PHOSPHOR_ICONS[item.id] || "Circle";
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                title={collapsed ? item.label : undefined}
                className={`group flex items-center rounded-xl py-2.5 transition-all duration-150 ${
                  collapsed ? "mx-auto h-10 w-10 justify-center px-0" : "w-full gap-3 px-3 text-left"
                } ${
                  active
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <span className={`flex-shrink-0 ${collapsed ? "" : ""}`}>
                  <PhosphorIcon
                    name={iconName}
                    size={19}
                    weight={active ? "fill" : "regular"}
                    className={active ? "text-white" : "text-slate-400 group-hover:text-indigo-500"}
                  />
                </span>
                <span
                  className={`overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-300 ease-in-out ${
                    collapsed ? "w-0 opacity-0 pointer-events-none" : "flex-1 opacity-100"
                  }`}
                >
                  {item.label}
                </span>
                {active && !collapsed && (
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white/70" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-slate-100 px-1.5 py-3">
          <button
            onClick={onLogout}
            title={collapsed ? "Log out" : undefined}
            className={`group flex items-center rounded-xl bg-red-50 py-2.5 text-red-500 transition-all duration-150 hover:bg-red-100 hover:text-red-600 ${
              collapsed ? "mx-auto h-10 w-10 justify-center px-0" : "w-full gap-3 px-3"
            }`}
          >
            <span className="flex-shrink-0">
              <PhosphorIcon
                name="SignOut"
                size={19}
                weight="regular"
                className="text-red-500 transition-colors group-hover:text-red-600"
              />
            </span>
            <span
              className={`overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-300 ease-in-out ${
                collapsed ? "w-0 opacity-0 pointer-events-none" : "flex-1 opacity-100"
              }`}
            >
              Log out
            </span>
          </button>
        </div>

      </div>
    </aside>
  );
}

export default Sidebar;
