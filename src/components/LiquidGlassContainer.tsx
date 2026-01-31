'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

interface LiquidGlassContainerProps {
  children: ReactNode;
  className?: string;
  roundedClass?: string; // Tailwind rounded class, e.g. 'rounded-2xl' or 'rounded-[28px]' or 'rounded-full'
  intensity?: 'low' | 'medium' | 'high' | 'strong';
  border?: 'subtle' | 'normal';
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  animated?: boolean; // 是否启用液态玻璃动效
  animatedMode?: 'always' | 'hover' | 'inview'; // 动效触发模式
  tint?: 'blue' | 'neutral' | 'pink';
}

export default function LiquidGlassContainer({
  children,
  className,
  roundedClass = 'rounded-2xl',
  intensity = 'medium',
  border: _border = 'subtle', // Keep for compat, but unused
  shadow = 'lg',
  animated = true,
  animatedMode = 'inview',
  tint = 'blue',
}: LiquidGlassContainerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [motionReduced, setMotionReduced] = useState(false);

  useEffect(() => {
    if (!animated || animatedMode !== 'inview') return;
    const el = rootRef.current;
    if (!el || typeof window === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        setInView(!!first?.isIntersecting);
      },
      { root: null, threshold: 0 }
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
    };
  }, [animated, animatedMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const handler = (e: MediaQueryListEvent) => setMotionReduced(e.matches);
      setMotionReduced(mq.matches);
      mq.addEventListener?.('change', handler);
      return () => mq.removeEventListener?.('change', handler);
    } catch {
      // ignore
    }
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    rootRef.current.style.setProperty('--lgx-spotlight-x', `${x}px`);
    rootRef.current.style.setProperty('--lgx-spotlight-y', `${y}px`);
  };

  const intensityClass = clsx({
    'lgx-intensity-strong': intensity === 'strong',
    'lgx-intensity-low': intensity === 'low',
    // medium/high use default
  });

  const tintClass = clsx({
    'lgx-tint-blue': tint === 'blue',
    'lgx-tint-pink': tint === 'pink',
    'lgx-tint-neutral': tint === 'neutral',
  });

  const shadowMap: Record<string, string> = {
    none: 'shadow-none',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
    '2xl': 'shadow-2xl',
  };

  const shouldAnimate =
    animated &&
    !motionReduced &&
    (animatedMode === 'always' ||
      (animatedMode === 'hover' && isHovered) ||
      (animatedMode === 'inview' && inView));

  return (
    <div
      ref={rootRef}
      className={clsx(
        'lgx-container',
        roundedClass,
        intensityClass,
        tintClass,
        shadowMap[shadow],
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
    >
      {/* 1. Fluid Background Layer - DISABLED */}
      {/* {shouldAnimate && <div className='lgx-fluid-bg' />} */}

      {/* 2. Spotlight Effect (Mouse Follow) */}
      <div className='lgx-spotlight' />

      {/* 3. Specular Highlight (The "Edge Glint") */}
      <div className='lgx-specular' />

      {/* 4. Shimmer Animation (Optional overlay) */}
      {shouldAnimate && <div className='lgx-shimmer' />}

      {/* Content */}
      <div className='relative z-10'>{children}</div>
    </div>
  );
}
