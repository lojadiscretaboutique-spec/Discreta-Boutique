import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  ShoppingCart,
  Trash2,
  Minus,
  Plus,
  CreditCard,
  Banknote,
  QrCode,
  X,
  Package,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Hash,
  Clock,
  Wallet,
  FileText,
  Loader2,
  Printer,
} from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  addDoc,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Button } from "../../components/ui/button";
import {
  cn,
  formatCurrency,
  roundTo2,
  formatVariantName,
} from "../../lib/utils";
import { useFeedback } from "../../contexts/FeedbackContext";
import { useAuthStore } from "../../store/authStore";
import { Product, ProductVariant } from "../../services/productService";
import { Customer } from "../../services/customerService";
import { stockMovementService } from "../../services/stockMovementService";
import { cashService, CashSession } from "../../services/cashService";
import { financialService } from "../../services/financialService";
import { pdvFinancialService } from "../../services/pdvFinancialService";
import { comboService, Combo } from "../../services/comboService";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate, useSearchParams } from "react-router-dom";

interface CartItem {
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  isCombo?: boolean;
  comboId?: string;
  price: number;
  costPrice: number;
  quantity: number;
  sku: string;
  gtin?: string;
  imageUrl?: string;
  discount?: number;
}

// Utility for POS beep sound
const playBeep = () => {
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
  } catch (e) {
    // Ignore
  }
};

const formatCustomerAddress = (cust: any) => {
  if (!cust) return "";
  const end = cust.endereco;
  if (!end) {
    return cust.customerAddress || "";
  }
  if (typeof end === "string") {
    return end;
  }
  const parts = [];
  if (end.rua) parts.push(end.rua);
  if (end.numero) parts.push(`Nº ${end.numero}`);
  if (end.complemento) parts.push(end.complemento);
  if (end.bairro) parts.push(end.bairro);
  if (end.cidade) parts.push(end.cidade);
  if (end.estado) parts.push(end.estado);
  if (end.referencia) parts.push(`(Ref: ${end.referencia})`);
  return parts.join(", ");
};

const formatOrderDate = (date: any) => {
  if (!date) return "";
  try {
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return "";
  }
};

export function AdminPDV() {
  const { user, hasPermission } = useAuthStore();
  const { toast } = useFeedback();
  const navigate = useNavigate();

  const canPDV =
    hasPermission("caixa", "visualizar") || hasPermission("orders", "criar");

  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [comboResults, setComboResults] = useState<Combo[]>([]);
  const [searching, setSearching] = useState(false);
  const [allCombos, setAllCombos] = useState<Combo[]>([]);

  const [searchParams, setSearchParams] = useSearchParams();
  const editingOrderId = searchParams.get("orderId");
  const addComboId = searchParams.get("addCombo");

  useEffect(() => {
    const loadCombos = async () => {
      try {
        const data = await comboService.listCombos();
        setAllCombos(data.filter(c => c.active));
      } catch (error) {
        console.error("Error loading combos:", error);
      }
    };
    loadCombos();
  }, []);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [modalVariants, setModalVariants] = useState<ProductVariant[]>([]);
  const [notes, setNotes] = useState("");
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [stockWarningModal, setStockWarningModal] = useState<{
    productName: string;
    stock: number;
  } | null>(null);

  const cartSubtotal = roundTo2(
    cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
  );
  const itemsDiscountTotal = roundTo2(
    cart.reduce((sum, item) => sum + (item.discount || 0), 0),
  );

  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [customerNotFound, setCustomerNotFound] = useState(false);
  const [isRegisteringCustomer, setIsRegisteringCustomer] = useState(false);

  // States/Cities/Areas for Customer Registration
  const [availableStates, setAvailableStates] = useState<
    { id?: string; nome: string; sigla: string }[]
  >([]);
  const [availableCities, setAvailableCities] = useState<
    { id?: string; nome: string }[]
  >([]);
  const [availableNeighborhoods, setAvailableNeighborhoods] = useState<
    { id?: string; bairro: string }[]
  >([]);

  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({
    nome: "",
    whatsapp: "",
    dataNascimento: "",
    status: "ativo",
    endereco: {
      estado: "",
      cidade: "",
      bairro: "",
      rua: "",
      numero: "",
      complemento: "",
      referencia: "",
    },
  });

  // Checkout state
  const [step, setStep] = useState<"cart" | "payment" | "success">("cart");
  const [saveAsNewOrder, setSaveAsNewOrder] = useState(false);
  const [activeTab, setActiveTab] = useState<"pdv" | "customer">("pdv");
  const [payments, setPayments] = useState<
    { method: string; amount: number }[]
  >([]);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState("");
  const [lastFinishedOrder, setLastFinishedOrder] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [lastOrderId, setLastOrderId] = useState("");
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'value' | 'percent'>('value');
  const [discountBase, setDiscountBase] = useState<number>(0);
  const [shipping, setShipping] = useState<number>(0);
  const [partialAmount, setPartialAmount] = useState<string>("");
  const [isDelivery, setIsDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const resetPDV = useCallback((targetStep: "cart" | "payment" | "success" = "cart") => {
    setCart([]);
    setSelectedCustomer(null);
    setPayments([]);
    setPaymentMethod("");
    setReceivedAmount("");
    setGlobalDiscount(0);
    setDiscountBase(0);
    setDiscountType('value');
    setShipping(0);
    setNotes("");
    setSearchTerm("");
    setSearchResults([]);
    setSaveAsNewOrder(false);
    setIsDelivery(false);
    setDeliveryAddress("");
    setStep(targetStep);
    setSearchParams({});
  }, [setSearchParams]);

  useEffect(() => {
    if (selectedCustomer) {
      const formatted = formatCustomerAddress(selectedCustomer);
      setDeliveryAddress(formatted);
    } else {
      setDeliveryAddress("");
    }
  }, [selectedCustomer]);

  useEffect(() => {
      if (discountType === 'value') {
        setGlobalDiscount(discountBase);
      } else {
        setGlobalDiscount(cartSubtotal > 0 ? roundTo2((cartSubtotal * discountBase) / 100) : 0);
      }
    }, [discountType, discountBase, cartSubtotal]);
  const [editingOrderType, setEditingOrderType] = useState<string | null>(null);
  const [showMobileCart, setShowMobileCart] = useState(false);

  const [currentSession, setCurrentSession] = useState<CashSession | null>(
    null,
  );
  const [checkingSession, setCheckingSession] = useState(true);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check for open session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await cashService.getCurrentSession();
        setCurrentSession(session);
      } catch (err) {
        console.error("Erro ao verificar sessão do caixa:", err);
      } finally {
        setCheckingSession(false);
      }
    };
    checkSession();
  }, []);

  // Load order for editing
  useEffect(() => {
    if (editingOrderId) {
      const loadOrder = async () => {
        try {
          const docRef = doc(db, "orders", editingOrderId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            setEditingOrderType(data.type || "pdv");

            // Set cart
            const loadedCart: CartItem[] = data.items.map((item: any) => ({
              productId: item.productId,
              variantId: item.variantId || undefined,
              name: item.name,
              variantName: item.variantName || undefined,
              price: item.price,
              costPrice: item.costPrice || 0,
              quantity: item.quantity,
              sku: item.sku || "",
              discount: item.discount || 0,
            }));
            setCart(loadedCart);

            // Set Customer
            if (data.customerId) {
              const custSnap = await getDoc(
                doc(db, "customers", data.customerId),
              );
              if (custSnap.exists()) {
                setSelectedCustomer({
                  id: custSnap.id,
                  ...custSnap.data(),
                } as Customer);
              }
            } else if (data.customerName) {
              setSelectedCustomer({
                id: "",
                nome: data.customerName,
                whatsapp: data.customerWhatsapp || "",
                status: "ativo",
                endereco: { rua: data.customerAddress || "" },
              } as any);
            }

            // Set global discount if total differs from subtotal - item discounts + shipping
            const subtotal = loadedCart.reduce(
              (acc, item) => acc + item.price * item.quantity,
              0,
            );
            const itemsDisc = loadedCart.reduce(
              (acc, item) => acc + (item.discount || 0),
              0,
            );
            const shippingVal = data.shipping || data.deliveryFee || 0;
            setShipping(shippingVal);

            const calculatedTotal = subtotal - itemsDisc + shippingVal;

            if (Math.abs(data.total - calculatedTotal) > 0.01) {
              setGlobalDiscount(Math.max(0, calculatedTotal - data.total));
            }

            // Set Payments
            if (data.payments && Array.isArray(data.payments)) {
              setPayments(data.payments);
            } else if (data.paymentMethod) {
              setPayments([{ method: data.paymentMethod, amount: data.total }]);
            }

            if (data.notes) {
              setNotes(data.notes);
            }
            if (data.status === "NOVO") {
              setSaveAsNewOrder(true);
            } else {
              setSaveAsNewOrder(false);
            }
            toast("Resumo do pedido carregado para edição.");
          } else {
            toast("Pedido não encontrado.", "error");
            navigate("/admin/pedidos");
          }
        } catch (err) {
          console.error(err);
          toast("Erro ao carregar pedido.", "error");
        }
      };
      loadOrder();
    }
  }, [editingOrderId, navigate, toast]);

  // Focus search input on mount
  useEffect(() => {
    if (searchInputRef.current && activeTab === "pdv")
      searchInputRef.current.focus();
  }, [activeTab]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5") {
        e.preventDefault();
        if (cart.length > 0 && step === "cart") setStep("payment");
      }
      if (e.key === "F2") {
        e.preventDefault();
        resetPDV();
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === "Escape" && step === "cart") {
        setSearchTerm("");
        setSearchResults([]);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart.length, step, resetPDV]);

  // Load delivery areas data when customer tab is active
  useEffect(() => {
    if (activeTab === "customer") {
      import("../../services/deliveryAreaService")
        .then(({ deliveryAreaService }) => {
          deliveryAreaService
            .listStates()
            .then(setAvailableStates)
            .catch(console.error);
          deliveryAreaService
            .listCities()
            .then(setAvailableCities)
            .catch(console.error);
          deliveryAreaService
            .listDeliveryAreas()
            .then(setAvailableNeighborhoods)
            .catch(console.error);
        })
        .catch(console.error);
    }
  }, [activeTab]);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (!term) return;

    const lowerTerm = term.toLowerCase();
    // 0. Buscar por Combos (Exato ou SKU gerado)
    const exactCombo = allCombos.find(c => 
      c.name.toLowerCase() === lowerTerm || 
      `combo-${c.id?.slice(-6).toUpperCase()}`.toLowerCase() === lowerTerm ||
      (c.gtin && c.gtin.toLowerCase() === lowerTerm) ||
      (c.sku && c.sku.toLowerCase() === lowerTerm)
    );
    if (exactCombo) {
      addComboToCart(exactCombo);
      return;
    }

    setSearching(true);
    try {
      const productsRef = collection(db, "products");
      let exactMatches: Product[] = [];
      const upperTerm = term.toUpperCase();
      const termsToSearch = Array.from(new Set([term, upperTerm]));

      // 1. Check SKU (exact or uppercase) in products
      let q = query(productsRef, where("sku", "in", termsToSearch), limit(1));
      let snap = await getDocs(q);

      if (snap.empty) {
        // 2. Check Barcode / GTIN in products
        q = query(productsRef, where("gtin", "==", term), limit(1));
        snap = await getDocs(q);
      }

      if (!snap.empty) {
        const product = {
          id: snap.docs[0].id,
          ...snap.docs[0].data(),
        } as Product;
        exactMatches.push(product);
      }

      if (exactMatches.length > 0) {
        playBeep();
        
        // Se o produto encontrado tem variantes, precisamos ver se não existe uma variação com esse SKU também para ser mais preciso de imediato
        if (exactMatches[0].hasVariants) {
          const vSnap = await getDocs(
            collection(db, `products/${exactMatches[0].id}/variants`),
          );
          const variantDoc = vSnap.docs.find((d) => {
            const v = d.data();
            return (
              v.barcode === term ||
              v.sku === term ||
              termsToSearch.includes(v.sku)
            );
          });

          if (variantDoc) {
            const variant = {
              id: variantDoc.id,
              ...variantDoc.data(),
            } as ProductVariant;
            addToCart(exactMatches[0], variant);
            setSearchTerm("");
            setSearchResults([]);
            return;
          }
        }
        
        addToCart(exactMatches[0]);
        setSearchTerm("");
        setSearchResults([]);
        return;
      }

      // If not found in main products, search in variantIdentifiers
      const pQ = query(
        productsRef,
        where("variantIdentifiers", "array-contains", term),
        limit(1),
      );
      const pSnap = await getDocs(pQ);

      if (!pSnap.empty) {
        const productDoc = pSnap.docs[0];
        const product = { id: productDoc.id, ...productDoc.data() } as Product;

        // Load its variants
        const vSnap = await getDocs(
          collection(db, `products/${product.id}/variants`),
        );
        const variantDoc = vSnap.docs.find((d) => {
          const v = d.data();
          return (
            v.barcode === term ||
            v.sku === term ||
            termsToSearch.includes(v.sku)
          );
        });

        if (variantDoc) {
          const variant = {
            id: variantDoc.id,
            ...variantDoc.data(),
          } as ProductVariant;
          playBeep();
          addToCart(product, variant);
          setSearchTerm("");
          setSearchResults([]);
          return;
        }
      }

      // 4. Se chegou aqui, não achou o EAN/SKU exato. Tentar buscar pelo nome ou pesquisar no termo de busca exato no firebase
      // Se não houver nada no searchResults (pois o usuário bateu enter antes de 300ms), faz a busca aqui
      let currentResults = searchResults;
      if (currentResults.length === 0) {
        const qAll = query(
          productsRef,
          where("active", "==", true),
          limit(1000),
        );
        const snapAll = await getDocs(qAll);
        const allProds = snapAll.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Product,
        );
        currentResults = allProds
          .filter((p) => {
            return (
              p.name.toLowerCase().includes(term) ||
              p.sku?.toLowerCase().includes(term) ||
              p.gtin?.toLowerCase().includes(term) ||
              p.internalCode?.toLowerCase().includes(term) ||
              p.variantIdentifiers?.some((vi) =>
                vi.toLowerCase().includes(term),
              ) ||
              p.searchTerms?.some((st) => st.includes(term))
            );
          })
          .slice(0, 15);
        // Atualiza a lista na tela para que, se não houver um exact match e sim múltiplos,
        // o usuário possa clicar na lista.
        setSearchResults(currentResults);
      }

      const exactNameMatch = currentResults.find(
        (p) => p.name.toLowerCase().trim() === term,
      );
      if (exactNameMatch) {
        playBeep();
        addToCart(exactNameMatch);
        setSearchTerm("");
        setSearchResults([]);
        return;
      }

      // Check remaining internal codes if local search was tracking it
      const localMatch = currentResults.find(
        (p) =>
          p.gtin === term ||
          p.sku === term ||
          p.sku === upperTerm ||
          p.internalCode === term ||
          p.internalCode === upperTerm,
      );

      if (localMatch) {
        playBeep();
        addToCart(localMatch);
        setSearchTerm("");
        setSearchResults([]);
        return;
      }

      // Checking current results if it's the only one
      if (currentResults.length === 1) {
        playBeep();
        addToCart(currentResults[0]);
        setSearchTerm("");
        setSearchResults([]);
      } else if (currentResults.length > 1) {
        toast("Múltiplos produtos. Clique em um da lista abaixo.", "warning");
      } else {
        toast("EAN/SKU não encontrado no sistema.", "error");
      }
    } catch (err: unknown) {
      const error = err as any;
      if (
        error?.code === "failed-precondition" ||
        error?.message?.includes("index")
      ) {
        toast(
          "Índice de busca para variantes não criado no Firebase.",
          "warning",
        );
        console.warn(
          "Firebase precisa de um index collectionGroup para buscar variantes. Clique no link do console de erro.",
        );
      } else {
        toast("Erro ao buscar produto.", "error");
      }
    } finally {
      setSearching(false);
    }
  };

  const handleSearchCustomer = async () => {
    const cleanPhone = customerSearchTerm.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast("Digite um número de WhatsApp válido (com DDD).", "warning");
      return;
    }

    setIsSearchingCustomer(true);
    setCustomerNotFound(false);
    try {
      const snap = await getDoc(doc(db, "customers", cleanPhone));
      if (snap.exists()) {
        const c = { id: snap.id, ...snap.data() } as Customer;
        setSelectedCustomer(c);
        toast(`Cliente ${c.nome} encontrado!`, "success");
        // Pre-fill form with existing data for possible editions
        setNewCustomer({
          id: c.id,
          nome: c.nome || "",
          whatsapp: c.whatsapp || cleanPhone,
          dataNascimento: c.dataNascimento || "",
          status: c.status || "ativo",
          endereco: c.endereco || {
            estado: "",
            cidade: "",
            bairro: "",
            rua: "",
            numero: "",
            complemento: "",
            referencia: "",
          },
        });
        setCustomerNotFound(true); // Reusing this boolean to show the form
      } else {
        setSelectedCustomer(null);
        setCustomerNotFound(true);
        setNewCustomer({
          id: "",
          nome: "",
          whatsapp: cleanPhone,
          dataNascimento: "",
          status: "ativo",
          endereco: {
            estado: "",
            cidade: "",
            bairro: "",
            rua: "",
            numero: "",
            complemento: "",
            referencia: "",
          },
        });
        toast(
          "Cliente não encontrado. Preencha os dados para cadastrar.",
          "info",
        );
      }
    } catch (err) {
      console.error(err);
      toast("Erro ao buscar cliente.", "error");
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  const handleRegisterCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.nome || !newCustomer.whatsapp) {
      toast("Nome e WhatsApp são obrigatórios.", "warning");
      return;
    }

    setIsRegisteringCustomer(true);
    try {
      const { customerService } =
        await import("../../services/customerService");
      const cId = await customerService.saveCustomer({
        ...newCustomer,
        origin: 'pdv'
      } as Customer);
      const c = await customerService.getCustomerByWhatsapp(cId);
      if (c) {
        setSelectedCustomer(c);
        toast("Cliente salvo com sucesso!", "success");
        setCustomerNotFound(false);
        setCustomerSearchTerm("");
        setNewCustomer({
          nome: "",
          whatsapp: "",
          dataNascimento: "",
          status: "ativo",
          endereco: {
            estado: "",
            cidade: "",
            bairro: "",
            rua: "",
            numero: "",
            complemento: "",
            referencia: "",
          },
        });
        setStep("payment");
      }
    } catch (err: any) {
      console.error(err);
      toast(err.message || "Erro ao cadastrar cliente.", "error");
    } finally {
      setIsRegisteringCustomer(false);
    }
  };

  // Search products
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      setComboResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearching(true);
      try {
        const s = searchTerm.toLowerCase();

        // Filter combos (already loaded in allCombos)
        const combos = allCombos.filter(c => 
          c.name.toLowerCase().includes(s) || 
          c.description.toLowerCase().includes(s) ||
          (c.gtin && c.gtin.toLowerCase().includes(s)) ||
          (c.sku && c.sku.toLowerCase().includes(s))
        );
        setComboResults(combos);

        const q = query(
          collection(db, "products"),
          where("active", "==", true),
          limit(1000), // Increase limits so standard store sizes are fully searched by client-filter
        );
        const snap = await getDocs(q);
        const products = snap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Product,
        );

        // Client side filtering for better UX with partial terms
        const filtered = products
          .filter((p) => {
            return (
              p.name.toLowerCase().includes(s) ||
              p.sku?.toLowerCase().includes(s) ||
              p.gtin?.toLowerCase().includes(s) ||
              p.internalCode?.toLowerCase().includes(s) ||
              p.variantIdentifiers?.some((vi) =>
                vi.toLowerCase().includes(s),
              ) ||
              p.searchTerms?.some((st) => st.includes(s))
            );
          })
          .slice(0, 15); // Cap displayed items

        setSearchResults(filtered);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, allCombos]);

  const openVariantModal = async (product: Product) => {
    setSelectedProduct(product);
    setIsVariantModalOpen(true);
    setLoadingVariants(true);
    setModalVariants([]);
    try {
      const snap = await getDocs(
        collection(db, `products/${product.id}/variants`),
      );
      const fetchedVariants = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as ProductVariant,
      );
      setModalVariants(fetchedVariants);
    } catch (err) {
      console.error("Erro listando variações:", err);
      toast("Erro ao listar as variações desse produto.", "error");
    } finally {
      setLoadingVariants(false);
    }
  };

  const addToCart = (product: Product, variant?: ProductVariant) => {
    if (product.hasVariants && !variant) {
      openVariantModal(product);
      return;
    }

    const currentStock = variant ? variant.stock || 0 : product.stock || 0;
    const allowBackorder = product.allowBackorder;

    if (currentStock <= 0 && !allowBackorder) {
      setStockWarningModal({
        productName: variant
          ? `${product.name} - ${variant.name}`
          : product.name,
        stock: currentStock,
      });
      return;
    }

    const productId = product.id!;
    const variantId = variant?.id;
    const price = variant?.price || product.promoPrice || product.price;
    const name = product.name;
    const variantName = variant?.name;
    const sku = variant?.sku || product.sku;
    const gtin = variant?.barcode || product.gtin;
    const imageUrl = variant?.imageUrl || product.images?.[0]?.url;

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.productId === productId && item.variantId === variantId,
      );

      if (existingIndex > -1) {
        const newCart = [...prev];
        newCart[existingIndex].quantity += 1;
        return newCart;
      }

      return [
        ...prev,
        {
          productId,
          variantId,
          name,
          variantName,
          price,
          costPrice: variant?.costPrice || product.costPrice || 0,
          quantity: 1,
          sku: sku || "",
          gtin: gtin || "",
          imageUrl,
          discount: 0,
        },
      ];
    });

    setSearchTerm("");
    setSearchResults([]);
    setIsVariantModalOpen(false);
    setSelectedProduct(null);
    if (searchInputRef.current) searchInputRef.current.focus();

    toast(
      `Adicionado: ${name} ${variantName ? `(${variantName})` : ""}`,
      "success",
    );
  };

  const addComboToCart = useCallback(async (combo: Combo) => {
    // 1. Validar estoque geral do combo
    const virtualStock = await comboService.getComboStock(combo);
    if (virtualStock <= 0) {
      toast(`Combo "${combo.name}" esgotado devido a falta de itens individuais.`, "error");
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.isCombo && item.comboId === combo.id);

      if (existingIndex > -1) {
        const newCart = [...prev];
        newCart[existingIndex].quantity += 1;
        return newCart;
      }

      return [
        ...prev,
        {
          productId: combo.id!, // Using productId as unique identifier in some loops
          comboId: combo.id,
          isCombo: true,
          name: `[COMBO] ${combo.name}`,
          price: combo.price,
          costPrice: 0, // Need to implement cost price calc if needed
          quantity: 1,
          sku: combo.sku || `COMBO-${combo.id!.slice(-6).toUpperCase()}`,
          gtin: combo.gtin || "",
          imageUrl: combo.imageUrl,
          discount: 0,
        },
      ];
    });

    setSearchTerm("");
    setSearchResults([]);
    setComboResults([]);
    playBeep();
    toast(`Adicionado: Combo ${combo.name}`, "success");
  }, [allCombos, toast]);

  // Handle addCombo query param
  useEffect(() => {
    if (addComboId && allCombos.length > 0) {
      const combo = allCombos.find(c => c.id === addComboId);
      if (combo) {
        addComboToCart(combo);
        // Clear param
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("addCombo");
        setSearchParams(newParams);
      }
    }
  }, [addComboId, allCombos, searchParams, setSearchParams, addComboToCart]);

  useEffect(() => {
    if (!canPDV) {
      toast("Você não tem permissão para acessar o PDV", "error");
      navigate("/admin");
    }
  }, [canPDV, navigate, toast]);

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const updateQty = (index: number, delta: number) => {
    setCart((prev) => {
      const newCart = [...prev];
      const newQty = newCart[index].quantity + delta;
      if (newQty < 1) return prev;
      newCart[index].quantity = newQty;
      return newCart;
    });
  };

  const updateItemDiscount = (index: number, value: number) => {
    setCart((prev) => {
      const newCart = [...prev];
      newCart[index].discount = value;
      return newCart;
    });
  };

  const calculatedTotal = roundTo2(
    cartSubtotal - itemsDiscountTotal + shipping - globalDiscount,
  );
  const total = Math.max(0, calculatedTotal);

  const totalDiscount = roundTo2(cartSubtotal + shipping - total);

  const totalPaid = roundTo2(payments.reduce((acc, p) => acc + p.amount, 0));
  const additionalAmount = totalPaid > total ? roundTo2(totalPaid - total) : 0;
  const cashEntryAmount = totalPaid;

  useEffect(() => {
    if (step === "payment") {
      const paid = payments.reduce((acc, p) => acc + p.amount, 0);
      const remaining = total - paid;

      if (remaining > 0) {
        setPartialAmount(roundTo2(remaining).toString());
      } else {
        setPartialAmount("0.00");
      }
    }
  }, [step, total, payments]);

  const handleFinishOrder = async () => {
    if (cart.length === 0) return;
    if (isFinishing) return;

    if (!currentSession) {
      toast("Para realizar vendas, o caixa deve estar ABERTO.", "error");
      navigate("/admin/caixa");
      return;
    }

    const paidTotal = payments.reduce((acc, p) => acc + p.amount, 0);
    if (!saveAsNewOrder && paidTotal < total - 0.01) {
      toast(
        `O valor pago (${formatCurrency(paidTotal)}) deve ser pelo menos igual ao total do pedido (${formatCurrency(total)})`,
        "error",
      );
      return;
    }

    setIsFinishing(true);
    setCheckoutStatus("Iniciando finalização...");

    try {
      const finalPaidTotal = roundTo2(
        payments.reduce((acc, p) => acc + p.amount, 0),
      );
      const finalAdditionalAmount =
        finalPaidTotal > total ? roundTo2(finalPaidTotal - total) : 0;

      setCheckoutStatus("Preparando dados do pedido...");

      // 1. Prepare order data
      const orderData: any = {
        sessionId: currentSession?.id, // Tie order to cash session
        items: cart.map((item) => ({
          productId: item.productId,
          variantId: item.variantId || null,
          name: item.name,
          variantName: item.variantName || null,
          price: item.price,
          costPrice: (item as any).costPrice || 0,
          quantity: item.quantity,
          sku: item.sku,
          gtin: item.gtin || "",
          discount: item.discount || 0,
          isCombo: item.isCombo || false,
          comboId: item.comboId || null,
          subtotal: roundTo2(item.price * item.quantity - (item.discount || 0)),
        })),
        subtotal: cartSubtotal,
        total,
        additionalAmount: finalAdditionalAmount,
        financialReceivedAmount: finalPaidTotal,
        cashEntryAmount: finalPaidTotal,
        discount: totalDiscount,
        shipping: shipping,
        notes: notes,
        paymentMethod: payments
          .map((p) => `${p.method} (${formatCurrency(p.amount)})`)
          .join(" + "),
        payments: payments,
        status: saveAsNewOrder ? "NOVO" : "ENTREGUE",
        type: isDelivery ? "pdv_entrega" : (editingOrderId ? editingOrderType : "pdv"),
        isDelivery: isDelivery,
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer?.nome || "Cliente Balcão",
        customerWhatsapp: selectedCustomer?.whatsapp || null,
        customerAddress: deliveryAddress || formatCustomerAddress(selectedCustomer) || "",
        sellerId: user?.uid,
        sellerName: user?.email,
        updatedAt: serverTimestamp(),
      };

      let currentOrderId = editingOrderId;

      if (editingOrderId) {
        setCheckoutStatus("Estornando estoque antigo...");
        // 1. REVERTER ESTOQUE ANTIGO (Para pedidos que já foram finalizados)
        await stockMovementService.deleteMovementsByOrderId(editingOrderId);

        setCheckoutStatus("Atualizando pedido no banco de dados...");
        // 2. UPDATE EXISTING
        await updateDoc(doc(db, "orders", editingOrderId), orderData);

        setCheckoutStatus("Registrando novas movimentações de estoque...");
        // 3. REGISTRAR NOVAS MOVIMENTAÇÕES (A partir do carrinho atual em paralelo para máxima confiabilidade)
        const movementPromises = cart.map(async (item) => {
          if (item.isCombo) {
            const combo = allCombos.find(c => c.id === item.comboId);
            if (combo) {
              const innerPromises = combo.items.map(cItem => 
                stockMovementService.registerMovement({
                  productId: cItem.productId,
                  productName: `${cItem.name || item.name} (Combo: ${combo.name})`,
                  variantId: cItem.variantId || undefined,
                  sku: item.sku,
                  quantity: cItem.quantity * item.quantity,
                  type: "out",
                  reason: `Venda Combo PDV (Editado - #${editingOrderId.slice(-6).toUpperCase()})`,
                  channel: "Loja Física",
                  orderId: editingOrderId,
                })
              );
              await Promise.all(innerPromises);
              await comboService.incrementSoldCount(combo.id!, item.quantity, (item.price - item.costPrice) * item.quantity);
            }
          } else {
            await stockMovementService.registerMovement({
              productId: item.productId,
              productName: item.name,
              variantId: item.variantId || undefined,
              sku: item.sku,
              quantity: item.quantity,
              type: "out",
              reason: `Venda PDV (Editado - #${editingOrderId.slice(-6).toUpperCase()})`,
              channel: "Loja Física",
              orderId: editingOrderId,
            });
          }
        });

        await Promise.all(movementPromises);

        setCheckoutStatus("Ajustando lançamentos financeiros...");
        // 4. Se estiver editando, limpamos os lançamentos financeiros antigos associados a este pedido
        await financialService.deleteTransactionsByOrderId(editingOrderId);
        await cashService.deleteTransactionsByOrderId(editingOrderId);

        toast("Pedido atualizado e estoque recalculado!", "success");
      } else {
        setCheckoutStatus("Criando novo pedido no banco de dados...");
        // CREATE NEW
        orderData.createdAt = serverTimestamp();
        const orderRef = await addDoc(collection(db, "orders"), orderData);
        currentOrderId = orderRef.id;

        setCheckoutStatus("Registrando saídas de estoque...");
        // Registrar movimentações de saída para cada item em paralelo
        const movementPromises = cart.map(async (item) => {
          if (item.isCombo) {
            const combo = allCombos.find(c => c.id === item.comboId);
            if (combo) {
              const innerPromises = combo.items.map(cItem => 
                stockMovementService.registerMovement({
                  productId: cItem.productId,
                  productName: `${cItem.name || item.name} (Combo: ${combo.name})`,
                  variantId: cItem.variantId || undefined,
                  sku: item.sku,
                  quantity: cItem.quantity * item.quantity,
                  type: "out",
                  reason: "Venda Combo PDV",
                  channel: "Loja Física",
                  orderId: currentOrderId,
                })
              );
              await Promise.all(innerPromises);
              await comboService.incrementSoldCount(combo.id!, item.quantity, (item.price - item.costPrice) * item.quantity);
            }
          } else {
            await stockMovementService.registerMovement({
              productId: item.productId,
              productName: item.name,
              variantId: item.variantId || undefined,
              sku: item.sku,
              quantity: item.quantity,
              type: "out",
              reason: "Venda PDV",
              channel: "Loja Física",
              orderId: currentOrderId,
            });
          }
        });

        await Promise.all(movementPromises);
      }

      // ==========================================
      // LANÇAMENTO FINANCEIRO INTELIGENTE (AUTOMÁTICO)
      // ==========================================
      setCheckoutStatus("Registrando fluxo do financeiro e fechamento...");
      const orderRefTag = currentOrderId!.slice(-6).toUpperCase();

      // 1. Registro Financeiro Inteligente (DRE + Caixa)
      if (!saveAsNewOrder) {
        await pdvFinancialService.finalizeSaleFinancials({
          orderId: currentOrderId!,
          orderRefTag,
          customerName: orderData.customerName,
          totalVenda: total,
          totalRecebido: finalPaidTotal,
          paymentMethod: orderData.paymentMethod,
          payments: payments,
          userId: user!.uid,
          userEmail: user!.email || "system",
          sessionId: currentSession!.id!,
        });
      }

      // ==========================================

      setCheckoutStatus("Conclpindo venda...");
      
      // Salvar os dados completos para fins de impressão de cupom
      setLastFinishedOrder({
        id: currentOrderId!,
        createdAt: new Date(),
        items: cart.map((item) => ({
          productId: item.productId,
          variantId: item.variantId || null,
          name: item.name,
          variantName: item.variantName || null,
          price: item.price,
          quantity: item.quantity,
          sku: item.sku,
          gtin: item.gtin || "",
          discount: item.discount || 0
        })),
        subtotal: cartSubtotal,
        total,
        discount: totalDiscount,
        shipping: shipping,
        customerName: orderData.customerName,
        customerWhatsapp: orderData.customerWhatsapp,
        customerAddress: orderData.customerAddress,
        type: orderData.type,
        payments: payments,
        paymentMethod: orderData.paymentMethod,
        additionalAmount: finalAdditionalAmount,
        financialReceivedAmount: finalPaidTotal,
        notes: notes,
      });

      setLastOrderId(currentOrderId!);
      resetPDV("success");
    } catch (error) {
      console.error("PDV Order error:", error);
      toast("Erro ao processar pedido. Verifique sua conexão.", "error");
    } finally {
      setIsFinishing(false);
      setCheckoutStatus("");
    }
  };

  const handlePrintReceipt = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "", "width=300,height=600");
    if (!printWindow) {
      toast("Popups bloqueados! Ative a permissão de popups para poder imprimir o cupom do pedido.", "warning");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Cupom do Pedido</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              font-size: 13px; 
              width: 58mm; 
              margin: 0; 
              padding: 5mm;
              color: black;
              font-weight: bold;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .text-center { text-align: center; }
            .font-bold { font-weight: 900; }
            .divider { border-top: 1px dashed black; margin: 5px 0; }
            .item { display: flex; justify-content: space-between; gap: 5px; margin-bottom: 2px; }
            .totals { margin-top: 10px; font-weight: 900; }
            .header-info { margin-bottom: 10px; font-weight: bold;}
            .footer { margin-top: 20px; text-align: center; font-size: 11px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; font-weight: bold;}
            th { text-align: left; border-bottom: 1px solid #000; font-weight: 900;}
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = () => {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleNewSale = () => {
    setLastFinishedOrder(null);
    resetPDV("cart");
  };

  if (step === "success") {
    const formattedDate = lastFinishedOrder?.createdAt
      ? new Date(lastFinishedOrder.createdAt).toLocaleDateString("pt-BR") + " " + new Date(lastFinishedOrder.createdAt).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })
      : "";

    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center p-4">
        {/* Hidden thermal receipt for print */}
        <div className="hidden">
          <div ref={printRef} className="thermal-receipt">
            <div
              className="text-center font-bold"
              style={{ fontSize: "15px", marginBottom: "5px" }}
            >
              DISCRETA BOUTIQUE
            </div>
            <div
              className="text-center"
              style={{ fontSize: "11px", marginBottom: "5px" }}
            >
              Sua boutique especializada em momentos inesquecíveis.
            </div>
            <div className="divider" style={{ borderTop: "1px dashed black", margin: "5px 0" }}></div>
            {lastFinishedOrder && (
              <>
                <div className="header-info" style={{ fontSize: "12px", marginBottom: "8px" }}>
                  <div>PEDIDO: #{lastFinishedOrder.id.slice(-6).toUpperCase()}</div>
                  <div>
                    DATA: {formatOrderDate(lastFinishedOrder.createdAt)}
                  </div>
                  <div>
                    TIPO: {lastFinishedOrder.type === "pdv" ? "BALCAO" : "ONLINE"}
                  </div>
                  {lastFinishedOrder.scheduledDate && (
                    <div style={{ fontWeight: "bold" }}>
                      <span style={{ fontWeight: 900 }}>ENTREGA AGENDADA:</span>
                      <br />
                      <span style={{ fontWeight: 900, fontSize: "14px" }}>
                        {lastFinishedOrder.scheduledDate.split("-").reverse().join("/")}{" "}
                        @ {lastFinishedOrder.scheduledTime}h
                      </span>
                    </div>
                  )}
                </div>
                <div className="divider" style={{ borderTop: "1px dashed black", margin: "5px 0" }}></div>
                <div className="font-bold">CLIENTE:</div>
                <div>{lastFinishedOrder.customerName || "Cliente Balcão"}</div>
                {lastFinishedOrder.customerWhatsapp && <div>{lastFinishedOrder.customerWhatsapp}</div>}
                {lastFinishedOrder.customerAddress && (
                  <>
                    <div style={{ marginTop: "5px" }}>ENDERECO:</div>
                    <div style={{ fontSize: "12px", fontWeight: "bold" }}>
                      {lastFinishedOrder.customerAddress}
                    </div>
                  </>
                )}
                <div className="divider" style={{ borderTop: "1px dashed black", margin: "5px 0" }}></div>
                <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid black" }}>
                      <th>QTD</th>
                      <th>DESC</th>
                      <th style={{ textAlign: "right" }}>VAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastFinishedOrder.items.map((item: any, i: number) => (
                      <tr key={i} style={{ borderBottom: "1px dashed #eee" }}>
                        <td style={{ verticalAlign: "top" }}>{item.quantity}</td>
                        <td>
                          {item.name}
                          {item.variantName ? ` (${item.variantName})` : ""}
                          {(item.sku || item.gtin) && (
                            <div style={{ fontSize: "10px" }}>
                              {item.sku ? `SKU: ${item.sku}` : ""}
                              {item.sku && item.gtin ? " | " : ""}
                              {item.gtin ? `EAN: ${item.gtin}` : ""}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: "right", verticalAlign: "top" }}>
                          {formatCurrency(item.price * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="divider" style={{ borderTop: "1px dashed black", margin: "5px 0" }}></div>
                <div className="totals" style={{ fontSize: "12px" }}>
                  <div
                    className="item"
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span>Subtotal:</span>
                    <span>{formatCurrency(lastFinishedOrder.subtotal || lastFinishedOrder.items.reduce((acc: any, item: any) => acc + item.price * item.quantity, 0))}</span>
                  </div>
                  {lastFinishedOrder.shipping > 0 && (
                    <div
                      className="item"
                      style={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <span>Frete/Entrega:</span>
                      <span>{formatCurrency(lastFinishedOrder.shipping)}</span>
                    </div>
                  )}
                  {lastFinishedOrder.discount && lastFinishedOrder.discount > 0 ? (
                    <div
                      className="item"
                      style={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <span>Desconto:</span>
                      <span>-{formatCurrency(lastFinishedOrder.discount)}</span>
                    </div>
                  ) : null}
                  <div
                    className="item"
                    style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", paddingTop: "4px", borderTop: "1px dashed #ccc" }}
                  >
                    <span style={{ fontWeight: "bold" }}>Total:</span>
                    <span style={{ fontWeight: "bold" }}>{formatCurrency(lastFinishedOrder.total)}</span>
                  </div>
                  {lastFinishedOrder.additionalAmount &&
                    lastFinishedOrder.additionalAmount > 0 && (
                      <div
                        className="item"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>Acréscimo:</span>
                        <span>
                          +{formatCurrency(lastFinishedOrder.additionalAmount)}
                        </span>
                      </div>
                    )}
                  <div
                    className="item"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: "bold",
                      fontSize: "14px",
                      marginTop: "5px",
                      borderTop: "1px dashed #ccc",
                      paddingTop: "5px",
                    }}
                  >
                    <span>TOTAL RECEBIDO:</span>
                    <span>
                      {formatCurrency(
                        lastFinishedOrder.financialReceivedAmount ||
                          lastFinishedOrder.total,
                      )}
                    </span>
                  </div>
                </div>
                <div className="divider" style={{ borderTop: "1px dashed black", margin: "5px 0" }}></div>
                <div className="font-bold">FORMA DE PAGTO:</div>
                {lastFinishedOrder.payments && lastFinishedOrder.payments.length > 0 ? (
                  <div>
                    {lastFinishedOrder.payments.map((p: any, idx: number) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                        <span>- {p.method}</span>
                        <span>{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>{lastFinishedOrder.paymentMethod || "A DEFINIR"}</div>
                )}
                {lastFinishedOrder.notes && (
                  <>
                    <div style={{ marginTop: "5px", fontStyle: "italic" }}>
                      OBS: {lastFinishedOrder.notes}
                    </div>
                  </>
                )}
                <div className="divider" style={{ borderTop: "1px dashed black", margin: "5px 0" }}></div>
                <div className="footer" style={{ textAlign: "center", fontSize: "10px", marginTop: "15px" }}>
                  OBRIGADO PELA PREFERENCIA!
                  <br />
                  Siga-nos no Instagram @discretaico
                </div>
              </>
            )}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 max-w-md w-full text-center shadow-2xl overflow-hidden relative"
        >
          <div className="absolute top-0 left-0 w-full h-3 bg-red-600 animate-pulse"></div>
          <div className="w-20 h-20 bg-green-950/30 border-2 border-green-500 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/10">
            <CheckCircle2 size={40} />
          </div>
          <h1 className="text-3xl font-black text-white italic tracking-tight uppercase leading-none mb-3">
            Venda Realizada!
          </h1>
          <p className="text-sm text-slate-300 font-bold tracking-wide mb-2">
            Pedido finalizado com sucesso.
          </p>
          <p className="inline-block bg-slate-950/85 border border-slate-800 text-red-500 text-xl font-mono px-6 py-2 rounded-2xl mb-8 font-black tracking-widest">
            #{lastOrderId.slice(-6).toUpperCase()}
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handlePrintReceipt}
              className="w-full h-14 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 border-2 border-white transition-all hover:scale-[1.01]"
            >
              <Printer size={18} />
              Imprimir Pedido
            </button>
            <button
              onClick={handleNewSale}
              className="w-full h-14 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
            >
              <ShoppingCart size={18} />
              Novo Pedido
            </button>
            <button
              onClick={() => {
                setStep("cart");
                navigate("/admin/pedidos");
              }}
              className="w-full h-14 border-2 border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
            >
              <FileText size={18} />
              Ver Pedidos
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (checkingSession) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">
            Verificando Caixa...
          </span>
        </div>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center p-4 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900 rounded-[2.5rem] p-12 max-w-md w-full shadow-2xl"
        >
          <div className="w-20 h-20 bg-red-600/10 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={40} />
          </div>
          <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">
            Caixa Fechado!
          </h2>
          <p className="text-slate-400 font-medium leading-relaxed mb-8">
            O PDV está bloqueado porque não há nenhum caixa aberto no momento.
            Para começar a vender, você precisa abrir o caixa primeiro.
          </p>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => navigate("/admin/caixa")}
              className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest h-14 px-8 rounded-2xl shadow-xl shadow-red-600/20"
            >
              Ir para Gerenciar Caixa
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/admin")}
              className="text-slate-400 font-bold uppercase tracking-widest"
            >
              Voltar ao Início
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Dynamic Saving Overlay to prevent concurrent operations & show detailed status */}
      {isFinishing && (
        <div className="fixed inset-0 z-[999] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="relative mb-8">
            <div className="w-24 h-24 rounded-full border-4 border-slate-800 border-t-red-600 animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <ShoppingCart size={32} className="text-red-500 animate-pulse" />
            </div>
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2 italic">
            Gravando Pedido
          </h2>
          <p className="text-xs uppercase font-black text-red-500 tracking-widest min-h-[20px] animate-pulse">
            {checkoutStatus || "Salvando..."}
          </p>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-4 max-w-sm">
            Por favor, não feche esta janela ou recarregue a página até que a transação termine.
          </p>
        </div>
      )}

      {/* Header PDV */}
      <header className="h-16 bg-slate-900 border-b border-white/10 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/admin")}
            className="p-2 hover:bg-slate-900/10 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.3)]">
              <Package size={16} className="text-white" />
            </div>
            <h1 className="text-lg font-black uppercase tracking-tighter italic">
              Discreta PDV{" "}
              <span className="text-xs font-normal not-italic text-slate-400 ml-2">
                v1.0
              </span>
            </h1>
          </div>
          {editingOrderId && (
            <div className="flex items-center gap-3 ml-6 bg-amber-500/10 border border-amber-500/20 px-4 py-1.5 rounded-full animate-in fade-in slide-in-from-left-4">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                Editando Pedido #{editingOrderId.slice(-6).toUpperCase()}
              </span>
              <button
                onClick={() => navigate("/admin/pdv")}
                className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors border-l border-white/10 pl-3 ml-1"
              >
                Descartar
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          <Button
            className="lg:hidden h-10 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-[10px] items-center gap-2"
            onClick={() => setShowMobileCart(true)}
          >
            <ShoppingCart size={16} />
            {cart.length} ITENS
          </Button>

          <div className="hidden lg:flex flex-col items-end">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
              Operador
            </span>
            <span className="text-sm font-bold text-white uppercase">
              {user?.email?.split("@")[0]}
            </span>
          </div>
          <div className="h-8 w-px bg-slate-900/10"></div>
          <div className="flex items-center gap-3 text-red-500 font-mono text-xl font-bold">
            {new Date().toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </header>
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT: Search & Products */}
        <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-white/10 p-4 lg:p-6 overflow-hidden">
          {/* Tabs header mimicking Bling */}
          <div className="flex gap-1 mb-6 border-b border-white/10 pb-4">
            <button
              onClick={() => setActiveTab("pdv")}
              className={cn(
                "flex-1 py-3 px-4 text-center font-black uppercase text-xs tracking-widest rounded-l-xl transition-all",
                activeTab === "pdv"
                  ? "bg-red-600 text-white"
                  : "bg-slate-900/5 text-slate-400",
              )}
            >
              1. Produto / Leitor
            </button>
            <button
              onClick={() => setActiveTab("customer")}
              className={cn(
                "flex-1 py-3 px-4 text-center font-black uppercase text-xs tracking-widest rounded-r-xl transition-all",
                activeTab === "customer"
                  ? "bg-red-600 text-white"
                  : "bg-slate-900/5 text-slate-400",
              )}
            >
              2. Cliente (Opcional)
            </button>
          </div>

          {activeTab === "pdv" && (
            <>
              <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                  Venda Direta
                </h3>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-green-500 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  Leitor de Código de Barras Ativado
                </div>
              </div>

              <form onSubmit={handleSearchSubmit} className="relative mb-6">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                  <Search size={22} />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pesquise por Nome, SKU ou GTIN (Esc para limpar)"
                  className="w-full h-16 bg-slate-900/5 border-2 border-white/10 rounded-2xl pl-14 pr-6 text-xl font-medium focus:border-red-600 focus:bg-slate-900/10 outline-none transition-all placeholder:text-slate-300"
                  autoFocus
                />
                {searching && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </form>

              {/* Results Area */}
              <div className="flex-1 overflow-y-auto no-scrollbar pb-6">
                {(searchResults.length > 0 || comboResults.length > 0) ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {/* Render Combos First */}
                    {comboResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => addComboToCart(c)}
                        className="bg-slate-900/5 border-2 border-red-500/50 rounded-2xl p-3 flex flex-col items-center text-center hover:bg-slate-900/10 hover:border-red-600 hover:scale-[1.02] active:scale-[0.98] transition-all group relative"
                      >
                         <div className="absolute top-2 left-2 z-10 bg-red-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg">COMBO</div>
                         <div className="w-full aspect-square bg-slate-800 rounded-xl mb-3 overflow-hidden relative">
                            {(c.images && c.images.find(img => img.isMain)?.url) ? (
                              <img src={c.images.find(img => img.isMain)?.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                            ) : c.imageUrl ? (
                              <img src={c.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <Plus size={24} />
                              </div>
                            )}
                         </div>
                         <h3 className="text-xs font-bold text-slate-100 line-clamp-2 leading-tight h-8 mb-2 group-hover:text-red-500 transition-colors">
                            {c.name}
                          </h3>
                          <p className="text-sm font-black text-white">
                            {formatCurrency(c.price)}
                          </p>
                      </button>
                    ))}

                    {searchResults.map((p) => {
                      const mainImg =
                        p.images?.find((i) => i.isMain)?.url ||
                        p.images?.[0]?.url;
                      return (
                        <button
                          key={p.id}
                          onClick={() => addToCart(p)}
                          className="bg-slate-900/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center text-center hover:bg-slate-900/10 hover:border-red-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all group"
                        >
                          <div className="w-full aspect-square bg-slate-800 rounded-xl mb-3 overflow-hidden relative">
                            {mainImg ? (
                              <img
                                src={mainImg || undefined}
                                alt=""
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <Package size={24} />
                              </div>
                            )}
                            <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-tighter">
                              Est: {p.stock}
                            </div>
                          </div>
                          <h3 className="text-xs font-bold text-slate-100 line-clamp-2 leading-tight h-8 mb-2 group-hover:text-red-500 transition-colors">
                            {p.name}
                          </h3>
                          <p className="text-sm font-black text-white">
                            {formatCurrency(p.promoPrice || p.price)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : searchTerm.length >= 2 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-30">
                    <AlertCircle size={64} className="mb-4" />
                    <p className="text-lg font-bold">
                      Nenhum produto encontrado
                    </p>
                  </div>
                ) : cart.length > 0 ? (
                  <div className="flex flex-col items-center justify-center h-full animate-in fade-in slide-in-from-bottom-8 duration-500">
                    <div className="w-[280px] h-[280px] bg-slate-800 rounded-3xl overflow-hidden mb-8 border border-white/10 shadow-2xl relative group">
                      {cart[cart.length - 1].imageUrl ? (
                        <img
                          src={cart[cart.length - 1].imageUrl || undefined}
                          alt="Último item"
                          className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-200">
                          <Package size={80} />
                        </div>
                      )}
                      <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-500/20">
                        Último Adicionado
                      </div>
                    </div>
                    <h2 className="text-3xl font-black text-white text-center px-8 mb-2 tracking-tighter leading-tight max-w-xl">
                      {cart[cart.length - 1].name}
                    </h2>
                    {cart[cart.length - 1].variantName && (
                      <p className="text-red-500 font-bold uppercase tracking-widest mb-4">
                        {cart[cart.length - 1].variantName}
                      </p>
                    )}
                    <div className="text-6xl font-[900] text-white tracking-tighter mt-4">
                      {formatCurrency(cart[cart.length - 1].price)}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full opacity-10">
                    <Hash size={120} className="mb-4" />
                    <p className="text-2xl font-black italic uppercase tracking-widest">
                      Aguardando entrada...
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "customer" && (
            <div className="p-6 text-white bg-slate-900/5 rounded-2xl border border-white/10 m-2 flex flex-col h-full overflow-y-auto no-scrollbar">
              <h2 className="text-2xl font-bold mb-4">Cliente</h2>

              <label className="text-sm font-bold text-slate-400 uppercase mb-2 block">
                Buscar por WhatsApp
              </label>
              <div className="flex gap-2 mb-8">
                <input
                  value={customerSearchTerm}
                  onChange={(e) => setCustomerSearchTerm(e.target.value)}
                  placeholder="Ex: 11999998888"
                  className="flex-1 h-12 bg-black/20 border border-white/10 rounded-xl px-4 text-lg focus:border-red-600 outline-none transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && handleSearchCustomer()}
                />
                <Button
                  onClick={handleSearchCustomer}
                  className="h-12 px-8 bg-red-600 hover:bg-red-700 font-bold"
                  disabled={isSearchingCustomer}
                >
                  {isSearchingCustomer ? "Buscando..." : "Buscar"}
                </Button>
              </div>

              {selectedCustomer && !customerNotFound && (
                <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-xl mb-6 flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-green-500 mb-2">
                      Cliente Selecionado
                    </h3>
                    <p className="text-lg">
                      <strong>Nome:</strong> {selectedCustomer.nome}
                    </p>
                    <p className="text-lg">
                      <strong>WhatsApp:</strong> {selectedCustomer.whatsapp}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="border-green-500 text-green-500 hover:bg-green-500/10"
                      onClick={() => {
                        setNewCustomer({
                          id: selectedCustomer.id,
                          nome: selectedCustomer.nome || "",
                          whatsapp: selectedCustomer.whatsapp || "",
                          dataNascimento: selectedCustomer.dataNascimento || "",
                          status: selectedCustomer.status || "ativo",
                          endereco: selectedCustomer.endereco || {
                            estado: "",
                            cidade: "",
                            bairro: "",
                            rua: "",
                            numero: "",
                            complemento: "",
                            referencia: "",
                          },
                        });
                        setCustomerNotFound(true); // Reusing this to show form
                      }}
                    >
                      Editar Cliente
                    </Button>
                    <Button
                      variant="outline"
                      className="border-red-500 text-red-500 hover:bg-red-500/10"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerNotFound(false);
                      }}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              )}

              {customerNotFound && (
                <form
                  onSubmit={handleRegisterCustomer}
                  className="flex-1 animate-in fade-in slide-in-from-bottom-4"
                >
                  <div className="space-y-4 bg-black/20 p-6 rounded-xl border border-white/5">
                    <h3 className="text-lg font-bold text-red-500">
                      {newCustomer.id
                        ? "Alterar Dados do Cliente"
                        : "Cadastrar Novo Cliente"}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                          Nome Completo *
                        </label>
                        <input
                          required
                          value={newCustomer.nome || ""}
                          onChange={(e) =>
                            setNewCustomer((prev) => ({
                              ...prev,
                              nome: e.target.value,
                            }))
                          }
                          className="w-full h-12 bg-slate-900/5 border border-white/10 rounded-xl px-4"
                          placeholder="João da Silva"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                          WhatsApp *
                        </label>
                        <input
                          required
                          value={newCustomer.whatsapp || ""}
                          onChange={(e) =>
                            setNewCustomer((prev) => ({
                              ...prev,
                              whatsapp: e.target.value,
                            }))
                          }
                          className="w-full h-12 bg-slate-900/5 border border-white/10 rounded-xl px-4"
                          placeholder="11999998888"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                          Data de Nascimento (Opcional)
                        </label>
                        <input
                          type="date"
                          value={newCustomer.dataNascimento || ""}
                          onChange={(e) =>
                            setNewCustomer((prev) => ({
                              ...prev,
                              dataNascimento: e.target.value,
                            }))
                          }
                          className="w-full h-12 bg-slate-900/5 border border-white/10 rounded-xl px-4 text-white"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/10 mt-4">
                      <h4 className="text-sm font-bold text-white mb-4">
                        Endereço (Obrigatório)
                      </h4>

                      <datalist id="estados-sugestoes">
                        {availableStates.map((state) => (
                          <option
                            key={state.id || state.sigla}
                            value={state.sigla}
                          />
                        ))}
                      </datalist>

                      <datalist id="cidades-sugestoes">
                        {availableCities.map((city) => (
                          <option
                            key={city.id || city.nome}
                            value={city.nome}
                          />
                        ))}
                      </datalist>

                      <datalist id="bairros-sugestoes">
                        {availableNeighborhoods.map((hood) => (
                          <option
                            key={hood.id || hood.bairro}
                            value={hood.bairro}
                          />
                        ))}
                      </datalist>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                            Estado *
                          </label>
                          <input
                            required
                            list="estados-sugestoes"
                            placeholder="SP"
                            value={newCustomer.endereco?.estado || ""}
                            onChange={(e) =>
                              setNewCustomer((prev) => ({
                                ...prev,
                                endereco: {
                                  ...(prev.endereco || {
                                    estado: "",
                                    cidade: "",
                                    bairro: "",
                                    rua: "",
                                    numero: "",
                                    complemento: "",
                                    referencia: "",
                                  }),
                                  estado: e.target.value,
                                },
                              }))
                            }
                            className="w-full h-12 bg-slate-900/5 border border-white/10 rounded-xl px-4"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                            Cidade *
                          </label>
                          <input
                            required
                            list="cidades-sugestoes"
                            placeholder="São Paulo"
                            value={newCustomer.endereco?.cidade || ""}
                            onChange={(e) =>
                              setNewCustomer((prev) => ({
                                ...prev,
                                endereco: {
                                  ...(prev.endereco || {
                                    estado: "",
                                    cidade: "",
                                    bairro: "",
                                    rua: "",
                                    numero: "",
                                    complemento: "",
                                    referencia: "",
                                  }),
                                  cidade: e.target.value,
                                },
                              }))
                            }
                            className="w-full h-12 bg-slate-900/5 border border-white/10 rounded-xl px-4"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                            Bairro *
                          </label>
                          <input
                            required
                            list="bairros-sugestoes"
                            placeholder="Centro"
                            value={newCustomer.endereco?.bairro || ""}
                            onChange={(e) =>
                              setNewCustomer((prev) => ({
                                ...prev,
                                endereco: {
                                  ...(prev.endereco || {
                                    estado: "",
                                    cidade: "",
                                    bairro: "",
                                    rua: "",
                                    numero: "",
                                    complemento: "",
                                    referencia: "",
                                  }),
                                  bairro: e.target.value,
                                },
                              }))
                            }
                            className="w-full h-12 bg-slate-900/5 border border-white/10 rounded-xl px-4"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                            Rua *
                          </label>
                          <input
                            required
                            placeholder="Nome da rua"
                            value={newCustomer.endereco?.rua || ""}
                            onChange={(e) =>
                              setNewCustomer((prev) => ({
                                ...prev,
                                endereco: {
                                  ...(prev.endereco || {
                                    estado: "",
                                    cidade: "",
                                    bairro: "",
                                    rua: "",
                                    numero: "",
                                    complemento: "",
                                    referencia: "",
                                  }),
                                  rua: e.target.value,
                                },
                              }))
                            }
                            className="w-full h-12 bg-slate-900/5 border border-white/10 rounded-xl px-4"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                            Número *
                          </label>
                          <input
                            required
                            placeholder="123"
                            value={newCustomer.endereco?.numero || ""}
                            onChange={(e) =>
                              setNewCustomer((prev) => ({
                                ...prev,
                                endereco: {
                                  ...(prev.endereco || {
                                    estado: "",
                                    cidade: "",
                                    bairro: "",
                                    rua: "",
                                    numero: "",
                                    complemento: "",
                                    referencia: "",
                                  }),
                                  numero: e.target.value,
                                },
                              }))
                            }
                            className="w-full h-12 bg-slate-900/5 border border-white/10 rounded-xl px-4"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                            Complemento
                          </label>
                          <input
                            placeholder="Apto 45"
                            value={newCustomer.endereco?.complemento || ""}
                            onChange={(e) =>
                              setNewCustomer((prev) => ({
                                ...prev,
                                endereco: {
                                  ...(prev.endereco || {
                                    estado: "",
                                    cidade: "",
                                    bairro: "",
                                    rua: "",
                                    numero: "",
                                    complemento: "",
                                    referencia: "",
                                  }),
                                  complemento: e.target.value,
                                },
                              }))
                            }
                            className="w-full h-12 bg-slate-900/5 border border-white/10 rounded-xl px-4"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                          Ponto de Referência *
                        </label>
                        <input
                          required
                          placeholder="Próximo ao mercado X"
                          value={newCustomer.endereco?.referencia || ""}
                          onChange={(e) =>
                            setNewCustomer((prev) => ({
                              ...prev,
                              endereco: {
                                ...prev.endereco!,
                                referencia: e.target.value,
                              },
                            }))
                          }
                          className="w-full h-12 bg-slate-900/5 border border-white/10 rounded-xl px-4 mb-4"
                        />
                      </div>
                    </div>

                    <div className="flex gap-4 mt-6">
                      {newCustomer.id && (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-14 flex-1 border-white/20 text-white hover:bg-slate-900/10 font-bold"
                          onClick={() => {
                            setCustomerNotFound(false);
                          }}
                        >
                          Cancelar
                        </Button>
                      )}
                      <Button
                        type="submit"
                        className="h-14 flex-[2] bg-green-600 hover:bg-green-700 text-white font-bold text-lg"
                        disabled={isRegisteringCustomer}
                      >
                        {isRegisteringCustomer
                          ? "Salvando..."
                          : newCustomer.id
                            ? "Atualizar e Continuar"
                            : "Cadastrar e Continuar"}
                      </Button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Cart & Actions */}
        <div
          className={cn(
            "fixed inset-0 lg:relative lg:inset-auto z-[110] lg:z-auto w-full lg:w-[450px] bg-slate-900 flex flex-col shrink-0 overflow-hidden shadow-[0_-10px_30px_rgba(0,0,0,0.5)] lg:shadow-[-10px_0_30px_rgba(0,0,0,0.5)] transition-transform duration-300",
            showMobileCart
              ? "translate-x-0"
              : "translate-x-full lg:translate-x-0",
          )}
        >
          {/* Mobile Close Button */}
          <button
            onClick={() => setShowMobileCart(false)}
            className="lg:hidden absolute top-4 left-4 z-[120] w-10 h-10 bg-slate-900/10 rounded-full flex items-center justify-center text-white"
          >
            <X size={20} />
          </button>

          <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 pl-16 lg:pl-6 shrink-0 bg-slate-950/50">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-red-500" />
              <h2 className="font-black uppercase tracking-widest text-xs">
                Cesto de Compras
              </h2>
            </div>
            <span className="bg-red-600/20 text-red-500 px-3 py-1 rounded-full text-[10px] font-black">
              {cart.length} ITENS
            </span>
          </div>

          {/* Cart List */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">
            {cart.length > 0 ? (
              cart.map((item, idx) => (
                <div
                  key={`${item.productId}-${item.variantId}-${idx}`}
                  className="bg-slate-900/5 border border-white/10 rounded-2xl p-4 flex gap-4 animate-in fade-in slide-in-from-right-4"
                >
                  <div className="w-16 h-16 bg-slate-800 rounded-xl overflow-hidden shrink-0">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl || undefined}
                        alt=""
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={20} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-center min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">
                      {item.name}
                    </h4>
                    {item.variantName && (
                      <span className="text-[10px] text-red-500 font-bold uppercase">
                        {formatVariantName(item.variantName)}
                      </span>
                    )}
                    <div className="mt-2 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateQty(idx, -1);
                          }}
                          className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-900/10 hover:bg-red-600 transition-colors"
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const newQty = parseInt(e.target.value) || 1;
                            setCart((prev) => {
                              const newCart = [...prev];
                              newCart[idx].quantity = newQty;
                              return newCart;
                            });
                          }}
                          className="w-10 text-sm font-black text-center bg-slate-950 border border-white/10 rounded-lg outline-none focus:border-red-500"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateQty(idx, 1);
                          }}
                          className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-900/10 hover:bg-red-600 transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-black text-white">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            Desc Reais:
                          </span>
                          <input
                            type="number"
                            value={item.discount || 0}
                            onChange={(e) =>
                              updateItemDiscount(
                                idx,
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            onBlur={(e) =>
                              updateItemDiscount(
                                idx,
                                roundTo2(parseFloat(e.target.value)) || 0,
                              )
                            }
                            className="w-16 bg-slate-900/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] font-black text-green-500 outline-none focus:border-green-500 transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromCart(idx)}
                    className="self-center p-2 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full opacity-20 text-center px-8">
                <ShoppingCart size={48} className="mb-4" />
                <p className="text-sm font-bold uppercase tracking-widest">
                  Seu carrinho está vazio
                </p>
              </div>
            )}
          </div>

          {/* Totals & Main Action */}
          <div className="p-6 bg-slate-950 border-t border-white/20">
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400 font-medium">Subtotal</span>
                <span className="text-white font-bold">
                  {formatCurrency(cartSubtotal)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 font-medium">
                  Descontos (Pedido)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-green-500 font-bold">-</span>
                  <div className="flex items-center bg-slate-900 border border-white/10 rounded overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setDiscountType(prev => prev === 'value' ? 'percent' : 'value')}
                      className="px-2 py-1 text-[10px] font-black text-slate-400 hover:text-white bg-slate-800"
                    >
                      {discountType === 'value' ? 'R$' : '%'}
                    </button>
                    <input
                      type="number"
                      value={discountBase}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setDiscountBase(val);
                      }}
                      className="w-16 bg-transparent border-none px-2 py-1 text-xs font-black text-green-500 text-right outline-none focus:ring-0 transition-colors"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>
              {itemsDiscountTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 font-medium">
                    Desc. nos Itens
                  </span>
                  <span className="text-green-500 font-bold">
                    - {formatCurrency(itemsDiscountTotal)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 font-medium">
                  Frete (Manual)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 font-bold">+</span>
                  <input
                    type="number"
                    value={shipping}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setShipping(val);
                    }}
                    onBlur={(e) => {
                      const val = roundTo2(parseFloat(e.target.value)) || 0;
                      setShipping(val);
                    }}
                    className="w-20 bg-slate-900/5 border border-white/10 rounded px-2 py-1 text-xs font-black text-white text-right outline-none focus:border-red-500 transition-colors"
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div className="h-px bg-slate-900/10 my-2"></div>
              <div className="flex justify-between items-end">
                <span className="text-sm font-black uppercase text-slate-400">
                  Total a Pagar
                </span>
                <span className="text-4xl font-[900] text-red-600 tracking-tighter shadow-red-600/20 drop-shadow-lg">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <Button
                variant="outline"
                className="h-12 border-slate-700 text-slate-400 font-bold uppercase text-[10px] hover:bg-slate-800"
                onClick={() => {
                  if (confirm("Limpar venda atual?")) setCart([]);
                }}
              >
                Cancelar
              </Button>
              <Button
                className="h-12 bg-slate-900 text-white hover:bg-slate-200 font-bold uppercase text-[10px]"
                onClick={() => setStep("payment")}
                disabled={cart.length === 0}
              >
                Pagamento (F5)
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {step === "payment" && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[110] bg-slate-950 flex flex-col md:p-4 lg:p-8"
          >
            <div className="w-full h-full max-w-7xl mx-auto flex flex-col bg-slate-900 md:rounded-[2rem] border-0 md:border border-white/10 overflow-y-auto lg:overflow-hidden shadow-2xl relative">
              {/* HEADER */}
              <div className="h-16 shrink-0 border-b border-white/10 flex items-center justify-between px-6 lg:px-8 bg-slate-950/50">
                <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3 text-white">
                  <Banknote className="text-red-500" /> FINALIZAR VENDA
                </h2>
                <button
                  onClick={() => setStep("cart")}
                  className="w-10 h-10 flex items-center justify-center bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-full transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              {/* CONTENT WRAPPER */}
              <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden relative">
                {/* LEFT: PAYMENT INPUT & METHODS */}
                <div className="flex-1 flex flex-col p-4 md:p-8 lg:overflow-y-auto no-scrollbar lg:border-r border-white/10 bg-slate-900/50">
                  
                  {/* RESUMO FIXO / TOTAL A PAGAR */}
                  <div className="bg-black/40 border border-red-500/30 rounded-3xl p-6 md:p-8 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative overflow-hidden group shrink-0">
                     <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000 ease-out">
                        <Banknote size={180} className="-mr-10" />
                     </div>
                     <div className="relative z-10 w-full sm:w-auto">
                       <span className="text-[10px] md:text-xs font-black uppercase text-red-500 tracking-widest block mb-2">
                         Total da Venda
                       </span>
                       <h3 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none shadow-red-500/20 drop-shadow-xl">
                         {formatCurrency(total)}
                       </h3>
                       <div className="mt-3 text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-wider flex justify-start items-center gap-2">
                         <span className="bg-white/10 px-2 py-1 rounded text-white">{cart.length} itens</span> no carrinho
                       </div>
                     </div>
                     
                     <div className="relative z-10 w-full sm:w-auto bg-slate-900/60 p-4 rounded-2xl border border-white/5 sm:text-right flex flex-row sm:flex-col justify-between sm:justify-center items-center sm:items-end">
                       <span className="text-[10px] sm:text-xs font-black uppercase text-slate-400 tracking-widest sm:mb-1">
                         Resta Pagar
                       </span>
                       <div className={cn(
                         "text-2xl sm:text-3xl font-black tracking-tighter",
                         (total - roundTo2(payments.reduce((acc, p) => acc + p.amount, 0))) > 0 ? "text-orange-500" : "text-green-500"
                       )}>
                         {formatCurrency(Math.max(0, roundTo2(total - payments.reduce((acc, p) => acc + p.amount, 0))))}
                       </div>
                     </div>
                  </div>

                  {/* Lançar Valor */}
                  <div className="mb-8 shrink-0">
                    <label className="block text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-400 mb-3 ml-2">
                      Valor a Lançar
                    </label>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="relative flex-1">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 font-black text-2xl md:text-3xl italic">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={partialAmount}
                          onChange={(e) => setPartialAmount(e.target.value)}
                          onBlur={(e) => setPartialAmount(roundTo2(parseFloat(e.target.value)).toString())}
                          className="w-full h-16 md:h-20 bg-slate-950 border-2 border-white/5 rounded-2xl pl-20 md:pl-24 pr-8 text-3xl md:text-4xl font-black text-white outline-none focus:border-red-600 focus:bg-black transition-all shadow-inner"
                          placeholder="0,00"
                        />
                      </div>
                      <Button
                        variant="outline"
                        className="h-16 md:h-20 sm:w-40 rounded-2xl bg-slate-800/50 border-2 border-white/5 hover:border-white/20 text-slate-300 font-black uppercase text-[10px] md:text-xs tracking-widest"
                        onClick={() => {
                          const rem = total - payments.reduce((acc, p) => acc + p.amount, 0);
                          setPartialAmount(rem > 0 ? rem.toFixed(2) : "0.00");
                        }}
                      >
                        Aplicar<br/>Restante
                      </Button>
                    </div>
                  </div>

                  {/* Formas de Pagamento */}
                  <div className="mb-8 shrink-0">
                    <label className="block text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-400 mb-3 ml-2">
                      Forma de Pagamento
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                       <PaymentBtn
                          icon={<QrCode size={28} />}
                          label="PIX"
                          active={paymentMethod === "pix"}
                          onClick={() => {
                            setPaymentMethod("pix");
                            const val = parseFloat(partialAmount || "0");
                            if (val > 0) {
                              setPayments([...payments, { method: "Pix", amount: val }]);
                              toast(`Lançado: ${formatCurrency(val)} no Pix`, "success");
                            } else {
                              toast("Informe um valor maior que zero", "warning");
                            }
                          }}
                       />
                       <PaymentBtn
                          icon={<CreditCard size={28} />}
                          label="Crédito"
                          active={paymentMethod === "credito"}
                          onClick={() => {
                            setPaymentMethod("credito");
                            const val = parseFloat(partialAmount || "0");
                            if (val > 0) {
                              setPayments([...payments, { method: "Cartão Crédito", amount: val }]);
                              toast(`Lançado: ${formatCurrency(val)} no Crédito`, "success");
                            } else {
                              toast("Informe um valor maior que zero", "warning");
                            }
                          }}
                       />
                       <PaymentBtn
                          icon={<CreditCard size={28} />}
                          label="Débito"
                          active={paymentMethod === "debito"}
                          onClick={() => {
                            setPaymentMethod("debito");
                            const val = parseFloat(partialAmount || "0");
                            if (val > 0) {
                              setPayments([...payments, { method: "Cartão Débito", amount: val }]);
                              toast(`Lançado: ${formatCurrency(val)} no Débito`, "success");
                            } else {
                              toast("Informe um valor maior que zero", "warning");
                            }
                          }}
                       />
                       <PaymentBtn
                          icon={<Banknote size={28} />}
                          label="Dinheiro"
                          active={paymentMethod === "dinheiro"}
                          onClick={() => {
                            setPaymentMethod("dinheiro");
                            const val = parseFloat(partialAmount || "0");
                            if (val > 0) {
                              setPayments([...payments, { method: "Dinheiro", amount: val }]);
                              toast(`Lançado: ${formatCurrency(val)} em Dinheiro`, "success");
                            } else {
                              toast("Informe um valor maior que zero", "warning");
                            }
                          }}
                       />
                    </div>
                  </div>

                  {paymentMethod === "dinheiro" && (
                    <div className="p-6 bg-slate-950 rounded-2xl border-2 border-white/5 animate-in fade-in slide-in-from-top-4 shrink-0">
                      <label className="block text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
                         Assistente de Troco (Opcional)
                      </label>
                      <div className="flex flex-col sm:flex-row gap-4 items-center">
                        <div className="flex-1 w-full">
                          <span className="text-[10px] font-bold text-slate-500 block mb-2 uppercase tracking-widest">
                            Valor entregue pelo cliente:
                          </span>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-black text-xl italic">R$</span>
                            <input
                              type="number"
                              value={receivedAmount}
                              onChange={(e) => setReceivedAmount(e.target.value)}
                              onBlur={(e) => setReceivedAmount(roundTo2(parseFloat(e.target.value)).toString())}
                              className="bg-slate-900 border-2 border-white/10 rounded-xl h-16 w-full pl-12 pr-4 text-2xl font-black text-white outline-none focus:border-red-600 transition-colors"
                              placeholder="0,00"
                            />
                          </div>
                        </div>
                        {receivedAmount && parseFloat(receivedAmount) > 0 && (
                          <Button
                            onClick={() => {
                              const val = parseFloat(receivedAmount);
                              setPayments([...payments, { method: "Dinheiro", amount: val }]);
                              setPartialAmount("0.00");
                              setReceivedAmount("");
                              setPaymentMethod("");
                              toast(`Lançado: ${formatCurrency(val)} em Dinheiro`, "success");
                            }}
                            className="w-full sm:w-auto h-16 rounded-xl bg-green-600 hover:bg-green-500 border-b-4 border-green-800 text-white font-black uppercase tracking-widest px-8 mt-4 sm:mt-0 transition-transform active:translate-y-1 active:border-b-0"
                          >
                            Aplicar
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT: PAYMENTS RECORDED & FINISH ACTION */}
                <div className="w-full lg:w-[480px] bg-slate-950 flex flex-col relative z-20 shadow-[-20px_0_40px_rgba(0,0,0,0.5)] lg:overflow-y-auto">
                   <div className="flex-1 p-6 md:p-8 flex flex-col lg:overflow-y-auto no-scrollbar">
                     <h4 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center justify-between">
                        Pagamentos Confirmados
                        <span className="bg-red-600/20 text-red-500 px-3 py-1 rounded relative">
                          <span className="absolute inset-0 border border-red-500/50 rounded animate-ping hidden lg:block"></span>
                          {payments.length}
                        </span>
                     </h4>

                     <div className="flex-1 space-y-4 min-h-[160px]">
                       {payments.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl p-8 bg-slate-900/20">
                            <Wallet size={64} className="mb-6 opacity-30" />
                            <p className="text-[10px] md:text-xs font-black uppercase text-center tracking-widest leading-relaxed">Nenhum valor<br/>registrado ainda</p>
                          </div>
                       ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                            {payments.map((p, i) => {
                              const methodLower = p.method.toLowerCase();
                              const isPix = methodLower.includes('pix');
                              const isDinheiro = methodLower.includes('dinheiro');
                              const borderAccent = isPix ? 'border-sky-500/40 bg-sky-950/20' : isDinheiro ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-purple-500/40 bg-purple-950/20';
                              const textAccent = isPix ? 'text-sky-400' : isDinheiro ? 'text-emerald-400' : 'text-purple-400';
                              const indicatorBg = isPix ? 'bg-sky-500' : isDinheiro ? 'bg-emerald-500' : 'bg-purple-500';

                              return (
                                <div key={i} className={`flex items-center gap-3 border ${borderAccent} p-3.5 rounded-2xl relative overflow-hidden hover:opacity-90 transition-opacity shadow-md`}>
                                   <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${indicatorBg}`}></div>
                                   <div className="w-10 h-10 bg-slate-950 border border-white/10 rounded-xl flex items-center justify-center text-slate-300 shrink-0 shadow-inner">
                                     {isPix ? <QrCode size={18} className="text-sky-400" /> : isDinheiro ? <Banknote size={18} className="text-emerald-400" /> : <CreditCard size={18} className="text-purple-400" />}
                                   </div>
                                   <div className="flex-1 min-w-0 pr-6">
                                     <p className="text-xs md:text-sm font-black text-white uppercase tracking-wider truncate">{p.method}</p>
                                     <span className={`inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/5 ${textAccent} mt-1`}>
                                       Recebido
                                     </span>
                                   </div>
                                   <div className="text-right shrink-0 pr-6 lg:pr-8">
                                     <p className="text-base md:text-lg font-black text-white leading-none">{formatCurrency(p.amount)}</p>
                                     <p className="text-[9px] uppercase font-bold text-slate-500 mt-1">
                                       {new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                     </p>
                                   </div>
                                   <button
                                     onClick={() => setPayments(payments.filter((_, idx) => idx !== i))}
                                     className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-red-650 hover:bg-red-600 bg-red-500 text-white rounded-xl flex items-center justify-center transition-all shadow-md shrink-0"
                                     title="Remover pagamento"
                                   >
                                     <Trash2 size={14} />
                                   </button>
                                </div>
                              );
                            })}
                          </div>
                       )}
                     </div>

                     {/* ENTREGA / DELIVERY */}
                      <div className="mt-6 pt-6 border-t border-slate-800">
                        <label className="flex items-center gap-3 cursor-pointer select-none mb-3">
                          <input
                            type="checkbox"
                            checked={isDelivery}
                            onChange={(e) => setIsDelivery(e.target.checked)}
                            className="h-5 w-5 rounded border-slate-700 bg-slate-900 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900 transition-colors cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center gap-1.5% mb-0">
                              🚚 Pedido para Entrega (Delivery)
                            </span>
                          </div>
                        </label>
                        {isDelivery && (
                          <div className="mt-3 space-y-2 mb-4">
                            <label className="text-[10px] block font-black uppercase text-slate-500 tracking-widest">
                              Confirmar Endereço de Entrega
                            </label>
                            <textarea
                              placeholder="Digite o endereço completo para entrega..."
                              value={deliveryAddress}
                              onChange={(e) => setDeliveryAddress(e.target.value)}
                              className="w-full h-20 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs md:text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-red-600 resize-none transition-colors shadow-inner"
                            />
                            {!selectedCustomer && (
                              <p className="text-[10px] text-orange-400 font-semibold leading-relaxed">
                                ⚠️ Atenção: Nenhum cliente selecionado. Digite o endereço e telefone nas observações se necessário para controle do entregador.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                     {/* OBSERVAÇOES */}
                     <div className="mt-8 pt-8 border-t border-slate-800">
                        <label className="text-[10px] flex items-center gap-2 font-black uppercase text-slate-500 tracking-widest mb-3">
                           <FileText size={14} /> Observações (Opcional)
                        </label>
                        <textarea
                          placeholder="Ex: Pegar depois..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="w-full h-20 md:h-24 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs md:text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-red-600 resize-none transition-colors shadow-inner"
                        />
                     </div>
                   </div>

                   {/* BOTTOM SHEET / STICKY FOOTER */}
                  {/* OPÇÃO DE SALVAR COMO NOVO PEDIDO TRATADO INTELIGENTEMENTE */}
                  <div className="mb-4 px-6">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none py-2 px-1">
                      <input
                        type="checkbox"
                        checked={saveAsNewOrder}
                        onChange={(e) => setSaveAsNewOrder(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900 transition-colors cursor-pointer"
                      />
                      <span className="text-[10px] sm:text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider">
                        Salvar como "Novo" Pedido (WhatsApp / Rascunho)
                      </span>
                    </label>
                  </div>
                   <div className="bg-slate-900 border-t border-slate-800 p-6 md:p-8 shadow-[0_-20px_40px_rgba(0,0,0,0.5)] z-30">
                     <div className="flex justify-between items-end mb-6">
                       <div>
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Total Confirmado</span>
                         <span className="text-3xl font-black text-white leading-none">{formatCurrency(totalPaid)}</span>
                       </div>
                       {additionalAmount > 0 ? (
                         <div className="text-right">
                           <span className="text-[10px] font-black uppercase tracking-widest text-green-500 block mb-1">Troco / Acréscimo</span>
                           <span className="text-2xl font-black text-green-500 leading-none">+{formatCurrency(additionalAmount)}</span>
                         </div>
                       ) : (
                          <div className="text-right">
                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Falta Pagar</span>
                             <span className="text-2xl font-black text-red-500 leading-none">
                               {formatCurrency(Math.max(0, roundTo2(total - totalPaid)))}
                             </span>
                          </div>
                       )}
                     </div>

                     <Button
                       onClick={handleFinishOrder}
                       disabled={isFinishing || (!saveAsNewOrder && totalPaid < total - 0.01)}
                       className="w-full h-20 md:h-24 bg-green-600 hover:bg-green-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:opacity-100 disabled:border-b-0 border-b-8 border-green-800 text-white rounded-[1.5rem] text-lg md:text-xl font-black uppercase tracking-[0.1em] flex items-center justify-center gap-4 transition-all relative overflow-hidden group active:border-b-0 active:translate-y-2"
                     >
                       {isFinishing ? (
                         <Loader2 className="animate-spin text-white" size={32} />
                       ) : (
                         <>
                           FINALIZAR VENDA
                           <CheckCircle2 size={32} className="group-hover:scale-125 group-disabled:scale-100 transition-transform" />
                           <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none hidden md:block"></div>
                         </>
                       )}
                     </Button>
                   </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Variant Selection Modal (Simplified for speed) */}
      <AnimatePresence>
        {isVariantModalOpen && selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 text-white"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 rounded-3xl w-full max-w-xl overflow-hidden p-8"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter italic">
                    {selectedProduct.name}
                  </h3>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                    Escolha a cor ou tamanho abaixo
                  </p>
                </div>
                <button
                  onClick={() => setIsVariantModalOpen(false)}
                  className="p-2 hover:bg-slate-950 rounded-full text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                {loadingVariants ? (
                  <p className="col-span-2 text-center text-slate-400 py-10 font-bold italic">
                    Carregando variações do estoque físico...
                  </p>
                ) : modalVariants.length > 0 ? (
                  modalVariants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        addToCart(selectedProduct, v);
                        setIsVariantModalOpen(false);
                      }}
                      disabled={v.stock <= 0 || !v.active}
                      className="border-2 border-slate-100 rounded-xl p-4 text-left hover:border-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      <h4 className="font-bold text-white leading-tight mb-1 group-hover:text-red-700">
                        {v.name}
                      </h4>
                      <div className="flex justify-between items-end mt-2">
                        <span className="text-xs font-black text-slate-400 uppercase">
                          {v.sku}
                        </span>
                        <span className="text-lg font-black text-white">
                          {formatCurrency(
                            v.price ||
                              selectedProduct.promoPrice ||
                              selectedProduct.price,
                          )}
                        </span>
                      </div>
                      <div className="mt-2 text-[10px] font-bold uppercase tracking-widest">
                        {v.stock > 0 ? (
                          <span className="text-green-600">
                            Estoque: {v.stock}
                          </span>
                        ) : (
                          <span className="text-red-600">Sem Estoque</span>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="col-span-2 text-center">
                    <p className="text-slate-400 py-6 font-bold italic">
                      Nenhuma variação encontrada.
                    </p>
                    <Button
                      onClick={() => {
                        addToCart(selectedProduct, {
                          name: "Padrão",
                          sku: selectedProduct.sku,
                          stock: selectedProduct.stock,
                          active: true,
                          price:
                            selectedProduct.promoPrice || selectedProduct.price,
                          attributes: {},
                        });
                        setIsVariantModalOpen(false);
                      }}
                      className="w-full h-14 bg-slate-900 hover:bg-black text-white rounded-xl"
                    >
                      Continuar com Produto Principal
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stock Warning Modal */}
      <AnimatePresence>
        {stockWarningModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden text-center p-8 shadow-2xl"
            >
              <div className="flex justify-center mb-6 text-red-500">
                <AlertCircle size={64} className="opacity-80" />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white mb-2">
                Estoque Insuficiente
              </h3>
              <p className="text-slate-300 font-bold mb-6">
                Não é permitido vender produtos sem estoque no PDV.
              </p>
              <div className="bg-slate-800 rounded-xl p-4 mb-8">
                <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mb-1">
                  Produto
                </p>
                <p className="text-lg font-black text-white leading-tight mb-4">
                  {stockWarningModal.productName}
                </p>
                <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mb-1">
                  Estoque Atual
                </p>
                <p className="text-3xl font-black text-red-500">
                  {stockWarningModal.stock}
                </p>
              </div>
              <Button
                onClick={() => setStockWarningModal(null)}
                className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest rounded-xl text-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                ENTENDI
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PaymentBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-24 rounded-2xl flex flex-col items-center justify-center gap-2 border-2 transition-all duration-300 transform relative",
        active
          ? "bg-red-600 border-red-600 text-white shadow-[0_10px_20px_rgba(220,38,38,0.4)] scale-[1.02] z-10"
          : "bg-slate-900/5 border-white/10 text-slate-400 hover:bg-slate-900/10 hover:border-white/20 hover:scale-[1.01]",
      )}
    >
      <div
        className={cn(
          "transition-all duration-500",
          active ? "scale-110" : "scale-100",
        )}
      >
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest">
        {label}
      </span>
      {active && (
        <motion.div
          layoutId="activePayment"
          className="absolute -top-1 -right-1 bg-slate-900 text-red-600 p-1 rounded-full shadow-lg"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          <CheckCircle2 size={12} />
        </motion.div>
      )}
    </button>
  );
}
