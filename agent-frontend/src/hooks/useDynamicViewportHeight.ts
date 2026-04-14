import { useEffect, useState } from 'react';

function getViewportHeight(): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  return window.visualViewport?.height ?? window.innerHeight;
}

export function useDynamicViewportHeight(): number {
  const [viewportHeight, setViewportHeight] = useState<number>(() => getViewportHeight());

  useEffect(() => {
    const updateHeight = () => {
      setViewportHeight(getViewportHeight());
    };

    updateHeight();

    const viewport = window.visualViewport;
    window.addEventListener('resize', updateHeight);
    window.addEventListener('orientationchange', updateHeight);
    viewport?.addEventListener('resize', updateHeight);
    viewport?.addEventListener('scroll', updateHeight);

    return () => {
      window.removeEventListener('resize', updateHeight);
      window.removeEventListener('orientationchange', updateHeight);
      viewport?.removeEventListener('resize', updateHeight);
      viewport?.removeEventListener('scroll', updateHeight);
    };
  }, []);

  return viewportHeight;
}
