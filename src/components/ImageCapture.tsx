import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageCaptureProps {
  onImageCapture: (imageData: string) => void;
}

export const ImageCapture = ({ onImageCapture }: ImageCaptureProps) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  // Cleanup camera stream when component unmounts
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Process all selected files
      Array.from(files).forEach((file, index) => {
        if (!file.type.startsWith("image/")) {
          toast({
            title: "Invalid file type",
            description: "Please select an image file",
            variant: "destructive",
          });
          return;
        }

        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: "Please select an image smaller than 10MB",
            variant: "destructive",
          });
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const imageData = event.target?.result as string;
          setPreview(imageData);
          // Add a small delay between processing multiple files
          setTimeout(() => {
            onImageCapture(imageData);
          }, index * 100);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const clearImage = () => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
    // Stop camera stream if active
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const startCamera = async () => {
    try {
      // Check if MediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Fallback to file input method
        fallbackToInputMethod();
        return;
      }

      // Stop any existing stream
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }

      // Request camera access with constraints for better performance
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      setCameraStream(stream);
      setShowCamera(true);
      
      // Attach stream to video element
      if (videoRef.current) {
        // Wait a moment for the video element to be ready
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // Play the video to ensure it's active
            videoRef.current.play().catch(err => console.warn('Video play failed:', err));
          }
        }, 100);
      }
    } catch (error) {
      console.warn('Camera access failed, falling back to file input:', error);
      // Try user-facing camera as fallback
      try {
        // Stop any existing stream first
        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        
        setCameraStream(stream);
        setShowCamera(true);
        
        if (videoRef.current) {
          // Wait a moment for the video element to be ready
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              // Play the video to ensure it's active
              videoRef.current.play().catch(err => console.warn('Video play failed:', err));
            }
          }, 100);
        }
      } catch (fallbackError) {
        console.warn('User-facing camera also failed:', fallbackError);
        // Final fallback to file input method
        fallbackToInputMethod();
      }
    }
  };

  const fallbackToInputMethod = () => {
    if (cameraInputRef.current) {
      // Reset the value to ensure the onChange event fires
      cameraInputRef.current.value = '';
      
      // Try environment camera first (rear camera)
      const cameraInput = cameraInputRef.current;
      cameraInput.setAttribute("capture", "environment");
      
      try {
        cameraInput.click();
      } catch (error) {
        // Fallback: try user-facing camera
        try {
          cameraInput.setAttribute("capture", "user");
          cameraInput.click();
        } catch (fallbackError) {
          // Final fallback: open file dialog without capture attribute
          try {
            cameraInput.removeAttribute("capture");
            cameraInput.click();
          } catch (finalError) {
            toast({
              title: "Camera Error",
              description: "Failed to access camera. Please check permissions and try again.",
              variant: "destructive",
            });
          }
        }
      }
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw a black background first to ensure proper capture
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to JPEG with good quality
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setPreview(imageData);
        onImageCapture(imageData);
        
        // Stop camera stream
        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
        }
        setShowCamera(false);
      }
    } else {
      toast({
        title: "Camera not ready",
        description: "Please wait for the camera to initialize and try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-2 shadow-medium bg-gradient-card">
      <div className="space-y-1.5">
        <h2 className="text-sm font-semibold text-foreground">Capture Business Card</h2>
        
        <div className="flex flex-col gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
            multiple
          />
          
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-primary hover:bg-primary-hover text-primary-foreground transition-smooth shadow-soft text-xs py-2"
            size="sm"
          >
            <Upload className="mr-1 h-3 w-3" />
            Upload Image
          </Button>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
            id="camera-capture"
            multiple
          />
          
          <Button
            onClick={startCamera}
            variant="outline"
            className="w-full border-primary text-primary hover:bg-primary/10 transition-smooth shadow-soft text-xs py-2"
            size="sm"
          >
            <Camera className="mr-1 h-3 w-3" />
            Use Camera
          </Button>
        </div>

        {showCamera && (
          <div className="mt-4 rounded-lg overflow-hidden shadow-medium">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-auto max-h-96 object-contain bg-muted"
            />
            <div className="flex gap-2 mt-2">
              <Button
                onClick={capturePhoto}
                className="flex-1 bg-primary text-primary-foreground shadow-lg"
              >
                Capture Photo
              </Button>
              <Button
                onClick={clearImage}
                variant="destructive"
                className="flex-1 shadow-medium"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        
        {preview && !showCamera && (
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
