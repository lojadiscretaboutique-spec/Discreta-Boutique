import { motion } from "motion/react";

export default function LGPDPage() {
  return (
    <div className="flex-1 bg-black text-white py-24 px-4">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="text-center space-y-4">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-black uppercase tracking-tighter italic"
          >
            Proteção de <span className="text-red-600">Dados (LGPD)</span>
          </motion.h1>
          <p className="text-zinc-500 font-medium uppercase tracking-[0.2em] text-xs">
            Conformidade integral com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
          </p>
        </header>

        <section className="bg-zinc-950/50 border border-zinc-900 rounded-[2.5rem] p-8 md:p-12 space-y-8 leading-relaxed text-zinc-400">
          <p>
            A Discreta Boutique reafirma seu compromisso com a transparência e a autodeterminação informativa no tratamento de seus dados pessoais.
          </p>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Seus Direitos como Titular</h2>
            <ul className="list-disc pl-5 space-y-3 marker:text-red-600">
              <li>Confirmação da existência de tratamento dos seus dados.</li>
              <li>Acesso irrestrito aos seus dados armazenados em nossa plataforma.</li>
              <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade.</li>
              <li>Portabilidade dos dados a outro fornecedor de serviço, mediante requisição expressa.</li>
              <li>Revogação do consentimento para tratamento de dados a qualquer momento.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Como Exercer Seus Direitos</h2>
            <p>
              Para qualquer solicitação referente à LGPD, o titular dos dados pode entrar em contato diretamente com nossa equipe de Compliance através do e-mail de suporte. Processaremos suas requisições com a agilidade exigida pela legislação vigente.
            </p>
          </div>

          <div className="pt-8 border-t border-zinc-900">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-black italic">
              Última atualização: Maio de 2024.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
