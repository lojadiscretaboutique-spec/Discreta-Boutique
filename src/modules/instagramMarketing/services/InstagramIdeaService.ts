import { OpenAIContentService } from './OpenAIContentService.js';
import { InstagramSuggestion } from '../types/index.js';

export class InstagramIdeaService {
  private contentService: OpenAIContentService;

  constructor() {
    this.contentService = new OpenAIContentService();
  }

  async generateWeeklyIdeas(
    userDescription: string, 
    type: 'feed' | 'story' | 'reels',
    brandKitPrompt?: string
  ): Promise<InstagramSuggestion[]> {
    if (!userDescription || userDescription.trim() === '') {
      throw new Error('A descrição ou tema semanal de ideias não pode estar vazia.');
    }
    
    return await this.contentService.generateIdeas(userDescription, type, brandKitPrompt);
  }
}
