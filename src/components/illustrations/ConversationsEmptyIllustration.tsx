export function ConversationsEmptyIllustration({ className = "w-40 h-40" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background circle */}
      <circle cx="80" cy="80" r="72" fill="hsl(var(--primary) / 0.08)" />
      {/* Main chat bubble */}
      <rect x="28" y="38" width="80" height="52" rx="12" fill="hsl(var(--primary))" />
      <path d="M44 90 L36 104 L60 90Z" fill="hsl(var(--primary))" />
      {/* Chat bubble dots */}
      <circle cx="52" cy="64" r="4" fill="white" fillOpacity="0.9" />
      <circle cx="68" cy="64" r="4" fill="white" fillOpacity="0.9" />
      <circle cx="84" cy="64" r="4" fill="white" fillOpacity="0.9" />
      {/* Secondary chat bubble */}
      <rect x="58" y="92" width="70" height="38" rx="10" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1.5" />
      <path d="M118 108 L128 118 L108 124Z" fill="hsl(var(--muted))" />
      <path d="M118 108 L128 118 L108 124Z" stroke="hsl(var(--border))" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Secondary bubble lines */}
      <line x1="70" y1="107" x2="114" y2="107" stroke="hsl(var(--muted-foreground))" strokeWidth="2" strokeLinecap="round" />
      <line x1="70" y1="116" x2="100" y2="116" stroke="hsl(var(--muted-foreground))" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
