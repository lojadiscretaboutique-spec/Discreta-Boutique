import { motion } from "motion/react";

export default function ExchangePolicyPage() {
  return (
    <div className="flex-1 bg-black text-white py-24 px-4">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="text-center space-y-4">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-black uppercase tracking-tighter italic"
          >
            Política de <span className="text-red-600">Troca</span>
          </motion.h1>
          <p className="text-zinc-500 font-medium uppercase tracking-[0.2em] text-xs">
            Transparência e respeito ao Código de Defesa do Consumidor.
          </p>
        </header>

        <section className="bg-zinc-950/50 border border-zinc-900 rounded-[2.5rem] p-8 md:p-12 space-y-10 leading-relaxed text-zinc-400">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-tight italic">Devolução por Arrependimento</h2>
            <p>
              O cliente tem o prazo de até 7 dias corridos a contar do recebimento do produto para desistir da compra. O produto deve estar em sua embalagem original, lacrado e sem qualquer indício de uso.
            </p>
          </div>

          <div className="space-y-4 p-6 bg-red-600/5 border border-red-600/10 rounded-2xl">
            <h2 className="text-xl font-bold text-red-500 uppercase tracking-tight italic text-sm">Resguardo de Higiene</h2>
            <p className="text-xs">
              Devido à natureza íntima de nossos produtos, por questões de saúde pública e segurança sanitária, **não aceitamos trocas ou devoluções de produtos cujo lacre de segurança tenha sido rompido**, exceto em casos comprovados de vício de fabricação.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-tight italic">Produtos com Defeito</h2>
            <p>
              Caso receba um produto com defeito de fabricação, o prazo para comunicação à nossa central de atendimento é de 30 dias. Realizaremos a análise e, constatado o defeito, a troca será efetuada sem custos operacionais adicionais para o cliente.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-tight italic">Procedimento</h2>
            <p>
              Todo processo de troca deve ser iniciado através do nosso canal de suporte ao cliente, informando o número do pedido e anexando evidências (fotos/vídeos) caso o motivo seja defeito técnico.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
