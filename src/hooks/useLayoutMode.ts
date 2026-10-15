import { useEffect, useState } from 'react';

export type LayoutMode = 'desktop' | 'mobile';

/**
 * Desktop/laptop (landscape) → 'desktop': hotel list | map | selected-hotels panel.
 * Phones (either orientation) and tablets held in portrait → 'mobile': Map / Hotels tabs.
 */
const MOBILE_MAX_WIDTH = 767;
const PORTRAIT_TABLET_MAX_WIDTH = 1023;
const PHONE_LANDSCAPE_MAX_HEIGHT = 499; // phones turned sideways
const QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px), (orientation: portrait) and (max-width: ${PORTRAIT_TABLET_MAX_WIDTH}px), (max-height: ${PHONE_LANDSCAPE_MAX_HEIGHT}px)`;

function getMode(): LayoutMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'desktop';
  return window.matchMedia(QUERY).matches ? 'mobile' : 'desktop';
}

export function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>(getMode);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setMode(mql.matches ? 'mobile' : 'desktop');
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return mode;
}
