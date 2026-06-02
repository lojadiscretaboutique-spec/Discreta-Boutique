import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDocs, 
  updateDoc, 
  Timestamp 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface VisitorSession {
  id: string;
  device: 'Mobile' | 'Desktop' | 'Tablet';
  referrer: string;
  source: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  createdAt: any;
  lastActive: any;
  isAnonymous: boolean;
  userId: string | null;
  country: string;
  regionName: string;
  city: string;
  ipPlaceholder?: string; // Stored safely without full IP disclosure (LGPD compliance)
}

export interface PageView {
  id?: string;
  sessionId: string;
  path: string;
  title: string;
  timestamp: any;
}

let cachedSessionId: string | null = null;
let lastSessionUpdateTimeStr = '0';

// Simple debounce helper to restrict session lastActive spamming (no more than once every 15 seconds)
function canUpdateSession(): boolean {
  const now = Date.now();
  const lastUpdate = parseInt(lastSessionUpdateTimeStr || '0', 10);
  if (now - lastUpdate > 15000) {
    lastSessionUpdateTimeStr = now.toString();
    return true;
  }
  return false;
}

export const analyticsService = {
  getOrCreateSessionId(): string {
    if (cachedSessionId) return cachedSessionId;
    const stored = sessionStorage.getItem('discreta_analytics_session_id');
    if (stored) {
      cachedSessionId = stored;
      return stored;
    }
    const newId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
    sessionStorage.setItem('discreta_analytics_session_id', newId);
    cachedSessionId = newId;
    return newId;
  },

  async trackPageView(title: string, path: string) {
    try {
      // 1. Identify or initialize session
      const sessionId = this.getOrCreateSessionId();
      const sessionRef = doc(db, 'visitor_sessions', sessionId);
      const isNewSession = !sessionStorage.getItem('discreta_analytics_session_active');

      const ua = navigator.userAgent;
      let device: 'Mobile' | 'Desktop' | 'Tablet' = 'Desktop';
      if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) {
        device = 'Mobile';
        if (/iPad/i.test(ua)) {
          device = 'Tablet';
        }
      } else if (/Tablet|PlayBook|Silk/i.test(ua)) {
        device = 'Tablet';
      }

      // Referral channel categorization
      let referral = document.referrer;
      let source = 'Direto';
      if (referral) {
        if (referral.includes('google.com')) source = 'Google';
        else if (referral.includes('instagram.com') || referral.includes('t.co')) source = 'Instagram';
        else if (referral.includes('facebook.com') || referral.includes('fb')) source = 'Facebook';
        else if (referral.includes('whatsapp.com') || referral.includes('wa.me')) source = 'WhatsApp';
        else source = 'Outros';
      }

      const urlParams = new URLSearchParams(window.location.search);
      const utmSource = urlParams.get('utm_source');
      const utmMedium = urlParams.get('utm_medium') || '';
      const utmCampaign = urlParams.get('utm_campaign') || '';

      if (utmSource) {
        const uLower = utmSource.toLowerCase();
         if (uLower.includes('google')) source = 'Google';
         else if (uLower.includes('instagram') || uLower.includes('ig')) source = 'Instagram';
         else if (uLower.includes('facebook') || uLower.includes('fb')) source = 'Facebook';
         else if (uLower.includes('whatsapp') || uLower.includes('wa')) source = 'WhatsApp';
         else source = utmSource;
      }

      if (isNewSession) {
        // Retrieve IP-based geolocation coordinates (LGPD aggregate compliance, no direct PII)
        let country = 'Brasil';
        let regionName = 'Desconhecido';
        let city = 'Desconhecido';

        try {
          const fetchGeo = await fetch('https://ip-api.com/json', { signal: AbortSignal.timeout(3000) })
            .then(r => r.json())
            .catch(() => null);
          if (fetchGeo && fetchGeo.status === 'success') {
            country = fetchGeo.country || 'Brasil';
            regionName = fetchGeo.regionName || fetchGeo.region || 'Desconhecido';
            city = fetchGeo.city || 'Desconhecido';
          }
        } catch (geoErr) {
          console.warn("[Analytics] Silently missing location mapping", geoErr);
        }

        const sessionPayload: VisitorSession = {
          id: sessionId,
          device,
          referrer: referral || '',
          source,
          utmSource: utmSource || '',
          utmMedium,
          utmCampaign,
          createdAt: new Date(),
          lastActive: new Date(),
          isAnonymous: !auth.currentUser,
          userId: auth.currentUser?.uid || null,
          country,
          regionName,
          city,
          ipPlaceholder: '★★★.★★★.***' // IP hidden for LGPD
        };

        await setDoc(sessionRef, sessionPayload);
        sessionStorage.setItem('discreta_analytics_session_active', 'true');
      } else {
        // Prevent update storming on navigation
        if (canUpdateSession()) {
          await updateDoc(sessionRef, {
            lastActive: new Date(),
            isAnonymous: !auth.currentUser,
            userId: auth.currentUser?.uid || null
          }).catch(() => null);
        }
      }

      // 2. Track page view logs
      const pvCollection = collection(db, 'page_views');
      const pageViewData: PageView = {
        sessionId,
        path,
        title: title || document.title || 'Página',
        timestamp: new Date()
      };
      await addDoc(pvCollection, pageViewData);

    } catch (err) {
      console.warn("[Analytics] Error tracking access", err);
    }
  },

  // Analytics dashboard aggregations retrieved client-side
  async getAggregatedStats(): Promise<{
    activeOnline: number;
    activeOnlineAnon: number;
    activeOnlineAuth: number;
    sessions: VisitorSession[];
    pageViews: PageView[];
  }> {
    try {
      const sessionsSnap = await getDocs(collection(db, 'visitor_sessions'));
      const pvsSnap = await getDocs(collection(db, 'page_views'));

      const sessions = sessionsSnap.docs.map(doc => {
        const d = doc.data();
        return {
          ...d,
          createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : new Date(d.createdAt),
          lastActive: d.lastActive instanceof Timestamp ? d.lastActive.toDate() : new Date(d.lastActive)
        } as VisitorSession;
      });

      const pageViews = pvsSnap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          timestamp: d.timestamp instanceof Timestamp ? d.timestamp.toDate() : new Date(d.timestamp)
        } as PageView;
      });

      // Filter active users online in the last 5 minutes
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      
      const activeOnlineList = sessions.filter(s => s.lastActive.getTime() > fiveMinutesAgo);
      const activeOnline = activeOnlineList.length;
      const activeOnlineAnon = activeOnlineList.filter(s => s.isAnonymous).length;
      const activeOnlineAuth = activeOnline - activeOnlineAnon;

      return {
        activeOnline,
        activeOnlineAnon,
        activeOnlineAuth,
        sessions,
        pageViews
      };
    } catch (e) {
      console.error("[Analytics] Error aggregation", e);
      return {
        activeOnline: 0,
        activeOnlineAnon: 0,
        activeOnlineAuth: 0,
        sessions: [],
        pageViews: []
      };
    }
  }
};
