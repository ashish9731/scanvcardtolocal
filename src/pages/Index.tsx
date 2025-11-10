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
  const [isLinkedInSearching, setIsLinkedInSearching] = useState(false);
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

  const handleLinkedInSearch = async () => {
    if (cards.length === 0) {
      toast({
        title: "No cards to search",
        description: "Please scan some business cards first",
        variant: "destructive",
      });
      return;
    }

    setIsLinkedInSearching(true);
    toast({
      title: "LinkedIn Search",
      description: "Searching for LinkedIn profiles...",
    });

    try {
      // Create a copy of cards with LinkedIn profile URLs
      const updatedCards = [...cards];
      
      // Process each card to find LinkedIn profiles
      let foundCount = 0;
      for (let i = 0; i < updatedCards.length; i++) {
        const card = updatedCards[i];
        if (card.email) {
          try {
            // Search for LinkedIn profile using email, name, and company
            const linkedinUrl = await searchLinkedInProfile(card.email, card.name, card.company);
            if (linkedinUrl) {
              updatedCards[i] = { ...card, linkedinUrl };
              foundCount++;
            }
          } catch (error) {
            console.warn(`Failed to find LinkedIn profile for ${card.email}:`, error);
          }
        }
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setCards(updatedCards);
      
      toast({
        title: "LinkedIn Search Complete",
        description: `Found ${foundCount} LinkedIn profiles`,
      });
    } catch (error) {
      console.error("LinkedIn search error:", error);
      toast({
        title: "Search Failed",
        description: "Failed to search for LinkedIn profiles. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLinkedInSearching(false);
    }
  };

// This function is no longer needed as we're updating cards directly in the search function
  // const handleUpdateCardWithLinkedIn = (id: string, linkedinUrl: string) => {
  //   setCards((prev) =>
  //     prev.map((card) => (card.id === id ? { ...card, linkedinUrl } : card))
  //   );
  // };


  const searchLinkedInProfile = async (email: string, name?: string, company?: string): Promise<string | null> => {
    // In a real application, you would use LinkedIn's API or a third-party service
    // This is a simplified implementation that generates realistic LinkedIn URLs
    
    // Predefined list of realistic LinkedIn profile URLs with associated data for demonstration
    // In a real implementation, these would come from an actual API search
    const realisticProfiles = [
      { url: 'https://www.linkedin.com/in/john-doe-123456', name: 'John Doe', email: 'john.doe@example.com', company: 'Tech Solutions Inc' },
      { url: 'https://www.linkedin.com/in/jane-smith-abcdef', name: 'Jane Smith', email: 'jane.smith@corporate.com', company: 'Global Enterprises' },
      { url: 'https://www.linkedin.com/in/michael-brown-789012', name: 'Michael Brown', email: 'm.brown@innovate.com', company: 'Innovate Corp' },
      { url: 'https://www.linkedin.com/in/sarah-johnson-345678', name: 'Sarah Johnson', email: 's.johnson@digital.com', company: 'Digital Services' },
      { url: 'https://www.linkedin.com/in/david-wilson-901234', name: 'David Wilson', email: 'd.wilson@tech.com', company: 'Tech Industries' },
      { url: 'https://www.linkedin.com/in/emily-davis-567890', name: 'Emily Davis', email: 'e.davis@creative.com', company: 'Creative Agency' },
      { url: 'https://www.linkedin.com/in/robert-miller-234567', name: 'Robert Miller', email: 'r.miller@consulting.com', company: 'Consulting Group' },
      { url: 'https://www.linkedin.com/in/jennifer-garcia-890123', name: 'Jennifer Garcia', email: 'j.garcia@marketing.com', company: 'Marketing Solutions' },
      { url: 'https://www.linkedin.com/in/william-rodriguez-456789', name: 'William Rodriguez', email: 'w.rodriguez@finance.com', company: 'Finance Partners' },
      { url: 'https://www.linkedin.com/in/jessica-martinez-123789', name: 'Jessica Martinez', email: 'j.martinez@health.com', company: 'Health Systems' }
    ];
    
    // Helper function to normalize text for comparison
    const normalizeText = (text: string): string => {
      return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    };
    
    // Helper function to check if two names match
    const namesMatch = (name1: string, name2: string): boolean => {
      const norm1 = normalizeText(name1);
      const norm2 = normalizeText(name2);
      
      // Check for exact match or first name match
      return norm1 === norm2 || norm1.split(' ')[0] === norm2.split(' ')[0];
    };
    
    // Helper function to check if two companies match
    const companiesMatch = (company1: string, company2: string): boolean => {
      const norm1 = normalizeText(company1);
      const norm2 = normalizeText(company2);
      
      // Check for exact match or if one contains the other
      return norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1);
    };
    
    // Helper function to check if two emails match
    const emailsMatch = (email1: string, email2: string): boolean => {
      // Compare email prefixes (before @)
      const prefix1 = email1.split('@')[0]?.toLowerCase();
      const prefix2 = email2.split('@')[0]?.toLowerCase();
      
      return prefix1 === prefix2;
    };
    
    // Helper function to find an exact matching profile
    const findExactMatchingProfile = (email: string, name?: string, company?: string): string | null => {
      // All three criteria must be provided
      if (!email || !name || !company) {
        return null;
      }
      
      // Search for a profile that matches all three criteria
      for (const profile of realisticProfiles) {
        if (
          emailsMatch(email, profile.email) &&
          namesMatch(name, profile.name) &&
          companiesMatch(company, profile.company)
        ) {
          return profile.url;
        }
      }
      
      // No exact match found
      return null;
    };
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Find an exact matching profile
    const profileUrl = findExactMatchingProfile(email, name, company);
    
    return profileUrl;
  };


  // Update the CardData interface to include LinkedIn URL
  const updateCardDataWithLinkedIn = (id: string, linkedinUrl: string) => {
    setCards((prev) =>
      prev.map((card) => (card.id === id ? { ...card, linkedinUrl } : card))
    );
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
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Side - Capture Options */}
            <div className="py-4 md:col-span-1">
              <div className="bg-gradient-to-br from-card to-muted rounded-2xl shadow-xl p-4 border border-border h-full">
                <h2 className="text-xl font-bold text-foreground mb-4">Capture Business Card</h2>
                <ImageCapture onImageCapture={handleImageCapture} />
              </div>
            </div>
            
            {/* Right Side - Report/Results */}
            <div className="py-4 md:col-span-2">
              <div className="bg-gradient-to-br from-card to-muted rounded-2xl shadow-xl p-6 border border-border h-full">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <h2 className="text-2xl font-bold text-foreground">Scanned Cards Report</h2>
                  <button 
                    onClick={handleLinkedInSearch}
                    disabled={isLinkedInSearching}
                    className={`px-3 py-2 rounded-lg transition-colors text-sm flex items-center gap-1 ${isLinkedInSearching ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                    </svg>
                    <span className="hidden sm:inline">{isLinkedInSearching ? 'Searching...' : 'Search LinkedIn'}</span>
                    <span className="sm:hidden">{isLinkedInSearching ? 'Searching...' : 'LinkedIn'}</span>
                  </button>
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
