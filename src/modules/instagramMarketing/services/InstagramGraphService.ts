import axios from 'axios';

export interface InstagramPublishCredentials {
  accessToken: string;
  instagramBusinessId: string;
}

export class InstagramGraphService {
  private apiVersion = 'v19.0';
  private baseUrl = 'https://graph.facebook.com';

  /**
   * Exchanges an authorization code for a short-lived user access token
   */
  async exchangeCodeForToken(code: string, redirectUri: string, appId: string, appSecret: string): Promise<string> {
    const url = `${this.baseUrl}/${this.apiVersion}/oauth/access_token`;
    const response = await axios.get(url, {
      params: {
        client_id: appId,
        redirect_uri: redirectUri,
        client_secret: appSecret,
        code
      }
    });
    return response.data.access_token;
  }

  /**
   * Exchanges a short-lived token for a long-lived user access token (60 days)
   */
  async getLongLivedToken(shortToken: string, appId: string, appSecret: string): Promise<string> {
    const url = `${this.baseUrl}/${this.apiVersion}/oauth/access_token`;
    const response = await axios.get(url, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortToken
      }
    });
    return response.data.access_token;
  }

  /**
   * Fetches Facebook pages and their attached Instagram Business Accounts
   */
  async getUserPagesAndInstagramAccounts(longToken: string): Promise<any[]> {
    const url = `${this.baseUrl}/${this.apiVersion}/me/accounts`;
    const response = await axios.get(url, {
      params: {
        fields: 'id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}',
        access_token: longToken
      }
    });
    return response.data.data || [];
  }

  /**
   * Performs real and deep Meta Graph validation for token, permissions, connected pages, and Instagram Business profile.
   */
  async validateConnectionDetailed(creds: {
    accessToken: string;
    instagramBusinessId: string;
    pageId?: string;
  }): Promise<{
    valid: boolean;
    status: string;
    checks: {
      token_valid: boolean;
      instagram_connected: boolean;
      page_linked: boolean;
      permissions_approved: boolean;
    };
    details: {
      permissions: string[];
      granted_permissions: string[];
      declined_permissions: string[];
      expires_at?: string;
      username?: string;
      name?: string;
      profile_picture_url?: string;
      page_name?: string;
    };
  }> {
    const checks = {
      token_valid: false,
      instagram_connected: false,
      page_linked: false,
      permissions_approved: false,
    };

    const details: any = {
      permissions: [],
      granted_permissions: [],
      declined_permissions: []
    };

    try {
      // 1. Check permissions and token validity
      const permissionsUrl = `${this.baseUrl}/${this.apiVersion}/me/permissions`;
      const permissionsRes = await axios.get(permissionsUrl, {
        params: { access_token: creds.accessToken }
      });
      checks.token_valid = true;

      const permList: any[] = permissionsRes.data.data || [];
      const requiredPerms = [
        'instagram_basic',
        'instagram_content_publish',
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_posts',
        'business_management'
      ];

      const grantedSet = new Set<string>();
      permList.forEach(p => {
        if (p.status === 'granted') {
          grantedSet.add(p.permission);
          details.granted_permissions.push(p.permission);
        } else {
          details.declined_permissions.push(p.permission);
        }
      });

      details.permissions = requiredPerms;
      
      // Check if all needed permissions are approved
      const missingPerms = requiredPerms.filter(p => !grantedSet.has(p));
      checks.permissions_approved = missingPerms.length === 0;

      // 2. Fetch Instagram Profile details to verify Instagram connection
      if (creds.instagramBusinessId) {
        const igUrl = `${this.baseUrl}/${this.apiVersion}/${creds.instagramBusinessId}`;
        try {
          const igRes = await axios.get(igUrl, {
            params: {
              fields: 'id,username,name,profile_picture_url',
              access_token: creds.accessToken
            }
          });
          checks.instagram_connected = true;
          details.username = igRes.data.username;
          details.name = igRes.data.name;
          details.profile_picture_url = igRes.data.profile_picture_url;
        } catch (igErr: any) {
          console.warn('[Validation] Falha ao consultar Instagram Business account:', igErr.message);
        }
      }

      // 3. Verify page link
      if (creds.pageId) {
        const pageUrl = `${this.baseUrl}/${this.apiVersion}/${creds.pageId}`;
        try {
          const pageRes = await axios.get(pageUrl, {
            params: {
              fields: 'id,name',
              access_token: creds.accessToken
            }
          });
          checks.page_linked = true;
          details.page_name = pageRes.data.name;
        } catch (pErr: any) {
          console.warn('[Validation] Falha ao consultar Facebook Page:', pErr.message);
        }
      }

      const valid = checks.token_valid && checks.instagram_connected && checks.permissions_approved;
      let status = 'conectado';
      if (!checks.token_valid) status = 'Token expirado';
      else if (!checks.instagram_connected) status = 'Página sem Instagram Business';
      else if (!checks.permissions_approved) status = 'Permissão ausente';

      return {
        valid,
        status,
        checks,
        details
      };
    } catch (error: any) {
      console.error('[Validation] Erro profundo na chamada de validação do Meta:', error.response?.data || error);
      const isExpired = error.response?.data?.error?.code === 190 || error.message?.includes('expired') || error.response?.status === 401;
      return {
        valid: false,
        status: isExpired ? 'Token expirado' : 'Token inválido ou expirado',
        checks: {
          token_valid: false,
          instagram_connected: false,
          page_linked: false,
          permissions_approved: false
        },
        details
      };
    }
  }

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
