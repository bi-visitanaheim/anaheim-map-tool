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

// US Letter landscape dimensions in mm
const PAGE_WIDTH_MM = 279.4; // 11 inches
const PAGE_HEIGHT_MM = 215.9; // 8.5 inches
const MARGIN_MM = 15; // ~0.6 inch margins

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
      // Create PDF with US Letter landscape
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'letter',
      });

      // Calculate content area dimensions
      const contentWidth = PAGE_WIDTH_MM - (MARGIN_MM * 2);
      const contentHeight = PAGE_HEIGHT_MM - (MARGIN_MM * 2);
      
      // Layout: Hotel list takes ~25% width, map takes ~70%, logo area ~5%
      const hotelListWidth = contentWidth * 0.22;
      const mapWidth = contentWidth * 0.58;
      const logoWidth = contentWidth * 0.15;
      const gapWidth = contentWidth * 0.025;

      // Get the map container and capture it
      const mapContainer = document.getElementById('map-container');
      if (!mapContainer) {
        throw new Error('Map container not found');
      }

      // Capture map at high resolution
      const mapCanvas = await html2canvas(mapContainer, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#F5E6DB',
        logging: false,
      });

      // Build sorted hotel list
      const sortedHotels = [...selectedHotels].sort((a, b) => a.number - b.number);

      // Set fonts and styles
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(26, 58, 74); // Deep teal

      // Draw "PARTNER HOTELS" title
      const titleX = MARGIN_MM;
      const titleY = MARGIN_MM + 8;
      pdf.text('PARTNER HOTELS', titleX, titleY);

      // Draw hotel list
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      
      let yPos = titleY + 12;
      const circleRadius = 3.5;
      
      sortedHotels.forEach((sh) => {
        const hotel = hotels.find(h => h.id === sh.hotelId);
        if (!hotel) return;

        // Draw orange circle with number
        pdf.setFillColor(224, 122, 59); // Orange accent
        pdf.circle(titleX + circleRadius, yPos - 1.5, circleRadius, 'F');
        
        // Draw number in white
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        const numStr = sh.number.toString();
        const numWidth = pdf.getTextWidth(numStr);
        pdf.text(numStr, titleX + circleRadius - numWidth/2, yPos);
        
        // Draw hotel name
        pdf.setTextColor(26, 58, 74);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        
        // Truncate long names
        let hotelName = hotel.name;
        const maxNameWidth = hotelListWidth - 12;
        while (pdf.getTextWidth(hotelName) > maxNameWidth && hotelName.length > 10) {
          hotelName = hotelName.slice(0, -1);
        }
        if (hotelName !== hotel.name) {
          hotelName += '...';
        }
        
        pdf.text(hotelName, titleX + circleRadius * 2 + 4, yPos);
        
        yPos += 9;
      });

      // Calculate map position and size
      const mapX = MARGIN_MM + hotelListWidth + gapWidth;
      const mapY = MARGIN_MM;
      
      // Scale map to fit available height while maintaining aspect ratio
      const mapAspect = mapCanvas.width / mapCanvas.height;
      let finalMapWidth = mapWidth;
      let finalMapHeight = finalMapWidth / mapAspect;
      
      // If map is too tall, scale down by height
      if (finalMapHeight > contentHeight) {
        finalMapHeight = contentHeight;
        finalMapWidth = finalMapHeight * mapAspect;
      }

      // Add the map image
      pdf.addImage(
        mapCanvas.toDataURL('image/png', 1.0),
        'PNG',
        mapX,
        mapY,
        finalMapWidth,
        finalMapHeight,
        undefined,
        'FAST'
      );

      // Draw Visit Anaheim logo placeholder (text version)
      const logoX = mapX + finalMapWidth + gapWidth;
      const logoY = MARGIN_MM + 5;
      
      // Orange "visit" text
      pdf.setTextColor(224, 122, 59);
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(10);
      pdf.text('visit', logoX, logoY);
      
      // Teal "Anaheim" text
      pdf.setTextColor(26, 58, 74);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('Anaheim', logoX, logoY + 6);

      // Save PDF
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
