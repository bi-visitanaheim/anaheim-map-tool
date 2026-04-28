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

      // ── Column geometry ──────────────────────────────────────────────────────
      // Each "legend column" has: circle + gap + text
      const circleRadius = 7;
      const circleDiameter = circleRadius * 2;
      const circleToTextGap = 8;
      const colGap = 16; // gap between the two legend columns
      const fontSize = 10;
      const lineHeight = fontSize * 1.3;
      const entryPadding = 5;

      // Header block height (logo + title + spacing)
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
      const headerHeight = logoHeight + 12 + 22; // logo + spacing + title row

      const availableListHeight = contentHeight - headerHeight - 10;

      // ── Column width calculation ─────────────────────────────────────────────
      // When only one column → its width equals the full "legend area width" which
      // we'll fix at 260 pt so the map takes the remaining space (same as before).
      // When two columns → total legend area is still the same 260 pt but split.
      const legendAreaWidth = 260;
      const singleColTextWidth = legendAreaWidth - circleDiameter - circleToTextGap;
      const twoColEachWidth = (legendAreaWidth - colGap) / 2;
      const twoColTextWidth = twoColEachWidth - circleDiameter - circleToTextGap;

      // ── Helper: measure one entry's rendered height ──────────────────────────
      const entryHeight = (hotel: typeof hotels[number], maxTextW: number): number => {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', 'normal');
        const nameLines = pdf.splitTextToSize(hotel.name, maxTextW);
        const addrLines = pdf.splitTextToSize(hotel.address, maxTextW);
        const distLines = pdf.splitTextToSize(`${hotel.distanceFromACC} mi from ACC`, maxTextW);
        const textH = (nameLines.length + addrLines.length + distLines.length) * lineHeight;
        return Math.max(circleDiameter, textH) + entryPadding;
      };

      // ── Map geometry ─────────────────────────────────────────────────────────
      const gapWidth = 12;
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

      // ── Draw header (logo + title) ────────────────────────────────────────────
      const listX = MARGIN_PT;
      let currentY = MARGIN_PT;

      pdf.addImage(logoImg, 'PNG', listX, currentY, logoWidth, logoHeight);
      currentY += logoHeight + 12;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(137, 204, 226);
      pdf.text('PARTNER HOTELS', listX, currentY + 10);
      currentY += 22;

      // ── Split hotels into columns ─────────────────────────────────────────────
      const col1Hotels = useTwoColumns ? sortedHotels.slice(0, 10) : sortedHotels;
      const col2Hotels = useTwoColumns ? sortedHotels.slice(10) : [];

      // ── Draw one column of hotel entries ─────────────────────────────────────
      const drawColumn = (
        columnHotels: SelectedHotel[],
        colStartX: number,
        startY: number,
        maxTextW: number
      ) => {
        let y = startY;
        const textX = colStartX + circleDiameter + circleToTextGap;

        columnHotels.forEach((sh) => {
          const hotel = hotels.find((h) => h.id === sh.hotelId);
          if (!hotel) return;

          pdf.setFontSize(fontSize);
          pdf.setFont('helvetica', 'normal');
          const nameLines: string[] = pdf.splitTextToSize(hotel.name, maxTextW);
          const addrLines: string[] = pdf.splitTextToSize(hotel.address, maxTextW);
          const distLines: string[] = pdf.splitTextToSize(
            `${hotel.distanceFromACC} mi from ACC`,
            maxTextW
          );
          const totalLines = nameLines.length + addrLines.length + distLines.length;
          const textH = totalLines * lineHeight;
          const eh = Math.max(circleDiameter, textH);

          // Circle – vertically centred with the text block
          const circleY = y + eh / 2;
          pdf.setFillColor(0, 65, 131);
          pdf.circle(colStartX + circleRadius, circleY, circleRadius, 'F');

          // Number inside circle – same font size as body text
          pdf.setTextColor(255, 255, 255);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(fontSize);
          const numStr = sh.number.toString();
          const numW = pdf.getTextWidth(numStr);
          pdf.text(numStr, colStartX + circleRadius - numW / 2, circleY + fontSize * 0.35);

          // Text – vertically centred
          const textStartY = y + (eh - textH) / 2 + lineHeight * 0.8;

          pdf.setTextColor(26, 58, 74);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(fontSize);
          nameLines.forEach((line: string, i: number) => {
            pdf.text(line, textX, textStartY + i * lineHeight);
          });

          pdf.setTextColor(250, 162, 27);
          addrLines.forEach((line: string, i: number) => {
            pdf.text(line, textX, textStartY + (nameLines.length + i) * lineHeight);
          });

          pdf.setTextColor(120, 120, 120);
          distLines.forEach((line: string, i: number) => {
            pdf.text(
              line,
              textX,
              textStartY + (nameLines.length + addrLines.length + i) * lineHeight
            );
          });

          y += eh + entryPadding;
        });
      };

      if (useTwoColumns) {
        const col1X = listX;
        const col2X = listX + twoColEachWidth + colGap;
        drawColumn(col1Hotels, col1X, currentY, twoColTextWidth);
        drawColumn(col2Hotels, col2X, currentY, twoColTextWidth);
      } else {
        drawColumn(col1Hotels, listX, currentY, singleColTextWidth);
      }

      // ── Draw map ─────────────────────────────────────────────────────────────
      const mapX = MARGIN_PT + legendAreaWidth + gapWidth + mapOffsetX;
      const mapY = MARGIN_PT + mapOffsetY;

      pdf.addImage(mapImage.src, 'JPEG', mapX, mapY, finalMapWidth, finalMapHeight, undefined, 'FAST');

      // ── Redraw markers on map ─────────────────────────────────────────────────
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
