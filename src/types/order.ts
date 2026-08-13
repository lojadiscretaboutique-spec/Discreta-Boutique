export type OrderStatus = 
  | 'pending' 
  | 'approved' 
  | 'processing' 
  | 'shipped' 
  | 'delivered' 
  | 'cancelled' 
  | 'refunded'
  | 'concluido'
  | 'cancelado'
  | string;

export type PaymentMethodType = 
  | 'pix' 
  | 'credit_card' 
  | 'debit_card' 
  | 'money' 
  | 'cash' 
  | 'boleto' 
  | 'multiple'
  | string;

export interface OrderItem {
  id?: string;
  productId: string;
  variantId?: string;
  name: string;
  price: number;
  originalPrice?: number;
  costPrice?: number;
  quantity: number;
  imageUrl?: string;
  sku?: string;
  gtin?: string;
  attributes?: Record<string, string>;
  total?: number;
}

export interface OrderCustomerInfo {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  cpf?: string;
}

export interface OrderShippingAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface OrderPaymentDetail {
  method: PaymentMethodType | string;
  amount: number;
  status?: string;
  transactionId?: string;
  installments?: number;
  changeFor?: number;
}

export interface Order {
  id: string;
  code?: string;
  orderNumber?: string;
  userId?: string;

  // Customer info (supports both nested object and root-level fields)
  customer?: OrderCustomerInfo;
  customerName?: string;
  customerWhatsapp?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCpf?: string;
  customerEmail?: string;

  items: OrderItem[];

  subtotal?: number;
  subTotal?: number;
  discountTotal?: number;
  discountCode?: string;
  shippingTotal?: number;
  deliveryFee?: number;
  shipping?: number;
  discount?: number;
  additionalAmount?: number;
  financialReceivedAmount?: number;
  cashEntryAmount?: number;
  change?: number;
  total: number;

  status: OrderStatus;
  paymentMethod?: PaymentMethodType;
  paymentMethodNameSnapshot?: string;
  paymentProvider?: string;
  payments?: OrderPaymentDetail[];
  paymentStatus?: string;

  type?: "online" | "pdv" | string;
  source?: 'online' | 'pdv' | 'whatsapp' | 'live_shop' | string;

  scheduledDate?: string;
  scheduledTime?: string;

  discountAuthorizationId?: string;
  discountAuthorizedBy?: string;
  discountAuthorizedByRole?: string;
  discountReason?: string;
  discountNote?: string;

  shippingAddress?: OrderShippingAddress;
  shippingMethod?: string;
  trackingCode?: string;

  notes?: string;
  cashierId?: string;
  sessionId?: string;

  createdAt: any;
  updatedAt?: any;
}
