import { db } from '../../lib/firebase';
import { 
    collection, 
    addDoc, 
    getDocs, 
    getDoc,
    query, 
    orderBy, 
    doc, 
    updateDoc, 
    deleteDoc, 
    Timestamp,
    where
} from 'firebase/firestore';                
import { StoryShop } from '../../types/storyShop';

const COLLECTION = 'story_shop';

export const storyShopService = {
  async listStories(): Promise<StoryShop[]> {
    const q = query(collection(db, COLLECTION), orderBy('order', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoryShop));
  },
  
  async createStory(story: StoryShop): Promise<string> {
    const data = {
        ...story,
        startDate: story.startDate instanceof Date ? Timestamp.fromDate(story.startDate) : story.startDate,
        endDate: story.endDate instanceof Date ? Timestamp.fromDate(story.endDate) : story.endDate,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        views: 0,
        clicks: 0
    };
    const docRef = await addDoc(collection(db, COLLECTION), data);
    return docRef.id;
  },
  
  async updateStory(id: string, story: Partial<StoryShop>): Promise<void> {
    const docRef = doc(db, COLLECTION, id);
    const data = { ...story, updatedAt: Timestamp.now() };
    if (data.startDate instanceof Date) data.startDate = Timestamp.fromDate(data.startDate);
    if (data.endDate instanceof Date) data.endDate = Timestamp.fromDate(data.endDate);
    
    await updateDoc(docRef, data);
  },

  async deleteStory(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION, id);
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as StoryShop;
        
        // Dynamic import to prevent bundler problems and keep file lazy loaded
        const { storage } = await import('../../lib/storage');
        const { ref: storageRef, deleteObject } = await import('firebase/storage');

        // Verify and delete video from Storage
        if (
          data.videoSource === 'firebase_storage' && 
          data.videoStoragePath && 
          data.videoStoragePath.startsWith('story-shop/videos/')
        ) {
          try {
            const videoRef = storageRef(storage, data.videoStoragePath);
            await deleteObject(videoRef);
            console.log(`[STORAGE] Deleted video: ${data.videoStoragePath}`);
          } catch (storageErr) {
            console.error(`[STORAGE] Could not delete video at ${data.videoStoragePath}:`, storageErr);
          }
        }

        // Verify and delete thumbnail from Storage
        if (
          data.thumbnailSource === 'firebase_storage' && 
          data.thumbnailStoragePath && 
          data.thumbnailStoragePath.startsWith('story-shop/thumbnails/')
        ) {
          try {
            const thumbRef = storageRef(storage, data.thumbnailStoragePath);
            await deleteObject(thumbRef);
            console.log(`[STORAGE] Deleted thumbnail: ${data.thumbnailStoragePath}`);
          } catch (storageErr) {
            console.error(`[STORAGE] Could not delete thumbnail at ${data.thumbnailStoragePath}:`, storageErr);
          }
        }
      }
    } catch (err) {
      console.error("[storyShopService] Pre-delete storage sweep encountered an error:", err);
    }

    await deleteDoc(docRef);
  }
};
