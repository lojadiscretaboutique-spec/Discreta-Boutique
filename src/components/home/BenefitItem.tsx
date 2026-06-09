import { motion } from 'motion/react';
import React from 'react';

export function BenefitItem({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -8 }}
      whileTap={{ scale: 0.95 }}
      className="flex flex-col items-center text-center group cursor-default p-8 rounded-[3rem] bg-zinc-950/50 hover:bg-zinc-900/40 border border-transparent hover:border-zinc-800 transition-all duration-500"
    >
      <div className="w-24 h-24 bg-zinc-900 border border-zinc-800 text-red-600 rounded-[2.5rem] flex items-center justify-center mb-8 group-hover:bg-red-600 group-hover:text-white group-active:bg-red-700 group-active:text-white transition-all duration-500 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-red-600 blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-700" />
        <div className="relative z-10 transition-transform duration-500 group-hover:scale-110">
          {icon}
        </div>
      </div>
      <h4 className="text-xl font-black uppercase tracking-tight mb-4 text-zinc-100 group-hover:text-red-500 transition-colors">
        {title}
      </h4>
      <p className="text-zinc-500 text-sm leading-relaxed max-w-[220px] group-hover:text-zinc-300 transition-colors">
        {desc}
      </p>
    </motion.div>
  );
}
