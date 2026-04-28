import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { SelectedHotel } from '@/hooks/useMarkerPositions';
import { hotels } from '@/data/hotels';

interface ExportButtonProps {
  selectedHotels: SelectedHotel[];
}

// US Letter landscape: 11 x 8.5 inches = 792 x 612 points at 72 DPI
const PAGE_WIDTH_PT = 792;
const PAGE_HEIGHT_PT = 612;
const MARGIN_PT = 24;

export function ExportButton({ selectedHotels }: ExportButtonProps) {
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

      const contentWidth = PAGE_WIDTH_PT - MARGIN_PT * 2;
      const contentHeight = PAGE_HEIGHT_PT - MARGIN_PT * 2;

      const sortedHotels = [...selectedHotels].sort((a, b) => a.number - b.number);
      const useTwoColumns = sortedHotels.length > 10;

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

      const titleFontSize = 14;
      const logoGap = 14;
      const headerHeight = logoHeight + 12 + 22;

      // ── Legend area width ───────────────────────────────────────────────────
      const legendAreaWidth = useTwoColumns ? 340 : 320;
      const gapWidth = 12;

      // ── Map geometry ─────────────────────────────────────────────────────────
      const availableMapWidth = contentWidth - legendAreaWidth - gapWidth;
      const availableMapHeight = contentHeight;

      const mapContainer = document.getElementById('map-container');
      if (!mapContainer) throw new Error('Map container not found');
      const mapImage = mapContainer.querySelector('img') as HTMLImageElement;
      if (!mapImage) throw new Error('Map image not found');

      const imageAspect = mapImage.naturalWidth / mapImage.naturalHeight;
      const pdfMapAspect = availableMapWidth / availableMapHeight;
      let finalMapWidth: number;
      let finalMapHeight: number;
      let mapOffsetX = 0;
      let mapOffsetY = 0;

      if (imageAspect > pdfMapAspect) {
        finalMapWidth = availableMapWidth;
        finalMapHeight = availableMapWidth / imageAspect;
        mapOffsetY = (availableMapHeight - finalMapHeight) / 2;
      } else {
        finalMapHeight = availableMapHeight;
        finalMapWidth = availableMapHeight * imageAspect;
        mapOffsetX = (availableMapWidth - finalMapWidth) / 2;
      }

      // ── Cap legend height to map bottom ─────────────────────────────────────
      const legendMaxBottom = MARGIN_PT + mapOffsetY + finalMapHeight;
      const listStartY = MARGIN_PT + headerHeight;
      const maxColumnHeight = legendMaxBottom - listStartY - 4;

      // ── Sizing constants ───────────────────────────────────────────────────────
      const badgeW = 16;
      const badgeToTextGap = 6;
      const colGap = 14;
      const entryPadding = 3;

      const singleColTextWidth = legendAreaWidth - badgeW - badgeToTextGap;
      const twoColEachWidth = (legendAreaWidth - colGap) / 2;
      const twoColTextWidth = twoColEachWidth - badgeW - badgeToTextGap;

      // ── Auto-scale font to fit all hotels in available column height ─────────
      const colHotels1 = useTwoColumns ? sortedHotels.slice(0, 10) : sortedHotels;
      const colHotels2 = useTwoColumns ? sortedHotels.slice(10) : [];

      const measureColumnHeight = (colHotels: SelectedHotel[], maxTextW: number, fs: number) => {
        const lh = fs * 1.3;
        let total = 0;
        for (const sh of colHotels) {
          const hotel = hotels.find((h) => h.id === sh.hotelId);
          if (!hotel) continue;
          pdf.setFontSize(fs);
          const nameLines: string[] = pdf.splitTextToSize(hotel.name, maxTextW);
          const addrLines: string[] = pdf.splitTextToSize(hotel.address, maxTextW);
          const distLines: string[] = pdf.splitTextToSize(`${hotel.distanceFromACC} mi from ACC`, maxTextW);
          const totalLines = nameLines.length + addrLines.length + distLines.length;
          const textH = totalLines * lh;
          const eh = Math.max(badgeW, textH);
          total += eh + entryPadding;
        }
        return total;
      };

      let fontSize = 10;
      const minFontSize = 6;
      while (fontSize > minFontSize) {
        const textW = useTwoColumns ? twoColTextWidth : singleColTextWidth;
        const h1 = measureColumnHeight(colHotels1, textW, fontSize);
        const h2 = useTwoColumns ? measureColumnHeight(colHotels2, twoColTextWidth, fontSize) : 0;
        const tallest = Math.max(h1, h2);
        if (tallest <= maxColumnHeight) break;
        fontSize -= 0.5;
      }
      const lineHeight = fontSize * 1.3;

      // ── Draw header ──────────────────────────────────────────────────────────
      const listX = MARGIN_PT;
      let currentY = MARGIN_PT;

      pdf.addImage(logoImg, 'PNG', listX, currentY, logoWidth, logoHeight);

      const titleX = listX + logoWidth + logoGap;
      const titleY = currentY + logoHeight / 2 + titleFontSize * 0.35;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(titleFontSize);
      pdf.setTextColor(0, 65, 131);
      pdf.text('Visit Anaheim Hotel Itinerary', titleX, titleY);

      currentY += logoHeight + 12;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(137, 204, 226);
      pdf.text('PARTNER HOTELS', listX, currentY + 10);
      currentY += 22;

      // ── Draw one column with per-entry separators ───────────────────────────
      const drawColumn = (
        columnHotels: SelectedHotel[],
        colStartX: number,
        startY: number,
        maxTextW: number,
        colWidth: number
      ) => {
        let y = startY;
        const textX = colStartX + badgeW + badgeToTextGap;

        // Pre-filter to only hotels that will actually fit, so we know the last one
        const visibleHotels: SelectedHotel[] = [];
        let testY = startY;
        for (const sh of columnHotels) {
          const hotel = hotels.find((h) => h.id === sh.hotelId);
          if (!hotel) continue;
          pdf.setFontSize(fontSize);
          const nameLines: string[] = pdf.splitTextToSize(hotel.name, maxTextW);
          const addrLines: string[] = pdf.splitTextToSize(hotel.address, maxTextW);
          const distLines: string[] = pdf.splitTextToSize(`${hotel.distanceFromACC} mi from ACC`, maxTextW);
          const totalLines = nameLines.length + addrLines.length + distLines.length;
          const textH = totalLines * lineHeight;
          const eh = Math.max(badgeW, textH);
          if (testY + eh > startY + maxColumnHeight) break;
          visibleHotels.push(sh);
          testY += eh + entryPadding;
        }

        visibleHotels.forEach((sh, idx) => {
          const hotel = hotels.find((h) => h.id === sh.hotelId)!;

          pdf.setFontSize(fontSize);
          pdf.setFont('helvetica', 'normal');
          const nameLines: string[] = pdf.splitTextToSize(hotel.name, maxTextW);
          const addrLines: string[] = pdf.splitTextToSize(hotel.address, maxTextW);
          const distLines: string[] = pdf.splitTextToSize(`${hotel.distanceFromACC} mi from ACC`, maxTextW);
          const totalLines = nameLines.length + addrLines.length + distLines.length;
          const textH = totalLines * lineHeight;
          const eh = Math.max(badgeW, textH);

          // ── Tall rounded-rectangle badge spanning full entry height ──────────
          const badgeRadius = 3;
          pdf.setFillColor(0, 65, 131);
          pdf.roundedRect(colStartX, y, badgeW, eh, badgeRadius, badgeRadius, 'F');

          // Number centered in badge
          pdf.setTextColor(255, 255, 255);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(fontSize);
          const numStr = sh.number.toString();
          const numW = pdf.getTextWidth(numStr);
          pdf.text(numStr, colStartX + badgeW / 2 - numW / 2, y + eh / 2 + fontSize * 0.35);

          // Text block vertically centered in the same entry height
          const textStartY = y + (eh - textH) / 2 + lineHeight * 0.8;

          // Hotel name – dark navy
          pdf.setTextColor(26, 58, 74);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(fontSize);
          nameLines.forEach((line: string, i: number) => {
            pdf.text(line, textX, textStartY + i * lineHeight);
          });

          // Address – amber/gold
          pdf.setTextColor(250, 162, 27);
          addrLines.forEach((line: string, i: number) => {
            pdf.text(line, textX, textStartY + (nameLines.length + i) * lineHeight);
          });

          // Distance from ACC – blue
          pdf.setTextColor(33, 150, 243);
          distLines.forEach((line: string, i: number) => {
            pdf.text(
              line,
              textX,
              textStartY + (nameLines.length + addrLines.length + i) * lineHeight
            );
          });

          y += eh + entryPadding;

          // ── Light grey horizontal separator after each entry except the last ──
          if (idx < visibleHotels.length - 1) {
            const sepY = y - entryPadding / 2;
            pdf.setDrawColor(210, 210, 210);
            pdf.setLineWidth(0.4);
            pdf.line(colStartX, sepY, colStartX + colWidth, sepY);
          }
        });
      };

      if (useTwoColumns) {
        const col1X = listX;
        const col2X = listX + twoColEachWidth + colGap;
        drawColumn(colHotels1, col1X, currentY, twoColTextWidth, twoColEachWidth);
        drawColumn(colHotels2, col2X, currentY, twoColTextWidth, twoColEachWidth);

        // ── Vertical separator between the two columns ─────────────────────────
        const vertSepX = listX + twoColEachWidth + colGap / 2;
        pdf.setDrawColor(210, 210, 210);
        pdf.setLineWidth(0.4);
        pdf.line(vertSepX, currentY, vertSepX, legendMaxBottom);
      } else {
        drawColumn(colHotels1, listX, currentY, singleColTextWidth, legendAreaWidth);
      }

      // ── Draw map ──────────────────────────────────────────────────────────────
      const mapX = MARGIN_PT + legendAreaWidth + gapWidth + mapOffsetX;
      const mapY = MARGIN_PT + mapOffsetY;

      pdf.addImage(mapImage.src, 'JPEG', mapX, mapY, finalMapWidth, finalMapHeight, undefined, 'FAST');

      // ── Redraw markers ────────────────────────────────────────────────────────
      const markerRadius = 8;
      sortedHotels.forEach((sh) => {
        if (!sh.position) return;
        const pdfMarkerX = mapX + (sh.position.x / 100) * finalMapWidth;
        const pdfMarkerY = mapY + (sh.position.y / 100) * finalMapHeight;

        pdf.setFillColor(0, 65, 131);
        pdf.setDrawColor(255, 255, 255);
        pdf.setLineWidth(1.5);
        pdf.circle(pdfMarkerX, pdfMarkerY, markerRadius, 'FD');

        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        const numStr = sh.number.toString();
        const numWidth = pdf.getTextWidth(numStr);
        pdf.text(numStr, pdfMarkerX - numWidth / 2, pdfMarkerY + 3);
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
      size="lg"
    >
      {isExporting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="mr-2 h-4 w-4" />
          Export PDF
        </>
      )}
    </Button>
  );
}
