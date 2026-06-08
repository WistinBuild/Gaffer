export default function Loading() {
  return (
    <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8">
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="h-6 w-40 rounded-full bg-white/[0.04] mb-6" />
        <div className="h-20 w-3/4 rounded-2xl bg-white/[0.04] mb-3" />
        <div className="h-5 w-1/2 rounded-full bg-white/[0.04] mb-10" />

        {/* Active war card */}
        <div className="rounded-[2rem] bg-white/[0.04] h-72 mb-12" />

        {/* Open wars grid */}
        <div className="h-8 w-1/3 rounded-full bg-white/[0.04] mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white/[0.03] h-64" />
          ))}
        </div>
      </div>
    </main>
  );
}
