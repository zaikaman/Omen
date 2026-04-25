import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export const CustomCursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailerRef = useRef<HTMLDivElement>(null);
  // Start visible to avoid flicker if mouse is already on screen
  const [isVisible, setIsVisible] = useState(true);
  const [isClicking, setIsClicking] = useState(false);
  const [isPointerFine, setIsPointerFine] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(pointer: fine)');
    setIsPointerFine(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setIsPointerFine(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!isPointerFine) return;

    const cursor = cursorRef.current;
    const trailer = trailerRef.current;
    
    if (!cursor || !trailer) return;

    let trailerX = 0;
    let trailerY = 0;
    let mouseX = 0;
    let mouseY = 0;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      
      // Instant update for main cursor to prevent lag
      cursor.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
      
      if (!isVisible) setIsVisible(true);
    };

    const animateTrailer = () => {
      // Lerp for smooth trailing
      const ease = 0.15;
      trailerX += (mouseX - trailerX) * ease;
      trailerY += (mouseY - trailerY) * ease;
      
      trailer.style.transform = `translate3d(${trailerX}px, ${trailerY}px, 0)`;
      
      requestAnimationFrame(animateTrailer);
    };

    const onMouseDown = () => setIsClicking(true);
    const onMouseUp = () => setIsClicking(false);
    const onMouseEnter = () => setIsVisible(true);
    const onMouseLeave = () => setIsVisible(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    document.body.addEventListener('mouseenter', onMouseEnter);
    document.body.addEventListener('mouseleave', onMouseLeave);

    const animationId = requestAnimationFrame(animateTrailer);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.removeEventListener('mouseenter', onMouseEnter);
      document.body.removeEventListener('mouseleave', onMouseLeave);
      cancelAnimationFrame(animationId);
    };
  }, [isVisible, isPointerFine]);

  // Hide default cursor globally
  useEffect(() => {
    if (!isPointerFine) return;

    const style = document.createElement('style');
    style.innerHTML = `
      @media (pointer: fine) {
        * { cursor: none !important; }
        /* Ensure links and buttons also don't show cursor */
        a, button, [role="button"], input, select, textarea { cursor: none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, [isPointerFine]);

  useEffect(() => {
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.top = '0';
    div.style.left = '0';
    div.style.width = '100%';
    div.style.height = '0';
    div.style.pointerEvents = 'none';
    div.style.zIndex = '2147483647';
    document.body.appendChild(div);
    setPortalContainer(div);

    const observer = new MutationObserver((mutations) => {
      let shouldMove = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            if (mutation.addedNodes[i] !== div) {
              shouldMove = true;
              break;
            }
          }
        }
      }
      if (shouldMove && document.body.lastChild !== div) {
        document.body.appendChild(div);
      }
    });
    
    observer.observe(document.body, { childList: true });

    return () => {
      observer.disconnect();
      if (document.body.contains(div)) {
        document.body.removeChild(div);
      }
    };
  }, []);

  if (!isPointerFine || !portalContainer) return null;

  return createPortal(
    <>
      {/* Main Crosshair Cursor */}
      <div
        ref={cursorRef}
        className={`pointer-events-none fixed left-0 top-0 transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{ willChange: 'transform', zIndex: 2147483647 }}
      >
        <div className={`relative -ml-3 -mt-3 h-6 w-6 transition-transform duration-100 ${isClicking ? 'scale-75' : 'scale-100'}`}>
          {/* Crosshair lines */}
          <div className="absolute left-1/2 top-0 h-full w-[1px] bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          <div className="absolute left-0 top-1/2 h-[1px] w-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          {/* Center dot */}
          <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 bg-cyan-400" />
        </div>
      </div>

      {/* Trailing Ring */}
      <div
        ref={trailerRef}
        className={`pointer-events-none fixed left-0 top-0 transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{ willChange: 'transform', zIndex: 2147483646 }}
      >
        <div 
          className={`
            -ml-6 -mt-6 h-12 w-12 rounded-full border border-cyan-500/30 
            transition-all duration-300 ease-out
            ${isClicking ? 'scale-50 opacity-80 bg-cyan-500/10 border-cyan-500' : 'scale-100 opacity-40'}
          `} 
        >
          {/* Decorative corners for tech feel */}
          <div className="absolute -left-[1px] -top-[1px] h-2 w-2 border-l border-t border-cyan-500/60" />
          <div className="absolute -right-[1px] -top-[1px] h-2 w-2 border-r border-t border-cyan-500/60" />
          <div className="absolute -bottom-[1px] -left-[1px] h-2 w-2 border-b border-l border-cyan-500/60" />
          <div className="absolute -bottom-[1px] -right-[1px] h-2 w-2 border-b border-r border-cyan-500/60" />
        </div>
      </div>
    </>,
    portalContainer
  );
};
