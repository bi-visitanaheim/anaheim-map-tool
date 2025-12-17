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
const MARGIN_PT = 24; // Smaller margins for more space

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
      
      // Hotel list gets wider width to accommodate full hotel names
      const hotelListWidth = 240;
      const gapWidth = 12;
      const availableMapWidth = contentWidth - hotelListWidth - gapWidth;
      const availableMapHeight = contentHeight;
      
      // Get the map container and image
      const mapContainer = document.getElementById('map-container');
      if (!mapContainer) {
        throw new Error('Map container not found');
      }

      const mapImage = mapContainer.querySelector('img') as HTMLImageElement;
      if (!mapImage) {
        throw new Error('Map image not found');
      }

      // Get container and image dimensions
      const containerWidth = mapContainer.offsetWidth;
      const containerHeight = mapContainer.offsetHeight;
      const imageNaturalWidth = mapImage.naturalWidth;
      const imageNaturalHeight = mapImage.naturalHeight;
      const imageAspect = imageNaturalWidth / imageNaturalHeight;

      // Calculate where the image actually displays within the container (due to object-contain)
      const containerAspect = containerWidth / containerHeight;
      let displayedImageWidth: number;
      let displayedImageHeight: number;
      let imageOffsetX: number;
      let imageOffsetY: number;

      if (imageAspect > containerAspect) {
        // Image is wider - fits to container width, has vertical letterboxing
        displayedImageWidth = containerWidth;
        displayedImageHeight = containerWidth / imageAspect;
        imageOffsetX = 0;
        imageOffsetY = (containerHeight - displayedImageHeight) / 2;
      } else {
        // Image is taller - fits to container height, has horizontal letterboxing
        displayedImageHeight = containerHeight;
        displayedImageWidth = containerHeight * imageAspect;
        imageOffsetX = (containerWidth - displayedImageWidth) / 2;
        imageOffsetY = 0;
      }

      // Sort hotels by number
      const sortedHotels = [...selectedHotels].sort((a, b) => a.number - b.number);
      
      // Calculate PDF map dimensions maintaining the IMAGE's aspect ratio
      const pdfMapAspect = availableMapWidth / availableMapHeight;
      let finalMapWidth: number;
      let finalMapHeight: number;
      let mapOffsetX = 0;
      let mapOffsetY = 0;
      
      if (imageAspect > pdfMapAspect) {
        // Image is wider than available space - fit to width
        finalMapWidth = availableMapWidth;
        finalMapHeight = availableMapWidth / imageAspect;
        mapOffsetY = (availableMapHeight - finalMapHeight) / 2;
      } else {
        // Image is taller than available space - fit to height
        finalMapHeight = availableMapHeight;
        finalMapWidth = availableMapHeight * imageAspect;
        mapOffsetX = (availableMapWidth - finalMapWidth) / 2;
      }
      
      const finalListWidth = hotelListWidth;

      // === DRAW HOTEL LIST ===
      const listX = MARGIN_PT;
      let currentY = MARGIN_PT;

      // Partner Hotels title
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(137, 204, 226); // Light blue #89cce2
      pdf.text('PARTNER HOTELS', listX, currentY + 10);

      currentY += 22;

      // Calculate dynamic sizing based on hotel count
      const availableHeight = PAGE_HEIGHT_PT - MARGIN_PT - currentY - 10;
      const hotelCount = sortedHotels.length;
      
      // Calculate line height to fit all hotels
      const maxLineHeight = 26;
      const minLineHeight = 16;
      let lineHeight = Math.min(maxLineHeight, Math.max(minLineHeight, availableHeight / hotelCount));
      
      // Calculate font size based on line height
      const fontSize = Math.min(9, Math.max(6.5, lineHeight * 0.4));
      const circleRadius = Math.min(7, Math.max(5, lineHeight * 0.28));

      // Hotel entries
      sortedHotels.forEach((sh) => {
        const hotel = hotels.find(h => h.id === sh.hotelId);
        if (!hotel) return;

        // Dark blue circle #004183
        pdf.setFillColor(0, 65, 131);
        pdf.circle(listX + circleRadius, currentY + circleRadius, circleRadius, 'F');

        // Number in white
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(fontSize);
        const numStr = sh.number.toString();
        const numWidth = pdf.getTextWidth(numStr);
        pdf.text(numStr, listX + circleRadius - numWidth / 2, currentY + circleRadius + fontSize * 0.35);

        // Hotel name
        pdf.setTextColor(26, 58, 74);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(fontSize);

        let hotelName = hotel.name;
        const maxNameWidth = finalListWidth - circleRadius * 2 - 8;
        
        while (pdf.getTextWidth(hotelName) > maxNameWidth && hotelName.length > 10) {
          hotelName = hotelName.slice(0, -1);
        }
        if (hotelName !== hotel.name) hotelName += '…';

        pdf.text(hotelName, listX + circleRadius * 2 + 6, currentY + circleRadius + fontSize * 0.35);
        currentY += lineHeight;
      });

      // === DRAW MAP ===
      // Position includes offset to center the map if aspect ratio differs
      const mapX = MARGIN_PT + finalListWidth + gapWidth + mapOffsetX;
      const mapY = MARGIN_PT + mapOffsetY;

      // Draw the actual image directly (not the container) to preserve exact aspect ratio
      pdf.addImage(
        mapImage.src,
        'JPEG',
        mapX,
        mapY,
        finalMapWidth,
        finalMapHeight,
        undefined,
        'FAST'
      );

      // === REDRAW MARKERS ON PDF ===
      // Markers are stored as % of CONTAINER, but we need % of IMAGE
      // Convert from container coordinates to image coordinates
      const markerRadius = 8;
      
      sortedHotels.forEach((sh) => {
        if (!sh.position) return;
        
        // Convert container percentage to pixel position in container
        const containerPixelX = (sh.position.x / 100) * containerWidth;
        const containerPixelY = (sh.position.y / 100) * containerHeight;
        
        // Convert container pixel position to image percentage
        // by subtracting the image offset and dividing by displayed image size
        const imagePercentX = ((containerPixelX - imageOffsetX) / displayedImageWidth) * 100;
        const imagePercentY = ((containerPixelY - imageOffsetY) / displayedImageHeight) * 100;
        
        // Apply image percentage to PDF map dimensions
        const pdfMarkerX = mapX + (imagePercentX / 100) * finalMapWidth;
        const pdfMarkerY = mapY + (imagePercentY / 100) * finalMapHeight;
        
        // Draw dark blue circle with white border #004183
        pdf.setFillColor(0, 65, 131);
        pdf.setDrawColor(255, 255, 255);
        pdf.setLineWidth(1.5);
        pdf.circle(pdfMarkerX, pdfMarkerY, markerRadius, 'FD');
        
        // Draw number in white
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        const numStr = sh.number.toString();
        const numWidth = pdf.getTextWidth(numStr);
        pdf.text(numStr, pdfMarkerX - numWidth / 2, pdfMarkerY + 3);
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
