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
      // Load the company logo
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => reject(new Error('Failed to load logo'));
        logoImg.src = '/images/wog.png';
      });

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

      // Get image aspect ratio for PDF layout
      const imageAspect = mapImage.naturalWidth / mapImage.naturalHeight;

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

      // === DRAW COMPANY LOGO ===
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
      
      pdf.addImage(
        logoImg,
        'PNG',
        listX,
        currentY,
        logoWidth,
        logoHeight
      );
      
      currentY += logoHeight + 12; // Add spacing after logo

      // Partner Hotels title
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(137, 204, 226); // Light blue #89cce2
      pdf.text('PARTNER HOTELS', listX, currentY + 10);

      currentY += 22;

      // Calculate dynamic sizing based on hotel count with text wrapping
      const availableHeight = PAGE_HEIGHT_PT - MARGIN_PT - currentY - 10;
      const hotelCount = sortedHotels.length;
      
      // Start with a base font size and adjust if needed
      let fontSize = 8;
      const textLineHeight = fontSize * 1.3; // Line height for wrapped text
      const circleRadius = 6;
      const textX = listX + circleRadius * 2 + 8;
      const maxNameWidth = finalListWidth - circleRadius * 2 - 12;
      const entryPadding = 4; // Padding between entries
      
      // Calculate total height needed with text wrapping (name and address on separate lines)
      const calculateTotalHeight = (fSize: number): number => {
        pdf.setFontSize(fSize);
        pdf.setFont('helvetica', 'normal');
        let total = 0;
        const tLineHeight = fSize * 1.3;
        sortedHotels.forEach((sh) => {
          const hotel = hotels.find(h => h.id === sh.hotelId);
          if (!hotel) return;
          // Calculate height for name and address separately
          const nameLines = pdf.splitTextToSize(hotel.name, maxNameWidth);
          const addressLines = pdf.splitTextToSize(hotel.address, maxNameWidth);
          const textHeight = (nameLines.length + addressLines.length) * tLineHeight;
          const entryHeight = Math.max(circleRadius * 2, textHeight) + entryPadding;
          total += entryHeight;
        });
        return total;
      };
      
      // Adjust font size if content doesn't fit
      let totalHeight = calculateTotalHeight(fontSize);
      while (totalHeight > availableHeight && fontSize > 5.5) {
        fontSize -= 0.5;
        totalHeight = calculateTotalHeight(fontSize);
      }
      
      const actualTextLineHeight = fontSize * 1.3;

      // Hotel entries with name and address on separate lines
      sortedHotels.forEach((sh) => {
        const hotel = hotels.find(h => h.id === sh.hotelId);
        if (!hotel) return;

        // Get wrapped lines for name and address separately
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(fontSize);
        const nameLines: string[] = pdf.splitTextToSize(hotel.name, maxNameWidth);
        const addressLines: string[] = pdf.splitTextToSize(hotel.address, maxNameWidth);
        const totalLines = nameLines.length + addressLines.length;
        const textHeight = totalLines * actualTextLineHeight;
        const entryHeight = Math.max(circleRadius * 2, textHeight);

        // Dark blue circle #004183 - vertically centered with text block
        const circleY = currentY + entryHeight / 2;
        pdf.setFillColor(0, 65, 131);
        pdf.circle(listX + circleRadius, circleY, circleRadius, 'F');

        // Number in white - centered in circle
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(fontSize);
        const numStr = sh.number.toString();
        const numWidth = pdf.getTextWidth(numStr);
        pdf.text(numStr, listX + circleRadius - numWidth / 2, circleY + fontSize * 0.35);

        // Calculate starting Y to vertically center text with the entry
        const textStartY = currentY + (entryHeight - textHeight) / 2 + actualTextLineHeight * 0.8;
        
        // Draw hotel name lines (dark color)
        pdf.setTextColor(26, 58, 74);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(fontSize);
        nameLines.forEach((line: string, lineIndex: number) => {
          const lineY = textStartY + lineIndex * actualTextLineHeight;
          pdf.text(line, textX, lineY);
        });
        
        // Draw address lines (orange color) on the next line(s)
        pdf.setTextColor(250, 162, 27); // #faa21b for address
        addressLines.forEach((line: string, lineIndex: number) => {
          const lineY = textStartY + (nameLines.length + lineIndex) * actualTextLineHeight;
          pdf.text(line, textX, lineY);
        });

        currentY += entryHeight + entryPadding;
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
      // Markers are now stored as % of IMAGE directly, so we can apply them straight to the PDF
      const markerRadius = 8;
      
      sortedHotels.forEach((sh) => {
        if (!sh.position) return;
        
        // Position is already stored as image percentage (0-100)
        // Apply directly to PDF map dimensions
        const pdfMarkerX = mapX + (sh.position.x / 100) * finalMapWidth;
        const pdfMarkerY = mapY + (sh.position.y / 100) * finalMapHeight;
        
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
