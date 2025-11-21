/* eslint-disable react-hooks/exhaustive-deps */

import React, { useEffect, useRef, useState } from 'react';

interface CapsuleSwitchProps {
  options: { label: string; value: string }[];
  active: string;
  onChange: (value: string) => void;
  className?: string;
}

const CapsuleSwitch: React.FC<CapsuleSwitchProps> = ({
  options,
  active,
  onChange,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
  }>({ left: 0, width: 0 });
  const [motionReduced, setMotionReduced] = useState(false);

  // 触摸滑动状态（仅用于移动端横向切换）
  const touchStartXRef = useRef<number | null>(null);
  const touchLastXRef = useRef<number | null>(null);
  const touchTriggeredRef = useRef<boolean>(false);
  const SWIPE_THRESHOLD = 30; // 触发切换的最小位移（像素）

  // 兼容无传入 options 的情况，避免运行时异常
  const safeOptions = Array.isArray(options) ? options : [];
  const activeIndex = safeOptions.findIndex((opt) => opt.value === active);

  // 更新指示器位置
  const updateIndicatorPosition = () => {
    if (
      activeIndex >= 0 &&
      buttonRefs.current[activeIndex] &&
      containerRef.current
    ) {
      const button = buttonRefs.current[activeIndex];
      const container = containerRef.current;
      if (button && container) {
        const buttonRect = button.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        if (buttonRect.width > 0) {
          setIndicatorStyle({
            left: buttonRect.left - containerRect.left,
            width: buttonRect.width,
          });
        }
      }
    }
  };

  // 组件挂载时立即计算初始位置
  useEffect(() => {
    const timeoutId = setTimeout(updateIndicatorPosition, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  // 监听选中项变化
  useEffect(() => {
    const timeoutId = setTimeout(updateIndicatorPosition, 0);
    return () => clearTimeout(timeoutId);
  }, [activeIndex]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let ro: ResizeObserver | null = null;
    const handle = () => updateIndicatorPosition();
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(handle);
      ro.observe(el);
    }
    const onResize = () => handle();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function'
    ) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const handler = (e: MediaQueryListEvent) => setMotionReduced(e.matches);
      setMotionReduced(mq.matches);
      mq.addEventListener?.('change', handler);
      return () => mq.removeEventListener?.('change', handler);
    }
  }, []);

  // 触摸事件处理：左右滑动切换激活项
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touchStartXRef.current = t.clientX;
      touchLastXRef.current = t.clientX;
      touchTriggeredRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      const startX = touchStartXRef.current;
      if (startX == null) return;
      const dx = t.clientX - startX;
      touchLastXRef.current = t.clientX;
      // 只在一次滑动中触发一次切换
      if (!touchTriggeredRef.current && Math.abs(dx) > SWIPE_THRESHOLD) {
        touchTriggeredRef.current = true;
        const nextIndex = (() => {
          if (dx < 0) {
            // 左滑：下一个
            return Math.min(activeIndex + 1, safeOptions.length - 1);
          } else {
            // 右滑：上一个
            return Math.max(activeIndex - 1, 0);
          }
        })();
        if (nextIndex !== activeIndex && safeOptions[nextIndex]) {
          onChange(safeOptions[nextIndex].value);
        }
      }
    };

    const handleTouchEnd = () => {
      touchStartXRef.current = null;
      touchLastXRef.current = null;
      touchTriggeredRef.current = false;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [activeIndex, safeOptions, onChange]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 rounded-full p-1 shadow-lg ${
        className || ''
      }`}
      style={{ touchAction: 'pan-x' }}
      role='tablist'
    >
      {/* 滑动的渐变背景指示器 */}
      {indicatorStyle.width > 0 && (
        <div
          className={`absolute top-1 bottom-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 dark:from-blue-600 dark:via-purple-600 dark:to-pink-600 rounded-full shadow-xl ${
            motionReduced ? '' : 'transition-all duration-300 ease-out'
          } will-change-transform`}
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`,
            boxShadow: motionReduced
              ? '0 0 8px rgba(147, 51, 234, 0.28)'
              : '0 0 20px rgba(147, 51, 234, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)',
          }}
        />
      )}

      {safeOptions.map((opt, index) => {
        const isActive = active === opt.value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            onClick={() => onChange(opt.value)}
            className={`relative z-10 w-16 px-3 py-1 text-xs sm:w-20 sm:py-2 sm:text-sm rounded-full font-bold ${
              motionReduced ? '' : 'transition-all duration-200'
            } cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800 ${
              isActive
                ? 'text-white dark:text-white drop-shadow-lg'
                : 'text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
            role='tab'
            aria-selected={isActive}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const dir = e.key === 'ArrowRight' ? 1 : -1;
                const next = Math.min(
                  Math.max(activeIndex + dir, 0),
                  safeOptions.length - 1
                );
                if (safeOptions[next]) onChange(safeOptions[next].value);
              } else if (e.key === 'Home') {
                e.preventDefault();
                if (safeOptions[0]) onChange(safeOptions[0].value);
              } else if (e.key === 'End') {
                e.preventDefault();
                if (safeOptions[safeOptions.length - 1])
                  onChange(safeOptions[safeOptions.length - 1].value);
              }
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default CapsuleSwitch;
