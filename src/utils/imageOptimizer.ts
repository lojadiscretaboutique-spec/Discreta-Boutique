import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { storage } from '../lib/storage';

export interface OptimizedImageResult {
  file: File;
  width: number;
  height: number;
  sizeKb: number;
  format: string;
}

export async function optimizeImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number = 0.85,
  forceWebp: boolean = true
): Promise<OptimizedImageResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let { width, height } = img;
        
        // Calculate new dimensions
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No canvas context');

        ctx.drawImage(img, 0, 0, width, height);

        const format = forceWebp ? 'image/webp' : file.type;
        const ext = forceWebp ? 'webp' : file.name.split('.').pop() || 'png';
        const finalName = file.name.replace(/\.[^/.]+$/, "") + `.${ext}`;

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject('Image processing failed');
            const optimizedFile = new File([blob], finalName, { type: format });
            resolve({
              file: optimizedFile,
              width,
              height,
              sizeKb: Math.round(blob.size / 1024),
              format: ext
            });
          },
          format,
          quality
        );
      };
      img.onerror = () => reject('Failed to load image');
    };
    reader.onerror = () => reject('Failed to read file');
  });
}

export interface BrandingImageInfo {
  url: string;
  path: string;
  width: number;
  height: number;
  sizeKb: number;
  format: string;
  version: number;
  uploadDate: string;
}

export async function uploadBrandingImage(
  optimized: OptimizedImageResult,
  folder: string = 'branding'
): Promise<BrandingImageInfo> {
  const file = optimized.file;
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${folder}/${Date.now()}_${sanitizedName}`;
  const fileRef = ref(storage, path);
  
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);

  return {
    url,
    path,
    width: optimized.width,
    height: optimized.height,
    sizeKb: optimized.sizeKb,
    format: optimized.format,
    version: Date.now(),
    uploadDate: new Date().toISOString()
  };
}
