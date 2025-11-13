/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Cat, Clover, Film, Globe, Home, PlaySquare, Radio, Star, Tv } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import LiquidGlassContainer from './LiquidGlassContainer';

interface MobileBottomNavProps {
  /**
   * 主动指定当前激活的路径。当未提供时，自动使用 usePathname() 获取的路径。
   */
  activePath?: string;
}

const MobileBottomNav = ({ activePath }: MobileBottomNavProps) => {
  const pathname = usePathname();

  // 当前激活路径：优先使用传入的 activePath，否则回退到浏览器地址
  const currentActive = activePath ?? pathname;

  const [navItems, setNavItems] = useState([
    { icon: Home, label: '首页', href: '/' },
    {
      icon: Globe,
      label: '源浏览',
      href: '/source-browser',
    },
    {
      icon: Film,
      label: '电影',
      href: '/douban?type=movie',
    },
    {
      icon: Tv,
      label: '剧集',
      href: '/douban?type=tv',
    },
    {
      icon: PlaySquare,
      label: '短剧',
      href: '/shortdrama',
    },
    {
      icon: Cat,
      label: '动漫',
      href: '/douban?type=anime',
    },
    {
      icon: Clover,
      label: '综艺',
      href: '/douban?type=show',
    },
    {
      icon: Radio,
      label: '直播',
      href: '/live',
    },
  ]);

  useEffect(() => {
    const runtimeConfig = (window as any).RUNTIME_CONFIG;
    if (runtimeConfig?.CUSTOM_CATEGORIES?.length > 0) {
      setNavItems((prevItems) => [
        ...prevItems,
        {
          icon: Star,
          label: '自定义',
          href: '/douban?type=custom',
        },
      ]);
    }
  }, []);

  const isActive = (href: string) => {
    const typeMatch = href.match(/type=([^&]+)/)?.[1];

    // 解码URL以进行正确的比较
    const decodedActive = decodeURIComponent(currentActive);
    const decodedItemHref = decodeURIComponent(href);

    return (
      decodedActive === decodedItemHref ||
      (decodedActive.startsWith('/douban') &&
        decodedActive.includes(`type=${typeMatch}`)) ||
      (href === '/shortdrama' && decodedActive.startsWith('/shortdrama'))
    );
  };

  return (
    <nav
      className='md:hidden fixed bottom-0 left-0 right-0 z-[600]'
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      aria-label='底部导航'
    >
      <LiquidGlassContainer
        className='mx-2 mb-2 overflow-hidden'
        roundedClass='rounded-[26px]'
        intensity='high'
        shadow='2xl'
        border='subtle'
        animated
      >
        {/* 顶部渐变强调线 */}
        <div className='h-[2px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent'></div>

        <ul className='flex items-center justify-around px-2 py-2 h-16'>
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className='flex-shrink-0 min-w-[52px]'>
                <Link
                  href={item.href}
                  className='relative flex flex-col items-center justify-center gap-0.5 transition-all duration-300 active:scale-95'
                  aria-current={active ? 'page' : undefined}
                >
                  {/* 激活背景胶囊 */}
                  <div className='relative'>
                    {active && (
                      <div className='absolute -inset-2 rounded-2xl bg-emerald-500/10 blur-[2px]'></div>
                    )}

                    {/* 图标容器 */}
                    <div className={`relative flex items-center justify-center w-10 h-7 rounded-2xl transition-all duration-300 ${active ? 'bg-gradient-to-br from-gray-100/80 to-gray-200/60 dark:from-gray-800/80 dark:to-gray-700/60 shadow-lg' : 'bg-transparent'}`}>
                      <Icon
                        className={`w-5 h-5 ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'} transition-all duration-300`}
                        strokeWidth={active ? 2.5 : 2}
                      />
                    </div>
                  </div>

                  {/* 标签，仅激活时显示 */}
                  {active && (
                    <span className='text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 transition-all duration-300'>
                      {item.label}
                    </span>
                  )}

                  {/* 激活指示点 */}
                  {active && (
                    <span className='absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500 shadow-sm'></span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </LiquidGlassContainer>
    </nav>
  );
};

export default MobileBottomNav;
