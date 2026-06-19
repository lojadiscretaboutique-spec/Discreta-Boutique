import { db } from '../../lib/firebase';
import { 
    collection, 
    addDoc, 
    getDocs, 
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
    await deleteDoc(doc(db, COLLECTION, id));
  }
};
