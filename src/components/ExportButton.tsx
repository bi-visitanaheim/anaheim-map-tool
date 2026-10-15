import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { SelectedHotel } from '@/hooks/useMarkerPositions';
import { hotels, Hotel } from '@/data/hotels';
import { computeLegendLayout, LEGEND_BADGE_TEXT_GAP, LEGEND_COLUMN_GAP } from '@/lib/pdfLegendLayout';
import { SHARP_SANS_600_BASE64, SHARP_SANS_700_BASE64 } from '@/lib/pdfFonts';

interface ExportButtonProps {
  selectedHotels: SelectedHotel[];
  /** Icon-only button for the compact (mobile) header. */
  compact?: boolean;
}

// US Letter landscape: 11 x 8.5 inches = 792 x 612 points at 72 DPI
const PAGE_WIDTH_PT = 792;
const PAGE_HEIGHT_PT = 612;
const MARGIN_PT = 24;

export function ExportButton({ selectedHotels, compact = false }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const generatePDF = async () => {
    if (selectedHotels.length === 0) {
      toast.error('Please select at least one hotel to export');
      return;
    }

    setIsExporting(true);
    toast.info('Generating PDF...');

    try {
      // Load the company logo
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => reject(new Error('Failed to load logo'));
        logoImg.src = '/images/wog.png';
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'letter',
      });

      // Embed Sharp Sans Display No.2 so the exported PDF matches the on-screen brand font
      pdf.addFileToVFS('SharpSans-600.ttf', SHARP_SANS_600_BASE64);
      pdf.addFont('SharpSans-600.ttf', 'SharpSans', 'normal');
      pdf.addFileToVFS('SharpSans-700.ttf', SHARP_SANS_700_BASE64);
      pdf.addFont('SharpSans-700.ttf', 'SharpSans', 'bold');

      const contentWidth = PAGE_WIDTH_PT - MARGIN_PT * 2;
      const contentHeight = PAGE_HEIGHT_PT - MARGIN_PT * 2;

      const sortedHotels = [...selectedHotels].sort((a, b) => a.number - b.number);
      const legendHotels = sortedHotels
        .map((sh) => ({ sh, hotel: hotels.find((h) => h.id === sh.hotelId) }))
        .filter((x): x is { sh: SelectedHotel; hotel: Hotel } => !!x.hotel);

      // ── Logo sizing ──────────────────────────────────────────────────────────
      const logoMaxWidth = 120;
      const logoMaxHeight = 50;
      const logoAspect = logoImg.naturalWidth / logoImg.naturalHeight;
      let logoWidth: number;
      let logoHeight: number;
      if (logoAspect > logoMaxWidth / logoMaxHeight) {
        logoWidth = logoMaxWidth;
        logoHeight = logoMaxWidth / logoAspect;
      } else {
        logoHeight = logoMaxHeight;
        logoWidth = logoMaxHeight * logoAspect;
      }
      const headerHeight = logoHeight + 12 + 22;
      const continuedHeaderHeight = 22;
      const gapWidth = 12;

      // ── Map image ────────────────────────────────────────────────────────────
      const mapContainer = document.getElementById('map-container');
      if (!mapContainer) throw new Error('Map container not found');
      const mapImage = mapContainer.querySelector('img') as HTMLImageElement;
      if (!mapImage) throw new Error('Map image not found');
      const imageAspect = mapImage.naturalWidth / mapImage.naturalHeight;

      // ── Legend layout: fit every selected hotel on one page when possible ──
      pdf.setFont('SharpSans', 'normal');
      const layout = computeLegendLayout({
        entries: legendHotels.map(({ hotel }) => ({
          name: hotel.name,
          address: hotel.address,
          distance: `${hotel.distanceFromACC} mi from ACC`,
        })),
        contentWidth,
        contentHeight,
        firstPageColumnHeight: contentHeight - headerHeight - 4,
        overflowColumnHeight: contentHeight - continuedHeaderHeight - 4,
        mapAspect: imageAspect,
        gapWidth,
        splitText: (text, maxW, fs) => {
          pdf.setFontSize(fs);
          return pdf.splitTextToSize(text, maxW) as string[];
        },
        textWidth: (text, fs) => {
          pdf.setFontSize(fs);
          return pdf.getTextWidth(text);
        },
      });

      const { fontSize, lineHeight, badgeWidth: badgeW, columnWidth, entryGap } = layout;

      // ── Draw one column with per-entry separators ───────────────────────────
      const drawColumn = (entryIdx: number[], colStartX: number, startY: number) => {
        let y = startY;
        const textX = colStartX + badgeW + LEGEND_BADGE_TEXT_GAP;

        entryIdx.forEach((i, idx) => {
          const { sh } = legendHotels[i];
          const entry = layout.entries[i];
          const eh = entry.height;
          const textH = (entry.nameLines.length + entry.detailLines.length) * lineHeight;

          // Tall rounded-rectangle badge spanning full entry height
          pdf.setFillColor(18, 92, 96);
          pdf.roundedRect(colStartX, y, badgeW, eh, 3, 3, 'F');

          // Number centered in badge
          pdf.setTextColor(255, 255, 255);
          pdf.setFont('SharpSans', 'bold');
          pdf.setFontSize(fontSize);
          const numStr = sh.number.toString();
          const numW = pdf.getTextWidth(numStr);
          pdf.text(numStr, colStartX + badgeW / 2 - numW / 2, y + eh / 2 + fontSize * 0.35);

          // Text block vertically centered in the entry
          const textStartY = y + (eh - textH) / 2 + lineHeight * 0.8;
          pdf.setFont('SharpSans', 'normal');
          pdf.setFontSize(fontSize);

          // Hotel name – near-black
          pdf.setTextColor(35, 31, 32);
          entry.nameLines.forEach((line, li) => {
            pdf.text(line, textX, textStartY + li * lineHeight);
          });

          // Address – mid teal; distance from ACC – dark teal
          entry.detailLines.forEach((segments, li) => {
            let x = textX;
            const lineY = textStartY + (entry.nameLines.length + li) * lineHeight;
            segments.forEach((seg) => {
              if (seg.color === 'address') pdf.setTextColor(67, 163, 163);
              else pdf.setTextColor(18, 92, 96);
              pdf.text(seg.text, x, lineY);
              x += pdf.getTextWidth(seg.text);
            });
          });

          y += eh + entryGap;

          // Light grey separator after each entry except the last in the column
          if (idx < entryIdx.length - 1) {
            const sepY = y - entryGap / 2;
            pdf.setDrawColor(210, 210, 210);
            pdf.setLineWidth(0.4);
            pdf.line(colStartX, sepY, colStartX + columnWidth, sepY);
          }
        });
        return y - entryGap;
      };

      const drawColumns = (pageCols: number[][], startY: number) => {
        let bottom = startY;
        pageCols.forEach((col, c) => {
          const colX = MARGIN_PT + c * (columnWidth + LEGEND_COLUMN_GAP);
          bottom = Math.max(bottom, drawColumn(col, colX, startY));
        });
        // Vertical separators between columns
        pdf.setDrawColor(210, 210, 210);
        pdf.setLineWidth(0.4);
        for (let c = 1; c < pageCols.length; c++) {
          const sepX = MARGIN_PT + c * (columnWidth + LEGEND_COLUMN_GAP) - LEGEND_COLUMN_GAP / 2;
          pdf.line(sepX, startY, sepX, bottom);
        }
      };

      // ── Page 1 header ────────────────────────────────────────────────────────
      const listX = MARGIN_PT;
      let currentY = MARGIN_PT;
      pdf.addImage(logoImg, 'PNG', listX, currentY, logoWidth, logoHeight);
      currentY += logoHeight + 12;

      pdf.setFont('SharpSans', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(67, 163, 163);
      pdf.text('PARTNER HOTELS', listX, currentY + 10);
      currentY += 22;

      drawColumns(layout.pages[0] ?? [], currentY);

      // ── Draw map (page 1, right of legend, vertically centered) ─────────────
      const mapAreaWidth = contentWidth - layout.legendWidth - gapWidth;
      const mapX = MARGIN_PT + layout.legendWidth + gapWidth + (mapAreaWidth - layout.mapWidth) / 2;
      const mapY = MARGIN_PT + (contentHeight - layout.mapHeight) / 2;
      const finalMapWidth = layout.mapWidth;
      const finalMapHeight = layout.mapHeight;

      pdf.addImage(mapImage.src, 'JPEG', mapX, mapY, finalMapWidth, finalMapHeight, undefined, 'FAST');

      // ── Redraw markers (scaled down slightly for large selections) ──────────
      const markerRadius = sortedHotels.length > 40 ? 6.5 : 8;
      const markerFontSize = sortedHotels.length > 40 ? 6.5 : 8;
      sortedHotels.forEach((sh) => {
        if (!sh.position) return;
        const pdfMarkerX = mapX + (sh.position.x / 100) * finalMapWidth;
        const pdfMarkerY = mapY + (sh.position.y / 100) * finalMapHeight;

        pdf.setFillColor(18, 92, 96);
        pdf.setDrawColor(255, 255, 255);
        pdf.setLineWidth(1.5);
        pdf.circle(pdfMarkerX, pdfMarkerY, markerRadius, 'FD');

        pdf.setTextColor(255, 255, 255);
        pdf.setFont('SharpSans', 'bold');
        pdf.setFontSize(markerFontSize);
        const numStr = sh.number.toString();
        const numWidth = pdf.getTextWidth(numStr);
        pdf.text(numStr, pdfMarkerX - numWidth / 2, pdfMarkerY + markerFontSize * 0.36);
      });

      // ── Overflow pages (only when the selection can't fit on one page) ─────
      layout.pages.slice(1).forEach((pageCols) => {
        pdf.addPage('letter', 'landscape');
        pdf.setFont('SharpSans', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(67, 163, 163);
        pdf.text('PARTNER HOTELS (CONTINUED)', MARGIN_PT, MARGIN_PT + 10);
        drawColumns(pageCols, MARGIN_PT + continuedHeaderHeight);
      });

      const date = new Date().toISOString().split('T')[0];
      pdf.save(`Anaheim-Hotel-Map-${date}.pdf`);
      toast.success('PDF exported successfully!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      onClick={generatePDF}
      disabled={isExporting || selectedHotels.length === 0}
      className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold shadow-soft"
      size={compact ? 'icon' : 'lg'}
      aria-label={compact ? 'Export PDF' : undefined}
    >
      {isExporting ? (
        <>
          <Loader2 className={compact ? 'h-4 w-4 animate-spin' : 'mr-2 h-4 w-4 animate-spin'} />
          {!compact && 'Exporting...'}
        </>
      ) : (
        <>
          <Download className={compact ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />
          {!compact && 'Export PDF'}
        </>
      )}
    </Button>
  );
}
