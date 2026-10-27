import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CloudinarySignResponse {
  cloud_name: string;
  api_key: string;
  timestamp: number;
  folder: string;
  signature: string;
}

@Injectable({ providedIn: 'root' })
export class ImageUploadService {
  private functionsUrl = environment.supabaseFunctionsUrl || 'https://xfapeknaqakooacakjqy.supabase.co/functions/v1';

  constructor(private http: HttpClient) {}

  /**
   * Resizes and compresses an image in browser memory before uploading
   */
  async compressImage(file: File, maxDimension = 1600, quality = 0.82): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => reject(new Error('Failed to load image for compression'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Gets signed Cloudinary upload params from Supabase Edge Function and uploads directly to Cloudinary
   */
  async uploadImage(file: File | Blob, onProgress?: (pct: number) => void): Promise<string> {
    const token = localStorage.getItem('auth_token') || '';
    if (!token) {
      throw new Error('Not authenticated');
    }

    // 1. Compress if it is a File and large
    let uploadBlob: Blob = file;
    if (file instanceof File && file.type.startsWith('image/')) {
      uploadBlob = await this.compressImage(file);
    }

    // 2. Request signature from edge function
    const signParams = await firstValueFrom(
      this.http.post<CloudinarySignResponse>(
        `${this.functionsUrl}/agx-chat/sign-upload`,
        {},
        {
          headers: {
            'apikey': environment.supabaseAnonKey,
            'Authorization': `Bearer ${environment.supabaseAnonKey}`,
            'x-agx-token': token,
          },
        }
      )
    );

    // 3. Build form data for Cloudinary
    const formData = new FormData();
    formData.append('file', uploadBlob, 'upload.jpg');
    formData.append('api_key', signParams.api_key);
    formData.append('timestamp', String(signParams.timestamp));
    formData.append('signature', signParams.signature);
    formData.append('folder', signParams.folder);

    // 4. Upload with XHR to track progress
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(
        'POST',
        `https://api.cloudinary.com/v1_1/${signParams.cloud_name}/image/upload`
      );

      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 100);
            onProgress(pct);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            resolve(res.secure_url || res.url);
          } catch (e) {
            reject(new Error('Invalid response from image server'));
          }
        } else {
          let errText = xhr.responseText;
          try {
            const errJson = JSON.parse(xhr.responseText);
            errText = errJson.error?.message || errText;
          } catch {}
          reject(new Error(`Image upload failed: ${errText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error uploading image'));
      xhr.send(formData);
    });
  }
}
