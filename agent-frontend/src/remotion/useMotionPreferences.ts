import { useEffect, useMemo, useState } from 'react';

type NavigatorWithMemory = Navigator & {
  deviceMemory?: number;
};

interface MotionPreferences {
  allowMotion: boolean;
  prefersReducedMotion: boolean;
  isLowPerformanceDevice: boolean;
}

export function useMotionPreferences(enabled = true): MotionPreferences {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isLowPerformanceDevice, setIsLowPerformanceDevice] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');

    const refresh = () => {
      const hardwareThreads = navigator.hardwareConcurrency ?? 8;
      const deviceMemory = (navigator as NavigatorWithMemory).deviceMemory;
      const lowCpu = hardwareThreads <= 4;
      const lowMemory = typeof deviceMemory === 'number' && deviceMemory <= 4;

      setPrefersReducedMotion(media.matches);
      setIsLowPerformanceDevice(lowCpu || lowMemory);
    };

    refresh();
    media.addEventListener('change', refresh);

    return () => {
      media.removeEventListener('change', refresh);
    };
  }, []);

  const allowMotion = useMemo(() => {
    return enabled && !prefersReducedMotion && !isLowPerformanceDevice;
  }, [enabled, prefersReducedMotion, isLowPerformanceDevice]);

  return {
    allowMotion,
    prefersReducedMotion,
    isLowPerformanceDevice,
  };
}
