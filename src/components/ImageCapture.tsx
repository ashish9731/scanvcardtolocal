import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageCaptureProps {
  onImageCapture: (imageData: string) => void;
}

export const ImageCapture = ({ onImageCapture }: ImageCaptureProps) => {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target?.result as string;
        setPreview(imageData);
        onImageCapture(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card className="p-6 shadow-medium bg-gradient-card">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Capture Business Card</h2>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 bg-primary hover:bg-primary-hover text-primary-foreground transition-smooth shadow-soft"
            size="lg"
          >
            <Upload className="mr-2 h-5 w-5" />
            Upload Image
          </Button>

          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
            id="camera-capture"
          />
          
          <Button
            onClick={() => {
              const cameraInput = document.getElementById("camera-capture") as HTMLInputElement;
              if (cameraInput) {
                cameraInput.click();
              }
            }}
            variant="outline"
            className="flex-1 border-primary text-primary hover:bg-primary/10 transition-smooth shadow-soft"
            size="lg"
          >
            <Camera className="mr-2 h-5 w-5" />
            Use Camera
          </Button>
        </div>

        {preview && (
          <div className="relative mt-4 rounded-lg overflow-hidden shadow-medium">
            <img
              src={preview}
              alt="Business card preview"
              className="w-full h-auto max-h-96 object-contain bg-muted"
            />
            <Button
              onClick={clearImage}
              size="icon"
              variant="destructive"
              className="absolute top-2 right-2 shadow-medium"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};
