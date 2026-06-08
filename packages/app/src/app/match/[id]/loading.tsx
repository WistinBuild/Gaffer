export default function Loading() {
  return (
    <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8">
      <div className="mx-auto max-w-6xl animate-pulse">
        {/* Scoreboard */}
        <div className="rounded-[2rem] bg-white/[0.04] h-32 mb-4" />
        {/* Momentum bar */}
        <div className="h-1.5 rounded-full bg-white/10 mb-8" />
        {/* Mini pitch */}
        <div className="rounded-2xl bg-gaffer-pitch/30 h-[280px] mb-8" />
        {/* Main area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-white/[0.04] h-24" />
            ))}
          </div>
          <div className="lg:col-span-8">
            <div className="rounded-2xl bg-white/[0.04] h-80" />
          </div>
        </div>
      </div>
    </main>
  );
}
