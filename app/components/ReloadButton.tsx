"use client";

/**
 * Outline button with a rotating-arrow symbol, used for reload/refresh
 * actions (submissions list, submission review). The icon spins while the
 * action is in flight (button disabled).
 */
export default function ReloadButton({
  label,
  onClick,
  disabled = false,
  className = "",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded border border-brand-dark px-3 py-1.5 text-xs font-medium text-brand-dark transition-colors hover:bg-brand-dark hover:text-white disabled:opacity-50 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={`h-3.5 w-3.5 ${disabled ? "animate-spin" : ""}`}
      >
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
      </svg>
      {label}
    </button>
  );
}
