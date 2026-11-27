const s = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const IconPlay = () => (
    <svg {...s} fill="currentColor" stroke="none">
        <path d="M7 4.5v15l13-7.5z" />
    </svg>
);
export const IconPause = () => (
    <svg {...s} fill="currentColor" stroke="none">
        <rect x="6" y="4.5" width="4" height="15" rx="1" />
        <rect x="14" y="4.5" width="4" height="15" rx="1" />
    </svg>
);
export const IconMusic = () => (
    <svg {...s}>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
    </svg>
);
export const IconUndo = () => (
    <svg {...s}>
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
);
export const IconRedo = () => (
    <svg {...s}>
        <path d="m15 14 5-5-5-5" />
        <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </svg>
);
export const IconSave = () => (
    <svg {...s}>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
    </svg>
);
export const IconOpen = () => (
    <svg {...s}>
        <path d="M12 21V9" />
        <path d="m7 14 5-5 5 5" />
        <path d="M5 3h14" />
    </svg>
);
export const IconFilm = () => (
    <svg {...s}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
    </svg>
);
export const IconVolume = () => (
    <svg {...s}>
        <path d="M11 5 6 9H3v6h3l5 4z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
);
export const IconBolt = () => (
    <svg {...s}>
        <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
);
