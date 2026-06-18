import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Tv, Play, Calendar, Clock, Radio, ArrowRight, ExternalLink, VolumeX } from 'lucide-react';
import { useActiveLiveShop } from '../../hooks/useActiveLiveShop';
import { liveShopService } from '../../services/liveShopService';

export function HomeLiveShopSection() {
  const { activeLive, scheduledLive, loading } = useActiveLiveShop();
  const [countdown, setCountdown] = useState({ days: '00', hours: '00', minutes: '00', seconds: '00' });

  // Countdown timer calculation for scheduled live
  useEffect(() => {
    if (scheduledLive && scheduledLive.status === 'agendada') {
      const calcTimer = () => {
        const targetStr = `${scheduledLive.date}T${scheduledLive.time || '20:00'}:00`;
        const target = new Date(targetStr).getTime();
        const now = new Date().getTime();
        const difference = target - now;

        if (difference <= 0) {
          setCountdown({ days: '00', hours: '00', minutes: '00', seconds: '00' });
          return;
        }

        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hrs = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((difference % (1000 * 60)) / 1000);

        setCountdown({
          days: String(days).padStart(2, '0'),
          hours: String(hrs).padStart(2, '0'),
          minutes: String(mins).padStart(2, '0'),
          seconds: String(secs).padStart(2, '0')
        });
      };

      calcTimer();
      const interval = setInterval(calcTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [scheduledLive]);

  if (loading) return null;

  // Render AO VIVO Section
  if (activeLive && activeLive.status === 'ao_vivo') {
    const embedUrl = liveShopService.getEmbedUrl(activeLive.streamingUrl);
    // Force mute query parameters
    const getMutedUrl = (url: string) => {
      if (!url) return '';
      try {
        const parsed = new URL(url);
        parsed.searchParams.set('mute', '1');
        parsed.searchParams.set('muted', '1');
        return parsed.toString();
      } catch {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}mute=1&muted=1`;
      }
    };

    return (
      <section className="relative w-full max-w-7xl mx-auto px-4 py-8" id="home-live-now-section">
        <div className="relative rounded-3xl overflow-hidden border border-red-950/50 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 p-6 md:p-8 shadow-[0_0_50px_rgba(220,38,38,0.15)]">
          {/* Neon Glow Lines */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-600 to-transparent shadow-[0_0_10px_rgba(220,38,38,0.8)]" />
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-600/30 to-transparent" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Live Meta Texts */}
            <div className="lg:col-span-7 space-y-4 text-left">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 bg-red-650/10 border border-red-600/40 text-red-500 text-[10px] font-black uppercase tracking-[3px] px-3 py-1.5 rounded-full animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  AO VIVO AGORA
                </span>
                {activeLive.settings?.showLiveBadge && (
                  <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-zinc-500" />
                    Transmissão Exclusiva
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-xl md:text-3xl font-black uppercase tracking-wider text-white">
                  {activeLive.title}
                </h2>
                {activeLive.subtitle && (
                  <p className="text-xs md:text-sm font-semibold tracking-wide text-zinc-400 mt-1">
                    {activeLive.subtitle}
                  </p>
                )}
              </div>

              <p className="text-xs text-zinc-500 leading-relaxed font-medium max-w-2xl">
                {activeLive.description || "Acompanhe nossa Live Shop interativa agora mesmo! Explore as lingeries exclusivas e faça compras com condições promocionais imperdíveis em tempo real sob total sigilo."}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4 pt-2">
                <Link
                  to="/live"
                  className="px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-[2px] rounded-xl shadow-lg shadow-red-950/50 transition-all duration-300 transform hover:-translate-y-0.5 flex items-center gap-2"
                >
                  <Play size={14} className="fill-white" />
                  Assistir Live Shop
                </Link>
                {activeLive.settings?.showRelatedProducts && (
                  <Link
                    to="/live"
                    className="px-6 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-black uppercase tracking-[2px] border border-zinc-800 rounded-xl transition-all duration-300 flex items-center gap-2"
                  >
                    Ver ofertas
                    <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            </div>

            {/* Live Inline Preview (Mini player inline) */}
            <div className="lg:col-span-5 h-full w-full">
              {activeLive.settings?.enableFloatingPlayer ? (
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-zinc-800 bg-black group shadow-lg">
                  {/* Silent embed loading */}
                  <iframe
                    src={getMutedUrl(embedUrl)}
                    title="Live Stream Inline Stream"
                    className="w-full h-full border-0 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity"
                    allow="autoplay; encrypted-media; picture-in-picture"
                  />
                  {/* Subtle mute tag */}
                  <div className="absolute top-3 left-3 bg-black/80 px-2 py-1 rounded text-[9px] font-bold text-zinc-400 flex items-center gap-1">
                    <VolumeX size={10} />
                    MUDO (PRÉVIA)
                  </div>

                  {/* Redirection click boundary */}
                  <Link
                    to="/live"
                    className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-full bg-red-600/90 text-white flex items-center justify-center scale-95 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-red-950/80">
                      <ExternalLink size={20} />
                    </div>
                  </Link>
                </div>
              ) : (
                <Link
                  to="/live"
                  className="group relative block aspect-video rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 transition-transform duration-300 hover:scale-[1.01]"
                >
                  <div className="absolute inset-0 bg-red-950/10 border-2 border-dashed border-red-900/30 rounded-2xl flex flex-col items-center justify-center p-6 gap-3 group-hover:bg-red-950/20 group-hover:border-red-600/50 transition-all text-center">
                    <Tv className="w-10 h-10 text-red-500 animate-pulse" />
                    <div>
                      <p className="text-xs font-black uppercase text-white tracking-[1.5px]">Apenas na Discreta</p>
                      <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase">Acesse canal para interagir conosco!</p>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Render AGENDADA Section
  if (scheduledLive && scheduledLive.status === 'agendada') {
    // Format scheduled date beautifully
    const formatDateLabel = (dateStr: string, timeStrStr?: string) => {
      try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const dtObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          const label = dtObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
          return `${label} às ${timeStrStr || '20:00'}`;
        }
        return `${dateStr} às ${timeStrStr || '20:00'}`;
      } catch {
        return `${dateStr} às ${timeStrStr || '20:00'}`;
      }
    };

    return (
      <section className="relative w-full max-w-7xl mx-auto px-4 py-8" id="home-live-scheduled-section">
        <div className="relative rounded-3xl overflow-hidden border border-zinc-850 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 p-6 md:p-8 shadow-2xl">
          {/* Subtle neon accents */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Meta and titles */}
            <div className="lg:col-span-7 space-y-4 text-left">
              <span className="inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px] font-black uppercase tracking-[2px] px-3.5 py-1.5 rounded-full">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                PROGRAMADO
              </span>

              <div>
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-white">
                  {scheduledLive.title}
                </h2>
                <p className="text-xs uppercase font-black text-red-500 tracking-[1.5px] mt-1.5 flex items-center gap-1.5">
                  <Clock size={12} />
                  Estreia em: {formatDateLabel(scheduledLive.date, scheduledLive.time)}
                </p>
              </div>

              {scheduledLive.subtitle && (
                <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                  {scheduledLive.subtitle}
                </p>
              )}

              <p className="text-xs text-zinc-500 font-medium leading-relaxed max-w-2xl">
                {scheduledLive.description || "Inscreva-se em nossos canais de alertas para ser avisada na hora do lançamento. Nossa próxima live-commerce trará novidades de lingerie premium inteiramente integradas ao catálogo de compras."}
              </p>

              {/* Action Button */}
              <div className="pt-2">
                <Link
                  to="/live"
                  className="px-6 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-black uppercase tracking-[2px] border border-zinc-800 rounded-xl transition-all duration-300 inline-flex items-center gap-2 shadow-lg hover:shadow-black/60"
                >
                  Visualizar Espaço Live
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            {/* Countdown widget */}
            {scheduledLive.settings?.showCountdown && (
              <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 bg-zinc-900/40 rounded-2xl border border-zinc-850">
                <p className="text-[10px] font-black uppercase tracking-[3px] text-zinc-500 mb-4 flex items-center gap-1.5">
                  <Clock size={12} className="animate-pulse" />
                  CONTAGEM REGRESSIVA
                </p>

                <div className="flex items-center gap-3">
                  {/* Days */}
                  {Number(countdown.days) > 0 && (
                    <>
                      <div className="text-center">
                        <div className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center bg-zinc-950 border border-zinc-800 rounded-xl text-xl md:text-2xl font-black text-white tracking-widest shadow-inner">
                          {countdown.days}
                        </div>
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-1.5 block">Dias</span>
                      </div>
                      <span className="text-zinc-600 font-black text-xl mb-6">:</span>
                    </>
                  )}

                  {/* Hours */}
                  <div className="text-center">
                    <div className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center bg-zinc-950 border border-zinc-800 rounded-xl text-xl md:text-2xl font-black text-white tracking-widest shadow-inner">
                      {countdown.hours}
                    </div>
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-1.5 block">Horas</span>
                  </div>
                  <span className="text-zinc-600 font-black text-xl mb-6">:</span>

                  {/* Minutes */}
                  <div className="text-center">
                    <div className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center bg-zinc-950 border border-zinc-800 rounded-xl text-xl md:text-2xl font-black text-white tracking-widest shadow-inner">
                      {countdown.minutes}
                    </div>
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-1.5 block">Min</span>
                  </div>
                  <span className="text-zinc-600 font-black text-xl mb-6">:</span>

                  {/* Seconds */}
                  <div className="text-center">
                    <div className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center bg-zinc-800/10 border border-red-950 text-red-500 rounded-xl text-xl md:text-2xl font-black tracking-widest shadow-inner">
                      {countdown.seconds}
                    </div>
                    <span className="text-[9px] font-black text-red-500/60 uppercase tracking-widest mt-1.5 block">Seg</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Fallback
  return null;
}
