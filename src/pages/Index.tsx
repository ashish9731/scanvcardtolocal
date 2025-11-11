import { useState, useEffect } from "react";
import { ImageCapture } from "@/components/ImageCapture";
import { CardDataTable } from "@/components/CardDataTable";
import { ThemeToggle } from "@/components/theme-toggle";
import { processImage, type CardData } from "@/utils/ocrProcessor";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "../contexts/AuthContext";

const Index = () => {
  const [cards, setCards] = useState<CardData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingQueue, setProcessingQueue] = useState<number>(0);
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [showApp, setShowApp] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, signOut, getCouponDaysRemaining } = useAuth();

  useEffect(() => {
    if (user) {
      const remaining = getCouponDaysRemaining();
      setDaysRemaining(remaining);
    } else {
      setDaysRemaining(null);
    }
  }, [user]);

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

  const handleLoginClick = () => {
    navigate('/login');
  };

  const handleSignupClick = () => {
    navigate('/signup');
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleStartCapturing = () => {
    // Redirect to the protected app page
    navigate('/app');
  };

  return (
    <div className="min-h-screen bg-background">
      {!showApp ? (
        // Hero Section with CTA
        <div className="max-w-4xl mx-auto px-4 py-16 md:py-24 text-center">
          <div className="absolute top-4 right-4 flex gap-2 items-center">
            {daysRemaining !== null && (
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                {daysRemaining} days left
              </div>
            )}
            {user ? (
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={handleLoginClick}>
                  Login
                </Button>
                <Button size="sm" onClick={handleSignupClick}>
                  Sign Up
                </Button>
              </>
            )}
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
                onClick={handleStartCapturing}
                className="px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-lg shadow-lg hover:bg-primary/90 transition-all transform hover:scale-105 text-lg"
              >
                Start Capturing Cards
              </button>
            </div>
            
            <div className="pt-4">
              <div className="inline-block bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-lg">
                <p className="font-medium">Unlock 60 Days FREE! Sign up and scan smarter with Business Card Scanner — Use code <span className="font-bold">BCS60</span>.</p>
              </div>
            </div>
            
            <div className="max-w-2xl mx-auto mt-4">
              <div className="flex items-start">
                <span className="mr-2">⚠️</span>
                <p className="text-sm">
                  <strong>Disclaimer:</strong> This app can throw up any error, so please cross verify the details.
                </p>
              </div>
            </div>
            
            <div className="mt-8 text-muted-foreground">
              <p className="text-2xl md:text-3xl font-bold">
                Join <span className="text-primary">10,000+</span> users who are already saving hours of time by using BCS
              </p>
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
                <h3 className="text-xl font-semibold mb-2">Privacy & Data Policy</h3>
                <p className="text-muted-foreground">We do not store any data. Save your data before exiting.</p>
              </div>
              <div className="p-6 bg-card rounded-xl border border-border shadow-sm">
                <div className="text-2xl font-bold text-primary mb-2">04</div>
                <h3 className="text-xl font-semibold mb-2">Export & Share</h3>
                <p className="text-muted-foreground">Export contacts to CSV or VCF format</p>
              </div>
            </div>
            
            <div className="pt-8 max-w-4xl mx-auto">
              <h3 className="text-xl font-semibold text-foreground mb-4 text-center">Additional Benefits</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start p-4 bg-muted/50 rounded-lg border border-border">
                  <span className="text-primary mr-2">✓</span>
                  <div>
                    <h4 className="font-medium text-foreground">Editable Table</h4>
                    <p className="text-sm text-muted-foreground">Easily edit and improve extracted information</p>
                  </div>
                </div>
                <div className="flex items-start p-4 bg-muted/50 rounded-lg border border-border">
                  <span className="text-primary mr-2">✓</span>
                  <div>
                    <h4 className="font-medium text-foreground">Multiple Export Options</h4>
                    <p className="text-sm text-muted-foreground">Export to CSV, VCF, or send directly via Gmail</p>
                  </div>
                </div>
                <div className="flex items-start p-4 bg-muted/50 rounded-lg border border-border">
                  <span className="text-primary mr-2">✓</span>
                  <div>
                    <h4 className="font-medium text-foreground">Batch Processing</h4>
                    <p className="text-sm text-muted-foreground">Process multiple cards at once</p>
                  </div>
                </div>
                <div className="flex items-start p-4 bg-muted/50 rounded-lg border border-border">
                  <span className="text-primary mr-2">✓</span>
                  <div>
                    <h4 className="font-medium text-foreground">Cross-Platform</h4>
                    <p className="text-sm text-muted-foreground">Works on mobile and desktop browsers</p>
                  </div>
                </div>
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