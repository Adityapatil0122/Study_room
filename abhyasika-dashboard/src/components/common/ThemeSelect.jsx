import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import LucideIcon from "../icons/LucideIcon.jsx";

const baseButton =
  "relative flex min-h-[38px] w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-sm outline-none transition hover:border-indigo-200 hover:bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-70";

const textFromNode = (node) => {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");
  if (React.isValidElement(node)) return textFromNode(node.props.children);
  return "";
};

const optionsFromChildren = (children) => {
  const parsed = [];
  const walk = (items) => {
    React.Children.forEach(items, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === React.Fragment) {
        walk(child.props.children);
        return;
      }
      if (child.type !== "option") return;
      const value =
        child.props.value !== undefined && child.props.value !== null
          ? String(child.props.value)
          : textFromNode(child.props.children);
      parsed.push({
        value,
        label: child.props.children,
        text: textFromNode(child.props.children),
        disabled: Boolean(child.props.disabled),
      });
    });
  };
  walk(children);
  return parsed;
};

function ThemeSelect({
  name,
  value = "",
  onChange,
  children,
  options,
  className = "",
  disabled = false,
  required,
  "aria-label": ariaLabel,
  ...rest
}) {
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const normalizedValue = value === undefined || value === null ? "" : String(value);

  const parsedOptions = useMemo(() => {
    if (Array.isArray(options)) {
      return options.map((option) => ({
        value:
          option.value !== undefined && option.value !== null
            ? String(option.value)
            : "",
        label: option.label ?? option.value ?? "",
        text: textFromNode(option.label ?? option.value ?? ""),
        disabled: Boolean(option.disabled),
      }));
    }
    return optionsFromChildren(children);
  }, [children, options]);

  const selectedOption =
    parsedOptions.find((option) => option.value === normalizedValue) ??
    parsedOptions.find((option) => option.value === "") ??
    null;
  const selectedIndex = Math.max(
    parsedOptions.findIndex((option) => option.value === normalizedValue),
    0
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (
        !rootRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const updateMenuPosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportHeight = window.innerHeight || 720;
      const estimatedHeight = Math.min(256, Math.max(44, parsedOptions.length * 40 + 8));
      const spaceBelow = viewportHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const openAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
      const availableHeight = Math.max(
        120,
        openAbove ? Math.min(estimatedHeight, spaceAbove - 4) : Math.min(estimatedHeight, spaceBelow - 4)
      );

      setMenuStyle({
        left: `${rect.left}px`,
        top: `${openAbove ? Math.max(8, rect.top - availableHeight - 4) : rect.bottom + 4}px`,
        width: `${rect.width}px`,
        maxHeight: `${availableHeight}px`,
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, parsedOptions.length]);

  useEffect(() => {
    setActiveIndex(selectedIndex);
  }, [selectedIndex]);

  const emitChange = (nextValue) => {
    onChange?.({
      target: {
        name,
        value: nextValue,
        type: "select-one",
      },
      currentTarget: {
        name,
        value: nextValue,
        type: "select-one",
      },
    });
  };

  const choose = (option) => {
    if (!option || option.disabled) return;
    emitChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const moveActive = (direction) => {
    if (parsedOptions.length === 0) return;
    let next = activeIndex;
    for (let i = 0; i < parsedOptions.length; i += 1) {
      next = (next + direction + parsedOptions.length) % parsedOptions.length;
      if (!parsedOptions[next]?.disabled) break;
    }
    setActiveIndex(next);
  };

  const handleButtonKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      moveActive(1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      moveActive(-1);
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      choose(parsedOptions[activeIndex]);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        {...rest}
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-required={required || undefined}
        aria-label={ariaLabel}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        onKeyDown={handleButtonKeyDown}
        className={`${baseButton} ${className}`}
      >
        <span
          className={`block min-w-0 flex-1 truncate ${
            normalizedValue === "" ? "text-slate-400" : ""
          }`}
        >
          {selectedOption?.label ?? "Select"}
        </span>
        <LucideIcon
          name="ChevronDown"
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${
            open ? "rotate-180 text-indigo-500" : ""
          }`}
        />
      </button>

      {open && menuStyle
        ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-200/80"
          style={menuStyle}
        >
          <div
            role="listbox"
            tabIndex={-1}
            className="overflow-y-auto overscroll-contain"
            style={{ maxHeight: menuStyle.maxHeight }}
          >
            {parsedOptions.map((option, index) => {
              const selected = option.value === normalizedValue;
              const active = index === activeIndex;
              return (
                <button
                  key={`${option.value}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={option.disabled}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    selected
                      ? "btn-gradient-primary"
                      : active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-700 hover:bg-slate-50"
                  } ${option.disabled ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {selected ? (
                    <LucideIcon name="Check" className="h-4 w-4 shrink-0" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )
        : null}
    </div>
  );
}

export default ThemeSelect;
