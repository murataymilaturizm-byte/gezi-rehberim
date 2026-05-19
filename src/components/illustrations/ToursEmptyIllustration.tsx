export function ToursEmptyIllustration({ className = "w-40 h-40" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background circle */}
      <circle cx="80" cy="80" r="72" fill="hsl(var(--primary) / 0.08)" />
      {/* Map background */}
      <rect x="30" y="45" width="100" height="75" rx="8" fill="hsl(var(--muted))" />
      <rect x="30" y="45" width="100" height="75" rx="8" stroke="hsl(var(--border))" strokeWidth="1.5" />
      {/* Map lines */}
      <line x1="30" y1="70" x2="130" y2="70" stroke="hsl(var(--border))" strokeWidth="1" />
      <line x1="30" y1="90" x2="130" y2="90" strokeDasharray="4 3" stroke="hsl(var(--border))" strokeWidth="1" />
      <line x1="65" y1="45" x2="65" y2="120" stroke="hsl(var(--border))" strokeWidth="1" />
      {/* Pin */}
      <path d="M80 50 C80 50 67 62 67 72 C67 79.2 73 84 80 84 C87 84 93 79.2 93 72 C93 62 80 50 80 50Z" fill="hsl(var(--primary))" />
      <circle cx="80" cy="72" r="5" fill="white" />
      {/* Pin shadow */}
      <ellipse cx="80" cy="86" rx="6" ry="2" fill="hsl(var(--primary) / 0.2)" />
      {/* Plus icon */}
      <circle cx="112" cy="108" r="14" fill="hsl(var(--primary))" />
      <line x1="112" y1="102" x2="112" y2="114" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="106" y1="108" x2="118" y2="108" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
