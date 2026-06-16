import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Wifi, Phone, User, Check, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function WifiHotspotPage() {
  const settings = useSettings();
  const [searchParams] = useSearchParams();

  // Helper to read parameters robustly from the URL, search structure or hashes
  const getParam = (key: string): string => {
    // 1. Try React Router useSearchParams
    const fromRouter = searchParams.get(key);
    if (fromRouter) return fromRouter;

    // 2. Try window.location.search
    const urlParams = new URLSearchParams(window.location.search);
    const fromSearch = urlParams.get(key);
    if (fromSearch) return fromSearch;

    // 3. Try window.location.hash
    const hash = window.location.hash;
    if (hash) {
      const cleanHash = hash.replace(/^[#?]+/, '');
      const hashParams = new URLSearchParams(cleanHash);
      const fromHash = hashParams.get(key);
      if (fromHash) return fromHash;
    }

    return '';
  };

  // Hotspot mandatory URL parameters
  const mac = getParam('mac');
  const ip = getParam('ip');
  const linkLoginOnly = getParam('link-login-only');
  const linkOrig = getParam('link-orig');
  const urlUsername = getParam('username');
  const urlPassword = getParam('password');

  // Form states (Predefined with localStorage values if previously submitted)
  const [name, setName] = useState(() => localStorage.getItem('wifi_lead_name') || '');
  const [phoneInput, setPhoneInput] = useState(() => localStorage.getItem('wifi_lead_phone') || '');
  const [acceptedMarketing, setAcceptedMarketing] = useState(true);
  
  // Feedback and flow control states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [autoAuthenticating, setAutoAuthenticating] = useState(false);

  // -------------------------------------------------------------------------
  // AUTO-AUTHENTICATION BYPASS (Login once pattern)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const isSubmitted = localStorage.getItem('wifi_lead_submitted') === 'true';
    if (isSubmitted) {
      setAutoAuthenticating(true);
      setSuccess(true);

      const timer = setTimeout(() => {
        if (linkLoginOnly) {
          // Programmatic release of hotspot via Hidden Form Submit (POST)
          const form = document.createElement('form');
          form.setAttribute('method', 'post');
          form.setAttribute('action', linkLoginOnly);
          form.style.display = 'none';

          const usernameInput = document.createElement('input');
          usernameInput.type = 'hidden';
          usernameInput.name = 'username';
          usernameInput.value = 'visitante';
          form.appendChild(usernameInput);

          const passwordInput = document.createElement('input');
          passwordInput.type = 'hidden';
          passwordInput.name = 'password';
          passwordInput.value = 'discreta2026';
          form.appendChild(passwordInput);

          const dstInput = document.createElement('input');
          dstInput.type = 'hidden';
          dstInput.name = 'dst';
          dstInput.value = 'https://discretaboutique.com.br';
          form.appendChild(dstInput);

          document.body.appendChild(form);
          form.submit();
        } else {
          // Demonstration mode outside Mikrotik - instant redirect
          window.location.href = 'https://discretaboutique.com.br';
        }
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [linkLoginOnly]);

  // Auto-format Brazilian phone numbers: (XX) XXXXX-XXXX
  const formatPhoneNumber = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    if (formatted.length <= 15) {
      setPhoneInput(formatted);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validations
    if (!name.trim()) {
      setErrorMsg('Por favor, informe seu nome.');
      return;
    }

    const digitsOnly = phoneInput.replace(/\D/g, '');
    if (!phoneInput || digitsOnly.length < 10) {
      setErrorMsg('Por favor, informe um WhatsApp válido com DDD.');
      return;
    }

    if (!acceptedMarketing) {
      setErrorMsg('Você precisa aceitar os termos de marketing para liberar o acesso.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Submit lead details to our backend api
      const response = await fetch('/api/wifi-leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          whatsapp: digitsOnly,
          mac,
          ip,
          userAgent: navigator.userAgent,
          source: 'wifi_loja'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ocorreu um erro ao salvar seus dados.');
      }

      // Persist the submission flags locally to remember the client and adhere to 'login once' requirement
      localStorage.setItem('wifi_lead_submitted', 'true');
      localStorage.setItem('wifi_lead_name', name.trim());
      localStorage.setItem('wifi_lead_phone', phoneInput);

      setSuccess(true);

      // Wait 1.5 seconds for visual transition feedback, then perform programmatic Mikrotik release
      setTimeout(() => {
        if (linkLoginOnly) {
          // Programmatic release of hotspot via Hidden Form Submit (POST)
          const form = document.createElement('form');
          form.setAttribute('method', 'post');
          form.setAttribute('action', linkLoginOnly);
          form.style.display = 'none';

          const usernameInput = document.createElement('input');
          usernameInput.type = 'hidden';
          usernameInput.name = 'username';
          usernameInput.value = 'visitante';
          form.appendChild(usernameInput);

          const passwordInput = document.createElement('input');
          passwordInput.type = 'hidden';
          passwordInput.name = 'password';
          passwordInput.value = 'discreta2026';
          form.appendChild(passwordInput);

          const dstInput = document.createElement('input');
          dstInput.type = 'hidden';
          dstInput.name = 'dst';
          dstInput.value = 'https://discretaboutique.com.br';
          form.appendChild(dstInput);

          document.body.appendChild(form);
          form.submit();
        } else {
          // Standard/Local sandbox simulation and direct redirect (Demonstration mode)
          window.location.href = 'https://discretaboutique.com.br';
        }
      }, 1500);

    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de conexão. Tente novamente.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white relative px-4 overflow-hidden py-12">
      {/* Background Decorative Rings */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-red-950/10 blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-red-900/10 blur-3xl"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-zinc-900/80 border border-zinc-800/80 p-8 rounded-2xl shadow-2xl backdrop-blur-xl relative z-10"
      >
        {/* Header / Brand Identity */}
        <div className="flex flex-col items-center mb-8 text-center">
          {settings.logoUrl ? (
            <img 
              src={settings.logoUrl} 
              alt={settings.storeName} 
              className="h-20 w-auto object-contain mb-4 referrer-policy-no-referrer"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-16 w-16 bg-red-600/10 border border-red-500/20 rounded-full flex items-center justify-center mb-4 text-red-500 shadow-inner">
              <Wifi className="w-8 h-8" />
            </div>
          )}
          <h1 className="text-2xl font-semibold tracking-wide uppercase text-white font-sans">
            {settings.storeName || 'Discreta Boutique'}
          </h1>
          <p className="text-zinc-400 text-xs mt-1.5 tracking-wider font-mono">
            Portal Wi-Fi de Boas-Vindas
          </p>
        </div>

        {/* Premium welcome subtitle/notice */}
        <p className="text-zinc-500 text-xs text-center -mt-4 mb-6 leading-relaxed max-w-xs mx-auto">
          Preencha o cadastro abaixo para liberar as boas-vindas do sinal Wi-Fi de alta velocidade e acompanhar as novidades exclusivas da nossa boutique.
        </p>

        <AnimatePresence mode="wait">
          {!success ? (
            <motion.form 
              key="hotspot-form"
              onSubmit={handleSubmit} 
              className="space-y-5"
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              {/* Name Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 font-sans tracking-wide block">
                  Nome Completo
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-500" />
                  <Input
                    type="text"
                    required
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10.5 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* WhatsApp Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 font-sans tracking-wide block">
                  WhatsApp
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-500" />
                  <Input
                    type="tel"
                    required
                    placeholder="(99) 99999-9999"
                    value={phoneInput}
                    onChange={handlePhoneChange}
                    className="pl-10.5 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Marketing Checkbox */}
              <label 
                className="flex items-start gap-3 p-3 bg-zinc-950/40 border border-zinc-800/40 rounded-xl cursor-pointer select-none group hover:bg-zinc-950/70 transition-colors"
                id="marketing-optin"
              >
                <div className="relative flex items-center h-5 mt-0.5">
                  <input
                    type="checkbox"
                    checked={acceptedMarketing}
                    onChange={(e) => setAcceptedMarketing(e.target.checked)}
                    className="peer sr-only"
                    disabled={isSubmitting}
                  />
                  <div className="w-5 h-5 bg-zinc-950 border border-zinc-800 rounded-md flex items-center justify-center transition-all peer-checked:bg-red-600 peer-checked:border-red-600 peer-focus-visible:ring-2 peer-focus-visible:ring-red-600/50">
                    <Check className="w-3.5 h-3.5 text-white stroke-[3px] opacity-0 peer-checked:opacity-100 transition-opacity" />
                  </div>
                </div>
                <span className="text-xs text-zinc-400 group-hover:text-zinc-300 transition-colors leading-relaxed">
                  Aceito receber comunicações e ofertas da Discreta Boutique pelo WhatsApp.
                </span>
              </label>

              {/* Error Message */}
              {errorMsg && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-red-950/30 border border-red-500/20 text-red-400 rounded-lg text-xs"
                >
                  {errorMsg}
                </motion.div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                variant="default"
                disabled={isSubmitting}
                className="w-full h-12 bg-red-600 hover:bg-red-700 active:bg-red-800 text-sm font-semibold tracking-wide uppercase transition-all shadow-[0_4px_20px_rgba(220,38,38,0.25)] rounded-xl"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Liberando Acesso...</span>
                  </div>
                ) : (
                  <span>Liberar Internet</span>
                )}
              </Button>
            </motion.form>
          ) : (
            <motion.div 
              key="hotspot-success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center text-center space-y-4 py-6"
            >
              <div className="w-16 h-16 bg-emerald-600/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-2">
                <Check className="w-8 h-8 stroke-[2.5]" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-wide">
                {autoAuthenticating ? 'Liberando Wi-Fi...' : 'Acesso Autorizado!'}
              </h2>
              <p className="text-zinc-400 text-xs max-w-xs leading-relaxed">
                {autoAuthenticating 
                  ? `Olá ${name}! Identificamos seu cadastro anterior da boutique. Liberando sua internet automaticamente, aguarde...`
                  : 'Dados validados com sucesso. Estamos liberando seu sinal e te direcionando para a nossa boutique em instantes...'
                }
              </p>
              <div className="flex items-center gap-1.5 text-red-500 mt-2">
                <Heart className="w-4 h-4 fill-current animate-pulse" />
                <span className="text-[10px] font-bold tracking-widest uppercase font-mono">Discreta Boutique</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer info/metadata */}
        <div className="flex flex-col gap-1.5 text-[10px] text-zinc-600 font-mono mt-8 border-t border-zinc-800/40 pt-4 px-1">
          <div className="flex justify-between items-center">
            <span>IP: {ip || 'Detectando'}</span>
            <span>MAC: {mac || 'Detectando'}</span>
          </div>
          {(linkOrig || urlUsername || urlPassword) && (
            <div className="flex justify-between items-center text-[8px] text-zinc-700 font-sans">
              <span className="truncate max-w-[150px]" title={linkOrig}>Dest: {linkOrig || 'Indefinida'}</span>
              <span>ID: {urlUsername || 'Visitante'}</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
