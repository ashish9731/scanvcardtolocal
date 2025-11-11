import { useState } from "react";
import { ImageCapture } from "@/components/ImageCapture";
import { CardDataTable } from "@/components/CardDataTable";
import { ThemeToggle } from "@/components/theme-toggle";
import { processImage, type CardData } from "@/utils/ocrProcessor";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const AppPage = () => {
  const [cards, setCards] = useState<CardData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingQueue, setProcessingQueue] = useState<number>(0);
  const { toast } = useToast();
  const { signOut } = useAuth();
  const navigate = useNavigate();

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

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-2xl font-bold text-foreground">Business Card Scanner</h1>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button onClick={handleLogout} variant="outline" size="sm">
            Logout
          </Button>
        </div>
      </div>
      
      <div className="mb-6">
        <div className="flex items-start">
          <span className="mr-2 mt-0.5">⚠️</span>
          <p className="text-sm">
            <strong>Disclaimer:</strong> This app can throw up any error, so please cross verify the details.
          </p>
        </div>
      </div>
      
      <div className="space-y-6">
        {/* Capture Business Card Section */}
        <div className="bg-card rounded-xl shadow-lg border border-border p-6">
          <h2 className="text-2xl font-bold text-foreground mb-6">Capture Business Card</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Capture Section - 2/3 width */}
            <div className="lg:col-span-2">
              <ImageCapture onImageCapture={handleImageCapture} />
            </div>
            
            {/* Tips Section - 1/3 width */}
            <div className="bg-muted rounded-lg p-4 border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-3">Capture Tips</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
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
              </ul>
            </div>
          </div>
        </div>
        
        {/* Scanned Cards Report Section */}
        <div className="bg-card rounded-xl shadow-lg border border-border p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-foreground">Scanned Cards Report</h2>
            <div className="text-sm text-muted-foreground">
              {cards.length} card{cards.length !== 1 ? 's' : ''} scanned
            </div>
          </div>
          
          {isProcessing && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                <p className="text-lg text-muted-foreground">Processing your business card...</p>
              </div>
            </div>
          )}
          
          {!isProcessing && cards.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border">
              <CardDataTable
                cards={cards}
                onUpdateCard={handleUpdateCard}
                onDeleteCard={handleDeleteCard}
              />
            </div>
          )}
          
          {!isProcessing && cards.length === 0 && (
            <div className="text-center py-12 bg-muted/30 rounded-lg">
              <p className="text-muted-foreground text-lg">No cards scanned yet. Upload or capture a business card to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppPage;