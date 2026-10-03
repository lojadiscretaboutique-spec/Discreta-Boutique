import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Sparkles, 
  Gift, 
  X, 
  CheckCircle2, 
  Volume2, 
  VolumeX, 
  Printer, 
  ShoppingBag,
  Award
} from 'lucide-react';
import { rouletteService } from '../../services/rouletteService';
import { rouletteAudio } from '../../utils/rouletteAudio';
import { RouletteConfig, RoulettePrize, WheelSlice } from '../../types/roulette';

interface RouletteWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderTotal: number;
  customerName?: string;
  customerWhatsapp?: string;
  onSpinCompleted?: (result: { isWin: boolean; prizeName?: string }) => void;
}

export function RouletteWheelModal({
  isOpen,
  onClose,
  orderId,
  orderTotal,
  customerName,
  customerWhatsapp,
  onSpinCompleted,
}: RouletteWheelModalProps) {
  const [config, setConfig] = useState<RouletteConfig | null>(null);
  const [slices, setSlices] = useState<WheelSlice[]>([]);
  const [prizes, setPrizes] = useState<RoulettePrize[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  // Result state
  const [spinResult, setSpinResult] = useState<{
    isWin: boolean;
    prizeWon?: RoulettePrize;
    phraseLanded?: string;
  } | null>(null);
  const [showResultCard, setShowResultCard] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationAngleRef = useRef(0);
  const animFrameIdRef = useRef<number | null>(null);
  const lastTickSliceRef = useRef<number>(-1);

  // Load config & build slices on open
  useEffect(() => {
    if (!isOpen) {
      setHasSpun(false);
      setSpinResult(null);
      setShowResultCard(false);
      setIsSpinning(false);
      return;
    }

    let isMounted = true;

    const setup = async () => {
      try {
        const loadedConfig = await rouletteService.getConfig();
        if (!isMounted) return;
        setConfig(loadedConfig);

        const { slices: builtSlices, prizes: builtPrizes } = await rouletteService.buildWheelSlices(loadedConfig);
        if (!isMounted) return;
        setSlices(builtSlices);
        setPrizes(builtPrizes);

        // Play celebration intro audio
        if (loadedConfig.soundEnabled) {
          setTimeout(() => {
            rouletteAudio.playCelebrationIntro();
          }, 300);
        }
      } catch (err) {
        console.error('Error setting up roulette:', err);
      }
    };

    setup();

    return () => {
      isMounted = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isOpen]);

  // Render Wheel Canvas
  const drawWheel = (angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas || slices.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 20;
    const totalSlices = slices.length;
    const sliceAngle = (2 * Math.PI) / totalSlices;

    ctx.clearRect(0, 0, width, height);

    // Outer decorative golden ring with bulbs
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 14, 0, 2 * Math.PI);
    ctx.fillStyle = '#b45309';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fef08a';
    ctx.stroke();

    // Decorative bulbs around rim
    const numBulbs = 24;
    for (let b = 0; b < numBulbs; b++) {
      const bAngle = (b * (2 * Math.PI)) / numBulbs;
      const bx = centerX + (radius + 8) * Math.cos(bAngle);
      const by = centerY + (radius + 8) * Math.sin(bAngle);
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, 2 * Math.PI);
      ctx.fillStyle = b % 2 === 0 ? '#fef08a' : '#ffffff';
      ctx.shadowColor = '#fef08a';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    // Draw Slices
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle);

    for (let i = 0; i < totalSlices; i++) {
      const slice = slices[i];
      const startA = i * sliceAngle;
      const endA = startA + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startA, endA);
      ctx.closePath();

      ctx.fillStyle = slice.color;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff25';
      ctx.stroke();

      // Slice label text
      ctx.save();
      ctx.rotate(startA + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = slice.textColor || '#ffffff';
      ctx.font = slice.isWin 
        ? 'bold 13px system-ui, sans-serif' 
        : '11px system-ui, sans-serif';

      const label = slice.label.length > 22 ? slice.label.slice(0, 20) + '...' : slice.label;
      ctx.fillText(label, radius - 18, 4);
      ctx.restore();
    }

    ctx.restore();

    // Center Hub Rim
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, 46, 0, 2 * Math.PI);
    ctx.fillStyle = '#18181b';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#e11d48';
    ctx.stroke();
    ctx.restore();
  };

  // Re-draw when slices load or change
  useEffect(() => {
    drawWheel(rotationAngleRef.current);
  }, [slices]);

  // Spin Engine
  const startSpin = async () => {
    if (isSpinning || hasSpun || slices.length === 0) return;

    setIsSpinning(true);

    try {
      // Determine the outcome using 10% hit rate and 10x margin protection
      const outcome = await rouletteService.determineSpinOutcome(orderTotal, slices, prizes);

      const totalSlices = slices.length;
      const sliceAngle = (2 * Math.PI) / totalSlices;

      // Pointer is at TOP (angle = 3 * Math.PI / 2 or -Math.PI / 2)
      // We want `targetSliceIndex` to stop right under the top pointer!
      const targetSliceCenter = outcome.targetSliceIndex * sliceAngle + sliceAngle / 2;
      const pointerTargetAngle = (3 * Math.PI) / 2;

      // Current angle normalized
      const currentAngle = rotationAngleRef.current % (2 * Math.PI);
      const rotations = 6 * 2 * Math.PI; // 6 full 360-degree rotations

      // Calculate final target angle
      const finalAngle = rotationAngleRef.current + rotations + (pointerTargetAngle - targetSliceCenter - currentAngle) + (2 * Math.PI);

      const startTime = performance.now();
      const spinDuration = 5200; // 5.2 seconds

      const startAngle = rotationAngleRef.current;
      const totalDelta = finalAngle - startAngle;

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / spinDuration);

        // Quintic / Quartic Ease Out for authentic heavy casino wheel deceleration
        const easeOut = 1 - Math.pow(1 - progress, 4);

        const currentRot = startAngle + totalDelta * easeOut;
        rotationAngleRef.current = currentRot;

        // Sound tick effect when passing slices
        const currentSliceUnderPointer = Math.floor(
          (((3 * Math.PI) / 2 - (currentRot % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / sliceAngle
        );

        if (currentSliceUnderPointer !== lastTickSliceRef.current) {
          lastTickSliceRef.current = currentSliceUnderPointer;
          if (soundOn) {
            rouletteAudio.playTick();
          }
        }

        drawWheel(currentRot);

        if (progress < 1) {
          animFrameIdRef.current = requestAnimationFrame(animate);
        } else {
          // Finished spinning!
          setIsSpinning(false);
          setHasSpun(true);
          setSpinResult({
            isWin: outcome.isWin,
            prizeWon: outcome.prizeWon,
            phraseLanded: outcome.phraseLanded,
          });

          // Record spin in Firestore
          rouletteService.recordSpinResult({
            orderId,
            orderTotal,
            customerName,
            customerWhatsapp,
            resultType: outcome.isWin ? 'WIN' : 'LOSS',
            prizeWon: outcome.prizeWon?.name,
            prizeCost: outcome.prizeWon?.costPrice,
            phraseLanded: outcome.phraseLanded,
            newAccumulatedRevenue: outcome.newAccumulatedRevenue,
          });

          // Fanfare and Celebration
          setTimeout(() => {
            setShowResultCard(true);
            if (outcome.isWin) {
              if (soundOn) rouletteAudio.playWinnerFanfare();
              confetti({
                particleCount: 160,
                spread: 100,
                origin: { y: 0.5 },
                colors: ['#e11d48', '#fbbf24', '#ffffff', '#9333ea'],
              });
            } else {
              if (soundOn) rouletteAudio.playTryAgain();
            }

            if (onSpinCompleted) {
              onSpinCompleted({
                isWin: outcome.isWin,
                prizeWon: outcome.prizeWon?.name,
              });
            }
          }, 350);
        }
      };

      animFrameIdRef.current = requestAnimationFrame(animate);
    } catch (err) {
      console.error('Spin error:', err);
      setIsSpinning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 overflow-y-auto select-none animate-fade-in text-white">
      {/* Top Banner & Sound Controls */}
      <div className="w-full max-w-4xl flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-600 rounded-2xl shadow-lg shadow-red-600/30">
            <Gift className="w-6 h-6 text-white animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-red-500 font-mono">
                PDV Premiado
              </span>
              <span className="text-[10px] bg-red-950 text-red-300 border border-red-800/40 px-2 py-0.5 rounded-full font-mono">
                Compra: R$ {orderTotal.toFixed(2).replace('.', ',')}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-rose-50 tracking-tight">
              {config?.name || 'Roleta Premiada Discreta'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundOn(!soundOn)}
            className="p-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl transition cursor-pointer"
            title={soundOn ? 'Desativar som' : 'Ativar som'}
          >
            {soundOn ? <Volume2 className="w-5 h-5 text-emerald-400" /> : <VolumeX className="w-5 h-5 text-zinc-500" />}
          </button>

          <button
            onClick={onClose}
            className="p-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Wheel Area */}
      <div className="relative my-auto flex flex-col items-center justify-center py-2">
        {/* Pointer Arrow at Top pointing downward */}
        <div className="relative z-30 mb-[-24px] filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
          <div className="w-0 h-0 border-l-[18px] border-l-transparent border-r-[18px] border-r-transparent border-t-[34px] border-t-amber-400"></div>
          <div className="w-2.5 h-2.5 bg-white rounded-full mx-auto mt-[-28px] shadow-sm"></div>
        </div>

        {/* Canvas Wheel */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={520}
            height={520}
            className="max-w-[88vw] max-h-[58vh] aspect-square drop-shadow-[0_0_35px_rgba(225,29,72,0.25)]"
          />

          {/* Center Spin Button */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <button
              type="button"
              disabled={isSpinning || hasSpun}
              onClick={startSpin}
              className={`pointer-events-auto w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-red-500 via-rose-600 to-red-800 border-4 border-amber-300 text-white font-black text-xs sm:text-sm uppercase tracking-wider flex flex-col items-center justify-center shadow-[0_0_25px_rgba(225,29,72,0.6)] transition-all cursor-pointer ${
                isSpinning
                  ? 'opacity-80 scale-95 cursor-not-allowed'
                  : hasSpun
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:scale-105 hover:shadow-[0_0_35px_rgba(225,29,72,0.9)] animate-pulse'
              }`}
            >
              <Sparkles className="w-5 h-5 mb-0.5 text-amber-200" />
              <span>{isSpinning ? 'GIRANDO...' : hasSpun ? 'CONCLUÍDO' : 'GIRAR!'}</span>
            </button>
          </div>
        </div>

        {/* Instructions banner */}
        {!hasSpun && !isSpinning && (
          <p className="text-xs text-zinc-400 mt-4 text-center animate-bounce">
            👉 Clique no centro da roleta para girar e testar a sorte!
          </p>
        )}
      </div>

      {/* Bottom Footer Details */}
      <div className="w-full max-w-md text-center py-2 text-xs text-zinc-500">
        Cliente: <strong className="text-zinc-300">{customerName || 'Cliente Balcão'}</strong> • Pedido #{orderId.slice(-6).toUpperCase()}
      </div>

      {/* Result Announcement Overlay */}
      {showResultCard && spinResult && (
        <div className="fixed inset-0 z-[160] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-scale-up">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-lg w-full text-center p-8 sm:p-10 shadow-2xl relative overflow-hidden">
            {spinResult.isWin ? (
              <>
                <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-amber-400 via-rose-500 to-red-600 animate-pulse" />
                <div className="w-20 h-20 bg-amber-500/10 border-2 border-amber-400 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-amber-500/20">
                  <Award className="w-10 h-10 animate-bounce" />
                </div>
                <span className="text-xs uppercase font-black tracking-widest text-amber-400 font-mono block mb-1">
                  🎉 PARABÉNS! TEMOS UMA GANHADORA! 🎉
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mb-4">
                  VOCÊ GANHOU:
                </h2>
                <div className="bg-gradient-to-br from-red-950/60 to-zinc-900 border-2 border-red-500/50 p-6 rounded-3xl mb-6 shadow-xl">
                  <span className="text-2xl sm:text-3xl font-black text-rose-300 block leading-tight">
                    🏆 {spinResult.prizeWon?.name}
                  </span>
                  <span className="text-xs text-zinc-400 block mt-2">
                    Entregue o brinde para a cliente ou registre na sacola!
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-zinc-900 border border-zinc-700 text-zinc-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8" />
                </div>
                <span className="text-xs uppercase font-extrabold tracking-widest text-zinc-500 font-mono block mb-1">
                  Resultado do Giro
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-3">
                  {spinResult.phraseLanded}
                </h2>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto mb-6">
                  Agradecemos a sua preferência na Discreta Boutique! Continue participando nas próximas compras!
                </p>
              </>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                onClick={onClose}
                className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-600/30 transition cursor-pointer"
              >
                Concluir e Voltar ao PDV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
