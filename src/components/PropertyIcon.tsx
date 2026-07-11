/** Line-art icons for the property-type picker on screen 1. */
const PATHS: Record<string, JSX.Element> = {
  home: (
    <>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  office: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
      <path d="M10 21v-3h4v3" />
    </>
  ),
  shop: (
    <>
      <path d="M4 8l1-4h14l1 4" />
      <path d="M4 8c0 1.5 1 2.5 2.5 2.5S9 9.5 9 8c0 1.5 1 2.5 2.5 2.5S14 9.5 14 8c0 1.5 1 2.5 2.5 2.5S19 9.5 19 8" />
      <path d="M5 10.5V20h14v-9.5" />
      <path d="M9 20v-5h6v5" />
    </>
  ),
  clinic: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M12 9v6M9 12h6" />
    </>
  ),
  workshop: (
    <path d="M14.7 6.3a4 4 0 00-5.6 5.6L4 17v3h3l5.1-5.1a4 4 0 005.6-5.6l-2.4 2.4-2.3-2.3z" />
  ),
  other: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 114 2c-.8.6-1.5 1-1.5 2M12 17h.01" />
    </>
  ),
}

/** Maps a property label to its icon key. */
export const PROPERTY_ICON_KEY: Record<string, string> = {
  Home: 'home',
  'Office / Company': 'office',
  Shop: 'shop',
  Clinic: 'clinic',
  Workshop: 'workshop',
  Other: 'other',
}

export function PropertyIcon({ name, color }: { name: string; color: string }) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  )
}
