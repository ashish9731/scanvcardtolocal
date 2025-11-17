import { createWorker } from 'tesseract.js';

// Helper function to convert data URL to Blob
const dataURLToBlob = (dataURL: string): Blob => {
  const parts = dataURL.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
};

// Helper function to resize image for better OCR performance
const resizeImageForOCR = (imageData: string): Promise<string> => {
  return new Promise((resolve) => {
    // Validate input
    if (!imageData || !imageData.startsWith('data:image/')) {
      console.warn('Invalid image data provided to resize function');
      resolve('');
      return;
    }

    const img = new Image();
    img.onload = () => {
      // Create canvas for resizing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve(imageData); // Return original if context not available
        return;
      }
      
      // Calculate new dimensions (max 1280px width for performance)
      const maxWidth = 1280;
      const scale = Math.min(1, maxWidth / img.width);
      const newWidth = Math.floor(img.width * scale);
      const newHeight = Math.floor(img.height * scale);
      
      canvas.width = newWidth;
      canvas.height = newHeight;
      
      // Draw resized image
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      
      // Return resized image data
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => {
      // If image fails to load, return original
      console.warn('Failed to load image for resizing');
      resolve(imageData);
    };
    img.src = imageData;
  });
};

// Helper function to validate and prepare image for OCR
const prepareImageForOCR = async (imageData: string): Promise<Blob | string> => {
  // Validate input
  if (!imageData) {
    throw new Error('No image data provided');
  }
  
  // Check if it's a data URL
  if (imageData.startsWith('data:image/')) {
    try {
      // Try to convert to blob for better Tesseract compatibility
      const blob = dataURLToBlob(imageData);
      return blob;
    } catch (error) {
      console.warn('Failed to convert data URL to blob, using original data', error);
      return imageData;
    }
  }
  
  // If it's already a blob or file path, return as is
  return imageData;
};

export interface CardData {
  id: string;
  name: string;
  company: string;
  designation: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  imageData: string; // Base64 encoded image data
}

export const processImage = async (imageData: string): Promise<CardData> => {
  // Validate input
  if (!imageData) {
    throw new Error('No image data provided');
  }
  
  // Log cross-origin status
  const isCrossOriginIsolated = window.crossOriginIsolated;
  console.log('Cross-origin isolation status:', isCrossOriginIsolated);
  
  // Prepare image for OCR
  let preparedImage: Blob | string;
  try {
    preparedImage = await prepareImageForOCR(imageData);
  } catch (prepareError) {
    console.error('Image preparation error:', prepareError);
    throw new Error(`Failed to prepare image: ${prepareError.message || 'Unknown preparation error'}`);
  }
  
  const worker = await createWorker('eng');
  
  try {
    // Configure worker for better performance with business cards
    await worker.setParameters({
      tessedit_do_invert: '0', // Skip inversion for better performance
      preserve_interword_spaces: '1', // Preserve spaces between words
      classify_bln_numeric_mode: '0', // Don't assume numeric mode
    });
    
    // Resize image for better performance if it's too large
    let resizedImageData: string | Blob = preparedImage;
    if (typeof preparedImage === 'string') {
      try {
        resizedImageData = await resizeImageForOCR(preparedImage);
        // If resize failed, use original
        if (!resizedImageData) {
          resizedImageData = preparedImage;
        }
      } catch (resizeError) {
        console.warn('Image resize failed, using original image', resizeError);
        resizedImageData = preparedImage;
      }
    }
    
    // Perform OCR with error handling
    try {
      console.log('Starting OCR recognition...');
      const { data: { text } } = await worker.recognize(resizedImageData);
      console.log('OCR recognition completed successfully');
      
      // Parse extracted text
      const parsedData = parseCardData(text, typeof resizedImageData === 'string' ? resizedImageData : imageData);
      
      return {
        id: Date.now().toString(),
        ...parsedData,
      };
    } catch (ocrError: any) {
      console.error('OCR processing error:', ocrError);
      // Try to provide more specific error information
      let errorMessage = 'Unknown OCR error';
      if (ocrError.message) {
        errorMessage = ocrError.message;
      } else if (ocrError.toString) {
        errorMessage = ocrError.toString();
      }
      throw new Error(`Failed to process image: ${errorMessage}`);
    }
  } finally {
    await worker.terminate();
  }
};

// ... existing parseCardData function remains unchanged ...