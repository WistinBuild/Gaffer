export default function Loading() {
  return (
    <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8">
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="h-6 w-40 rounded-full bg-white/[0.04] mb-6" />
        <div className="h-20 w-3/4 rounded-2xl bg-white/[0.04] mb-3" />

        {/* Podium */}
        <div className="grid grid-cols-3 gap-6 my-10 items-end">
          <div className="rounded-[2rem] bg-white/[0.04] h-64" />
          <div className="rounded-[2rem] bg-white/[0.06] h-80" />
          <div className="rounded-[2rem] bg-white/[0.04] h-56" />
        </div>

        {/* Table */}
        <div className="rounded-[2rem] bg-white/[0.04] h-[480px]" />
      </div>
    </main>
  );
}
