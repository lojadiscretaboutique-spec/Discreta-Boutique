import axios from 'axios';

export interface InstagramPublishCredentials {
  accessToken: string;
  instagramBusinessId: string;
}

export class InstagramGraphService {
  private apiVersion = 'v19.0';
  private baseUrl = 'https://graph.facebook.com';

  /**
   * Tests connection with the Instagram Business API
   */
  async testConnection(creds: InstagramPublishCredentials): Promise<{ status: 'conectado' | 'erro'; details: any }> {
    const url = `${this.baseUrl}/${this.apiVersion}/${creds.instagramBusinessId}`;
    try {
      const response = await axios.get(url, {
        params: {
          fields: 'id,username,name,profile_picture_url',
          access_token: creds.accessToken
        }
      });
      return {
        status: 'conectado',
        details: response.data
      };
    } catch (error: any) {
      console.error('Erro de conexão ao Instagram Graph:', error.response?.data || error);
      return {
        status: 'erro',
        details: error.response?.data || { message: error.message }
      };
    }
  }

  /**
   * Helper to wait for a media container to be fully processed by Instagram
   */
  private async waitForContainerReady(containerId: string, accessToken: string, retries = 5): Promise<boolean> {
    const url = `${this.baseUrl}/${this.apiVersion}/${containerId}`;
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios.get(url, {
          params: {
            fields: 'status_code,status',
            access_token: accessToken
          }
        });
        
        const { status_code } = response.data;
        console.log(`[Media Container Wait] Container ${containerId} status: ${status_code}`);
        
        if (status_code === 'FINISHED' || status_code === 'READY') {
          return true;
        } else if (status_code === 'ERROR') {
          throw new Error(`O processamento do container falhou no Instagram: ${response.data.status}`);
        }
      } catch (err: any) {
        console.warn(`[Media Container Warning] Tentativa ${i + 1} de checagem do container ${containerId}:`, err.message);
      }
      // Wait some seconds before trying again
      await new Promise(res => setTimeout(res, 5000));
    }
    return false;
  }

  /**
   * Publishes a single image to the Instagram feed or stories
   */
  async publishSingleImage(
    creds: InstagramPublishCredentials, 
    imageUrl: string, 
    caption: string,
    isStory = false
  ): Promise<string> {
    const containerUrl = `${this.baseUrl}/${this.apiVersion}/${creds.instagramBusinessId}/media`;
    
    // Create container
    try {
      const params: any = {
        image_url: imageUrl,
        access_token: creds.accessToken
      };

      if (isStory) {
        params.media_type = 'STORIES';
      } else {
        params.caption = caption;
      }

      console.log(`[InstagramGraph] Criando container para imagem unica. Story=${isStory}...`);
      const createResponse = await axios.post(containerUrl, null, { params });
      const containerId = createResponse.data.id;

      // Wait a moment for processing to finish
      await this.waitForContainerReady(containerId, creds.accessToken);

      // Publish container
      const publishUrl = `${this.baseUrl}/${this.apiVersion}/${creds.instagramBusinessId}/media_publish`;
      console.log(`[InstagramGraph] Publicando container ${containerId}...`);
      const publishResponse = await axios.post(publishUrl, null, {
        params: {
          creation_id: containerId,
          access_token: creds.accessToken
        }
      });

      return publishResponse.data.id;
    } catch (error: any) {
      const errorData = error.response?.data?.error || {};
      const msg = errorData.message || error.message;
      console.error('[InstagramGraph] Falha ao publicar imagem única:', errorData);
      throw new Error(`Falha ao publicar imagem: ${msg} (Código: ${errorData.code || 'N/A'})`);
    }
  }

  /**
   * Publishes a carousel matching multiple images
   */
  async publishCarousel(
    creds: InstagramPublishCredentials,
    imageUrls: string[],
    caption: string
  ): Promise<string> {
    if (imageUrls.length < 2 || imageUrls.length > 10) {
      throw new Error('Um post em carrossel deve conter entre 2 e 10 imagens.');
    }

    const containerUrl = `${this.baseUrl}/${this.apiVersion}/${creds.instagramBusinessId}/media`;
    const itemIds: string[] = [];

    try {
      // 1. Create individual containers for each image
      for (let i = 0; i < imageUrls.length; i++) {
        const imgUrl = imageUrls[i];
        console.log(`[InstagramGraph] Criando container para item ${i + 1}/${imageUrls.length} do Carrossel...`);
        const itemResponse = await axios.post(containerUrl, null, {
          params: {
            image_url: imgUrl,
            is_carousel_item: true,
            access_token: creds.accessToken
          }
        });
        itemIds.push(itemResponse.data.id);
      }

      // Check that item containers are ready
      for (const id of itemIds) {
        await this.waitForContainerReady(id, creds.accessToken);
      }

      // 2. Create the parent carousel container
      console.log(`[InstagramGraph] Criando container pai do Carrossel...`);
      const carouselResponse = await axios.post(containerUrl, null, {
        params: {
          media_type: 'CAROUSEL',
          children: itemIds.join(','),
          caption: caption,
          access_token: creds.accessToken
        }
      });
      const carouselContainerId = carouselResponse.data.id;

      // Wait for parent container to be ready
      await this.waitForContainerReady(carouselContainerId, creds.accessToken);

      // 3. Publish the carousel
      const publishUrl = `${this.baseUrl}/${this.apiVersion}/${creds.instagramBusinessId}/media_publish`;
      console.log(`[InstagramGraph] Publicando Carrossel...`);
      const publishResponse = await axios.post(publishUrl, null, {
        params: {
          creation_id: carouselContainerId,
          access_token: creds.accessToken
        }
      });

      return publishResponse.data.id;
    } catch (error: any) {
      const errorData = error.response?.data?.error || {};
      const msg = errorData.message || error.message;
      console.error('[InstagramGraph] Falha ao publicar Carrossel:', errorData);
      throw new Error(`Falha ao publicar Carrossel: ${msg} (Código: ${errorData.code || 'N/A'})`);
    }
  }
}
