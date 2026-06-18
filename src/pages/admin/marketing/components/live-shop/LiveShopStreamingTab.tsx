import React from 'react';
import { Input } from '../../../../../components/ui/input';
import { Sliders, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { LiveSession } from '../../../../../types/liveShop';

interface Props {
  title: string;
  setTitle: (v: string) => void;
  subtitle: string;
  setSubtitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  time: string;
  setTime: (v: string) => void;
  status: LiveSession['status'];
  setStatus: (v: LiveSession['status']) => void;
  streamingUrl: string;
  setStreamingUrl: (v: string) => void;
  coverImage: string;
  setCoverImage: (v: string) => void;
  bannerImage: string;
  setBannerImage: (v: string) => void;
}

export function LiveShopStreamingTab({
  title, setTitle,
  subtitle, setSubtitle,
  description, setDescription,
  date, setDate,
  time, setTime,
  status, setStatus,
  streamingUrl, setStreamingUrl,
  coverImage, setCoverImage,
  bannerImage, setBannerImage
}: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="liveshop-streaming-tab">
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">Título da Live *</label>
          <Input 
            placeholder="Ex: Coleção Inverno - Especial Chá de Lingerie" 
            value={title} 
            onChange={e => setTitle(e.target.value)}
            className="bg-zinc-950 border-zinc-800 text-white focus:border-red-650"
            required
          />
        </div>

        {/* Subtitle */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">Subtítulo / Chamada Rápida</label>
          <Input 
            placeholder="Ex: Ofertas com até 50% de desconto e frete grátis ao vivo!" 
            value={subtitle} 
            onChange={e => setSubtitle(e.target.value)}
            className="bg-zinc-950 border-zinc-800 text-white"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">Descrição do Evento</label>
          <textarea 
            placeholder="Descreva o foco da transmissão de live commerce de forma atrativa..." 
            value={description} 
            onChange={e => setDescription(e.target.value)}
            className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Date */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">Data de Lançamento</label>
            <Input 
              type="date"
              value={date} 
              onChange={e => setDate(e.target.value)}
              className="bg-zinc-950 border-zinc-800 text-white"
              required
            />
          </div>

          {/* Time */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">Hora de Início</label>
            <Input 
              placeholder="Ex: 20:00" 
              value={time} 
              onChange={e => setTime(e.target.value)}
              className="bg-zinc-950 border-zinc-800 text-white"
              required
            />
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">Status Inicial</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as any)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-600"
          >
            <option value="agendada">Agendada (Contagem Regressiva)</option>
            <option value="ao_vivo">Ao Vivo / Estreando (Player Interativo)</option>
            <option value="encerrada">Encerrada (Histórico)</option>
          </select>
        </div>
      </div>

      <div className="space-y-4 bg-zinc-950/40 p-5 rounded-xl border border-zinc-805/50">
        {/* Streaming URL */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">
            URL da Transmissão (YouTube, Vimeo, Twitch) *
          </label>
          <div className="relative">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <Input 
              placeholder="Ex: https://www.youtube.com/watch?v=..." 
              value={streamingUrl} 
              onChange={e => setStreamingUrl(e.target.value)}
              className="bg-zinc-950 border-zinc-800 pl-10 text-white"
              required
            />
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">
            Insira o link padrão de compartilhamento. O sistema converterá internamente de forma automática para o formato de incorporação responsivo.
          </p>
        </div>

        {/* Cover Image */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">URL da Imagem de Capa (Mobile / Card)</label>
          <div className="relative mb-2">
            <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <Input 
              placeholder="Ex: https://lojadiscreta.com/capa.jpg" 
              value={coverImage} 
              onChange={e => setCoverImage(e.target.value)}
              className="bg-zinc-950 border-zinc-800 pl-10 text-white"
            />
          </div>
          {coverImage && (
            <div className="relative h-24 w-full overflow-hidden rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <img 
                src={coverImage} 
                alt="Feed Cover Preview" 
                className="h-full w-full object-cover opacity-60" 
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} 
              />
              <span className="absolute text-[10px] font-bold uppercase bg-black/60 px-2 py-0.5 rounded text-white">Preview Capa</span>
            </div>
          )}
        </div>

        {/* Banner Image */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">URL do Banner Principal (Desktop Display)</label>
          <div className="relative mb-2">
            <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <Input 
              placeholder="Ex: https://lojadiscreta.com/banner.jpg" 
              value={bannerImage} 
              onChange={e => setBannerImage(e.target.value)}
              className="bg-zinc-950 border-zinc-800 pl-10 text-white"
            />
          </div>
          {bannerImage && (
            <div className="relative h-20 w-full overflow-hidden rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <img 
                src={bannerImage} 
                alt="Desktop Banner Preview" 
                className="h-full w-full object-cover opacity-60" 
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} 
              />
              <span className="absolute text-[10px] font-bold uppercase bg-black/60 px-2 py-0.5 rounded text-white">Preview Banner</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default LiveShopStreamingTab;
