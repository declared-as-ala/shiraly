'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPathRef = useRef(pathname + searchParams.toString());

  useEffect(() => {
    const key = pathname + searchParams.toString();
    if (key !== prevPathRef.current) {
      prevPathRef.current = key;
      setProgress(30);
      setVisible(true);
      let p = 30;
      const t = setInterval(() => {
        p += Math.random() * 25;
        if (p >= 95) { p = 95; clearInterval(t); timerRef.current = null; }
        setProgress(p);
      }, 200);
      timerRef.current = t;
      const finish = setTimeout(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setProgress(100);
        setTimeout(() => setVisible(false), 300);
      }, 600);
      return () => { clearTimeout(finish); if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; };
    }
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div className="fixed left-0 top-0 z-[9999] h-[3px] w-full">
      <div
        className="h-full bg-gradient-to-r from-brand-500 via-brand-400 to-brand-500 transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
