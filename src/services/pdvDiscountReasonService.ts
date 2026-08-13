import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  DiscountReasonModel, 
  INITIAL_DISCOUNT_REASONS_SEED 
} from '../types/pdvDiscount';

const COLLECTION_NAME = 'pdvDiscountReasons';

/**
 * Ensures initial discount reasons exist in Firestore.
 * Idempotent: checks by `code` / document ID before writing.
 */
export async function seedDiscountReasons(
  companyId?: string, 
  createdBy: string = 'system'
): Promise<DiscountReasonModel[]> {
  try {
    const existingSnap = await getDocs(collection(db, COLLECTION_NAME));
    const existingCodes = new Set<string>();

    existingSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.code) {
        existingCodes.add(data.code);
      }
    });

    const promises: Promise<void>[] = [];

    for (const seed of INITIAL_DISCOUNT_REASONS_SEED) {
      if (!existingCodes.has(seed.code)) {
        const docId = `reason_${seed.code.toLowerCase()}`;
        const docRef = doc(db, COLLECTION_NAME, docId);
        
        const newReasonData: Omit<DiscountReasonModel, 'id'> = {
          code: seed.code,
          name: seed.name,
          description: seed.description,
          active: true,
          requiresNotes: seed.requiresNotes,
          displayOrder: seed.displayOrder,
          isSystemDefault: true,
          companyId: companyId || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: createdBy || 'system',
        };

        promises.push(setDoc(docRef, newReasonData, { merge: true }));
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    // Re-fetch all reasons after seeding
    return await getDiscountReasons(companyId, false);
  } catch (err) {
    console.error('Erro ao executar seed dos motivos de desconto:', err);
    throw err;
  }
}

/**
 * Fetches discount reasons. Automatically seeds defaults if collection is empty.
 */
export async function getDiscountReasons(
  companyId?: string, 
  onlyActive: boolean = true
): Promise<DiscountReasonModel[]> {
  try {
    const snap = await getDocs(collection(db, COLLECTION_NAME));

    if (snap.empty) {
      return await seedDiscountReasons(companyId);
    }

    let list: DiscountReasonModel[] = snap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        code: data.code || docSnap.id,
        name: data.name || 'Sem nome',
        description: data.description || '',
        active: data.active !== false,
        requiresNotes: Boolean(data.requiresNotes),
        displayOrder: typeof data.displayOrder === 'number' ? data.displayOrder : 99,
        isSystemDefault: Boolean(data.isSystemDefault),
        companyId: data.companyId || undefined,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        createdBy: data.createdBy || 'sistema',
      };
    });

    // Check if any default codes are missing in existing data and insert them idempotently
    const currentCodes = new Set(list.map((r) => r.code));
    const missingSeeds = INITIAL_DISCOUNT_REASONS_SEED.filter((s) => !currentCodes.has(s.code));

    if (missingSeeds.length > 0) {
      await seedDiscountReasons(companyId);
      const reSnap = await getDocs(collection(db, COLLECTION_NAME));
      list = reSnap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          code: data.code || docSnap.id,
          name: data.name || 'Sem nome',
          description: data.description || '',
          active: data.active !== false,
          requiresNotes: Boolean(data.requiresNotes),
          displayOrder: typeof data.displayOrder === 'number' ? data.displayOrder : 99,
          isSystemDefault: Boolean(data.isSystemDefault),
          companyId: data.companyId || undefined,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          createdBy: data.createdBy || 'sistema',
        };
      });
    }

    if (onlyActive) {
      list = list.filter((item) => item.active);
    }

    // Filter by companyId if specified and reasons have companyId
    if (companyId) {
      list = list.filter((item) => !item.companyId || item.companyId === companyId);
    }

    // Order by displayOrder
    list.sort((a, b) => a.displayOrder - b.displayOrder);

    return list;
  } catch (err) {
    console.error('Erro ao buscar motivos de desconto:', err);
    // Fallback in-memory list if Firebase fails
    return INITIAL_DISCOUNT_REASONS_SEED.map((seed, idx) => ({
      id: `fallback_${seed.code}`,
      code: seed.code,
      name: seed.name,
      description: seed.description,
      active: true,
      requiresNotes: seed.requiresNotes,
      displayOrder: seed.displayOrder,
      isSystemDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'fallback',
    }));
  }
}

/**
 * Creates a new custom discount reason.
 */
export async function createDiscountReason(
  reasonData: Omit<DiscountReasonModel, 'id' | 'createdAt' | 'updatedAt'>,
  createdBy: string = 'admin'
): Promise<DiscountReasonModel> {
  const code = (reasonData.code || reasonData.name)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '_');

  const docId = `reason_custom_${Date.now()}`;
  const docRef = doc(db, COLLECTION_NAME, docId);

  const newReason: DiscountReasonModel = {
    id: docId,
    code,
    name: reasonData.name.trim(),
    description: (reasonData.description || '').trim(),
    active: reasonData.active !== false,
    requiresNotes: Boolean(reasonData.requiresNotes),
    displayOrder: typeof reasonData.displayOrder === 'number' ? reasonData.displayOrder : 99,
    isSystemDefault: false,
    companyId: reasonData.companyId || undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy,
  };

  await setDoc(docRef, newReason);
  return newReason;
}

/**
 * Updates an existing discount reason (name, description, active, requiresNotes, displayOrder).
 */
export async function updateDiscountReason(
  id: string,
  updates: Partial<DiscountReasonModel>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const dataToUpdate: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  };

  if (updates.name !== undefined) dataToUpdate.name = updates.name.trim();
  if (updates.description !== undefined) dataToUpdate.description = updates.description.trim();
  if (updates.active !== undefined) dataToUpdate.active = Boolean(updates.active);
  if (updates.requiresNotes !== undefined) dataToUpdate.requiresNotes = Boolean(updates.requiresNotes);
  if (updates.displayOrder !== undefined) dataToUpdate.displayOrder = Number(updates.displayOrder);

  await updateDoc(docRef, dataToUpdate);
}

/**
 * Toggles the active status of a discount reason.
 */
export async function toggleDiscountReasonActive(
  id: string, 
  active: boolean
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    active: Boolean(active),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Deletes or deactivates a discount reason safely.
 * Checks whether reason was used in orders or authorizations.
 */
export async function safeDeleteDiscountReason(
  reason: DiscountReasonModel
): Promise<{ success: boolean; deactivatedOnly: boolean; message: string }> {
  try {
    // 1. System default reasons or reasons with usage should not be physically deleted
    let hasUsage = reason.isSystemDefault;

    if (!hasUsage) {
      // Check in orders collection if any order used this reason
      const ordersQ = query(
        collection(db, 'orders'),
        where('discountReason', '==', reason.name)
      );
      const ordersSnap = await getDocs(ordersQ);
      if (!ordersSnap.empty) {
        hasUsage = true;
      }
    }

    if (!hasUsage) {
      // Check in authorizations collection
      const authQ = query(
        collection(db, 'pdvDiscountAuthorizations'),
        where('motivo', '==', reason.name)
      );
      const authSnap = await getDocs(authQ);
      if (!authSnap.empty) {
        hasUsage = true;
      }
    }

    if (hasUsage) {
      // Deactivate instead of deleting
      await toggleDiscountReasonActive(reason.id, false);
      return {
        success: true,
        deactivatedOnly: true,
        message: `O motivo "${reason.name}" já foi utilizado ou é padrão do sistema. Ele foi desativado para preservar os históricos de vendas.`,
      };
    }

    // Unused custom reason -> delete document
    const docRef = doc(db, COLLECTION_NAME, reason.id);
    await deleteDoc(docRef);
    return {
      success: true,
      deactivatedOnly: false,
      message: `Motivo "${reason.name}" excluído com sucesso.`,
    };
  } catch (err) {
    console.error('Erro ao excluir/desativar motivo de desconto:', err);
    throw err;
  }
}
