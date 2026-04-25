import { useEffect, useRef, useState, useCallback } from 'react';

interface UnicornStudioInstance {
  destroy: () => void;
  element: HTMLElement;
}

interface UnicornStudioAPI {
  init: (options?: {
    scale?: number;
    dpi?: number;
    fps?: number;
    lazyLoad?: boolean;
  }) => Promise<UnicornStudioInstance[]>;
  destroy: () => void;
  isInitialized?: boolean;
}

interface PerformanceProfile {
  dpi: number;
  scale: number;
  fps: number;
}

declare global {
  interface Window {
    UnicornStudio?: UnicornStudioAPI;
  }
}

/**
 * Detect if user is on a mobile/low-power device
 */
function getDevicePerformanceProfile(): PerformanceProfile {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isLowEndDevice = navigator.hardwareConcurrency ? navigator.hardwareConcurrency <= 4 : false;
  const deviceMemory = (navigator as { deviceMemory?: number }).deviceMemory || 4;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // If user prefers reduced motion, minimize everything
  if (prefersReducedMotion) {
    return { dpi: 1, scale: 0.5, fps: 30 };
  }

  // Low-end mobile devices
  if (isMobile && (isLowEndDevice || deviceMemory < 4)) {
    return { dpi: 1, scale: 0.5, fps: 30 };
  }

  // Standard mobile devices
  if (isMobile) {
    return { dpi: 1.25, scale: 0.75, fps: 45 };
  }

  // Low-end desktop
  if (isLowEndDevice || deviceMemory < 4) {
    return { dpi: 1.25, scale: 0.75, fps: 45 };
  }

  // High-end devices
  return { dpi: 1.5, scale: 1, fps: 60 };
}

/**
 * Load the UnicornStudio script dynamically using requestIdleCallback
 * This prevents blocking the main thread during page load
 */
function loadUnicornScript(): Promise<UnicornStudioAPI> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.UnicornStudio) {
      resolve(window.UnicornStudio);
      return;
    }

    const loadScript = () => {
      const script = document.createElement('script');
      script.src = '/unicornStudio.umd.js';
      script.async = true;

      script.onload = () => {
        if (window.UnicornStudio) {
          resolve(window.UnicornStudio);
        } else {
          reject(new Error('UnicornStudio not found after script load'));
        }
      };

      script.onerror = () => {
        reject(new Error('Failed to load UnicornStudio script'));
      };

      document.head.appendChild(script);
    };

    // Use requestIdleCallback for non-blocking load
    // Falls back to setTimeout for Safari
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number })
        .requestIdleCallback(loadScript, { timeout: 2000 });
    } else {
      // Fallback: use setTimeout with 0 delay to defer execution
      setTimeout(loadScript, 0);
    }
  });
}

interface UseLazyUnicornStudioOptions {
  projectId?: string;
  rootMargin?: string;
  threshold?: number;
  enabled?: boolean;
}

interface UseLazyUnicornStudioReturn {
  isLoaded: boolean;
  isInitialized: boolean;
  isError: boolean;
  error: Error | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Custom hook for lazy loading and initializing UnicornStudio
 * 
 * Features:
 * - Intersection Observer: Only loads when element is near viewport
 * - requestIdleCallback: Loads script during browser idle time
 * - Device-aware performance profiles
 * - Graceful error handling
 * - Visibility-aware pause/resume
 */
export function useLazyUnicornStudio(
  options: UseLazyUnicornStudioOptions = {}
): UseLazyUnicornStudioReturn {
  const {
    rootMargin = '200px', // Start loading 200px before element is visible
    threshold = 0,
    enabled = true,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<UnicornStudioInstance | null>(null);
  const hasStartedLoading = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const initializeUnicorn = useCallback(async () => {
    if (!containerRef.current || hasStartedLoading.current) return;
    hasStartedLoading.current = true;

    try {
      // Load script during idle time
      const UnicornStudio = await loadUnicornScript();
      setIsLoaded(true);

      // Get device-specific performance settings
      const profile = getDevicePerformanceProfile();

      // Initialize with optimized settings
      const initScene = async () => {
        if (!containerRef.current) return;

        try {
          const scenes = await UnicornStudio.init({
            scale: profile.scale,
            dpi: profile.dpi,
            fps: profile.fps,
          });

          // Find our scene
          const ourScene = scenes.find(
            (scene) =>
              scene.element === containerRef.current ||
              scene.element.contains(containerRef.current!) ||
              containerRef.current!.contains(scene.element)
          );

          if (ourScene) {
            instanceRef.current = ourScene;
          }

          setIsInitialized(true);
        } catch (initError) {
          console.error('UnicornStudio init error:', initError);
          setIsError(true);
          setError(initError instanceof Error ? initError : new Error('Init failed'));
        }
      };

      // Initialize during idle time for smoother experience
      if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number })
          .requestIdleCallback(() => initScene(), { timeout: 1000 });
      } else {
        // Use requestAnimationFrame as fallback for smoother init
        requestAnimationFrame(() => {
          requestAnimationFrame(() => initScene());
        });
      }
    } catch (loadError) {
      console.error('UnicornStudio load error:', loadError);
      setIsError(true);
      setError(loadError instanceof Error ? loadError : new Error('Load failed'));
    }
  }, []);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    // Create intersection observer to detect when element is near viewport
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasStartedLoading.current) {
            initializeUnicorn();
            observerRef.current?.disconnect();
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    observerRef.current.observe(containerRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [enabled, rootMargin, threshold, initializeUnicorn]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (instanceRef.current?.destroy) {
        instanceRef.current.destroy();
        instanceRef.current = null;
      }
    };
  }, []);

  return {
    isLoaded,
    isInitialized,
    isError,
    error,
    containerRef,
  };
}

/**
 * Alternative: Immediate loading with requestIdleCallback
 * Use this when you want to preload but not block rendering
 */
export function usePreloadUnicornStudio(): { isLoaded: boolean; isError: boolean } {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    loadUnicornScript()
      .then(() => setIsLoaded(true))
      .catch(() => setIsError(true));
  }, []);

  return { isLoaded, isError };
}
