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

export function ExportButton({ selectedHotels }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const generatePDF = async () => {
    if (selectedHotels.length === 0) {
      toast.error('Please select at least one hotel to export');
      return;
    }

    setIsExporting(true);
    toast.info('Generating high-quality PDF...');

    try {
      // Create a hidden container for PDF rendering
      const pdfContainer = document.createElement('div');
      pdfContainer.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 1100px;
        background: white;
        font-family: 'Open Sans', sans-serif;
      `;
      document.body.appendChild(pdfContainer);

      // Build the hotel list sorted by number
      const sortedHotels = [...selectedHotels].sort((a, b) => a.number - b.number);
      const hotelListHTML = sortedHotels.map((sh) => {
        const hotel = hotels.find(h => h.id === sh.hotelId);
        if (!hotel) return '';
        return `
          <div style="display: flex; align-items: flex-start; margin-bottom: 8px; font-size: 11px;">
            <div style="
              width: 22px;
              height: 22px;
              min-width: 22px;
              background: #E07A3B;
              color: white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 700;
              font-size: 10px;
              margin-right: 8px;
              border: 2px solid white;
              box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            ">${sh.number}</div>
            <div style="flex: 1; line-height: 1.3;">
              <div style="font-weight: 600; color: #1a3a4a;">${hotel.name}</div>
            </div>
          </div>
        `;
      }).join('');

      // Get the map container
      const mapContainer = document.getElementById('map-container');
      if (!mapContainer) {
        throw new Error('Map container not found');
      }

      // Capture map at high resolution
      const mapCanvas = await html2canvas(mapContainer, {
        scale: 4,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#F5E6DB',
        logging: false,
      });

      const mapDataUrl = mapCanvas.toDataURL('image/png', 1.0);

      // Build the PDF layout
      pdfContainer.innerHTML = `
        <div style="display: flex; padding: 20px; gap: 20px;">
          <div style="width: 300px; flex-shrink: 0;">
            <h1 style="
              font-family: 'Montserrat', sans-serif;
              font-size: 18px;
              font-weight: 800;
              color: #1a3a4a;
              margin: 0 0 15px 0;
              text-transform: uppercase;
              letter-spacing: 1px;
            ">Partner Hotels</h1>
            <div style="max-height: 700px; overflow: hidden;">
              ${hotelListHTML}
            </div>
          </div>
          <div style="flex: 1;">
            <img src="${mapDataUrl}" style="width: 100%; height: auto; border-radius: 8px;" />
          </div>
        </div>
      `;

      // Wait for image to load
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture the full layout
      const fullCanvas = await html2canvas(pdfContainer, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'letter',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Calculate dimensions to fit on page
      const canvasAspect = fullCanvas.width / fullCanvas.height;
      const pageAspect = pageWidth / pageHeight;

      let imgWidth, imgHeight;
      if (canvasAspect > pageAspect) {
        imgWidth = pageWidth - 10;
        imgHeight = imgWidth / canvasAspect;
      } else {
        imgHeight = pageHeight - 10;
        imgWidth = imgHeight * canvasAspect;
      }

      const xOffset = (pageWidth - imgWidth) / 2;
      const yOffset = (pageHeight - imgHeight) / 2;

      pdf.addImage(
        fullCanvas.toDataURL('image/png', 1.0),
        'PNG',
        xOffset,
        yOffset,
        imgWidth,
        imgHeight,
        undefined,
        'FAST'
      );

      // Clean up
      document.body.removeChild(pdfContainer);

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
