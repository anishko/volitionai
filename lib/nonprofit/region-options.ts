// Controlled vocabulary for regions of interest — states, macro regions, and
// notable places nonprofits might target for events (onboarding multi-select).

export interface RegionOption {
  value: string;
  label: string;
  group: string;
}

export const MACRO_REGIONS: RegionOption[] = [
  { value: "East Coast", label: "East Coast", group: "Coasts & macro regions" },
  { value: "West Coast", label: "West Coast", group: "Coasts & macro regions" },
  { value: "Gulf Coast", label: "Gulf Coast", group: "Coasts & macro regions" },
  { value: "Pacific Northwest", label: "Pacific Northwest", group: "Coasts & macro regions" },
  { value: "Mountain West", label: "Mountain West", group: "Coasts & macro regions" },
  { value: "Midwest", label: "Midwest", group: "Coasts & macro regions" },
  { value: "South", label: "South", group: "Coasts & macro regions" },
  { value: "Deep South", label: "Deep South", group: "Coasts & macro regions" },
  { value: "Southwest", label: "Southwest", group: "Coasts & macro regions" },
  { value: "New England", label: "New England", group: "Coasts & macro regions" },
  { value: "Rust Belt", label: "Rust Belt", group: "Coasts & macro regions" },
  { value: "Appalachia", label: "Appalachia", group: "Coasts & macro regions" },
];

export const US_STATES: RegionOption[] = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "District of Columbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois",
  "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts",
  "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
  "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming",
].map((s) => ({ value: s, label: s, group: "U.S. states & D.C." }));

export const NOTABLE_PLACES: RegionOption[] = [
  { value: "Lake Tahoe area", label: "Lake Tahoe area", group: "Notable places" },
  { value: "Silicon Valley", label: "Silicon Valley", group: "Notable places" },
  { value: "Bay Area", label: "Bay Area", group: "Notable places" },
  { value: "Greater Boston", label: "Greater Boston", group: "Notable places" },
  { value: "Research Triangle (NC)", label: "Research Triangle (NC)", group: "Notable places" },
  { value: "DMV (DC–Maryland–Virginia)", label: "DMV (DC–Maryland–Virginia)", group: "Notable places" },
  { value: "Greater Chicago", label: "Greater Chicago", group: "Notable places" },
  { value: "Greater Los Angeles", label: "Greater Los Angeles", group: "Notable places" },
  { value: "Greater New York", label: "Greater New York", group: "Notable places" },
  { value: "Greater Philadelphia", label: "Greater Philadelphia", group: "Notable places" },
  { value: "Greater Seattle", label: "Greater Seattle", group: "Notable places" },
  { value: "Greater Houston", label: "Greater Houston", group: "Notable places" },
  { value: "Greater Miami", label: "Greater Miami", group: "Notable places" },
  { value: "Napa Valley", label: "Napa Valley", group: "Notable places" },
  { value: "Hudson Valley", label: "Hudson Valley", group: "Notable places" },
  { value: "Cape Cod & Islands", label: "Cape Cod & Islands", group: "Notable places" },
  { value: "Hamptons", label: "Hamptons", group: "Notable places" },
  { value: "Charleston area", label: "Charleston area", group: "Notable places" },
  { value: "Nashville area", label: "Nashville area", group: "Notable places" },
  { value: "Austin area", label: "Austin area", group: "Notable places" },
];

export const ALL_REGION_OPTIONS: RegionOption[] = [
  ...MACRO_REGIONS,
  ...US_STATES,
  ...NOTABLE_PLACES,
];

export const REGION_VALUES = ALL_REGION_OPTIONS.map((o) => o.value) as [
  string,
  ...string[],
];

export function searchRegions(query: string, limit = 10): RegionOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_REGION_OPTIONS.slice(0, limit);
  return ALL_REGION_OPTIONS.filter(
    (o) => o.label.toLowerCase().includes(q) || o.group.toLowerCase().includes(q),
  ).slice(0, limit);
}
