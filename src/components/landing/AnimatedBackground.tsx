// Hero arkasındaki yumuşak hareketli gradient + blob mesh.
// Tüm hareket pure CSS keyframe — JS yükü yok, GPU-friendly.
// prefers-reduced-motion altında otomatik durur (index.css global kuralı).

export const AnimatedBackground = () => {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Ana gradient katmanı: animasyonlu pozisyon kayması */}
      <div
        className="absolute inset-0 opacity-[0.12] animate-gradient-shift"
        style={{
          background:
            "linear-gradient(120deg, hsl(16 95% 55%) 0%, hsl(28 90% 60%) 35%, hsl(189 75% 60%) 70%, hsl(16 95% 55%) 100%)",
          backgroundSize: "200% 200%",
        }}
      />
      {/* Yumuşak blob'lar: subtle floating */}
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/20 blur-3xl animate-blob-float-slow" />
      <div className="absolute -bottom-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-secondary/20 blur-3xl animate-blob-float-fast" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-accent/30 blur-3xl animate-blob-float-slow" />
    </div>
  );
};
