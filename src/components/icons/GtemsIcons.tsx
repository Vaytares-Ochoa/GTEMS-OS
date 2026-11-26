import React from 'react';
import type { AppId } from '../../lib/types';

export const GtemsLogo: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="gtems-aurora-grad" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#79D9CE" />
        <stop offset="50%" stopColor="#398F91" />
        <stop offset="100%" stopColor="#75B8DD" />
      </linearGradient>
      <linearGradient id="gtems-prism-inner" x1="16" y1="14" x2="48" y2="50" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#F5FCFA" />
        <stop offset="100%" stopColor="#CDEBFA" />
      </linearGradient>
    </defs>
    <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#gtems-aurora-grad)" />
    <path
      d="M32 13L49 23V41L32 51L15 41V23L32 13Z"
      stroke="url(#gtems-prism-inner)"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path
      d="M24 32C24 27.5817 27.5817 24 32 24C35.2 24 37.95 25.88 39.23 28.6H32.5V34H41.5C40.68 37.45 37.65 40 32 40C27.5817 40 24 36.4183 24 32Z"
      fill="#F5FCFA"
    />
  </svg>
);

export const GtemsAppIcon: React.FC<{ appId: AppId; className?: string }> = ({ appId, className = 'w-6 h-6' }) => {
  switch (appId) {
    case 'explorer':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#DDF5EC" stroke="#398F91" strokeWidth="1.5" />
          <path d="M7 11.5C7 10.12 8.12 9 9.5 9H13.5L15.5 11.5H22.5C23.88 11.5 25 12.62 25 14V21.5C25 22.88 23.88 24 22.5 24H9.5C8.12 24 7 22.88 7 21.5V11.5Z" fill="#79D9CE" stroke="#398F91" strokeWidth="1.4" />
          <path d="M11 17H21" stroke="#0F272B" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'browser':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <circle cx="16" cy="16" r="13" fill="#F5FCFA" stroke="#398F91" strokeWidth="1.5" />
          <path d="M16 3A13 13 0 0 1 27.26 9.5H16V16L9.5 5.2A13 13 0 0 1 16 3Z" fill="#EA4335" fillOpacity="0.88" />
          <path d="M27.26 9.5A13 13 0 0 1 16 29L21.5 19.5L16 16H27.26Z" fill="#FBBC05" fillOpacity="0.92" />
          <path d="M16 29A13 13 0 0 1 9.5 5.2L16 16L21.5 19.5L16 29Z" fill="#34A853" fillOpacity="0.88" />
          <circle cx="16" cy="16" r="5.5" fill="#FFFFFF" />
          <circle cx="16" cy="16" r="4" fill="#4285F4" />
        </svg>
      );
    case 'terminal':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <rect x="2" y="3" width="28" height="26" rx="7" fill="#0F272B" stroke="#79D9CE" strokeWidth="1.5" />
          <path d="M9 12L14 16L9 20" stroke="#79D9CE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 20H23" stroke="#BCEBDD" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'code-studio':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#0B161E" stroke="#00D4FF" strokeWidth="1.5" />
          <path d="M11 11L6.5 16L11 21" stroke="#79D9CE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 11L25.5 16L21 21" stroke="#75B8DD" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M17.8 9.5L14.2 22.5" stroke="#FF2E93" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'settings':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#CDEBFA" stroke="#398F91" strokeWidth="1.5" />
          <circle cx="16" cy="16" r="4.5" stroke="#0F272B" strokeWidth="2" />
          <path d="M16 6.5V9M16 23V25.5M6.5 16H9M23 16H25.5M9.3 9.3L11.1 11.1M20.9 20.9L22.7 22.7M22.7 9.3L20.9 11.1M11.1 20.9L9.3 22.7" stroke="#398F91" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'task-manager':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <rect x="2" y="3" width="28" height="26" rx="7" fill="#DDF5EC" stroke="#398F91" strokeWidth="1.5" />
          <path d="M6 18H10.5L13.5 10L17.5 22L20.5 14L23 18H26" stroke="#398F91" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'device-manager':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#E8F8F5" stroke="#398F91" strokeWidth="1.5" />
          <rect x="10" y="10" width="12" height="12" rx="2.5" fill="#79D9CE" stroke="#0F272B" strokeWidth="1.4" />
          <path d="M13 6V10M19 6V10M13 22V26M19 22V26M6 13H10M6 19H10M22 13H26M22 19H26" stroke="#398F91" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'image-editor':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <rect x="2" y="3" width="28" height="26" rx="7" fill="#CDEBFA" stroke="#75B8DD" strokeWidth="1.5" />
          <circle cx="11.5" cy="11.5" r="2.5" fill="#398F91" />
          <path d="M6 23L13 15L18 20L21.5 16.5L26 23H6Z" fill="#79D9CE" stroke="#0F272B" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      );
    case 'text-editor':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <rect x="4" y="2" width="24" height="28" rx="6" fill="#F5FCFA" stroke="#398F91" strokeWidth="1.5" />
          <path d="M10 10H22M10 15H22M10 20H17" stroke="#398F91" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'music-player':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#BCEBDD" stroke="#398F91" strokeWidth="1.5" />
          <path d="M13 21V11L23 9V19" stroke="#0F272B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="10.5" cy="21.5" r="2.5" fill="#398F91" />
          <circle cx="20.5" cy="19.5" r="2.5" fill="#398F91" />
        </svg>
      );
    case 'video-player':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <rect x="2" y="4" width="28" height="24" rx="7" fill="#A8D5EF" stroke="#398F91" strokeWidth="1.5" />
          <path d="M13 11.5L22 16L13 20.5V11.5Z" fill="#0F272B" />
        </svg>
      );
    case 'package-manager':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#DDF5EC" stroke="#398F91" strokeWidth="1.5" />
          <path d="M16 7L24 11.5V20.5L16 25L8 20.5V11.5L16 7Z" fill="#79D9CE" stroke="#0F272B" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M16 16V25M16 16L24 11.5M16 16L8 11.5" stroke="#0F272B" strokeWidth="1.3" />
        </svg>
      );
    case 'architecture':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#0F272B" stroke="#79D9CE" strokeWidth="1.5" />
          <rect x="7" y="8" width="18" height="4" rx="1.5" fill="#79D9CE" />
          <rect x="7" y="14" width="18" height="4" rx="1.5" fill="#75B8DD" />
          <rect x="7" y="20" width="18" height="4" rx="1.5" fill="#BCEBDD" />
        </svg>
      );
  }
};
