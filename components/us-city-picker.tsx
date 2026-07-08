"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { Check, ChevronDown, MapPin, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface UsCityPickerProps {
  value: string;
  onChange: (city: string) => void;
  disabled?: boolean;
  placeholder?: string;
  clearAriaLabel?: string;
  "aria-label"?: string;
}

export interface UsCitiesMultiPickerProps {
  value: string[];
  onChange: (cities: string[]) => void;
  disabled?: boolean;
  max?: number;
  placeholder?: string;
  "aria-label"?: string;
}

function formatPlaceCity(place: google.maps.places.PlaceResult): string | null {
  if (!place.address_components?.length) return null;
  let city = "";
  let state = "";
  for (const c of place.address_components) {
    if (c.types.includes("locality")) city = c.long_name;
    if (c.types.includes("sublocality") && !city) city = c.long_name;
    if (c.types.includes("administrative_area_level_1")) state = c.short_name ?? "";
  }
  if (!city || !state) return null;
  return `${city}, ${state}`;
}

let mapsLoader: Promise<void> | null = null;

function loadGooglePlaces(apiKey: string) {
  mapsLoader ??= (async () => {
    setOptions({ key: apiKey, v: "weekly" });
    await importLibrary("places");
  })();
  return mapsLoader;
}

function CitySearchDropdown({
  listId,
  open,
  loading,
  options,
  activeIndex,
  selected,
  onSelect,
  multi,
}: {
  listId: string;
  open: boolean;
  loading: boolean;
  options: string[];
  activeIndex: number;
  selected: string | string[];
  onSelect: (city: string) => void;
  multi?: boolean;
}) {
  if (!open) return null;
  const isSelected = (city: string) =>
    multi ? (selected as string[]).includes(city) : selected === city;

  return (
    <ul
      id={listId}
      role="listbox"
      className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
    >
      {loading && <li className="px-3 py-2 text-sm text-zinc-500">Searching…</li>}
      {!loading && options.length === 0 && (
        <li className="px-3 py-2 text-sm text-zinc-500">No U.S. cities found</li>
      )}
      {!loading &&
        options.map((city, i) => (
          <li
            key={city}
            role="option"
            aria-selected={isSelected(city)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(city)}
            className={cn(
              "flex cursor-pointer items-center justify-between px-3 py-2 text-sm",
              i === activeIndex && "bg-zinc-100 dark:bg-zinc-900",
              isSelected(city) && "font-medium",
            )}
          >
            <span>{city}</span>
            {isSelected(city) && <Check className="size-4 text-zinc-600" />}
          </li>
        ))}
    </ul>
  );
}

function GooglePlacesCityInput({
  value,
  onChange,
  disabled,
  placeholder = "Search U.S. cities…",
  clearAriaLabel = "Clear city",
  "aria-label": ariaLabel,
}: UsCityPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!inputRef.current || disabled) return;
    let autocomplete: google.maps.places.Autocomplete | null = null;
    let cancelled = false;

    loadGooglePlaces(apiKey)
      .then(() => {
        if (cancelled || !inputRef.current) return;
        autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          types: ["(cities)"],
          componentRestrictions: { country: "us" },
          fields: ["address_components"],
        });
        autocomplete.addListener("place_changed", () => {
          const formatted = formatPlaceCity(autocomplete?.getPlace() ?? {});
          if (formatted) onChangeRef.current(formatted);
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [apiKey, disabled]);

  useEffect(() => {
    if (inputRef.current) inputRef.current.value = value;
  }, [value]);

  return (
    <div className="relative">
      <MapPin className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-400" />
      <Input
        ref={inputRef}
        defaultValue={value}
        onBlur={() => {
          if (inputRef.current && inputRef.current.value !== value) {
            inputRef.current.value = value;
          }
        }}
        onChange={(e) => {
          if (!e.target.value) onChange("");
        }}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        className="pl-9 pr-9"
        autoComplete="off"
      />
      {value && !disabled && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="absolute top-1/2 right-2.5 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          aria-label={clearAriaLabel}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

function useCitySearch(inputValue: string, open: boolean) {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCities = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setOptions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/cities/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setOptions(Array.isArray(data.cities) ? data.cities : []);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void fetchCities(inputValue), 200);
    return () => clearTimeout(t);
  }, [inputValue, open, fetchCities]);

  return { options, loading };
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [ref, onClose]);
}

function UsCityCombobox({
  value,
  onChange,
  disabled,
  placeholder = "Search U.S. cities…",
  clearAriaLabel = "Clear city",
  "aria-label": ariaLabel,
}: UsCityPickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputValue = draft ?? value;
  const { options, loading } = useCitySearch(inputValue, open);

  useClickOutside(rootRef, () => {
    setOpen(false);
    setDraft(null);
  });

  function select(city: string) {
    onChange(city);
    setDraft(null);
    setOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div ref={rootRef} className="relative">
      <MapPin className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-zinc-400" />
      <Input
        value={inputValue}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
          if (!e.target.value) onChange("");
        }}
        onFocus={() => {
          setDraft(value);
          setOpen(true);
        }}
        onBlur={() => {
          setDraft(null);
          setOpen(false);
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
            setOpen(true);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && activeIndex >= 0 && options[activeIndex]) {
            e.preventDefault();
            select(options[activeIndex]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
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
      {value && !disabled && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            setDraft(null);
          }}
          className="absolute top-1/2 right-8 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          aria-label={clearAriaLabel}
        >
          <X className="size-4" />
        </button>
      )}
      {open && inputValue.trim().length >= 2 && (
        <CitySearchDropdown
          listId={listId}
          open={open}
          loading={loading}
          options={options}
          activeIndex={activeIndex}
          selected={value}
          onSelect={select}
        />
      )}
    </div>
  );
}

function GooglePlacesMultiCityInput({
  value,
  onChange,
  disabled,
  max = 12,
  placeholder = "Add U.S. cities…",
  "aria-label": ariaLabel,
}: UsCitiesMultiPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  function removeCity(city: string) {
    onChange(value.filter((c) => c !== city));
  }

  useEffect(() => {
    if (!inputRef.current || disabled) return;
    let autocomplete: google.maps.places.Autocomplete | null = null;
    let cancelled = false;

    loadGooglePlaces(apiKey)
      .then(() => {
        if (cancelled || !inputRef.current) return;
        autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          types: ["(cities)"],
          componentRestrictions: { country: "us" },
          fields: ["address_components"],
        });
        autocomplete.addListener("place_changed", () => {
          const formatted = formatPlaceCity(autocomplete?.getPlace() ?? {});
          const current = valueRef.current;
          if (formatted && !current.includes(formatted) && current.length < max) {
            onChangeRef.current([...current, formatted]);
            if (inputRef.current) inputRef.current.value = "";
          }
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [apiKey, disabled, max]);

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((city) => (
            <Badge key={city} variant="secondary" className="gap-1 pr-1">
              {city}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeCity(city)}
                  className="rounded-full p-0.5 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                  aria-label={`Remove ${city}`}
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
      {value.length < max && (
        <div className="relative">
          <MapPin className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            ref={inputRef}
            placeholder={placeholder}
            disabled={disabled}
            aria-label={ariaLabel}
            className="pl-9"
            autoComplete="off"
          />
        </div>
      )}
    </div>
  );
}

function UsCitiesMultiCombobox({
  value,
  onChange,
  disabled,
  max = 12,
  placeholder = "Add U.S. cities…",
  "aria-label": ariaLabel,
}: UsCitiesMultiPickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const { options, loading } = useCitySearch(draft, open);

  useClickOutside(rootRef, () => setOpen(false));

  function addCity(city: string) {
    if (value.includes(city) || value.length >= max) return;
    onChange([...value, city]);
    setDraft("");
    setOpen(false);
    setActiveIndex(-1);
  }

  function removeCity(city: string) {
    onChange(value.filter((c) => c !== city));
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((city) => (
            <Badge key={city} variant="secondary" className="gap-1 pr-1">
              {city}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeCity(city)}
                  className="rounded-full p-0.5 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                  aria-label={`Remove ${city}`}
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
          <MapPin className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-zinc-400" />
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
                addCity(options[activeIndex]);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder={placeholder}
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
          {open && draft.trim().length >= 2 && (
            <CitySearchDropdown
              listId={listId}
              open={open}
              loading={loading}
              options={options.filter((c) => !value.includes(c))}
              activeIndex={activeIndex}
              selected={value}
              onSelect={addCity}
              multi
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Single U.S. city — Google Places when configured, searchable combobox otherwise. */
export function UsCityPicker(props: UsCityPickerProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (apiKey) return <GooglePlacesCityInput {...props} />;
  return <UsCityCombobox {...props} />;
}

/** Multi U.S. city picker with chip list. */
export function UsCitiesMultiPicker(props: UsCitiesMultiPickerProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (apiKey) return <GooglePlacesMultiCityInput {...props} />;
  return <UsCitiesMultiCombobox {...props} />;
}

/** @deprecated Use UsCityPicker */
export const HeadquartersCityPicker = UsCityPicker;
