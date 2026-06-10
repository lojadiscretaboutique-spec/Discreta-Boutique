export interface DeliveryDriver {
  id: string; // matches user uid
  name: string;
  phone: string;
  status: 'active' | 'inactive' | 'delivering';
  vehicle?: string; // e.g., 'Moto', 'Carro'
  licensePlate?: string;
  updatedAt?: any;
}

export interface DeliveryLocation {
  orderId: string;
  driverId: string;
  driverName: string;
  latitude: number;
  longitude: number;
  speed: number;
  updatedAt: any;
}

export interface DeliveryTrackingPoint {
  id?: string;
  orderId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  speed: number;
  timestamp: any;
}

export interface DeliveryPayment {
  orderId: string;
  driverId: string;
  method: 'money' | 'pix' | 'debit' | 'credit';
  amount: number;
  details: {
    changeFor?: number; // Troco para quanto
    pixConfirmed?: boolean;
    cardBrand?: string; // Bandeira do cartão
  };
  createdAt: any;
}

export interface DeliveryProof {
  orderId: string;
  driverId: string;
  signature?: string; // base64-encoded png dataURL
  photo?: string; // base64-encoded jpeg dataURL
  receiverName: string;
  gps: {
    latitude: number;
    longitude: number;
  };
  createdAt: any;
}
