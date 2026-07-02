import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Save, Sliders, ArrowLeft, Brain, User, MessageSquare, AlertTriangle, 
  Check, Loader2, RefreshCw, Eye, EyeOff, ShieldCheck, Briefcase,
  Upload, Trash2, Image as ImageIcon
} from 'lucide-react';
import { candidateService, DEFAULT_RECRUITMENT_SETTINGS } from '../../services/candidateService';
import { RecruitmentSettings } from '../../types/candidate';
import { useFeedback } from '../../contexts/FeedbackContext';

export default function AdminTrabalheConoscoSettings() {
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Main recruitment settings state
  const [settings, setSettings] = useState<RecruitmentSettings>(DEFAULT_RECRUITMENT_SETTINGS);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const { ref: fileRef, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../../lib/storage');
      
      const storagePath = `branding/recruitment_share_${Date.now()}_${file.name}`;
      const r = fileRef(storage, storagePath);
      await uploadBytes(r, file);
      const downloadUrl = await getDownloadURL(r);
      
      handleChange('shareImageUrl', downloadUrl);
      toast('Imagem de compartilhamento enviada com sucesso!', 'success');
    } catch (err) {
      console.error('[UPLOAD_SHARE_IMAGE_ERROR]', err);
      toast('Erro ao fazer upload da imagem de compartilhamento.', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  // Load settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const data = await candidateService.getSettings();
        setSettings(data);
      } catch (err) {
        console.error('[LOAD_SETTINGS_ERROR]', err);
        toast('Erro ao carregar configurações de recrutamento. Usando valores padrão.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // Save changes to Firestore
  const handleSave = async () => {
    try {
      setSaving(true);
      await candidateService.saveSettings(settings);
      toast('Configurações de recrutamento salvas com sucesso!', 'success');
    } catch (err) {
      console.error('[SAVE_SETTINGS_ERROR]', err);
      toast('Falha ao salvar as configurações.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Restore factory defaults
  const handleRestoreDefaults = async () => {
    if (!confirm('Deseja realmente restaurar todos os campos para as definições de fábrica da Discreta Boutique? Alterações não salvas serão perdidas.')) {
      return;
    }

    try {
      setRestoring(true);
      setSettings(DEFAULT_RECRUITMENT_SETTINGS);
      toast('Campos restaurados para o padrão de fábrica. Clique em Salvar para persistir.', 'info');
    } catch (err) {
      console.error('[RESTORE_DEFAULTS_ERROR]', err);
    } finally {
      setRestoring(false);
    }
  };

  // Helper to handle text/boolean inputs dynamically
  const handleChange = (field: keyof RecruitmentSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4">
        <Loader2 size={32} className="text-red-600 animate-spin" />
        <span className="text-sm text-slate-400 font-mono">Carregando configurações de IA...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/trabalhe-conosco')}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-800 transition-colors"
            title="Voltar para Candidatos"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2 font-serif">
              <Sliders className="text-red-600" size={24} />
              Configurações do Recrutamento IA
            </h1>
            <p className="text-sm text-slate-400">Ajuste o comportamento do chatbot, prompts de IA da OpenAI e textos públicos</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRestoreDefaults}
            disabled={restoring || saving}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} />
            Restaurar Padrões
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-[0_0_15px_rgba(220,38,38,0.25)] disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar Configurações
          </button>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left Column: Public UI Settings (col-span-5) */}
        <div className="md:col-span-5 space-y-6">
          <div className="bg-slate-900/50 border border-slate-900/60 rounded-xl p-5 space-y-5">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2.5 flex items-center gap-2">
              <ShieldCheck className="text-red-500" size={16} />
              Portal Público & Status
            </h3>

            {/* Toggle Form Active/Deactive */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-300 block">Formulário de Inscrição Ativo</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Controla se candidatos podem se inscrever na rota pública</span>
              </div>
              <button
                type="button"
                onClick={() => handleChange('isActive', !settings.isActive)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.isActive ? 'bg-red-600' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.isActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Recruiter Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
                <User size={12} className="text-slate-600" /> Nome da Recrutadora Virtual
              </label>
              <input
                type="text"
                value={settings.recruiterName}
                onChange={(e) => handleChange('recruiterName', e.target.value)}
                placeholder="Ex: Aurora"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600"
              />
            </div>

            {/* Initial Message */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
                <MessageSquare size={12} className="text-slate-600" /> Mensagem Inicial de Boas-Vindas
              </label>
              <textarea
                value={settings.initialMessage}
                onChange={(e) => handleChange('initialMessage', e.target.value)}
                placeholder="Ex: Olá! Sou a Aurora..."
                className="w-full h-24 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-red-600 resize-none"
              />
            </div>

            {/* Final Message */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
                <MessageSquare size={12} className="text-slate-600" /> Mensagem de Sucesso (Fim da Entrevista)
              </label>
              <textarea
                value={settings.finalMessage}
                onChange={(e) => handleChange('finalMessage', e.target.value)}
                placeholder="Ex: Muito obrigada..."
                className="w-full h-28 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-red-600 resize-none"
              />
            </div>
          </div>

          {/* Social Share Preview Configuration */}
          <div className="bg-slate-900/50 border border-slate-900/60 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2.5 flex items-center gap-2">
              <ImageIcon className="text-red-500" size={16} />
              Prévia de Compartilhamento (SEO)
            </h3>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Configure a imagem e a descrição que aparecem quando você compartilha o link <code className="text-red-400 font-mono">discretaboutique.com.br/trabalhe-conosco</code> no WhatsApp, Facebook, Instagram ou outras redes.
            </p>

            {/* Share Description */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                Descrição de Compartilhamento / Vaga
              </label>
              <textarea
                value={settings.shareDescription || ''}
                onChange={(e) => handleChange('shareDescription', e.target.value)}
                placeholder="Ex: Estamos contratando Consultora de Vendas! Faça sua entrevista virtual com a nossa recrutadora e envie seu currículo de forma rápida e discreta."
                className="w-full h-20 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-red-600 resize-none font-sans leading-relaxed"
              />
            </div>

            {/* Share Image Upload */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                Imagem de Compartilhamento (1200x630 recomendado)
              </label>
              
              {settings.shareImageUrl ? (
                <div className="relative group border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                  <img src={settings.shareImageUrl} alt="Preview" className="w-full h-40 object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Deseja realmente remover esta imagem de compartilhamento?')) {
                          handleChange('shareImageUrl', '');
                        }
                      }}
                      className="p-2 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700 font-bold flex items-center gap-1 transition-all"
                    >
                      <Trash2 size={12} />
                      Remover
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-slate-800 rounded-lg p-6 flex flex-col items-center justify-center gap-2 bg-slate-950/40">
                  <ImageIcon size={24} className="text-slate-600" />
                  <span className="text-[10px] text-slate-400">Nenhuma imagem configurada</span>
                  <label className="cursor-pointer px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors flex items-center gap-1.5">
                    {uploadingImage ? (
                      <>
                        <Loader2 size={12} className="animate-spin text-red-500" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={12} className="text-slate-400" />
                        <span>Selecionar Imagem</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingImage}
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Vagas Disponíveis Box */}
          <div className="bg-slate-900/50 border border-slate-900/60 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2.5 flex items-center gap-2">
              <Briefcase className="text-red-500" size={16} />
              Vagas disponíveis
            </h3>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Escreva livremente as vagas realmente abertas no momento. A Aurora responderá estritamente com base neste conteúdo. Se estiver vazio, ela informará que não há vagas cadastradas no momento.
            </p>
            <div className="space-y-1.5">
              <textarea
                value={settings.availableJobsText || ''}
                onChange={(e) => handleChange('availableJobsText', e.target.value)}
                placeholder="Exemplo de conteúdo:&#10;Vaga: Consultora de Vendas&#10;Quantidade: 1&#10;Horário: Comercial&#10;Tipo: Fixa&#10;Descrição: Atendimento presencial e online, organização da loja, suporte em vendas e atendimento via WhatsApp.&#10;Salário: Não informado nesta etapa&#10;Benefícios: Serão informados na entrevista presencial"
                className="w-full h-48 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-red-600 resize-y font-sans leading-relaxed"
              />
            </div>
          </div>

          {/* LGPD Text Box */}
          <div className="bg-slate-900/50 border border-slate-900/60 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2.5 flex items-center gap-2">
              <ShieldCheck className="text-red-500" size={16} />
              Termo LGPD Obrigatório
            </h3>
            <div className="space-y-1.5">
              <textarea
                value={settings.lgpdText}
                onChange={(e) => handleChange('lgpdText', e.target.value)}
                placeholder="Termo de aceite de privacidade da LGPD..."
                className="w-full h-40 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-red-600 resize-none font-sans leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Right Column: AI & OpenAI Prompts (col-span-7) */}
        <div className="md:col-span-7 space-y-6">
          
          {/* Roteiro e Ordem das Perguntas da Entrevista */}
          <div className="bg-slate-900/50 border border-slate-900/60 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2.5 flex items-center gap-2">
              <Sliders className="text-red-500" size={16} />
              Roteiro de Perguntas Obrigatórias (Ordem de Condução)
            </h3>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Defina a ordem e o texto exato das perguntas obrigatórias que a Aurora deve seguir. Cada linha representa um campo e deve seguir estritamente o formato: <code className="text-red-400 font-mono">campoInterno | Pergunta da Aurora</code>. A ordem das linhas define a sequência da entrevista.
            </p>
            <textarea
              value={settings.requiredQuestionsText || ''}
              onChange={(e) => handleChange('requiredQuestionsText', e.target.value)}
              placeholder="Ex: nomeCompleto | Qual seu nome completo?"
              className="w-full h-[280px] bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-red-600 resize-y leading-relaxed"
            />
          </div>

          {/* Main Interview Prompt (Aurora System instructions) */}
          <div className="bg-slate-900/50 border border-slate-900/60 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2.5 flex items-center gap-2">
              <Brain className="text-red-500 animate-pulse" size={16} />
              Prompt do Chat de Recrutamento (Aurora)
            </h3>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Define a personalidade da recrutadora virtual, as perguntas a serem feitas, as regras de conformidade e o uso da tag <code className="text-red-400 font-mono">[ENTREVISTA_CONCLUIDA]</code> para encerrar o chat.
            </p>
            <textarea
              value={settings.promptPrincipal}
              onChange={(e) => handleChange('promptPrincipal', e.target.value)}
              className="w-full h-[260px] bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-red-600 resize-y leading-relaxed"
            />
          </div>

          {/* Admin Analysis Prompt */}
          <div className="bg-slate-900/50 border border-slate-900/60 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2.5 flex items-center gap-2">
              <Brain className="text-red-500" size={16} />
              Prompt do Analista IA (Gerador de Parecer)
            </h3>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Controla o raciocínio da IA ao analisar o perfil completo do candidato. Deve instruir a IA a estruturar o retorno em um JSON compatível com o painel administrativo.
            </p>
            <textarea
              value={settings.promptAnalise}
              onChange={(e) => handleChange('promptAnalise', e.target.value)}
              className="w-full h-[200px] bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-red-600 resize-y leading-relaxed"
            />
          </div>

        </div>

      </div>

    </div>
  );
}
