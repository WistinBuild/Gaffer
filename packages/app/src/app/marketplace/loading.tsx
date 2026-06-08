export default function Loading() {
  return (
    <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8">
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="h-6 w-48 rounded-full bg-white/[0.04] mb-6" />
        <div className="h-20 w-2/3 rounded-2xl bg-white/[0.04] mb-3" />
        <div className="h-5 w-1/2 rounded-full bg-white/[0.04] mb-10" />

        {/* Featured row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-12 justify-items-center">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-32 h-44 rounded-xl bg-white/[0.04]" />
          ))}
        </div>

        <div className="h-12 w-full rounded-2xl bg-white/[0.04] mb-6" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white/[0.03] h-72" />
          ))}
        </div>
      </div>
    </main>
  );
}
