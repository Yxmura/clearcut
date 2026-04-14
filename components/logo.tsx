export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M2 10 L10 2 L30 2 L30 30 L2 30 Z" fill="currentColor" />
    </svg>
  )
}
