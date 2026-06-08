export default function Loading() {
  return (
    <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8">
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="h-6 w-40 rounded-full bg-white/[0.04] mb-6" />
        <div className="h-24 w-2/3 rounded-2xl bg-white/[0.04] mb-12" />

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 auto-rows-[220px]">
          <div className="md:col-span-4 md:row-span-2 rounded-[2rem] bg-white/[0.04]" />
          <div className="md:col-span-2 rounded-[2rem] bg-white/[0.03]" />
          <div className="md:col-span-2 rounded-[2rem] bg-white/[0.03]" />
          <div className="md:col-span-2 rounded-[2rem] bg-white/[0.03]" />
          <div className="md:col-span-2 rounded-[2rem] bg-white/[0.03]" />
          <div className="md:col-span-2 rounded-[2rem] bg-white/[0.03]" />
        </div>
      </div>
    </main>
  );
}
