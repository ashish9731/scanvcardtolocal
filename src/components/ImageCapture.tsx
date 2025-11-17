import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Upload, X, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageCaptureProps {
  onImageCapture: (imageData: string) => void;
}

export const ImageCapture = ({ onImageCapture }: ImageCaptureProps) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  // Check orientation on resize
  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
          toast({
            title: "Invalid file type",
            description: "Please select an image or PDF file",
            variant: "destructive",
          });
          return;
        }

        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: "Please select a file smaller than 10MB",
            variant: "destructive",
          });
          return;
        }

        // Handle PDF files
        if (file.type === "application/pdf") {
          handlePdfFile(file, index);
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

  const handlePdfFile = (file: File, index: number) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const pdfData = event.target?.result as string;
      setPreview(pdfData);
      // Add a small delay between processing multiple files
      setTimeout(() => {
        onImageCapture(pdfData);
      }, index * 100);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setPreview(null);
    setCameraError(null);
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

  const startCamera = async (autoCapture = false) => {
    // Reset any previous errors
    setCameraError(null);
    
    // Check if device is in landscape mode
    if (window.innerWidth < window.innerHeight) {
      toast({
        title: "Orientation Warning",
        description: "Please rotate your device to landscape mode for optimal card scanning.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Stop any existing stream
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
      
      // Check if we're in a cross-origin isolated context
      if (window.crossOriginIsolated) {
        console.warn('Cross-origin isolation is enabled, which may affect camera access');
      }

      // Try environment camera first (rear camera for mobile)
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            // More flexible constraints for mobile devices
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 }
          }
        });
      } catch (envError) {
        console.warn('Environment camera failed:', envError);
        // Fallback to user-facing camera
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "user" },
              // More flexible constraints for mobile devices
              width: { min: 640, ideal: 1280, max: 1920 },
              height: { min: 480, ideal: 720, max: 1080 }
            }
          });
        } catch (userError) {
          console.warn('User camera failed:', userError);
          // Final fallback to file input
          fallbackToInputMethod();
          return;
        }
      }

      setCameraStream(stream);
      setShowCamera(true);

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", ""); // iOS fix
        videoRef.current.setAttribute("muted", ""); // Required for autoplay in some browsers
        
        // Add event listeners for better control
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded');
          // Play video once metadata is loaded
          if (videoRef.current) {
            videoRef.current.play().catch(playError => {
              console.warn('Video play failed:', playError);
              toast({
                title: "Camera Warning",
                description: "Camera loaded but playback failed. You can still capture photos.",
              });
            });
          }
        };
        
        videoRef.current.onerror = (videoError) => {
          console.error('Video element error:', videoError);
          toast({
            title: "Camera Error",
            description: "Video display error. Please try again.",
            variant: "destructive",
          });
        };
      }
    } catch (error: any) {
      console.error("Camera Error:", error);
      setCameraError(error.message || "Unknown camera error");
      
      // Handle specific Cross-Origin errors
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        toast({
          title: "Camera Access Blocked",
          description: "Please allow camera access in your browser settings and try again.",
          variant: "destructive",
        });
      } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
        toast({
          title: "Camera Not Found",
          description: "No camera found on this device. Please upload an image instead.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Camera Access Failed",
          description: "Unable to access camera. Please check permissions and try again.",
          variant: "destructive",
        });
      }
      setShowCamera(false);
    }
  };
  
  const startManualCapture = () => {
    startCamera();
  };
  
  const fallbackToInputMethod = () => {
    if (fileInputRef.current) {
      // Reset the value to ensure the onChange event fires
      fileInputRef.current.value = '';
      
      // Click the input directly
      setTimeout(() => {
        if (fileInputRef.current) {
          try {
            fileInputRef.current.click();
          } catch (error) {
            console.warn('File input fallback failed:', error);
            toast({
              title: "Camera Access Failed",
              description: "Unable to access camera. Please upload an image instead.",
              variant: "destructive",
            });
          }
        }
      }, 100);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      
      // Check if video has data, even if not fully playing
      if (video.readyState < video.HAVE_METADATA && !video.srcObject) {
        toast({
          title: "Camera not ready",
          description: "Please wait for the camera to initialize and try again.",
          variant: "destructive",
        });
        return;
      }
      
      // Use video dimensions or fallback to standard size
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      
      // Create canvas with actual video dimensions
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Fill canvas with black background first
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the video frame
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch (drawError) {
          console.warn('Draw error, using black frame:', drawError);
          // If draw fails, at least we have the black background
        }
        
        // Convert to JPEG with good quality for OCR
        const imageData = canvas.toDataURL('image/jpeg', 0.92); // Slightly reduced quality for faster processing
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
        title: "Camera Error",
        description: "Camera not available. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  return (
    <Card className="p-2 shadow-medium bg-gradient-card">
      <div className="space-y-1.5">
        <h2 className="text-sm font-semibold text-foreground">Capture Business Card</h2>
        
        {/* Landscape mode warning */}
        {!isLandscape && showCamera && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-4">
            <div className="flex items-center">
              <RotateCcw className="h-5 w-5 text-yellow-500 mr-2" />
              <p className="text-yellow-700 font-medium">Please rotate your device to landscape mode for optimal card scanning.</p>
            </div>
          </div>
        )}
        
        <div className="flex flex-col gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
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
            onClick={startManualCapture}
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
              className="w-full h-auto max-h-96 object-contain bg-transparent"
            />
            <div className="flex gap-2 mt-2">
              <Button
                onClick={capturePhoto}
                className="flex-1 bg-primary text-primary-foreground shadow-lg"
                disabled={!isLandscape}
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
              className="w-full h-auto max-h-96 object-contain bg-transparent"
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

export default ImageCapture;