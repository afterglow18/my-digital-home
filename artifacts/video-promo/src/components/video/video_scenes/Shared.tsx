import React from 'react';
import { motion } from 'framer-motion';

export const springBouncy = { type: "spring", stiffness: 300, damping: 15 };
export const springSnappy = { type: "spring", stiffness: 400, damping: 25 };
export const springSmooth = { type: "spring", stiffness: 120, damping: 20 };

export const WardrobeDoorsLayer = ({ isOpen }: { isOpen: boolean }) => (
  <div className="absolute inset-0 pointer-events-none z-[100]" style={{ perspective: '2500px' }}>
    <motion.div
      className="absolute top-0 left-0 w-[50.5%] h-full origin-left border-r-[3px] border-[#1A1A1A] flex items-center justify-end pr-[3cqw]"
      style={{ 
        backgroundImage: `url(${import.meta.env.BASE_URL}images/wood_texture.jpg)`, 
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        boxShadow: isOpen ? '15px 0 40px rgba(0,0,0,0.6)' : '0px 0 0px rgba(0,0,0,0)',
        backfaceVisibility: 'hidden'
      }}
      initial={false}
      animate={{ 
        rotateY: isOpen ? -105 : 0,
      }}
      transition={{ duration: 0.5, ease: [0.33, 1, 0.68, 1] }}
    >
      <div className="w-[1.5cqw] h-[15cqh] min-w-[12px] rounded-sm shadow-md border-[2px] border-[#1A1A1A]" style={{ background: 'linear-gradient(to right, #F5C518, #B8860B)' }} />
    </motion.div>
    <motion.div
      className="absolute top-0 right-0 w-[50.5%] h-full origin-right border-l-[3px] border-[#1A1A1A] flex items-center justify-start pl-[3cqw]"
      style={{ 
        backgroundImage: `url(${import.meta.env.BASE_URL}images/wood_texture.jpg)`, 
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        boxShadow: isOpen ? '-15px 0 40px rgba(0,0,0,0.6)' : '0px 0 0px rgba(0,0,0,0)',
        backfaceVisibility: 'hidden'
      }}
      initial={false}
      animate={{ 
        rotateY: isOpen ? 105 : 0,
      }}
      transition={{ duration: 0.5, ease: [0.33, 1, 0.68, 1] }}
    >
      <div className="w-[1.5cqw] h-[15cqh] min-w-[12px] rounded-sm shadow-md border-[2px] border-[#1A1A1A]" style={{ background: 'linear-gradient(to left, #F5C518, #B8860B)' }} />
    </motion.div>
  </div>
);

export const SceneContainer = ({ children, className = "", style = {} }: { children: React.ReactNode, className?: string, style?: any }) => (
  <motion.div
    className={`absolute inset-0 w-full h-full overflow-hidden flex flex-col items-center justify-center ${className}`}
    style={style}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.1 }}
  >
    {children}
  </motion.div>
);
