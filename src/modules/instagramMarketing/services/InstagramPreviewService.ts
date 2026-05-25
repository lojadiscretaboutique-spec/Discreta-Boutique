import { InstagramPost } from '../types/index.js';

export interface InstagramPreviewConfig {
  post: InstagramPost;
  activeImageIndex: number; // for carousels
}

export class InstagramPreviewService {
  /**
   * Helper to format double break lines on captions
   */
  formatCaption(caption: string): string {
    if (!caption) return '';
    return caption.replace(/\n/g, '<br />');
  }

  /**
   * Generates mock visual templates if needed or aggregates elements
   */
  getPreviewMetadata(post: InstagramPost, activeImageIndex = 0) {
    const images = post.imagens_geradas || [];
    const mainImage = images[activeImageIndex] || 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?q=80&w=600&auto=format&fit=crop';
    
    return {
      title: post.titulo || 'Nova Postagem de Cosméticos',
      descriptionOfImage: `Visualização do post para ${post.tipo.toUpperCase()}`,
      imageUrl: mainImage,
      totalImagesCount: images.length,
      mode: post.modo || 'unica'
    };
  }
}
