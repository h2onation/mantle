// Session — Flame
export function IconSession({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 2C10 2 14 6 14 11C14 14 12.2 17 10 17C7.8 17 6 14 6 11C6 8 8 6 8 6C8 6 7 9 9 11C10 12 10 10 10 2Z"
        stroke={color}
        strokeWidth="1.1"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Manual — Seed of Life
export function IconManual({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="4" stroke={color} strokeWidth="0.8" />
      <circle cx="10" cy="6" r="4" stroke={color} strokeWidth="0.8" opacity="0.5" />
      <circle cx="10" cy="14" r="4" stroke={color} strokeWidth="0.8" opacity="0.5" />
      <circle cx="6.5" cy="8" r="4" stroke={color} strokeWidth="0.8" opacity="0.5" />
      <circle cx="13.5" cy="8" r="4" stroke={color} strokeWidth="0.8" opacity="0.5" />
      <circle cx="6.5" cy="12" r="4" stroke={color} strokeWidth="0.8" opacity="0.5" />
      <circle cx="13.5" cy="12" r="4" stroke={color} strokeWidth="0.8" opacity="0.5" />
    </svg>
  );
}

// Guidance — Constellation
export function IconGuidance({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="5" cy="5" r="1.2" fill={color} opacity="0.8" />
      <circle cx="15" cy="4" r="1" fill={color} opacity="0.6" />
      <circle cx="12" cy="10" r="1.3" fill={color} opacity="0.9" />
      <circle cx="4" cy="13" r="0.9" fill={color} opacity="0.5" />
      <circle cx="14" cy="16" r="1.1" fill={color} opacity="0.7" />
      <circle cx="8" cy="16" r="0.8" fill={color} opacity="0.4" />
      <line x1="5" y1="5" x2="15" y2="4" stroke={color} strokeWidth="0.5" opacity="0.3" />
      <line x1="15" y1="4" x2="12" y2="10" stroke={color} strokeWidth="0.5" opacity="0.3" />
      <line x1="12" y1="10" x2="14" y2="16" stroke={color} strokeWidth="0.5" opacity="0.3" />
      <line x1="5" y1="5" x2="4" y2="13" stroke={color} strokeWidth="0.5" opacity="0.3" />
      <line x1="4" y1="13" x2="8" y2="16" stroke={color} strokeWidth="0.5" opacity="0.3" />
      <line x1="12" y1="10" x2="4" y2="13" stroke={color} strokeWidth="0.5" opacity="0.3" />
    </svg>
  );
}

// Settings — Mortar & Pestle
export function IconSettings({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5 9C5 9 4 10 4 13C4 15 6 17 10 17C14 17 16 15 16 13C16 10 15 9 15 9"
        stroke={color}
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path d="M5 9L15 9" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M13 3L8 9" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="13.5" cy="2.5" r="1" stroke={color} strokeWidth="0.8" />
    </svg>
  );
}
