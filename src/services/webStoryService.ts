
import { db } from "../lib/firebase";
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc } from "firebase/firestore";

export const webStoryService = {
  async listStories() {
    const snapshot = await getDocs(collection(db, "web_stories"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
  
  async createStory(storyData: any) {
    return await addDoc(collection(db, "web_stories"), { ...storyData, createdAt: new Date().toISOString() });
  },

  async updateStory(id: string, storyData: any) {
    return await updateDoc(doc(db, "web_stories", id), { ...storyData, updatedAt: new Date().toISOString() });
  }
};
