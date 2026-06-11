import { doc, setDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface DeliveryLocation {
    orderId: string;
    driverId: string;
    driverName: string;
    latitude: number;
    longitude: number;
    speed: number;
    updatedAt: any;
}

export interface TrackingPoint {
    orderId: string;
    driverId: string;
    latitude: number;
    longitude: number;
    speed: number;
    timestamp: any;
}

export const deliveryTrackingService = {
  async updateDriverLocation(orderId: string, driverId: string, driverName: string, lat: number, lng: number, speed: number) {
    // 1. Update live location
    await setDoc(doc(db, 'delivery_locations', orderId), {
        orderId,
        driverId,
        driverName,
        latitude: lat,
        longitude: lng,
        speed: speed,
        updatedAt: serverTimestamp()
    });

    // 2. Update order directly
    await updateDoc(doc(db, 'orders', orderId), {
        latMotoBoy: lat,
        lngMotoBoy: lng,
        updatedAt: serverTimestamp()
    });
  },

  async logTrackingPoint(orderId: string, driverId: string, lat: number, lng: number, speed: number) {
    await addDoc(collection(db, 'delivery_tracking'), {
        orderId,
        driverId,
        latitude: lat,
        longitude: lng,
        speed: speed,
        timestamp: serverTimestamp()
    });
  }
};
