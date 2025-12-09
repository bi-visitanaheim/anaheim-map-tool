import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
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
      // Create PDF in landscape mode with point units
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'letter',
      });

      // Content area
      const contentWidth = PAGE_WIDTH_PT - (MARGIN_PT * 2);
      const contentHeight = PAGE_HEIGHT_PT - (MARGIN_PT * 2);

      // Layout proportions: hotel list 22%, gap 3%, map 60%, gap 3%, logo 12%
      const hotelListWidth = contentWidth * 0.22;
      const gapWidth = contentWidth * 0.03;
      const logoWidth = contentWidth * 0.12;
      const mapWidth = contentWidth - hotelListWidth - logoWidth - (gapWidth * 2);

      // Get and capture the map
      const mapContainer = document.getElementById('map-container');
      if (!mapContainer) {
        throw new Error('Map container not found');
      }

      const mapCanvas = await html2canvas(mapContainer, {
        scale: 4,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#F5E6DB',
        logging: false,
      });

      // Sort hotels by number
      const sortedHotels = [...selectedHotels].sort((a, b) => a.number - b.number);

      // === DRAW HOTEL LIST ===
      const listX = MARGIN_PT;
      const listY = MARGIN_PT;

      // Title
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(26, 58, 74);
      pdf.text('PARTNER HOTELS', listX, listY + 16);

      // Hotel entries
      let yPos = listY + 40;
      const circleRadius = 10;
      const lineHeight = 28;

      sortedHotels.forEach((sh) => {
        const hotel = hotels.find(h => h.id === sh.hotelId);
        if (!hotel) return;

        // Orange circle
        pdf.setFillColor(224, 122, 59);
        pdf.circle(listX + circleRadius, yPos, circleRadius, 'F');

        // Number in white
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        const numStr = sh.number.toString();
        const numWidth = pdf.getTextWidth(numStr);
        pdf.text(numStr, listX + circleRadius - numWidth / 2, yPos + 4);

        // Hotel name
        pdf.setTextColor(26, 58, 74);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);

        let hotelName = hotel.name;
        const maxWidth = hotelListWidth - circleRadius * 2 - 15;
        while (pdf.getTextWidth(hotelName) > maxWidth && hotelName.length > 10) {
          hotelName = hotelName.slice(0, -1);
        }
        if (hotelName !== hotel.name) hotelName += '...';

        pdf.text(hotelName, listX + circleRadius * 2 + 8, yPos + 4);
        yPos += lineHeight;
      });

      // === DRAW MAP ===
      const mapX = MARGIN_PT + hotelListWidth + gapWidth;
      const mapY = MARGIN_PT;

      // Scale map to fill available height while maintaining aspect ratio
      const mapAspect = mapCanvas.width / mapCanvas.height;
      let finalMapHeight = contentHeight;
      let finalMapWidth = finalMapHeight * mapAspect;

      // If wider than available space, scale by width instead
      if (finalMapWidth > mapWidth) {
        finalMapWidth = mapWidth;
        finalMapHeight = finalMapWidth / mapAspect;
      }

      // Center map vertically if it doesn't fill height
      const mapYOffset = (contentHeight - finalMapHeight) / 2;

      pdf.addImage(
        mapCanvas.toDataURL('image/png', 1.0),
        'PNG',
        mapX,
        mapY + mapYOffset,
        finalMapWidth,
        finalMapHeight,
        undefined,
        'FAST'
      );

      // === DRAW LOGO ===
      const logoX = mapX + finalMapWidth + gapWidth;
      const logoY = MARGIN_PT + 10;

      // "visit" in orange italic
      pdf.setTextColor(224, 122, 59);
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(14);
      pdf.text('visit', logoX, logoY);

      // "Anaheim" in teal bold
      pdf.setTextColor(26, 58, 74);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.text('Anaheim', logoX, logoY + 20);

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
