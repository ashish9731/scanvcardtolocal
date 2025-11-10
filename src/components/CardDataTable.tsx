import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Download, Trash2, Edit2, Check, X, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { CardData } from "@/utils/ocrProcessor";

interface CardDataTableProps {
  cards: CardData[];
  onUpdateCard: (id: string, updates: Partial<CardData>) => void;
  onDeleteCard: (id: string) => void;
}

export const CardDataTable = ({ cards, onUpdateCard, onDeleteCard }: CardDataTableProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<CardData | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const { toast } = useToast();

  const startEdit = (card: CardData) => {
    setEditingId(card.id);
    setEditData({ ...card });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData(null);
  };

  const saveEdit = () => {
    if (editingId && editData) {
      onUpdateCard(editingId, editData);
      setEditingId(null);
      setEditData(null);
      toast({
        title: "Updated successfully",
        description: "Card data has been updated",
      });
    }
  };

  const handleExportCSV = async () => {
    if (cards.length === 0) {
      toast({
        title: "No data to export",
        description: "Please add some cards first",
        variant: "destructive",
      });
      return;
    }

    // Create a ZIP file containing both CSV and images
    const zip = new JSZip();
    const timestamp = Date.now();
    
    // Create a copy of cards with image filenames instead of base64 data
    const cardsForExport = cards.map((card, index) => {
      // Create a more descriptive filename
      const namePart = card.name ? card.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20) : `card_${index}`;
      const filename = `${namePart}_${timestamp}.jpg`;
      
      return {
        ...card,
        imageData: filename // Reference to the image file
      };
    });

    // Add CSV file to ZIP
    const csv = Papa.unparse(cardsForExport);
    zip.file(`business-cards-${timestamp}.csv`, csv);

    // Add images to ZIP
    cards.forEach((card, index) => {
      try {
        // Extract base64 data from the data URL
        const base64Data = card.imageData.split(',')[1];
        const binaryData = atob(base64Data);
        const arrayBuffer = new ArrayBuffer(binaryData.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        
        for (let i = 0; i < binaryData.length; i++) {
          uint8Array[i] = binaryData.charCodeAt(i);
        }
        
        // Create a more descriptive filename
        const namePart = card.name ? card.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20) : `card_${index}`;
        const filename = `${namePart}_${timestamp}.jpg`;
        
        // Add image to ZIP
        zip.file(filename, uint8Array);
      } catch (e) {
        console.error("Error processing image:", e);
      }
    });

    // Generate ZIP file and download
    try {
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `business-cards-${timestamp}.zip`);
      
      toast({
        title: "Export successful",
        description: "ZIP file containing CSV and images has been downloaded",
      });
    } catch (error) {
      console.error("Error generating ZIP file:", error);
      toast({
        title: "Export failed",
        description: "Failed to generate ZIP file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleExportVCF = () => {
    if (cards.length === 0) {
      toast({
        title: "No data to export",
        description: "Please add some cards first",
        variant: "destructive",
      });
      return;
    }

    // Generate VCF content
    let vcfContent = "";
    cards.forEach((card, index) => {
      vcfContent += "BEGIN:VCARD\n";
      vcfContent += "VERSION:3.0\n";
      
      // Add name
      if (card.name) {
        const nameParts = card.name.split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        vcfContent += `N:${lastName};${firstName};;;\n`;
        vcfContent += `FN:${card.name}\n`;
      }
      
      // Add organization
      if (card.company) {
        vcfContent += `ORG:${card.company}\n`;
      }
      
      // Add title
      if (card.designation) {
        vcfContent += `TITLE:${card.designation}\n`;
      }
      
      // Add email
      if (card.email) {
        vcfContent += `EMAIL;TYPE=WORK:${card.email}\n`;
      }
      
      // Add phone
      if (card.phone) {
        vcfContent += `TEL;TYPE=WORK:${card.phone}\n`;
      }
      
      // Add website
      if (card.website) {
        vcfContent += `URL:${card.website}\n`;
      }
      
      // Add address
      if (card.address) {
        vcfContent += `ADR;TYPE=WORK:;;${card.address}\n`;
      }
      
      // Add LinkedIn URL if available
      if (card.linkedinUrl) {
        vcfContent += `URL:${card.linkedinUrl}\n`;
      }
      
      vcfContent += "END:VCARD\n\n";
    });

    const blob = new Blob([vcfContent], { type: "text/vcard" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `business-cards-${Date.now()}.vcf`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: "VCF file has been downloaded",
    });
  };

  const handleSendEmail = async () => {
    if (cards.length === 0) {
      toast({
        title: "No data to send",
        description: "Please scan some business cards first",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSendingEmail(true);
      
      // Create ZIP file with CSV and images
      const zip = new JSZip();
      const timestamp = Date.now();
      
      // Create cards data for CSV export
      const cardsForExport = cards.map((card, index) => {
        const namePart = card.name ? card.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20) : `card_${index}`;
        const filename = `${namePart}_${timestamp}.jpg`;
        return {
          ...card,
          imageData: filename // Reference to the image file
        };
      });

      // Add CSV file to ZIP
      const csv = Papa.unparse(cardsForExport);
      zip.file(`business-cards-${timestamp}.csv`, csv);

      // Add images to ZIP
      cards.forEach((card, index) => {
        try {
          // Extract base64 data from the data URL
          const base64Data = card.imageData.split(',')[1];
          const binaryData = atob(base64Data);
          const arrayBuffer = new ArrayBuffer(binaryData.length);
          const uint8Array = new Uint8Array(arrayBuffer);
          
          for (let i = 0; i < binaryData.length; i++) {
            uint8Array[i] = binaryData.charCodeAt(i);
          }
          
          // Create a more descriptive filename
          const namePart = card.name ? card.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20) : `card_${index}`;
          const filename = `${namePart}_${timestamp}.jpg`;
          
          // Add image to ZIP
          zip.file(filename, uint8Array);
        } catch (e) {
          console.error("Error processing image:", e);
        }
      });

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: "blob" });
      
      // Create professional email content
      const subject = encodeURIComponent(`Business Cards Collection - ${new Date().toLocaleDateString()}`);
      const body = encodeURIComponent(`Dear Recipient,

I hope this email finds you well.

Please find attached a comprehensive collection of business cards that I have scanned using our Business Card Scanner application. The attachment includes:

1. A CSV file containing all extracted contact information
2. Individual image files of each business card for your reference

The ZIP file is organized for easy access to both the data and visual representations of the business cards.

Should you have any questions or require any additional information, please don't hesitate to reach out.

Best regards,
[Your Name]
[Your Position]
[Your Contact Information]`);
      
      // Create a temporary file reference for user guidance
      const filename = `business-cards-${timestamp}.zip`;
      
      // Save the file automatically
      saveAs(zipBlob, filename);
      
      // Open Gmail compose window with pre-filled content
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
      window.open(gmailUrl, '_blank');
      
      // Show detailed instructions to the user
      toast({
        title: "Email Preparation Complete",
        description: `Business cards ZIP file "${filename}" has been downloaded automatically. Gmail compose window has opened. To complete the process: 1) Click the paperclip icon in Gmail 2) Select the downloaded ZIP file 3) Send your email.`,
        duration: 10000, // Show for 10 seconds
      });
    } catch (error) {
      console.error("Error sending email:", error);
      toast({
        title: "Email Failed",
        description: "Failed to prepare email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };


  if (cards.length === 0) {
    return (
      <Card className="p-12 text-center shadow-medium bg-gradient-card">
        <p className="text-muted-foreground text-lg">No cards scanned yet. Upload or capture a business card to get started.</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 shadow-medium bg-gradient-card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-foreground">Extracted Card Data</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleExportCSV}
            className="bg-accent hover:bg-accent-hover text-accent-foreground transition-smooth shadow-soft text-sm py-2 px-3"
          >
            <Download className="mr-1 h-4 w-4" />
            CSV
          </Button>
          <Button
            onClick={handleExportVCF}
            className="bg-primary hover:bg-primary-hover text-primary-foreground transition-smooth shadow-soft text-sm py-2 px-3"
          >
            <Download className="mr-1 h-4 w-4" />
            VCF
          </Button>
          <Button
            onClick={handleSendEmail}
            disabled={isSendingEmail}
            className="bg-red-600 hover:bg-red-700 text-white transition-smooth shadow-soft text-sm py-2 px-3"
          >
            <Mail className="mr-1 h-4 w-4" />
            {isSendingEmail ? 'Sending...' : 'Gmail'}
          </Button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] md:min-w-[1000px] border-collapse">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="text-left p-3 font-semibold text-foreground">Name</th>
              <th className="text-left p-3 font-semibold text-foreground">Company</th>
              <th className="text-left p-3 font-semibold text-foreground">Designation</th>
              <th className="text-left p-3 font-semibold text-foreground">Email</th>
              <th className="text-left p-3 font-semibold text-foreground">Phone</th>
              <th className="text-left p-3 font-semibold text-foreground">Website</th>
              <th className="text-left p-3 font-semibold text-foreground">LinkedIn</th>
              <th className="text-left p-3 font-semibold text-foreground">Address</th>
              <th className="text-left p-3 font-semibold text-foreground">Image</th>
              <th className="text-left p-3 font-semibold text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={card.id} className="border-b border-border hover:bg-muted/50 transition-smooth">
                {editingId === card.id && editData ? (
                  <>
                    <td className="p-2">
                      <Input
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        className="min-w-[120px]"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={editData.company}
                        onChange={(e) => setEditData({ ...editData, company: e.target.value })}
                        className="min-w-[120px]"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={editData.designation}
                        onChange={(e) => setEditData({ ...editData, designation: e.target.value })}
                        className="min-w-[120px]"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={editData.email}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        className="min-w-[150px]"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={editData.phone}
                        onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                        className="min-w-[120px]"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={editData.website}
                        onChange={(e) => setEditData({ ...editData, website: e.target.value })}
                        className="min-w-[150px]"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={editData.linkedinUrl || ''}
                        onChange={(e) => setEditData({ ...editData, linkedinUrl: e.target.value })}
                        className="min-w-[150px]"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={editData.address}
                        onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                        className="min-w-[200px]"
                      />
                    </td>
                    <td className="p-2">
                      <div className="text-xs text-muted-foreground truncate max-w-[100px]" title="Image data included in CSV export">
                        Image Data
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={saveEdit} className="h-8 w-8 text-primary hover:bg-primary/10">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={cancelEdit} className="h-8 w-8 text-muted-foreground hover:bg-muted">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-3 text-foreground">{card.name}</td>
                    <td className="p-3 text-foreground">{card.company}</td>
                    <td className="p-3 text-foreground">{card.designation}</td>
                    <td className="p-3 text-foreground">{card.email}</td>
                    <td className="p-3 text-foreground">{card.phone}</td>
                    <td className="p-3 text-foreground">{card.website}</td>
                    <td className="p-3 text-foreground max-w-[150px] truncate">
                      {card.linkedinUrl ? (
                        <a 
                          href={card.linkedinUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate block"
                        >
                          LinkedIn Profile
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Not found</span>
                      )}
                    </td>
                    <td className="p-3 text-foreground max-w-[200px] truncate" title={card.address}>
                      {card.address}
                    </td>
                    <td className="p-3">
                      <div className="text-xs text-muted-foreground truncate max-w-[100px]" title="Image data included in CSV export">
                        Image Data
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEdit(card)}
                          className="h-8 w-8 text-primary hover:bg-primary/10"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onDeleteCard(card.id)}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
