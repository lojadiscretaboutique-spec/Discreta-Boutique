import { useState, useEffect } from 'react';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { LiveSession } from '../types/liveShop';

export function useActiveLiveShop() {
  const [activeLive, setActiveLive] = useState<LiveSession | null>(null);
  const [scheduledLive, setScheduledLive] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Query for active live (ao_vivo)
    const activeQuery = query(
      collection(db, 'lives'),
      where('status', '==', 'ao_vivo'),
      limit(1)
    );

    // Query for scheduled live (agendada)
    const scheduledQuery = query(
      collection(db, 'lives'),
      where('status', '==', 'agendada'),
      limit(1)
    );

    let activeLoaded = false;
    let scheduledLoaded = false;

    const checkLoading = () => {
      if (activeLoaded && scheduledLoaded) {
        setLoading(false);
      }
    };

    const unsubscribeActive = onSnapshot(
      activeQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const docSnap = snapshot.docs[0];
          setActiveLive({
            id: docSnap.id,
            ...docSnap.data(),
          } as LiveSession);
        } else {
          setActiveLive(null);
        }
        activeLoaded = true;
        checkLoading();
      },
      (error) => {
        console.error('Error listening to active live:', error);
        activeLoaded = true;
        checkLoading();
      }
    );

    const unsubscribeScheduled = onSnapshot(
      scheduledQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const docSnap = snapshot.docs[0];
          setScheduledLive({
            id: docSnap.id,
            ...docSnap.data(),
          } as LiveSession);
        } else {
          setScheduledLive(null);
        }
        scheduledLoaded = true;
        checkLoading();
      },
      (error) => {
        console.error('Error listening to scheduled live:', error);
        scheduledLoaded = true;
        checkLoading();
      }
    );

    return () => {
      unsubscribeActive();
      unsubscribeScheduled();
    };
  }, []);

  return {
    activeLive,
    scheduledLive,
    loading,
    hasLive: activeLive !== null,
  };
}
