import React from 'react';

interface BrandLogoProps {
  logoDataUrl?: string;
  companyName: string;
  size?: 'sm' | 'md' | 'lg';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  logoDataUrl,
  companyName,
  size = 'md',
}) => {
  const dims =
    size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-9 w-9';

  if (logoDataUrl) {
    return (
      <img
        src={logoDataUrl}
        alt={`${companyName} logo`}
        className={`${dims} rounded-lg object-contain border border-slate-200 bg-white shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${dims} rounded-lg bg-slate-900 text-white border border-slate-900 flex items-center justify-center shrink-0`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 32 32"
        className="w-5 h-5"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M16 3L19.6 11.4L28.5 12.2L21.8 18.1L23.8 26.8L16 22.2L8.2 26.8L10.2 18.1L3.5 12.2L12.4 11.4L16 3Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="16" r="2.2" fill="currentColor" />
      </svg>
    </div>
  );
};
