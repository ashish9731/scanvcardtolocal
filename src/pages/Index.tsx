import { useState } from "react";
import { ImageCapture } from "@/components/ImageCapture";
import { CardDataTable } from "@/components/CardDataTable";
import { processImage, type CardData } from "@/utils/ocrProcessor";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard } from "lucide-react";

const Index = () => {
  const [cards, setCards] = useState<CardData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleImageCapture = async (imageData: string) => {
    setIsProcessing(true);
    toast({
      title: "Processing image...",
      description: "Extracting information from the business card",
    });

    try {
      const cardData = await processImage(imageData);
      setCards((prev) => [...prev, cardData]);
      
      toast({
        title: "Success!",
        description: "Business card data extracted successfully",
      });
    } catch (error) {
      console.error("OCR processing error:", error);
      toast({
        title: "Processing failed",
        description: "Failed to extract data from the image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
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
      {/* Hero Section */}
      <div className="bg-gradient-hero text-primary-foreground py-12 px-4 shadow-large">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex justify-center mb-4">
            <CreditCard className="h-16 w-16" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Business Card Scanner
          </h1>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
            Digitize business cards instantly with powerful OCR technology. Capture, extract, and manage contact information effortlessly.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <ImageCapture onImageCapture={handleImageCapture} />

        {isProcessing && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <p className="text-lg text-muted-foreground">Processing your business card...</p>
            </div>
          </div>
        )}

        {!isProcessing && (
          <CardDataTable
            cards={cards}
            onUpdateCard={handleUpdateCard}
            onDeleteCard={handleDeleteCard}
          />
        )}
      </div>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground">
          <p>Built with OCR technology • Scan, Extract, Export</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
