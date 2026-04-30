type XLogoProps = {
  className?: string;
};

export function XLogo({ className }: XLogoProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.9 2h3.7l-8.1 9.3L24 22h-7.4l-5.8-7.6L4.2 22H.5l8.7-9.9L0 2h7.6l5.2 6.9L18.9 2Zm-1.3 18.1h2L6.5 3.8H4.3l13.3 16.3Z" />
    </svg>
  );
}
