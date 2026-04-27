import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { auditLogService } from './auditLogService';

export interface State {
    id?: string;
    nome: string;
    sigla: string;
    status: 'ativo' | 'inativo';
    ordem?: number;
    observacoes?: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface City {
    id?: string;
    stateId: string;
    stateName: string;
    nome: string;
    status: 'ativo' | 'inativo';
    ordem?: number;
    observacoes?: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface DeliveryArea {
    id?: string;
    stateId: string;
    stateName: string;
    cityId: string;
    cityName: string;
    bairro: string;
    taxaEntrega: number;
    pedidoMinimo: number;
    tempoEntrega: number; // in minutes
    cepInicial?: string;
    cepFinal?: string;
    freteGratisAcima?: number;
    observacoes?: string;
    status: 'ativo' | 'inativo';
    ordem?: number;
    createdAt?: any;
    updatedAt?: any;
}

export const deliveryAreaService = {
  // STATES
  async listStates(): Promise<State[]> {
    const q = query(collection(db, 'states'), orderBy('ordem', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as State));
  },
  async saveState(data: Partial<State>): Promise<string> {
    const isNew = !data.id;
    const docId = data.id || `ST_${Date.now()}`;
    const ref = doc(db, 'states', docId);
    
    // Check if duplicate abbreviation or name maybe? We assume validation happens before.
    const payload = { ...data, updatedAt: serverTimestamp() } as any;
    delete payload.id;
    
    if (isNew) {
        payload.createdAt = serverTimestamp();
        await setDoc(ref, payload);
        await auditLogService.logAction('Criar', 'areasEntrega', docId, { entidade: 'Estado', nome: data.nome });
    } else {
        await updateDoc(ref, payload);
        await auditLogService.logAction('Editar', 'areasEntrega', docId, { entidade: 'Estado', nome: data.nome });
    }
    return docId;
  },
  async deleteState(id: string): Promise<boolean> {
    // Prevent delete if cities exist
    const q = query(collection(db, 'cities'), where('stateId', '==', id));
    const snap = await getDocs(q);
    if (!snap.empty) {
        throw new Error("Não é possível excluir um estado que possua cidades vinculadas.");
    }
    await deleteDoc(doc(db, 'states', id));
    await auditLogService.logAction('Excluir', 'areasEntrega', id, { entidade: 'Estado' });
    return true;
  },

  // CITIES
  async listCities(stateId?: string): Promise<City[]> {
    let q;
    if (stateId) {
        q = query(collection(db, 'cities'), where('stateId', '==', stateId));
    } else {
        q = query(collection(db, 'cities'), orderBy('nome', 'asc'));
    }
    const snap = await getDocs(q);
    const result = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as City));
    
    // Sort in memory if query filter was used to avoid index requirements
    if (stateId) {
        result.sort((a, b) => a.nome.localeCompare(b.nome));
    }
    return result;
  },
  async saveCity(data: Partial<City>): Promise<string> {
    const isNew = !data.id;
    const docId = data.id || `CT_${Date.now()}`;
    const ref = doc(db, 'cities', docId);
    
    const payload = { ...data, updatedAt: serverTimestamp() } as any;
    delete payload.id;
    
    if (isNew) {
        payload.createdAt = serverTimestamp();
        await setDoc(ref, payload);
        await auditLogService.logAction('Criar', 'areasEntrega', docId, { entidade: 'Cidade', nome: data.nome });
    } else {
        await updateDoc(ref, payload);
        // Cascade update stateName in DeliveryAreas if stateId changed or stateName changed?
        // Let's assume stateId doesn't change, or if it does we skip cascade for now as it's complex for MVP.
        await auditLogService.logAction('Editar', 'areasEntrega', docId, { entidade: 'Cidade', nome: data.nome });
    }
    return docId;
  },
  async deleteCity(id: string): Promise<boolean> {
    // Prevent delete if areas exist
    const q = query(collection(db, 'deliveryAreas'), where('cityId', '==', id));
    const snap = await getDocs(q);
    if (!snap.empty) {
        throw new Error("Não é possível excluir uma cidade que possua bairros vinculados.");
    }
    await deleteDoc(doc(db, 'cities', id));
    await auditLogService.logAction('Excluir', 'areasEntrega', id, { entidade: 'Cidade' });
    return true;
  },

  // DELIVERY AREAS (Bairros)
  async listDeliveryAreas(cityId?: string): Promise<DeliveryArea[]> {
    let q;
    if (cityId) {
        q = query(collection(db, 'deliveryAreas'), where('cityId', '==', cityId));
    } else {
        q = query(collection(db, 'deliveryAreas'), orderBy('bairro', 'asc'));
    }
    const snap = await getDocs(q);
    const result = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryArea));

    if (cityId) {
        result.sort((a, b) => a.bairro.localeCompare(b.bairro));
    }
    return result;
  },
  
  async listActiveDeliveryAreasForCity(cityId: string): Promise<DeliveryArea[]> {
    const q = query(collection(db, 'deliveryAreas'), where('cityId', '==', cityId), where('status', '==', 'ativo'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryArea));
  },

  async saveDeliveryArea(data: Partial<DeliveryArea>): Promise<string> {
    const isNew = !data.id;
    const docId = data.id || `DA_${Date.now()}`;
    const ref = doc(db, 'deliveryAreas', docId);
    
    const payload = { ...data, updatedAt: serverTimestamp() } as any;
    delete payload.id;
    
    if (isNew) {
        // Prevent duplicate neighbourhood in same city
        const qCheck = query(collection(db, 'deliveryAreas'), where('cityId', '==', data.cityId!), where('bairro', '==', data.bairro!));
        const checkSnap = await getDocs(qCheck);
        if (!checkSnap.empty) {
            throw new Error("Já existe um bairro com este nome cadastrado para esta cidade.");
        }

        payload.createdAt = serverTimestamp();
        await setDoc(ref, payload);
        await auditLogService.logAction('Criar', 'areasEntrega', docId, { entidade: 'Bairro', nome: data.bairro });
    } else {
        await updateDoc(ref, payload);
        await auditLogService.logAction('Editar', 'areasEntrega', docId, { entidade: 'Bairro', nome: data.bairro });
    }
    return docId;
  },
  async deleteDeliveryArea(id: string): Promise<boolean> {
    await deleteDoc(doc(db, 'deliveryAreas', id));
    await auditLogService.logAction('Excluir', 'areasEntrega', id, { entidade: 'Bairro' });
    return true;
  }
};
