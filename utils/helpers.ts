
export const generateId = (): string => {
  // Fallback for non-secure contexts where crypto.randomUUID is not available
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const compressImage = (base64String: string, maxWidth = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Check if it already has the data prefix
    const src = base64String.startsWith('data:') 
      ? base64String 
      : `data:image/jpeg;base64,${base64String}`;
      
    img.src = src;
    
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64String); // Fallback
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Get new base64 string
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };

    img.onerror = (err) => {
      console.error("Image compression error", err);
      resolve(base64String); // Return original on error
    };
  });
};
