import { doc, getDoc, getDocs, collection, DocumentReference, DocumentSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface ResolvedVariant {
  ref: DocumentReference;
  snap: DocumentSnapshot;
  variantId: string;
  variantData: any;
}

/**
 * Resolves a product variant document robustly.
 * Handles cases where variantId is the actual Firestore doc ID, an SKU, a barcode,
 * a variant name, or an old variant ID that changed after product edits.
 */
export async function resolveVariantDoc(
  productId: string,
  variantId?: string,
  variantName?: string,
  sku?: string
): Promise<ResolvedVariant | null> {
  if (!productId) return null;

  const variantsCol = collection(db, `products/${productId}/variants`);

  // 1. Direct fetch if variantId is provided
  if (variantId) {
    try {
      const directRef = doc(db, `products/${productId}/variants/${variantId}`);
      const directSnap = await getDoc(directRef);
      if (directSnap.exists()) {
        return {
          ref: directRef,
          snap: directSnap,
          variantId: directSnap.id,
          variantData: directSnap.data()
        };
      }
    } catch (e) {
      console.warn(`[resolveVariantDoc] Direct fetch for variant ${variantId} failed, scanning subcollection...`, e);
    }
  }

  // 2. Scan variants subcollection for best match
  try {
    const vSnap = await getDocs(variantsCol);
    if (vSnap.empty) return null;

    const normVariantId = variantId?.toLowerCase().trim();
    const normVariantName = variantName?.toLowerCase().trim();
    const normSku = sku?.toLowerCase().trim();

    // First pass: exact SKU or Barcode or Doc ID match
    for (const d of vSnap.docs) {
      const data = d.data();
      const docId = d.id.toLowerCase().trim();
      const vSku = data.sku ? String(data.sku).toLowerCase().trim() : '';
      const vBarcode = data.barcode ? String(data.barcode).toLowerCase().trim() : '';

      if (normVariantId && (docId === normVariantId || data.id === normVariantId)) {
        return { ref: d.ref, snap: d, variantId: d.id, variantData: data };
      }
      if (normSku && (vSku === normSku || vBarcode === normSku)) {
        return { ref: d.ref, snap: d, variantId: d.id, variantData: data };
      }
      if (normVariantId && (vSku === normVariantId || vBarcode === normVariantId)) {
        return { ref: d.ref, snap: d, variantId: d.id, variantData: data };
      }
    }

    // Second pass: Name match
    for (const d of vSnap.docs) {
      const data = d.data();
      const vName = data.name ? String(data.name).toLowerCase().trim() : '';

      if (normVariantName && vName && (vName === normVariantName || vName.includes(normVariantName) || normVariantName.includes(vName))) {
        return { ref: d.ref, snap: d, variantId: d.id, variantData: data };
      }
      if (normVariantId && vName && (vName === normVariantId || vName.includes(normVariantId) || normVariantId.includes(vName))) {
        return { ref: d.ref, snap: d, variantId: d.id, variantData: data };
      }
    }

    // Fallback: If there is only 1 variant in the subcollection, use it
    if (vSnap.docs.length === 1) {
      const singleDoc = vSnap.docs[0];
      return { ref: singleDoc.ref, snap: singleDoc, variantId: singleDoc.id, variantData: singleDoc.data() };
    }
  } catch (err) {
    console.error("Error searching variants subcollection:", err);
  }

  return null;
}
