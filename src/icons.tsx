import type { ReactNode, SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const mk =
  (paths: ReactNode) =>
  ({ size = 18, ...p }: P) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...p}
    >
      {paths}
    </svg>
  );

export const IPulse = mk(<path d="M2.5 12h4.2l2.3-5.5 4 11 2.4-5.5h6.1" />);
export const IActivity = mk(<path d="M22 12h-3.5l-3 8L9 4l-3 8H2.5" />);
export const IGrid = mk(
  <>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
  </>
);
export const IUsers = mk(
  <>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M2.8 20c.7-3.2 3.2-5 6.2-5s5.5 1.8 6.2 5" />
    <path d="M15.5 4.9a3.4 3.4 0 0 1 0 6.2M17.8 15.4c1.7.7 3 2.2 3.4 4.6" />
  </>
);
export const IUser = mk(
  <>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20.2c.8-3.6 3.7-5.6 7-5.6s6.2 2 7 5.6" />
  </>
);
export const ICalendar = mk(
  <>
    <rect x="3.5" y="5" width="17" height="16" rx="2" />
    <path d="M3.5 10h17M8 2.8V6.5M16 2.8V6.5" />
  </>
);
export const IList = mk(
  <>
    <path d="M9 6h12M9 12h12M9 18h12" />
    <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
  </>
);
export const IStetho = mk(
  <>
    <path d="M5 3.5v5a5 5 0 0 0 10 0v-5" />
    <path d="M10 13.5v1.8a4.2 4.2 0 0 0 8.4 0v-2.1" />
    <circle cx="18.4" cy="10.5" r="2.4" />
  </>
);
export const IBed = mk(
  <>
    <path d="M3 18V7M3 14h18v4M3 11h18v0a3 3 0 0 0-3-3H9" />
    <circle cx="6.2" cy="8.8" r="1.4" />
  </>
);
export const IFlask = mk(
  <>
    <path d="M9.5 3h5M10.5 3v6L4.8 18.5A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.5L13.5 9V3" />
    <path d="M7.5 15h9" />
  </>
);
export const IPill = mk(
  <>
    <rect x="3.2" y="8.6" width="17.6" height="6.8" rx="3.4" transform="rotate(-35 12 12)" />
    <path d="M9.2 8.2l5.6 7.6" />
  </>
);
export const IBox = mk(
  <>
    <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
    <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" />
  </>
);
export const IAlert = mk(
  <>
    <path d="M12 3.5L2.5 20h19L12 3.5z" />
    <path d="M12 10v4.5" />
    <circle cx="12" cy="17.2" r="0.4" fill="currentColor" />
  </>
);
export const IReceipt = mk(
  <>
    <path d="M6 2.8h12v18.4l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6-2.4-1.6z" transform="translate(0,0)" />
    <path d="M9 8h6M9 12h6" />
  </>
);
export const IShield = mk(
  <>
    <path d="M12 3l7.5 2.8v5.7c0 4.6-3 8-7.5 9.5-4.5-1.5-7.5-4.9-7.5-9.5V5.8z" />
    <path d="M9 12l2.2 2.2L15.5 10" />
  </>
);
export const IChart = mk(
  <>
    <path d="M4 20V4" />
    <path d="M4 20h16" />
    <rect x="7.5" y="11" width="3" height="6" rx="0.6" />
    <rect x="12.5" y="7" width="3" height="10" rx="0.6" />
    <rect x="17.5" y="13" width="3" height="4" rx="0.6" />
  </>
);
export const IBell = mk(
  <>
    <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
    <path d="M10 18.5a2.2 2.2 0 0 0 4 0" />
  </>
);
export const IGear = mk(
  <>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
  </>
);
export const ISearch = mk(
  <>
    <circle cx="10.8" cy="10.8" r="6.3" />
    <path d="M15.5 15.5L21 21" />
  </>
);
export const IPlus = mk(<path d="M12 5v14M5 12h14" />);
export const IMenu = mk(<path d="M4 6.5h16M4 12h16M4 17.5h16" />);
export const IX = mk(<path d="M6 6l12 12M18 6L6 18" />);
export const ICheck = mk(<path d="M4.5 12.5l5 5L19.5 7" />);
export const IChevR = mk(<path d="M9 5.5l6.5 6.5L9 18.5" />);
export const IChevD = mk(<path d="M5.5 9l6.5 6.5L18.5 9" />);
export const IChevL = mk(<path d="M15 5.5L8.5 12L15 18.5" />);
export const IPrinter = mk(
  <>
    <path d="M7 8V3h10v5" />
    <rect x="3.5" y="8" width="17" height="8.5" rx="1.6" />
    <path d="M7 13.5h10V21H7z" />
  </>
);
export const IDownload = mk(
  <>
    <path d="M12 3.5V15M7.5 10.5L12 15l4.5-4.5" />
    <path d="M4 20.5h16" />
  </>
);
export const IClock = mk(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v5.2l3.4 2" />
  </>
);
export const IPhone = mk(
  <path d="M5.5 3.5h4l1.5 4.5-2.2 1.6a12.5 12.5 0 0 0 5.6 5.6l1.6-2.2 4.5 1.5v4a1.8 1.8 0 0 1-2 1.8A16.5 16.5 0 0 1 3.7 5.5a1.8 1.8 0 0 1 1.8-2z" />
);
export const IDrop = mk(<path d="M12 3.5S5.5 10.6 5.5 15a6.5 6.5 0 0 0 13 0c0-4.4-6.5-11.5-6.5-11.5z" />);
export const ILogout = mk(
  <>
    <path d="M14.5 8V5.5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6.5a2 2 0 0 0 2-2V16" />
    <path d="M9.5 12h11M17 8.5l3.5 3.5-3.5 3.5" />
  </>
);
export const IFile = mk(
  <>
    <path d="M6 2.8h8L19 8v13.2H6z" />
    <path d="M13.5 3v5h5M9 12.5h6M9 16h6" />
  </>
);
export const ICard = mk(
  <>
    <rect x="2.8" y="5" width="18.4" height="14" rx="2" />
    <path d="M2.8 9.5h18.4M6.5 14.5h4" />
  </>
);
export const IRefresh = mk(
  <>
    <path d="M20 12a8 8 0 1 1-2.3-5.6" />
    <path d="M20 3.5V7h-3.5" />
  </>
);
export const IEye = mk(
  <>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </>
);
export const IFilter = mk(<path d="M4 5h16l-6.2 7.2V19l-3.6 2v-8.8z" />);
export const IHeart = mk(
  <path d="M12 20.5S3.5 15.2 3.5 9.3a4.6 4.6 0 0 1 8.5-2.5A4.6 4.6 0 0 1 20.5 9.3c0 5.9-8.5 11.2-8.5 11.2z" />
);
export const ISyringe = mk(
  <>
    <path d="M18.5 2.5l3 3M20 4L10.5 13.5M6 18l-3 3M6 18l3.5-1L17 9.5 14.5 7 7 14.5z" />
    <path d="M12 9l1.5 1.5M9.5 11.5L11 13" />
  </>
);
export const IArrowR = mk(<path d="M4 12h16M14 6l6 6-6 6" />);
export const IInfo = mk(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5" />
    <circle cx="12" cy="8" r="0.4" fill="currentColor" />
  </>
);
export const IZap = mk(<path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z" />);
export const ITruck = mk(
  <>
    <path d="M2.5 6h12v11h-12zM14.5 10h4l3 3.5V17h-7" />
    <circle cx="6.5" cy="17.8" r="1.8" />
    <circle cx="17.5" cy="17.8" r="1.8" />
  </>
);
export const IClipboard = mk(
  <>
    <rect x="5" y="4.5" width="14" height="17" rx="2" />
    <path d="M9 2.8h6v3.5H9zM9 11h6M9 15h4" />
  </>
);
