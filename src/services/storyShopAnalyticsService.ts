import { db } from '../lib/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';

export const storyShopAnalyticsService = {
  async trackView(storyId: string) {
    const docRef = doc(db, 'story_shop', storyId);
    await updateDoc(docRef, { views: increment(1) });
  },
  
  async trackClick(storyId: string) {
    const docRef = doc(db, 'story_shop', storyId);
    await updateDoc(docRef, { clicks: increment(1) });
  }
};
