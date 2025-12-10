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
const MARGIN_PT = 36; // 0.5 inch margins

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
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'letter',
      });

      // Content area dimensions
      const contentWidth = PAGE_WIDTH_PT - (MARGIN_PT * 2);
      const contentHeight = PAGE_HEIGHT_PT - (MARGIN_PT * 2);

      // Layout: hotel list 30%, gap 2%, map fills rest (68%)
      const hotelListWidth = contentWidth * 0.30;
      const gapWidth = contentWidth * 0.02;
      const mapWidth = contentWidth - hotelListWidth - gapWidth;

      // Sort hotels by number
      const sortedHotels = [...selectedHotels].sort((a, b) => a.number - b.number);

      // === DRAW HOTEL LIST ===
      const listX = MARGIN_PT;
      const listY = MARGIN_PT;

      // Title
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(26, 58, 74);
      pdf.text('PARTNER HOTELS', listX, listY + 14);

      // Hotel entries
      let yPos = listY + 36;
      const circleRadius = 9;
      const lineHeight = 24;

      sortedHotels.forEach((sh) => {
        const hotel = hotels.find(h => h.id === sh.hotelId);
        if (!hotel) return;

        // Orange circle
        pdf.setFillColor(224, 122, 59);
        pdf.circle(listX + circleRadius, yPos, circleRadius, 'F');

        // Number in white
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        const numStr = sh.number.toString();
        const numWidth = pdf.getTextWidth(numStr);
        pdf.text(numStr, listX + circleRadius - numWidth / 2, yPos + 3.5);

        // Hotel name - with wider max width
        pdf.setTextColor(26, 58, 74);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);

        let hotelName = hotel.name;
        const maxWidth = hotelListWidth - circleRadius * 2 - 12;
        while (pdf.getTextWidth(hotelName) > maxWidth && hotelName.length > 10) {
          hotelName = hotelName.slice(0, -1);
        }
        if (hotelName !== hotel.name) hotelName += '...';

        pdf.text(hotelName, listX + circleRadius * 2 + 6, yPos + 3.5);
        yPos += lineHeight;
      });

      // === LOAD AND DRAW MAP IMAGE ===
      const mapX = MARGIN_PT + hotelListWidth + gapWidth;
      const mapY = MARGIN_PT;
      const mapHeight = contentHeight;

      // Load the map image directly (not through html2canvas)
      const mapImage = await loadImage('/images/map-template.jpg');
      
      // Draw the map stretched to fill the available space
      pdf.addImage(
        mapImage,
        'JPEG',
        mapX,
        mapY,
        mapWidth,
        mapHeight,
        undefined,
        'FAST'
      );

      // === DRAW MARKERS ON TOP OF MAP ===
      // Markers are positioned using percentage coordinates
      // We need to draw them at the correct position on the PDF map area
      const markerRadius = 12;

      sortedHotels.forEach((sh) => {
        if (!sh.position) return;

        // Convert percentage position to PDF coordinates
        // Position is stored as percentage (0-100) of the map container
        const markerX = mapX + (sh.position.x / 100) * mapWidth;
        const markerY = mapY + (sh.position.y / 100) * mapHeight;

        // Draw orange circle
        pdf.setFillColor(224, 122, 59);
        pdf.circle(markerX, markerY, markerRadius, 'F');

        // Draw white border
        pdf.setDrawColor(255, 255, 255);
        pdf.setLineWidth(2);
        pdf.circle(markerX, markerY, markerRadius, 'S');

        // Draw number in white
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        const numStr = sh.number.toString();
        const numWidth = pdf.getTextWidth(numStr);
        pdf.text(numStr, markerX - numWidth / 2, markerY + 4);
      });

      // Save
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

  // Helper function to load an image as base64
  const loadImage = (src: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 1.0));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });
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
