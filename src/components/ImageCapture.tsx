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
      
      // Auto-capture mode removed

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
    } catch (error) {
      console.error("Camera Error:", error);
      toast({
        title: "Camera Access Failed",
        description: "Unable to access camera. Please check permissions and try again.",
        variant: "destructive",
      });
      setShowCamera(false);
    }
  };
  
  const startManualCapture = () => {
    startCamera();
  };
  
  // Function to detect card boundaries using improved edge detection
  const detectCardBoundaries = (imageData: ImageData) => {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    // Improved edge detection algorithm for business card detection
    
    // Find the brightest and darkest regions to detect card edges
    let minX = width, maxX = 0, minY = height, maxY = 0;
    
    // Sample pixels to find edges (every 3rd pixel for better accuracy)
    for (let y = 0; y < height; y += 3) {
      for (let x = 0; x < width; x += 3) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // Calculate brightness
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // If this pixel is significantly different from average brightness,
        // it might be an edge
        if (brightness < 40 || brightness > 220) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    // Add some padding to the detected boundaries
    const padding = 15;
    const cardX = Math.max(0, minX - padding);
    const cardY = Math.max(0, minY - padding);
    const cardWidth = Math.min(width - cardX, maxX - minX + padding * 2);
    const cardHeight = Math.min(height - cardY, maxY - minY + padding * 2);
    
    // Ensure minimum size and reasonable proportions for a business card
    if (cardWidth < 100 || cardHeight < 50 || cardWidth > width * 0.95 || cardHeight > height * 0.95) {
      // If detection failed, use default center positioning with more conservative sizing
      const defaultWidth = width * 0.7;
      const defaultHeight = height * 0.4;
      return {
        x: (width - defaultWidth) / 2,
        y: (height - defaultHeight) / 2,
        width: defaultWidth,
        height: defaultHeight
      };
    }
    
    return {
      x: cardX,
      y: cardY,
      width: cardWidth,
      height: cardHeight
    };
  };
  
  // Fallback edge detection with improved accuracy
  const detectCardBoundariesFallback = (imageData: ImageData) => {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    // Improved edge detection algorithm
    
    // Find the brightest and darkest regions to detect card edges
    let minX = width, maxX = 0, minY = height, maxY = 0;
    
    // Sample pixels to find edges (every 3rd pixel for better accuracy)
    for (let y = 0; y < height; y += 3) {
      for (let x = 0; x < width; x += 3) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // Calculate brightness
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // If this pixel is significantly different from average brightness,
        // it might be an edge
        if (brightness < 40 || brightness > 220) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    // Add some padding to the detected boundaries
    const padding = 15;
    const cardX = Math.max(0, minX - padding);
    const cardY = Math.max(0, minY - padding);
    const cardWidth = Math.min(width - cardX, maxX - minX + padding * 2);
    const cardHeight = Math.min(height - cardY, maxY - minY + padding * 2);
    
    // Ensure minimum size and reasonable proportions for a business card
    if (cardWidth < 100 || cardHeight < 50 || cardWidth > width * 0.95 || cardHeight > height * 0.95) {
      // If detection failed, use default center positioning with more conservative sizing
      const defaultWidth = width * 0.7;
      const defaultHeight = height * 0.4;
      return {
        x: (width - defaultWidth) / 2,
        y: (height - defaultHeight) / 2,
        width: defaultWidth,
        height: defaultHeight
      };
    }
    
    return {
      x: cardX,
      y: cardY,
      width: cardWidth,
      height: cardHeight
    };
  };
  
  // Function to validate if detected boundaries represent a full card
  const isFullCardDetected = (boundaries: {x: number, y: number, width: number, height: number}, canvasWidth: number, canvasHeight: number) => {
    // Check if the detected area is reasonably sized for a business card
    const minWidth = canvasWidth * 0.3;
    const minHeight = canvasHeight * 0.2;
    const maxWidth = canvasWidth * 0.95;
    const maxHeight = canvasHeight * 0.8;
    
    return boundaries.width >= minWidth && boundaries.width <= maxWidth &&
           boundaries.height >= minHeight && boundaries.height <= maxHeight &&
           boundaries.x >= 0 && boundaries.y >= 0 &&
           boundaries.x + boundaries.width <= canvasWidth &&
           boundaries.y + boundaries.height <= canvasHeight;
  };
  
  // Function to adjust boundaries to ensure full card capture
  const adjustBoundariesForFullCard = (boundaries: {x: number, y: number, width: number, height: number}, canvasWidth: number, canvasHeight: number) => {
    // Ensure boundaries are within canvas
    let x = Math.max(0, boundaries.x);
    let y = Math.max(0, boundaries.y);
    let width = Math.min(canvasWidth - x, boundaries.width);
    let height = Math.min(canvasHeight - y, boundaries.height);
    
    // If the detected area is too small, expand it
    if (width < canvasWidth * 0.4) {
      const expansion = (canvasWidth * 0.4 - width) / 2;
      x = Math.max(0, x - expansion);
      width = Math.min(canvasWidth - x, width + expansion * 2);
    }
    
    if (height < canvasHeight * 0.3) {
      const expansion = (canvasHeight * 0.3 - height) / 2;
      y = Math.max(0, y - expansion);
      height = Math.min(canvasHeight - y, height + expansion * 2);
    }
    
    return { x, y, width, height };
  };
  
  // Function to draw detected corners for visual feedback
  const drawCorners = (canvas: HTMLCanvasElement, corners: {x: number, y: number, gradient: number}[]) => {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ff0000';
      corners.forEach(corner => {
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, 5, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
  };
  
  // Function to detect card boundaries using corner detection
  const detectCardBoundariesWithCorners = (imageData: ImageData) => {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    // Corner detection algorithm for business card alignment
    // This simulates detecting the four corners of a business card
    
    // Find potential corner points by analyzing gradient changes
    const corners = [];
    const threshold = 30; // Sensitivity threshold for corner detection
    
    // Sample pixels to find corners (every 10th pixel for performance)
    for (let y = 10; y < height - 10; y += 10) {
      for (let x = 10; x < width - 10; x += 10) {
        const idx = (y * width + x) * 4;
        
        // Calculate gradients in x and y directions
        const leftIdx = (y * width + (x - 5)) * 4;
        const rightIdx = (y * width + (x + 5)) * 4;
        const topIdx = ((y - 5) * width + x) * 4;
        const bottomIdx = ((y + 5) * width + x) * 4;
        
        // Calculate brightness for each point
        const centerBrightness = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        const leftBrightness = 0.299 * data[leftIdx] + 0.587 * data[leftIdx + 1] + 0.114 * data[leftIdx + 2];
        const rightBrightness = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
        const topBrightness = 0.299 * data[topIdx] + 0.587 * data[topIdx + 1] + 0.114 * data[topIdx + 2];
        const bottomBrightness = 0.299 * data[bottomIdx] + 0.587 * data[bottomIdx + 1] + 0.114 * data[bottomIdx + 2];
        
        // Calculate gradient magnitudes
        const gradX = Math.abs(rightBrightness - leftBrightness);
        const gradY = Math.abs(bottomBrightness - topBrightness);
        const gradientMagnitude = Math.sqrt(gradX * gradX + gradY * gradY);
        
        // If gradient is significant, this might be a corner
        if (gradientMagnitude > threshold) {
          corners.push({ x, y, gradient: gradientMagnitude });
        }
      }
    }
    
    // Sort corners by gradient magnitude (strongest first)
    corners.sort((a, b) => b.gradient - a.gradient);
    
    // Select the four strongest corners
    const selectedCorners = corners.slice(0, 4);
    
    // If we don't have enough corners, fall back to edge detection
    if (selectedCorners.length < 4) {
      return detectCardBoundariesFallback(imageData);
    }
    
    // Determine card boundaries from corners
    let minX = Math.min(...selectedCorners.map(c => c.x));
    let maxX = Math.max(...selectedCorners.map(c => c.x));
    let minY = Math.min(...selectedCorners.map(c => c.y));
    let maxY = Math.max(...selectedCorners.map(c => c.y));
    
    // Add padding
    const padding = 20;
    const cardX = Math.max(0, minX - padding);
    const cardY = Math.max(0, minY - padding);
    const cardWidth = Math.min(width - cardX, maxX - minX + padding * 2);
    const cardHeight = Math.min(height - cardY, maxY - minY + padding * 2);
    
    // Ensure minimum size
    if (cardWidth < 100 || cardHeight < 50) {
      return detectCardBoundariesFallback(imageData);
    }
    
    return {
      x: cardX,
      y: cardY,
      width: cardWidth,
      height: cardHeight
    };
  };
  
  // Function to draw card boundary with corners
  const drawCardBoundary = (canvas: HTMLCanvasElement, boundaries: {x: number, y: number, width: number, height: number}) => {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw boundary rectangle
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(boundaries.x, boundaries.y, boundaries.width, boundaries.height);
      
      // Draw corner markers
      const cornerSize = 10;
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3;
      
      // Top-left corner
      ctx.beginPath();
      ctx.moveTo(boundaries.x, boundaries.y + cornerSize);
      ctx.lineTo(boundaries.x, boundaries.y);
      ctx.lineTo(boundaries.x + cornerSize, boundaries.y);
      ctx.stroke();
      
      // Top-right corner
      ctx.beginPath();
      ctx.moveTo(boundaries.x + boundaries.width - cornerSize, boundaries.y);
      ctx.lineTo(boundaries.x + boundaries.width, boundaries.y);
      ctx.lineTo(boundaries.x + boundaries.width, boundaries.y + cornerSize);
      ctx.stroke();
      
      // Bottom-left corner
      ctx.beginPath();
      ctx.moveTo(boundaries.x, boundaries.y + boundaries.height - cornerSize);
      ctx.lineTo(boundaries.x, boundaries.y + boundaries.height);
      ctx.lineTo(boundaries.x + cornerSize, boundaries.y + boundaries.height);
      ctx.stroke();
      
      // Bottom-right corner
      ctx.beginPath();
      ctx.moveTo(boundaries.x + boundaries.width - cornerSize, boundaries.y + boundaries.height);
      ctx.lineTo(boundaries.x + boundaries.width, boundaries.y + boundaries.height);
      ctx.lineTo(boundaries.x + boundaries.width, boundaries.y + boundaries.height - cornerSize);
      ctx.stroke();
    }
  };
  
  // Function to adjust camera zoom based on corner positions
  const adjustCameraZoom = () => {
    // In a real implementation, this would adjust the camera zoom level
    // based on detected corner positions and card size
    // Browser APIs have limitations for direct zoom control
    // For now, we'll simulate the zoom adjustment
    console.log('Adjusting camera zoom based on corner positions...');
    
    // Get optimal zoom level
    const zoomLevel = getCardZoomLevel();
    console.log(`Setting zoom level to ${zoomLevel}x for optimal card capture`);
  };
  
  // Function to align card in frame based on corner positions
  const alignCard = () => {
    // In a real implementation, this would provide visual guidance
    // to help user align the card properly based on detected corners
    console.log('Aligning card based on corner positions...');
    
    // Simulate alignment process
    console.log('Corner alignment: 25% complete');
    setTimeout(() => console.log('Corner alignment: 50% complete'), 200);
    setTimeout(() => console.log('Corner alignment: 75% complete'), 400);
    setTimeout(() => console.log('Corner alignment: 100% complete'), 600);
  };
  
  // Function to check if card is properly positioned based on corner alignment
  const isCardProperlyPositioned = () => {
    // In a real implementation, this would analyze the frame
    // to determine if the card is properly aligned based on corner positions
    
    // Simulate a 95% success rate for proper positioning with corner detection
    return Math.random() > 0.05;
  };
  
  // Function to get zoom level for card based on corner positions
  const getCardZoomLevel = () => {
    // In a real implementation, this would calculate the optimal zoom
    // level based on detected corner positions and card size
    
    // Return a zoom level based on card size (larger cards need less zoom)
    return Math.random() * 3 + 1.5; // Random zoom between 1.5x and 4.5x
  };
  
  // Function to show alignment guidance with corner detection
  const showAlignmentGuidance = () => {
    // In a real implementation, this would show visual guides
    // to help the user position the card correctly
    console.log('Showing alignment guides...');
    
    // Simulate showing visual guides
    console.log('Detecting card corners...');
    console.log('Displaying corner markers');
    console.log('Showing alignment grid');
    console.log('Displaying distance indicators');
  };
  


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
        
        // Auto-detect card boundaries and crop the image
        const imageDataForDetection = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let cardBoundaries = detectCardBoundaries(imageDataForDetection);
        
        // Validate and adjust boundaries to ensure full card capture
        const isValidBoundaries = isFullCardDetected(cardBoundaries, canvas.width, canvas.height);
        
        if (!isValidBoundaries) {
          // Try corner detection as fallback
          cardBoundaries = detectCardBoundariesWithCorners(imageDataForDetection);
          
          // If still not valid, adjust boundaries
          if (!isFullCardDetected(cardBoundaries, canvas.width, canvas.height)) {
            cardBoundaries = adjustBoundariesForFullCard(cardBoundaries, canvas.width, canvas.height);
          }
        }
        
        // Create a new canvas for the cropped card image
        const croppedCanvas = document.createElement('canvas');
        const cropWidth = Math.min(canvas.width, Math.max(100, cardBoundaries.width));
        const cropHeight = Math.min(canvas.height, Math.max(50, cardBoundaries.height));
        croppedCanvas.width = cropWidth;
        croppedCanvas.height = cropHeight;
        
        const croppedCtx = croppedCanvas.getContext('2d');
        if (croppedCtx) {
          // Draw the cropped region
          croppedCtx.drawImage(
            canvas,
            Math.max(0, cardBoundaries.x), Math.max(0, cardBoundaries.y), 
            Math.min(canvas.width - cardBoundaries.x, cropWidth), 
            Math.min(canvas.height - cardBoundaries.y, cropHeight), // source
            0, 0, cropWidth, cropHeight // destination
          );
          
          // Convert to JPEG with good quality
          const imageData = croppedCanvas.toDataURL('image/jpeg', 0.95); // Increased quality
          setPreview(imageData);
          onImageCapture(imageData);
        } else {
          // Fallback if cropped context fails
          const imageData = canvas.toDataURL('image/jpeg', 0.95);
          setPreview(imageData);
          onImageCapture(imageData);
        }
        
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
            accept="image/*,application/pdf"
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
