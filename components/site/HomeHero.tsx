import Image from 'next/image';
import { ArrowRight, ChevronDown } from 'lucide-react';

/**
 * Hero built around /banner.png (1916×821).
 * Full banner on every breakpoint (aspect reserved → no layout shift).
 * Desktop overlays a CTA in a bottom scrim; mobile stacks the CTA below.
 */
export default function HomeHero() {
  const cta = (
    <a
      href="#products"
      className="group pointer-events-auto inline-flex items-center gap-2.5 rounded-full bg-brand-700 px-8 py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-sand-50 shadow-xl transition duration-300 hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-2xl sm:text-sm"
    >
      Shop the Collection
      <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
    </a>
  );

  return (
    <section className="relative bg-sand-100 pt-16 md:pt-0">
      <div className="relative overflow-hidden hero-fade">
        <Image
          src="/banner.png"
          alt="Shiraly — From Artist, To Artist"
          width={1916}
          height={821}
          priority
          sizes="100vw"
          className="hero-zoom h-auto w-full select-none"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-2/5 bg-gradient-to-t from-[rgba(42,30,20,0.6)] via-[rgba(42,30,20,0.15)] to-transparent md:block" />
        <div className="absolute inset-x-0 bottom-10 hidden flex-col items-center gap-4 px-4 text-center md:flex hero-rise delay-300">
          <p className="text-sm font-medium tracking-wide text-sand-50/90 drop-shadow">
            Discover the latest Shiraly essentials
          </p>
          {cta}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-3 hidden justify-center text-sand-50/80 md:flex">
          <ChevronDown size={22} className="scroll-nudge" aria-hidden />
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 px-4 py-7 text-center md:hidden">
        <p className="font-heading text-lg font-bold text-ink-900">Discover the latest Shiraly essentials</p>
        {cta}
      </div>
    </section>
  );
}
