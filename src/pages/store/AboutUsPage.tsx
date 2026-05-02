import { motion } from "motion/react";

export default function AboutUsPage() {
  return (
    <div className="flex-1 bg-black text-white py-24 px-4">
      <div className="max-w-5xl mx-auto space-y-16">
        <header className="text-center space-y-4">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-7xl font-black uppercase tracking-tighter italic"
          >
            Quem <span className="text-red-600">Somos</span>
          </motion.h1>
          <p className="text-zinc-500 font-medium uppercase tracking-[0.3em] text-xs">
            A essência da sofisticação e do prazer.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none">Nossa <br/> Trajetória</h2>
            <p className="text-zinc-400 leading-relaxed">
              A Discreta Boutique nasceu da visão de transformar o mercado de bem-estar e prazer em uma experiência de luxo, discrição e seleção impecável. Acreditamos que cada momento é único e merece ser celebrado com produtos que unam qualidade superior e design inovador.
            </p>
            <p className="text-zinc-400 leading-relaxed">
              Mais do que uma loja, somos um refúgio para quem busca explorar seus desejos com segurança, elegância e o suporte de especialistas comprometidos com a satisfação do cliente.
            </p>
          </div>
          <div className="relative aspect-square bg-zinc-900 rounded-[3rem] overflow-hidden border border-zinc-800">
             <div className="absolute inset-0 bg-gradient-to-br from-red-600/20 to-transparent flex items-center justify-center p-12">
                <span className="text-zinc-800 text-9xl font-black italic opacity-20">D</span>
             </div>
          </div>
        </div>

        <section className="grid md:grid-cols-3 gap-8 pt-12 border-t border-zinc-900">
          <div className="space-y-3">
            <div className="h-px w-12 bg-red-600"></div>
            <h3 className="font-black text-xs uppercase tracking-widest text-white">Qualidade</h3>
            <p className="text-zinc-500 text-xs leading-relaxed">Selecionamos apenas marcas que seguem rigorosos padrões internacionais de segurança e durabilidade.</p>
          </div>
          <div className="space-y-3">
            <div className="h-px w-12 bg-zinc-700"></div>
            <h3 className="font-black text-xs uppercase tracking-widest text-white">Discrição</h3>
            <p className="text-zinc-500 text-xs leading-relaxed">Toda a jornada, da navegação à entrega, é pensada para garantir sua total privacidade.</p>
          </div>
          <div className="space-y-3">
            <div className="h-px w-12 bg-zinc-700"></div>
            <h3 className="font-black text-xs uppercase tracking-widest text-white">Seleção</h3>
            <p className="text-zinc-500 text-xs leading-relaxed">Produtos escolhidos por especialistas para proporcionar experiências sensoriais inesquecíveis.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
