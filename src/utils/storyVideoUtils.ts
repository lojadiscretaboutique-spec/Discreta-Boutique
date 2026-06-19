/**
 * Utilitários para tratamento inteligente de vídeos do Story Shop no navegador.
 * Realiza validações e geração de thumbnail em WebP sem travar o browser.
 */

export interface VideoValidationResult {
  valid: boolean;
  duration: number;
  width: number;
  height: number;
  sizeMB: number;
  errors: string[];
  warnings: string[];
}

/**
 * Valida o arquivo do story video no navegador.
 */
export function validateStoryVideo(file: File): Promise<VideoValidationResult> {
  return new Promise((resolve) => {
    const sizeMB = file.size / (1024 * 1024);
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Validar formato (apenas mp4)
    const isMp4 = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
    if (!isMp4) {
      errors.push("Use vídeo em MP4 para melhor compatibilidade.");
    }

    // 2. Validar tamanho máximo (20 MB)
    if (sizeMB > 20) {
      errors.push("Vídeo muito grande. Use no máximo 20 MB.");
    }

    // Criar elemento de vídeo temporário para ler metadados no browser
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const tempUrl = URL.createObjectURL(file);

    video.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      errors.push("Use vídeo em MP4 para melhor compatibilidade.");
      resolve({
        valid: false,
        duration: 0,
        width: 0,
        height: 0,
        sizeMB,
        errors,
        warnings
      });
    };

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      URL.revokeObjectURL(tempUrl);

      // Validar duração máxima (30 segundos)
      if (duration > 30) {
        errors.push("Vídeo muito longo. Use no máximo 30 segundos.");
      }

      // Validar orientação vertical (proporção típica de 9:16 ou simplesmente vertical: height > width)
      if (height <= width) {
        warnings.push("Recomendamos vídeo vertical 9:16 para melhor visualização.");
      }

      // Proporção ou resoluções recomendadas como aviso sutil
      if (Math.abs((width / height) - (9 / 16)) > 0.1) {
        warnings.push("Recomendamos vídeo vertical 9:16 para melhor visualização.");
      }

      // Filtrar avisos duplicados
      const uniqueWarnings = Array.from(new Set(warnings));
      const valid = errors.length === 0;

      resolve({
        valid,
        duration,
        width,
        height,
        sizeMB,
        errors,
        warnings: uniqueWarnings
      });
    };

    video.src = tempUrl;
  });
}

/**
 * Gera uma thumbnail WebP extraindo um frame específico do vídeo.
 */
export function generateVideoThumbnailWebP(
  file: File,
  options?: { seekTime?: number }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    const tempUrl = URL.createObjectURL(file);
    video.src = tempUrl;

    video.onerror = (err) => {
      URL.revokeObjectURL(tempUrl);
      reject(err);
    };

    video.onloadedmetadata = () => {
      const duration = video.duration;
      let targetTime = 1;

      if (options?.seekTime !== undefined) {
        targetTime = options.seekTime;
      } else {
        if (duration < 1) {
          targetTime = duration / 2;
        }
      }

      // Garantir limites
      if (targetTime > duration) {
        targetTime = duration;
      }
      if (targetTime < 0) {
        targetTime = 0;
      }

      video.currentTime = targetTime;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxW = 480;
        let targetW = video.videoWidth;
        let targetH = video.videoHeight;

        // Manter proporção limitando largura máxima
        if (targetW > maxW) {
          targetH = (maxW / targetW) * targetH;
          targetW = maxW;
        }

        canvas.width = targetW;
        canvas.height = targetH;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(tempUrl);
          reject(new Error("Não foi possível criar contexto 2D do Canvas."));
          return;
        }

        // Desenhar frame no canvas
        ctx.drawImage(video, 0, 0, targetW, targetH);
        
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(tempUrl);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Falha ao exportar blob WebP do Canvas."));
          }
        }, 'image/webp', 0.75);
      } catch (err) {
        URL.revokeObjectURL(tempUrl);
        reject(err);
      }
    };
  });
}
