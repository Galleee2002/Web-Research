"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type Option<T extends string> = { value: T; label: string };

type SelectMenuProps<T extends string> = {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  triggerClassName: string;
  triggerContent: ReactNode;
  ariaLabel: string;
  rootClassName?: string;
  menuClassName?: string;
};

export function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  triggerClassName,
  triggerContent,
  ariaLabel,
  rootClassName,
  menuClassName,
}: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div
      className={["businesses-select", rootClassName].filter(Boolean).join(" ")}
      ref={rootRef}
    >
      <button
        type="button"
        className={triggerClassName}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
      >
        {triggerContent}
        <ChevronDown
          className={`businesses-select__chevron${
            open ? " businesses-select__chevron--open" : ""
          }`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          className={["businesses-select__menu", menuClassName].filter(Boolean).join(" ")}
          role="listbox"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              data-active={option.value === value ? "true" : undefined}
              className="businesses-select__option"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
