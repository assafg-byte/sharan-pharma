const S = (d: React.ReactNode, size = 17, w = 2) => function Svg() {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>;
};

export const Icon = {
  cal: S(<><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></>, 19, 1.8),
  prev: S(<path d="M9 6l6 6-6 6" />),
  next: S(<path d="M15 6l-6 6 6 6" />),
  prev2: S(<path d="M7 6l6 6-6 6M13 6l6 6-6 6" />),
  next2: S(<path d="M17 6l-6 6 6 6M11 6l-6 6 6 6" />),
  chev: S(<path d="M15 6l-6 6 6 6" />, 18),
  chevD: S(<path d="M6 9l6 6 6-6" />, 16, 2.2),
  copy: S(<><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M6 15H5a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v1" /></>, 15),
  search: S(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>, 17, 2.2),
  pen: S(<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />, 16),
  lock: S(<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></>, 16),
  up: S(<path d="M6 15l6-6 6 6" />, 15),
  down: S(<path d="M6 9l6 6 6-6" />, 15),
  trash: S(<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />, 15),
  plus: S(<path d="M12 5v14M5 12h14" />, 15, 2.2),
  eye: S(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>, 17),
  eyeOff: S(<><path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.7-1.3M9.9 9.9a3 3 0 004.2 4.2" /></>, 17),
  home: S(<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />, 16),
};
