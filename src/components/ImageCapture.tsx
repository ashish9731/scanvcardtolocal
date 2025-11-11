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
  const [isAutoCapture, setIsAutoCapture] = useState(false);
  const [isSmartAutoCapture, setIsSmartAutoCapture] = useState(false);
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

  const startCamera = async (autoCapture = false) => {
    try {
      // Stop any existing stream
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
      
      // Set auto-capture mode
      setIsAutoCapture(autoCapture);

      // Try environment camera first
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      } catch (envError) {
        console.warn('Environment camera failed:', envError);
        // Fallback to user-facing camera
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "user" },
              width: { ideal: 1280 },
              height: { ideal: 720 }
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
            
            // If auto-capture is enabled, capture after a short delay
            if (autoCapture && !isSmartAutoCapture) {
              setTimeout(() => {
                if (videoRef.current && showCamera) {
                  capturePhoto();
                }
              }, 1000); // Auto-capture after 1 second for faster response
            }
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
      toast({
        title: "Camera Access Failed",
        description: "Unable to access camera. Please check permissions and try again.",
        variant: "destructive",
      });
      setShowCamera(false);
    }
  };
  
  const startAutoCapture = () => {
    startCamera(true);
  };
  
  const startManualCapture = () => {
    startCamera(false);
  };
  
  const startSmartAutoCapture = () => {
    setIsSmartAutoCapture(true);
    startCamera(true);
  };
  
  // Simplified smart auto-capture that works immediately
  const initiateSmartAutoCapture = () => {
    if (!videoRef.current || !isSmartAutoCapture) return;
    
    const video = videoRef.current;
    
    // Check if video is ready
    if (video.readyState >= video.HAVE_METADATA) {
      // Immediately capture the image for smart auto-capture
      console.log('Smart auto-capture triggered, capturing image...');
      capturePhoto();
      setIsSmartAutoCapture(false); // Stop smart capture after successful capture
    } else {
      // Video not ready yet, check again shortly
      setTimeout(initiateSmartAutoCapture, 100);
    }
  };
  
  // Effect to start smart auto-capture when camera is ready
  useEffect(() => {
    if (isSmartAutoCapture && showCamera && videoRef.current) {
      // Start the smart auto-capture analysis immediately
      const timer = setTimeout(() => {
        initiateSmartAutoCapture();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isSmartAutoCapture, showCamera]);


  const fallbackToInputMethod = () => {
    if (cameraInputRef.current) {
      // Reset the value to ensure the onChange event fires
      cameraInputRef.current.value = '';
      
      // Try environment camera first (rear camera)
      const cameraInput = cameraInputRef.current;
      cameraInput.setAttribute("capture", "environment");
      
      // Click the input directly with minimal delay to ensure DOM is ready
      setTimeout(() => {
        if (cameraInputRef.current) {
          try {
            cameraInputRef.current.click();
          } catch (error) {
            console.warn('Environment camera failed, trying user camera:', error);
            // Fallback to user-facing camera
            try {
              cameraInputRef.current.setAttribute("capture", "user");
              cameraInputRef.current.click();
            } catch (userError) {
              console.warn('User camera failed, opening file dialog:', userError);
              // Final fallback: open file dialog without capture attribute
              cameraInputRef.current.removeAttribute("capture");
              cameraInputRef.current.click();
            }
          }
        }
      }, 50);
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
            onClick={startManualCapture}
            variant="outline"
            className="w-full border-primary text-primary hover:bg-primary/10 transition-smooth shadow-soft text-xs py-2"
            size="sm"
          >
            <Camera className="mr-1 h-3 w-3" />
            Use Camera
          </Button>
          
          <Button
            onClick={startAutoCapture}
            variant="outline"
            className="w-full border-green-500 text-green-500 hover:bg-green-500/10 transition-smooth shadow-soft text-xs py-2"
            size="sm"
          >
            <Camera className="mr-1 h-3 w-3" />
            Auto Capture
          </Button>
          
          <Button
            onClick={startSmartAutoCapture}
            variant="outline"
            className="w-full border-blue-500 text-blue-500 hover:bg-blue-500/10 transition-smooth shadow-soft text-xs py-2"
            size="sm"
          >
            <Camera className="mr-1 h-3 w-3" />
            Smart Auto Capture
          </Button>
        </div>

        {showCamera && (
          <div className="mt-4 rounded-lg overflow-hidden shadow-medium">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-auto max-h-96 object-contain"
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
              className="w-full h-auto max-h-96 object-contain"
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
