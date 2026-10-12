/**
 * pdfLegendLayout.ts
 *
 * Pure layout logic for the PDF export legend. Given the selected hotels and a
 * text-measuring function, it picks the column count, legend width, font size
 * and entry style that fit every hotel on one US Letter landscape page while
 * keeping the map as large as possible. If even the smallest allowed font
 * cannot fit everything, it returns the best layout and the export spills the
 * remaining entries onto additional pages.
 */

export interface LegendEntryText {
  name: string;
  address: string;
  distance: string; // e.g. "0.8 mi from ACC"
}

/** Splits text into lines that fit `maxWidth` at font size `fontSize`. */
export type SplitTextFn = (text: string, maxWidth: number, fontSize: number) => string[];
/** Width of `text` at font size `fontSize`. */
export type TextWidthFn = (text: string, fontSize: number) => number;

export interface EntryLines {
  nameLines: string[];
  /** Full-style: address lines then distance lines. Compact: combined detail lines. */
  detailLines: { text: string; color: 'address' | 'distance' }[][];
  height: number;
}

export interface LegendLayout {
  columns: number;
  legendWidth: number;
  columnWidth: number;
  textWidth: number;
  badgeWidth: number;
  fontSize: number;
  lineHeight: number;
  compact: boolean;
  entryGap: number;
  /** Entries for each column on each page: pages[page][column] = entry indices. */
  pages: number[][][];
  /** Measured lines per entry (same order as the input entries). */
  entries: EntryLines[];
  mapWidth: number;
  mapHeight: number;
  /** True when everything fits on a single page. */
  fitsOnePage: boolean;
}

export interface LayoutInput {
  entries: LegendEntryText[];
  contentWidth: number;
  /** Height available to the legend columns on the first page (below the header). */
  firstPageColumnHeight: number;
  /** Height available to legend columns on overflow pages. */
  overflowColumnHeight: number;
  contentHeight: number;
  mapAspect: number; // width / height of the map image
  gapWidth: number;
  splitText: SplitTextFn;
  textWidth: TextWidthFn;
}

const MAX_FONT = 10;
const MIN_FONT = 4.5;
const FONT_STEP = 0.25;
const READABLE_FONT = 7;
const COLUMN_GAP = 14;
const BADGE_TEXT_GAP = 6;
const LEGEND_WIDTHS = [320, 360, 400, 440, 480, 520];
/** Never shrink the map below this share of its full size to make room for the legend. */
const MIN_MAP_RATIO = 0.6;
const COLUMN_COUNTS = [1, 2, 3, 4, 5];
const MIN_COLUMN_WIDTH = 105;

export const LEGEND_COLUMN_GAP = COLUMN_GAP;
export const LEGEND_BADGE_TEXT_GAP = BADGE_TEXT_GAP;

function badgeWidthFor(fontSize: number) {
  return Math.max(11, Math.min(16, fontSize * 1.6));
}

function measureEntry(
  e: LegendEntryText,
  textW: number,
  fontSize: number,
  compact: boolean,
  badgeW: number,
  split: SplitTextFn,
  width: TextWidthFn
): EntryLines {
  const lh = fontSize * 1.3;
  const nameLines = split(e.name, textW, fontSize);
  const detailLines: EntryLines['detailLines'] = [];

  if (!compact) {
    split(e.address, textW, fontSize).forEach((t) => detailLines.push([{ text: t, color: 'address' }]));
    split(e.distance, textW, fontSize).forEach((t) => detailLines.push([{ text: t, color: 'distance' }]));
  } else {
    // Address and distance share a line when they fit: "1640 S. Clementine St. · 0.8 mi"
    const addrLines = split(e.address, textW, fontSize);
    addrLines.forEach((t) => detailLines.push([{ text: t, color: 'address' }]));
    const suffix = ` · ${e.distance}`;
    const last = addrLines[addrLines.length - 1] ?? '';
    if (width(last + suffix, fontSize) <= textW && detailLines.length > 0) {
      detailLines[detailLines.length - 1].push({ text: suffix, color: 'distance' });
    } else {
      split(e.distance, textW, fontSize).forEach((t) => detailLines.push([{ text: t, color: 'distance' }]));
    }
  }

  const textH = (nameLines.length + detailLines.length) * lh;
  return { nameLines, detailLines, height: Math.max(badgeW, textH) };
}

/**
 * Greedily packs entries (in order) into columns no taller than `capacity`.
 * Returns the columns, or null if an entry can't fit or columns run out.
 */
function packColumns(heights: number[], gap: number, capacity: number, maxColumns: number): number[][] | null {
  const cols: number[][] = [[]];
  let used = 0;
  for (let i = 0; i < heights.length; i++) {
    const h = heights[i];
    if (h > capacity) return null;
    const needed = cols[cols.length - 1].length === 0 ? h : used + gap + h;
    if (needed <= capacity) {
      cols[cols.length - 1].push(i);
      used = needed;
    } else {
      if (cols.length >= maxColumns) return null;
      cols.push([i]);
      used = h;
    }
  }
  return cols;
}

/** Smallest column capacity (≤ max) that still packs everything — balances columns. */
function balancedPack(heights: number[], gap: number, maxCapacity: number, columns: number): number[][] | null {
  const full = packColumns(heights, gap, maxCapacity, columns);
  if (!full) return null;
  const total = heights.reduce((a, b) => a + b, 0) + gap * Math.max(0, heights.length - 1);
  let lo = Math.max(...heights, total / columns - gap);
  let hi = maxCapacity;
  let best = full;
  for (let iter = 0; iter < 24 && hi - lo > 0.5; iter++) {
    const mid = (lo + hi) / 2;
    const packed = packColumns(heights, gap, mid, columns);
    if (packed) {
      best = packed;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return best;
}

interface Candidate {
  layout: LegendLayout;
  score: number;
}

export function computeLegendLayout(input: LayoutInput): LegendLayout {
  const { entries, contentWidth, contentHeight, mapAspect, gapWidth } = input;
  const maxMapWidth = Math.min(contentWidth - LEGEND_WIDTHS[0] - gapWidth, contentHeight * mapAspect);

  let best: Candidate | null = null;

  for (const legendWidth of LEGEND_WIDTHS) {
    const mapAreaWidth = contentWidth - legendWidth - gapWidth;
    if (mapAreaWidth <= 0) continue;
    const mapWidth = Math.min(mapAreaWidth, contentHeight * mapAspect);
    const mapHeight = mapWidth / mapAspect;
    const mapShrinks = mapWidth < maxMapWidth - 0.5;
    if (mapWidth / maxMapWidth < MIN_MAP_RATIO) continue;

    for (const columns of COLUMN_COUNTS) {
      const columnWidth = (legendWidth - COLUMN_GAP * (columns - 1)) / columns;
      if (columnWidth < MIN_COLUMN_WIDTH) continue;

      for (const compact of [false, true]) {
        for (let fs = MAX_FONT; fs >= MIN_FONT - 1e-9; fs -= FONT_STEP) {
          const badgeW = badgeWidthFor(fs);
          const textW = columnWidth - badgeW - BADGE_TEXT_GAP;
          const entryGap = Math.max(2, fs * 0.3);
          const measured = entries.map((e) =>
            measureEntry(e, textW, fs, compact, badgeW, input.splitText, input.textWidth)
          );
          const heights = measured.map((m) => m.height);
          const packed = balancedPack(heights, entryGap, input.firstPageColumnHeight, columns);

          const layout: LegendLayout = {
            columns,
            legendWidth,
            columnWidth,
            textWidth: textW,
            badgeWidth: badgeW,
            fontSize: fs,
            lineHeight: fs * 1.3,
            compact,
            entryGap,
            pages: packed ? [packed] : [],
            entries: measured,
            mapWidth,
            mapHeight,
            fitsOnePage: !!packed,
          };

          if (packed) {
            // Prefer: readable font with a full-size map; otherwise balance font size against map size.
            // Then fewer columns, then the full (3-line) entry style.
            const readable = fs >= READABLE_FONT ? 1 : 0;
            const score =
              (readable && !mapShrinks ? 1000 : 0) +
              fs * 20 +
              (mapWidth / maxMapWidth) * 50 -
              columns * 0.5 -
              (compact ? 0.25 : 0);
            if (!best || score > best.score) best = { layout, score };
            break; // largest font that fits for this combination
          }
        }
      }
    }
  }

  if (best) return best.layout;

  // Nothing fits on one page even at the minimum font: paginate. Page 1 keeps a
  // full-size map with a two-column legend; overflow pages use the full width.
  const legendWidth = LEGEND_WIDTHS[0];
  const columns = 2;
  const fs = READABLE_FONT;
  const columnWidth = (legendWidth - COLUMN_GAP) / columns;
  const badgeW = badgeWidthFor(fs);
  const textW = columnWidth - badgeW - BADGE_TEXT_GAP;
  const entryGap = Math.max(2, fs * 0.3);
  const measured = entries.map((e) => measureEntry(e, textW, fs, true, badgeW, input.splitText, input.textWidth));
  const overflowColumns = Math.max(1, Math.floor((contentWidth + COLUMN_GAP) / (columnWidth + COLUMN_GAP)));

  const pages: number[][][] = [];
  let next = 0;
  while (next < measured.length) {
    const first = pages.length === 0;
    const capacity = first ? input.firstPageColumnHeight : input.overflowColumnHeight;
    const maxCols = first ? columns : overflowColumns;
    const cols: number[][] = [];
    let col: number[] = [];
    let used = 0;
    while (next < measured.length) {
      const h = measured[next].height;
      const needed = col.length === 0 ? h : used + entryGap + h;
      if (needed <= capacity || col.length === 0) {
        col.push(next);
        used = needed;
        next++;
      } else {
        cols.push(col);
        col = [];
        used = 0;
        if (cols.length >= maxCols) break;
      }
    }
    if (col.length) cols.push(col);
    pages.push(cols);
  }

  const mapWidth = Math.min(contentWidth - legendWidth - gapWidth, contentHeight * mapAspect);
  return {
    columns,
    legendWidth,
    columnWidth,
    textWidth: textW,
    badgeWidth: badgeW,
    fontSize: fs,
    lineHeight: fs * 1.3,
    compact: true,
    entryGap,
    pages,
    entries: measured,
    mapWidth,
    mapHeight: mapWidth / mapAspect,
    fitsOnePage: pages.length <= 1,
  };
}
