import { useState, useEffect, useCallback } from 'react';
import { marketingService } from './marketingService';
import { 
  MktCampaign, 
  MktTask, 
  MktInfluencer, 
  MktAffiliateCampaign, 
  MktPromotion, 
  MktGiveaway, 
  MktContentItem, 
  MktAlert, 
  MktWhatsAppShot 
} from './marketingTypes';

export function useMarketingData() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<MktCampaign[]>([]);
  const [tasks, setTasks] = useState<MktTask[]>([]);
  const [influencers, setInfluencers] = useState<MktInfluencer[]>([]);
  const [affiliates, setAffiliates] = useState<MktAffiliateCampaign[]>([]);
  const [promotions, setPromotions] = useState<MktPromotion[]>([]);
  const [giveaways, setGiveaways] = useState<MktGiveaway[]>([]);
  const [contentItems, setContentItems] = useState<MktContentItem[]>([]);
  const [alerts, setAlerts] = useState<MktAlert[]>([]);
  const [whatsAppShots, setWhatsAppShots] = useState<MktWhatsAppShot[]>([]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Seed Check
      await marketingService.checkAndSeedData();

      // 2. Load all concurrently
      const [
        loadedCmp,
        loadedTasks,
        loadedInf,
        loadedAff,
        loadedPromos,
        loadedGiv,
        loadedContent,
        loadedAlerts,
        loadedShots
      ] = await Promise.all([
        marketingService.getCampaigns(),
        marketingService.getTasks(),
        marketingService.getInfluencers(),
        marketingService.getAffiliateCampaigns(),
        marketingService.getPromotions(),
        marketingService.getGiveaways(),
        marketingService.getContentItems(),
        marketingService.getAlerts(),
        marketingService.getWhatsAppShots()
      ]);

      setCampaigns(loadedCmp);
      setTasks(loadedTasks);
      setInfluencers(loadedInf);
      setAffiliates(loadedAff);
      setPromotions(loadedPromos);
      setGiveaways(loadedGiv);
      setContentItems(loadedContent);
      setAlerts(loadedAlerts);
      setWhatsAppShots(loadedShots);
    } catch (err) {
      console.error('[useMarketingData] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Tasks mutation helpers
  const moveTask = async (taskId: string, targetCol: MktTask['column']) => {
    // 1. Pessimistic state update
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedTask = { 
      ...task, 
      column: targetCol, 
      updatedAt: new Date().toISOString() 
    } as MktTask;
    
    // Add history item
    updatedTask.history = [
      {
        id: Math.random().toString(),
        action: `Coluna alterada para "${targetCol.toUpperCase().replace(/-/g, ' ')}"`,
        userName: 'Gestor Discreta',
        createdAt: new Date().toISOString()
      },
      ...updatedTask.history
    ];

    setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
    await marketingService.saveTask(updatedTask);
  };

  const saveTask = async (updatedTask: MktTask) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    await marketingService.saveTask(updatedTask);
  };

  const createTask = async (newTaskData: Omit<MktTask, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = await marketingService.createTask(newTaskData);
    const fullTask: MktTask = {
      ...newTaskData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setTasks(prev => [...prev, fullTask]);
    return id;
  };

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await marketingService.deleteTask(id);
  };

  const addCommentToTask = async (taskId: string, text: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newComment = {
      id: Math.random().toString(36).substring(7),
      userName: 'Gestor Discreta',
      text,
      createdAt: new Date().toISOString()
    };

    const updatedTask: MktTask = {
      ...task,
      comments: [...task.comments, newComment],
      history: [
        {
          id: Math.random().toString(),
          action: "Novo comentário adicionado",
          userName: 'Gestor Discreta',
          createdAt: new Date().toISOString()
        },
        ...task.history
      ],
      updatedAt: new Date().toISOString()
    };

    setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
    await marketingService.saveTask(updatedTask);
  };

  const updateChecklistItem = async (taskId: string, itemId: string, completed: boolean) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedChecklist = task.checklist.map(item => 
      item.id === itemId ? { ...item, completed } : item
    );

    const updatedTask: MktTask = {
      ...task,
      checklist: updatedChecklist,
      updatedAt: new Date().toISOString()
    };

    setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
    await marketingService.saveTask(updatedTask);
  };

  const addChecklistItem = async (taskId: string, text: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newItem = {
      id: Math.random().toString(36).substring(7),
      text,
      completed: false
    };

    const updatedTask: MktTask = {
      ...task,
      checklist: [...task.checklist, newItem],
      updatedAt: new Date().toISOString()
    };

    setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
    await marketingService.saveTask(updatedTask);
  };

  // Influencers CRM helpers
  const saveInfluencer = async (inf: MktInfluencer) => {
    setInfluencers(prev => prev.map(i => i.id === inf.id ? inf : i));
    await marketingService.saveInfluencer(inf);
  };

  const createInfluencer = async (inf: Omit<MktInfluencer, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = await marketingService.createInfluencer(inf);
    const fullInf: MktInfluencer = {
      ...inf,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setInfluencers(prev => [...prev, fullInf]);
    return id;
  };

  const deleteInfluencer = async (id: string) => {
    setInfluencers(prev => prev.filter(i => i.id !== id));
    await marketingService.deleteInfluencer(id);
  };

  // WhatsApp helper
  const createWhatsAppShot = async (shot: Omit<MktWhatsAppShot, 'id'>) => {
    const id = await marketingService.createWhatsAppShot(shot);
    const fullShot: MktWhatsAppShot = { ...shot, id };
    setWhatsAppShots(prev => [...prev, fullShot]);
    return id;
  };

  const saveWhatsAppShot = async (shot: MktWhatsAppShot) => {
    setWhatsAppShots(prev => prev.map(s => s.id === shot.id ? shot : s));
    await marketingService.saveWhatsAppShot(shot);
  };

  const deleteWhatsAppShot = async (id: string) => {
    setWhatsAppShots(prev => prev.filter(s => s.id !== id));
    await marketingService.deleteWhatsAppShot(id);
  };

  // Promotions helper
  const createPromotion = async (promo: Omit<MktPromotion, 'id'>) => {
    const id = await marketingService.createPromotion(promo);
    const fullPromo: MktPromotion = { ...promo, id };
    setPromotions(prev => [...prev, fullPromo]);
    return id;
  };

  const deletePromotion = async (id: string) => {
    setPromotions(prev => prev.filter(p => p.id !== id));
    await marketingService.deletePromotion(id);
  };

  // Giveaways helper
  const createGiveaway = async (give: Omit<MktGiveaway, 'id'>) => {
    const id = await marketingService.createGiveaway(give);
    const fullGive: MktGiveaway = { ...give, id };
    setGiveaways(prev => [...prev, fullGive]);
    return id;
  };

  const deleteGiveaway = async (id: string) => {
    setGiveaways(prev => prev.filter(g => g.id !== id));
    await marketingService.deleteGiveaway(id);
  };

  // Affiliates helpers
  const createAffiliateCampaign = async (cmp: Omit<MktAffiliateCampaign, 'id' | 'createdAt'>) => {
    const id = 'aff_' + Math.random().toString(36).substring(2, 11);
    const fullCmp: MktAffiliateCampaign = {
      ...cmp,
      id,
      createdAt: new Date().toISOString()
    };
    setAffiliates(prev => [...prev, fullCmp]);
    await marketingService.createAffiliateCampaign(fullCmp);
    return id;
  };

  const deleteAffiliateCampaign = async (id: string) => {
    setAffiliates(prev => prev.filter(c => c.id !== id));
    await marketingService.deleteAffiliateCampaign(id);
  };

  const saveAffiliateCampaign = async (cmp: MktAffiliateCampaign) => {
    setAffiliates(prev => prev.map(c => c.id === cmp.id ? cmp : c));
    await marketingService.saveAffiliateCampaign(cmp);
  };

  // Content Library helpers
  const saveContentItem = async (ci: MktContentItem) => {
    setContentItems(prev => prev.map(item => item.id === ci.id ? ci : item));
    await marketingService.saveContentItem(ci);
  };

  const createContentItem = async (ci: Omit<MktContentItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = await marketingService.createContentItem(ci);
    const fullCI: MktContentItem = {
      ...ci,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setContentItems(prev => [...prev, fullCI]);
    return id;
  };

  const deleteContentItem = async (id: string) => {
    setContentItems(prev => prev.filter(item => item.id !== id));
    await marketingService.deleteContentItem(id);
  };

  // Alerts automation helpers
  const dismissAlert = async (id: string) => {
    setAlerts(prev => prev.map(al => al.id === id ? { ...al, read: true } : al));
    await marketingService.markAlertAsRead(id);
  };

  const saveCampaign = async (cmp: MktCampaign) => {
    setCampaigns(prev => prev.map(c => c.id === cmp.id ? cmp : c));
    await marketingService.saveCampaign(cmp);
  };

  const createCampaign = async (cmp: Omit<MktCampaign, 'id' | 'createdAt' | 'updatedAt'>) => {
    const randomId = 'cmp_' + Math.random().toString(36).substring(2, 11);
    const fullCmp: MktCampaign = {
      ...cmp,
      id: randomId,
      salesCurrent: cmp.salesCurrent || 0,
      followersCurrent: cmp.followersCurrent || 0,
      visitsCurrent: cmp.visitsCurrent || 0,
      whatsappLeadsCurrent: cmp.whatsappLeadsCurrent || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setCampaigns(prev => [...prev, fullCmp]);
    await marketingService.saveCampaign(fullCmp);
    return randomId;
  };

  const deleteCampaign = async (id: string) => {
    setCampaigns(prev => prev.filter(c => c.id !== id));
    await marketingService.deleteCampaign(id);
  };

  const wipeAllData = async () => {
    setLoading(true);
    try {
      await marketingService.wipeAllMarketingData();
      setCampaigns([]);
      setTasks([]);
      setInfluencers([]);
      setAffiliates([]);
      setPromotions([]);
      setGiveaways([]);
      setContentItems([]);
      setAlerts([]);
      setWhatsAppShots([]);
    } catch (err) {
      console.error('[marketingHook] Failed to wipe all data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDemoData = async () => {
    setLoading(true);
    try {
      await marketingService.checkAndSeedData(true);
      await loadAllData();
    } catch (err) {
      console.error('[marketingHook] Failed to load demo data:', err);
      setLoading(false);
    }
  };

  return {
    loading,
    campaigns,
    tasks,
    influencers,
    affiliates,
    promotions,
    giveaways,
    contentItems,
    alerts,
    whatsAppShots,
    
    // Mutations
    moveTask,
    saveTask,
    createTask,
    deleteTask,
    addCommentToTask,
    updateChecklistItem,
    addChecklistItem,
    
    saveInfluencer,
    createInfluencer,
    deleteInfluencer,

    createWhatsAppShot,
    saveWhatsAppShot,
    deleteWhatsAppShot,

    createPromotion,
    deletePromotion,

    createGiveaway,
    deleteGiveaway,

    createAffiliateCampaign,
    deleteAffiliateCampaign,
    saveAffiliateCampaign,

    saveContentItem,
    createContentItem,
    deleteContentItem,

    dismissAlert,
    saveCampaign,
    createCampaign,
    deleteCampaign,
    wipeAllData,
    loadDemoData,
    reload: loadAllData
  };
}
