import React from "react";
import * as PhosphorIcons from "@phosphor-icons/react";

const FALLBACK = "Circle";

const toPascalCase = (value = "") =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_\s]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");

function PhosphorIcon({ name = FALLBACK, className = "", weight = "regular", size, ...rest }) {
  const pascal = toPascalCase(name);
  const candidates = [pascal, name, name.charAt(0).toUpperCase() + name.slice(1)].filter(Boolean);
  let IconComponent = PhosphorIcons[FALLBACK];
  for (const c of candidates) {
    if (c && c in PhosphorIcons) {
      IconComponent = PhosphorIcons[c];
      break;
    }
  }
  return (
    <IconComponent
      className={className}
      weight={weight}
      size={size}
      aria-hidden="true"
      {...rest}
    />
  );
}

export default PhosphorIcon;
