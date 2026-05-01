import { motion } from "motion/react";

export default function PrivacyPolicyPage() {
  return (
    <div className="flex-1 bg-black text-white py-24 px-4">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="text-center space-y-4">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-black uppercase tracking-tighter italic"
          >
            Política de <span className="text-red-600">Privacidade</span>
          </motion.h1>
          <p className="text-zinc-500 font-medium uppercase tracking-[0.2em] text-xs">
            Sua segurança e privacidade são nossa prioridade máxima.
          </p>
        </header>

        <section className="bg-zinc-950/50 border border-zinc-900 rounded-[2.5rem] p-8 md:p-12 space-y-8 leading-relaxed text-zinc-400">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">1. Coleta de Informações</h2>
            <p>
              Coletamos informações essenciais para processar seus pedidos e proporcionar uma experiência personalizada. Isso inclui dados cadastrais como nome, e-mail, telefone e endereço de entrega.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">2. Uso de Dados</h2>
            <p>
              Seus dados são utilizados exclusivamente para o processamento de compras, melhoria da interface do sistema e comunicações pertinentes aos seus pedidos. Não compartilhamos informações pessoais com terceiros para fins publicitários sem consentimento explícito.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">3. Segurança</h2>
            <p>
              Utilizamos tecnologias de criptografia de ponta a ponta e camadas de segurança sistêmica para garantir que suas informações estejam protegidas contra acessos não autorizados. No ambiente da Discreta Boutique, tratamos cada dado com o rigor necessário para manter a integridade da nossa plataforma.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">4. Cookies</h2>
            <p>
              Empregamos cookies para reconhecer seu navegador e oferecer funcionalidades como o carrinho de compras persistente e recomendações baseadas no seu perfil de navegação.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
