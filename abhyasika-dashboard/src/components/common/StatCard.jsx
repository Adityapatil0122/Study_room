import React from "react";
import PhosphorIcon from "../icons/PhosphorIcon.jsx";

const LUCIDE_TO_PHOSPHOR = {
  users: "Users",
  armchair: "Armchair",
  calendardays: "CalendarCheck",
  alertcircle: "Warning",
  badgecheck: "CheckCircle",
  creditcard: "CreditCard",
  trendingup: "TrendUp",
  bellring: "BellRinging",
};

const toneStyles = {
  default: "bg-white border-slate-100",
  primary: "bg-indigo-50 border-indigo-100",
  success: "bg-emerald-50 border-emerald-100",
  warning: "bg-amber-50 border-amber-100",
};

const toneIcon = {
  default: "text-indigo-600 bg-indigo-50",
  primary: "text-indigo-600 bg-white/80",
  success: "text-emerald-600 bg-white/80",
  warning: "text-amber-600 bg-white/80",
};

const toneValue = {
  default: "text-slate-800",
  primary: "text-indigo-700",
  success: "text-emerald-700",
  warning: "text-amber-700",
};

function StatCard({ title, icon, value, subtext, tone = "default" }) {
  const key = (icon || "").toLowerCase().replace(/[^a-z]/g, "");
  const phosphorName = LUCIDE_TO_PHOSPHOR[key] || "Circle";
  return (
    <div className={`rounded-xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${toneStyles[tone] ?? toneStyles.default}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{title}</p>
          <p className={`mt-1 text-2xl font-bold leading-tight ${toneValue[tone] ?? toneValue.default}`}>{value}</p>
          {subtext && <p className="mt-1.5 text-xs text-slate-400">{subtext}</p>}
        </div>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${toneIcon[tone] ?? toneIcon.default}`}>
          <PhosphorIcon name={phosphorName} size={20} weight="duotone" />
        </div>
      </div>
    </div>
  );
}

export default StatCard;
