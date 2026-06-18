import { 
  collection, doc, addDoc, updateDoc, deleteDoc, 
  serverTimestamp, onSnapshot, increment 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { LiveSession } from '../types/liveShop';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error in liveShopService:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const liveShopService = {
  // Real-time synchronization of all lives
  subscribeToLives(callback: (lives: LiveSession[]) => void, onError?: (err: any) => void) {
    const livesRef = collection(db, 'lives');
    return onSnapshot(
      livesRef,
      (snapshot) => {
        const liveList = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as LiveSession[];
        callback(liveList);
      },
      (error) => {
        console.error('Error listening to lives:', error);
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.LIST, 'lives');
      }
    );
  },

  // Save live (create or update)
  async saveLive(liveData: Omit<LiveSession, 'id'> & { id?: string }): Promise<string> {
    const { id, ...payload } = liveData;
    const path = id ? `lives/${id}` : 'lives';

    try {
      if (id) {
        const ref = doc(db, 'lives', id);
        await updateDoc(ref, {
          ...payload,
          updatedAt: serverTimestamp()
        });
        return id;
      } else {
        const ref = collection(db, 'lives');
        const docRef = await addDoc(ref, {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        return docRef.id;
      }
    } catch (error) {
      handleFirestoreError(error, id ? OperationType.UPDATE : OperationType.CREATE, path);
      throw error;
    }
  },

  // Update specific status of a live
  async updateStatus(id: string, status: LiveSession['status']): Promise<void> {
    const path = `lives/${id}`;
    try {
      const ref = doc(db, 'lives', id);
      await updateDoc(ref, {
        status,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      throw error;
    }
  },

  // Delete live
  async deleteLive(id: string): Promise<void> {
    const path = `lives/${id}`;
    try {
      const ref = doc(db, 'lives', id);
      await deleteDoc(ref);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
      throw error;
    }
  },

  // Convert generic YT/Vimeo shares to clean autoplay embed formats
  getEmbedUrl(url: string): string {
    if (!url) return '';
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/||user\/[^\/]+\/|embed\/|watch\?(?:.*&)?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const matchYt = url.match(ytRegex);
    if (matchYt && matchYt[1]) {
      return `https://www.youtube.com/embed/${matchYt[1]}?autoplay=1&mute=1&controls=1`;
    }
    const vimeoRegex = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/;
    const matchVimeo = url.match(vimeoRegex);
    if (matchVimeo && matchVimeo[1]) {
      return `https://player.vimeo.com/video/${matchVimeo[1]}?autoplay=1&muted=1`;
    }
    return url;
  },

  // Log public telemetry/interaction event safely via live_events collection and live_metrics subcollection
  async trackLiveEvent(event: {
    liveId: string;
    type: 'view' | 'product_click' | 'add_to_cart' | 'coupon_click' | 'whatsapp_click';
    productId?: string;
    couponCode?: string;
  }): Promise<void> {
    try {
      let sessionId = sessionStorage.getItem('live_shop_session_id');
      if (!sessionId) {
        sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
        sessionStorage.setItem('live_shop_session_id', sessionId);
      }

      const payload = {
        liveId: event.liveId,
        type: event.type,
        productId: event.productId || null,
        couponCode: event.couponCode || null,
        sessionId,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server/Unknown',
        createdAt: serverTimestamp()
      };

      // Create event in global live_events
      const eventsRef = collection(db, 'live_events');
      await addDoc(eventsRef, payload);

      // Create event in subcollection live_metrics/{liveId}/events/{eventId}
      try {
        const subRef = collection(db, 'live_metrics', event.liveId, 'events');
        await addDoc(subRef, payload);
      } catch (subErr) {
        console.warn('Subcollection metrics log failed slightly:', subErr);
      }
    } catch (error) {
      console.error('Failed to track public live event safely:', error);
    }
  },

  // Public increment methods (legacy fallback for compatibility, but gracefully degraded on public permission deny)
  async incrementViewCount(id: string): Promise<void> {
    try {
      await this.trackLiveEvent({ liveId: id, type: 'view' });
    } catch (error) {
      // safe silent capture for public clients
    }
  },

  async incrementProductClicks(id: string, productId: string): Promise<void> {
    try {
      await this.trackLiveEvent({ liveId: id, type: 'product_click', productId });
    } catch (error) {
      // safe silent capture for public clients
    }
  }
};
