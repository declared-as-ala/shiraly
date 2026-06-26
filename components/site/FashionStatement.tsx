import Reveal from '@/components/site/Reveal';

export default function FashionStatement() {
  return (
    <section id="about" className="relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-brand-800 py-16 text-sand-50 md:py-28">
      <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_20%_10%,white,transparent_40%),radial-gradient(circle_at_85%_90%,white,transparent_40%)]" />
      <Reveal className="container-shop relative text-center">
        <span className="mx-auto block h-px w-16 origin-center bg-sand-50/60 line-grow" />
        <h2 className="font-heading mx-auto mt-6 max-w-4xl text-[1.75rem] font-black leading-tight tracking-tight sm:mt-8 sm:text-5xl md:text-6xl">
          FROM ARTIST, TO ARTIST
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-sm text-sand-50/80 sm:mt-6 sm:text-base md:text-lg">
          Shiraly is more than clothing. It is a way to express your identity.
        </p>
        <span className="mx-auto mt-8 block h-px w-16 origin-center bg-sand-50/60 line-grow" />
      </Reveal>
    </section>
  );
}
