import { collection, query, where, getDocs, Timestamp, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { productService } from './productService';

export interface StockRisk {
  productId: string;
  name: string;
  currentStock: number;
  calculatedMinStock: number;
  averageDailySales: number;
  status: 'critical' | 'alert' | 'healthy';
  variantInfo?: string;
}

export interface SmartStockReport {
  criticalItems: StockRisk[];
  alertItems: StockRisk[];
  healthyItems: StockRisk[];
  totalAnalysis: number;
}

export const smartStockService = {
  /**
   * Calculates the ideal minimum stock for a product based on sales history.
   * Logic: (Avg Sales per Day * Lead Time) + Safety Stock
   */
  async calculateProductSmartStock(productId: string, daysLookback: number = 30): Promise<{
    minStock: number;
    avgDaily: number;
  }> {
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - daysLookback);

    // Query orders that contain this product
    // Note: We'll query all orders in the period and filter in memory to avoid complex indexes for now, 
    // unless the store has massive volume. For smarter retail, we'd use a dedicated sales_stats collection.
    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      orderBy('createdAt', 'desc')
    );

    const snap = await getDocs(q);
    let totalSold = 0;

    snap.docs.forEach(doc => {
      const order = doc.data();
      const items = order.items || [];
      items.forEach((item: any) => {
        if (item.productId === productId) {
          totalSold += (item.quantity || 0);
        }
      });
    });

    const avgDaily = totalSold / daysLookback;
    
    // Retail Standards:
    // Lead Time: 7 days (time to get new items)
    // Safety Factor: 1.5 (50% buffer for peaks)
    const leadTime = 7;
    const safetyFactor = 1.5;

    const calculatedMin = Math.ceil(avgDaily * leadTime * safetyFactor);
    
    // Floor of 1 if there were any sales
    return {
      minStock: totalSold > 0 ? Math.max(1, calculatedMin) : 0,
      avgDaily
    };
  },

  async generateStockRiskReport(daysLookback: number = 30): Promise<SmartStockReport> {
    const products = await productService.listProducts();
    const report: SmartStockReport = {
      criticalItems: [],
      alertItems: [],
      healthyItems: [],
      totalAnalysis: products.length
    };

    // To improve performance, we fetch ALL orders once
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - daysLookback);
    
    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('createdAt', '>=', Timestamp.fromDate(startDate))
    );
    const orderSnap = await getDocs(q);
    
    // Map of productId -> totalQty
    const salesMap = new Map<string, number>();
    orderSnap.docs.forEach(doc => {
      const order = doc.data();
      (order.items || []).forEach((item: any) => {
        const current = salesMap.get(item.productId) || 0;
        salesMap.set(item.productId, current + (item.quantity || 0));
      });
    });

    const leadTime = 7;
    const safetyFactor = 1.5;

    for (const prod of products) {
      if (!prod.controlStock) continue;

      const totalSold = salesMap.get(prod.id!) || 0;
      const avgDaily = totalSold / daysLookback;
      const calculatedMin = Math.ceil(avgDaily * leadTime * safetyFactor);
      
      const risk: StockRisk = {
        productId: prod.id!,
        name: prod.name,
        currentStock: prod.stock,
        calculatedMinStock: totalSold > 0 ? Math.max(1, calculatedMin) : (prod.minStock || 0),
        averageDailySales: avgDaily,
        status: 'healthy'
      };

      if (risk.currentStock <= 0) {
        risk.status = 'critical';
        report.criticalItems.push(risk);
      } else if (risk.currentStock <= risk.calculatedMinStock) {
        risk.status = 'alert';
        report.alertItems.push(risk);
      } else {
        report.healthyItems.push(risk);
      }
    }

    return report;
  },

  /**
   * Recalculates and updates the minStock field for a product automatically.
   */
  async updateProductSmartMinStock(productId: string): Promise<void> {
    try {
      const { minStock } = await this.calculateProductSmartStock(productId);
      
      // Update the product document
      const productRef = doc(db, 'products', productId);
      await updateDoc(productRef, {
        minStock: minStock,
        updatedAt: serverTimestamp()
      });
      
      console.log(`[SmartStock] Auto-updated minStock for ${productId} to ${minStock}`);
    } catch (error) {
      console.error(`[SmartStock] Error auto-updating minStock for ${productId}:`, error);
    }
  }
};
