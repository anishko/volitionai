"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Globe2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchRegions, type RegionOption } from "@/lib/nonprofit/region-options";

interface RegionMultiPickerProps {
  value: string[];
  onChange: (regions: string[]) => void;
  disabled?: boolean;
  max?: number;
  "aria-label"?: string;
}

export function RegionMultiPicker({
  value,
  onChange,
  disabled,
  max = 12,
  "aria-label": ariaLabel = "Regions of interest",
}: RegionMultiPickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const options = useMemo(
    () => searchRegions(draft, 12).filter((o) => !value.includes(o.value)),
    [draft, value],
  );

  const groupedOptions = useMemo(() => {
    const rows: { showGroup: boolean; opt: RegionOption }[] = [];
    let last = "";
    for (const opt of options) {
      const showGroup = opt.group !== last;
      last = opt.group;
      rows.push({ showGroup, opt });
    }
    return rows;
  }, [options]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function addRegion(region: string) {
    if (value.includes(region) || value.length >= max) return;
    onChange([...value, region]);
    setDraft("");
    setOpen(false);
    setActiveIndex(-1);
  }

  function removeRegion(region: string) {
    onChange(value.filter((r) => r !== region));
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((region) => (
            <Badge key={region} variant="secondary" className="gap-1 pr-1">
              {region}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeRegion(region)}
                  className="rounded-full p-0.5 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                  aria-label={`Remove ${region}`}
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {value.length < max && (
        <div ref={rootRef} className="relative">
          <Globe2 className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, options.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && activeIndex >= 0 && options[activeIndex]) {
                e.preventDefault();
                addRegion(options[activeIndex].value);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Search states, coasts, or places like Lake Tahoe…"
            disabled={disabled}
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            role="combobox"
            className="pl-9 pr-9"
            autoComplete="off"
          />
          <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-zinc-400" />

          {open && (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
            >
              {options.length === 0 && (
                <li className="px-3 py-2 text-sm text-zinc-500">No matching regions</li>
              )}
              {groupedOptions.map(({ showGroup, opt }, i) => (
                  <li key={opt.value} role="presentation">
                    {showGroup && (
                      <p className="px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
                        {opt.group}
                      </p>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={value.includes(opt.value)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addRegion(opt.value)}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm",
                        i === activeIndex && "bg-zinc-100 dark:bg-zinc-900",
                      )}
                    >
                      <span>{opt.label}</span>
                      {value.includes(opt.value) && <Check className="size-4 text-zinc-600" />}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
