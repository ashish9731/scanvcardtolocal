import { useState } from "react";
import { ImageCapture } from "@/components/ImageCapture";
import { CardDataTable } from "@/components/CardDataTable";
import { ThemeToggle } from "@/components/theme-toggle";
import { processImage, type CardData } from "@/utils/ocrProcessor";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard } from "lucide-react";

const Index = () => {
  const [cards, setCards] = useState<CardData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingQueue, setProcessingQueue] = useState<number>(0);
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [showApp, setShowApp] = useState(false);
  const { toast } = useToast();

  const handleImageCapture = async (imageData: string) => {
    // Increment the processing queue
    setProcessingQueue(prev => prev + 1);
    
    // Show a toast indicating we're starting to process
    if (processingQueue === 0) {
      setIsProcessing(true);
      toast({
        title: "Processing images...",
        description: "Extracting information from business cards",
      });
    }

    try {
      const cardData = await processImage(imageData);
      setCards((prev) => [...prev, cardData]);
      
      // Show success toast for each card processed
      toast({
        title: "Success!",
        description: "Business card data extracted successfully",
      });
    } catch (error) {
      console.error("OCR processing error:", error);
      toast({
        title: "Processing failed",
        description: "Failed to extract data from an image. Please try again.",
        variant: "destructive",
      });
    } finally {
      // Decrement the processing queue
      setProcessingQueue(prev => {
        const newCount = prev - 1;
        if (newCount <= 0) {
          setIsProcessing(false);
          toast({
            title: "Batch processing complete!",
            description: `Successfully processed ${cards.length + 1} business card(s)`,
          });
        }
        return Math.max(0, newCount);
      });
    }
  };

  const handleUpdateCard = (id: string, updates: Partial<CardData>) => {
    setCards((prev) =>
      prev.map((card) => (card.id === id ? { ...card, ...updates } : card))
    );
  };

  const handleDeleteCard = (id: string) => {
    setCards((prev) => prev.filter((card) => card.id !== id));
    toast({
      title: "Deleted",
      description: "Card data has been removed",
    });
  };



  return (
    <div className="min-h-screen bg-background">
      {!showApp ? (
        // Hero Section with CTA
        <div className="max-w-4xl mx-auto px-4 py-16 md:py-24 text-center">
          <div className="absolute top-4 right-4">
            <ThemeToggle />
          </div>
          <div className="space-y-8">
            <div className="inline-flex items-center justify-center p-4 rounded-full bg-primary/10 text-primary">
              <CreditCard className="h-16 w-16" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground">
              Business Card <span className="text-primary">Scanner</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Digitize business cards instantly with powerful OCR technology. Capture, extract, and manage contact information effortlessly.
            </p>
            
            <div className="pt-8">
              <button
                onClick={() => setShowApp(true)}
                className="px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-lg shadow-lg hover:bg-primary/90 transition-all transform hover:scale-105 text-lg"
              >
                Start Capturing Cards
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 max-w-4xl mx-auto">
              <div className="p-6 bg-card rounded-xl border border-border shadow-sm">
                <div className="text-2xl font-bold text-primary mb-2">01</div>
                <h3 className="text-xl font-semibold mb-2">Upload or Capture</h3>
                <p className="text-muted-foreground">Upload images or use your camera to capture business cards</p>
              </div>
              <div className="p-6 bg-card rounded-xl border border-border shadow-sm">
                <div className="text-2xl font-bold text-primary mb-2">02</div>
                <h3 className="text-xl font-semibold mb-2">Automatic Extraction</h3>
                <p className="text-muted-foreground">Our OCR technology extracts contact information</p>
              </div>
              <div className="p-6 bg-card rounded-xl border border-border shadow-sm">
                <div className="text-2xl font-bold text-primary mb-2">03</div>
                <h3 className="text-xl font-semibold mb-2">Export & Share</h3>
                <p className="text-muted-foreground">Export contacts to CSV or VCF format</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Application Interface
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h1 className="text-2xl font-bold text-foreground">Business Card Scanner</h1>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <button
                onClick={() => setShowApp(false)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
              >
                ← Back to Home
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Side - Capture Options */}
            <div className="py-4 lg:col-span-2">
              <div className="bg-gradient-to-br from-card to-muted rounded-2xl shadow-xl p-6 border border-border">
                <h2 className="text-2xl font-bold text-foreground mb-6">Capture Business Card</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Capture Section */}
                  <div className="lg:col-span-2">
                    <ImageCapture onImageCapture={handleImageCapture} />
                  </div>
                  
                  {/* Tips Section */}
                  <div className="bg-muted/50 rounded-xl p-4 border border-border">
                    <h3 className="text-lg font-semibold text-foreground mb-3">Capture Tips</h3>
                    <ul className="space-y-3 text-sm text-muted-foreground">
                      <li className="flex items-start">
                        <span className="text-primary mr-2">•</span>
                        <span>Ensure good lighting when capturing cards</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-primary mr-2">•</span>
                        <span>Position the card flat and straight</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-primary mr-2">•</span>
                        <span>Capture the entire card, including all edges</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-primary mr-2">•</span>
                        <span>Avoid glare or shadows on the card</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-primary mr-2">•</span>
                        <span>Use a contrasting background for better results</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-primary mr-2">•</span>
                        <span>Hold camera steady for clear images</span>
                      </li>
                    </ul>
                    
                    <div className="mt-4 pt-3 border-t border-border">
                      <h4 className="font-medium text-foreground mb-2">Best Practices</h4>
                      <p className="text-xs text-muted-foreground">
                        For optimal results, ensure text is clear and legible. The OCR works best with standard fonts and good contrast.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Scanned Cards Report Section */}
              <div className="bg-gradient-to-br from-card to-muted rounded-2xl shadow-xl p-6 border border-border mt-6">
                <h2 className="text-2xl font-bold text-foreground mb-6">Scanned Cards Report</h2>
                
                {isProcessing && (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center space-y-4">
                      <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                      <p className="text-lg text-muted-foreground">Processing your business card...</p>
                    </div>
                  </div>
                )}
                
                {!isProcessing && cards.length > 0 && (
                  <CardDataTable
                    cards={cards}
                    onUpdateCard={handleUpdateCard}
                    onDeleteCard={handleDeleteCard}
                  />
                )}
                
                {!isProcessing && cards.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground text-lg">No cards scanned yet. Upload or capture a business card to get started.</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Right Side - Empty Column */}
            <div className="py-4 lg:col-span-1">
              {/* Placeholder for future content or spacing */}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground">
          <p>© {new Date().getFullYear()} KenEdge Technologies. All rights reserved.</p>
          <p className="mt-1">
            <a 
              href="https://www.keenedgetech.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              www.keenedgetech.com
            </a>
          </p>
          <p className="mt-2 text-sm">Built with OCR technology • Scan, Extract, Export</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
