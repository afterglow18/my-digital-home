import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { SceneContainer, springBouncy, springSnappy } from './Shared';

export const Scene0 = () => {
  const [phase, setPhase] = useState(-1);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(0), 400),
      setTimeout(() => setPhase(1), 900),
      setTimeout(() => setPhase(2), 1400),
      setTimeout(() => setPhase(3), 1900),
      setTimeout(() => setPhase(4), 2400),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <SceneContainer style={{ backgroundColor: 'var(--color-brand-cream)' }}>
      {/* Background Video */}
      <motion.video
        autoPlay
        muted
        loop
        playsInline
        src={`${import.meta.env.BASE_URL}videos/90s_runway.mp4`}
        className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm"
      />
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(26,26,26,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(26,26,26,0.1)_1px,transparent_1px)] bg-[size:4cqw_4cqw]" />

      <div className="relative w-full h-full flex flex-col items-center justify-center">
        {/* Title */}
        <motion.div
          className="absolute top-[12cqh] z-10 w-[90%]"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, ...springSnappy }}
        >
          <h1 className="font-display font-black text-center text-[10cqw] leading-[0.9] tracking-tighter uppercase" style={{ color: 'var(--color-brand-black)' }}>
            Build Your<br />
            <span className="text-stroke" style={{ WebkitTextStroke: '2px var(--color-brand-pink)' }}>Dream Look</span>
          </h1>
        </motion.div>

        {/* Clothing Items */}
        <div className="relative w-[80cqw] h-[55cqh] mt-[15cqh]">
          {/* Top */}
          <motion.img
            src={`${import.meta.env.BASE_URL}images/top.jpeg`}
            className="absolute top-[5%] left-[20%] w-[50cqw] object-contain rounded-xl"
            style={{ filter: 'drop-shadow(4px 6px 12px rgba(0,0,0,0.25))' }}
            initial={{ scale: 0, y: -100, rotate: -15 }}
            animate={phase >= 0 ? { scale: 1, y: 0, rotate: -5 } : { scale: 0, y: -100, rotate: -15 }}
            transition={springBouncy}
          />
          
          {/* Skirt */}
          <motion.img
            src={`${import.meta.env.BASE_URL}images/skirt.jpeg`}
            className="absolute top-[35%] left-[25%] w-[45cqw] object-contain rounded-xl"
            style={{ filter: 'drop-shadow(4px 6px 12px rgba(0,0,0,0.25))' }}
            initial={{ scale: 0, y: -100, rotate: 20 }}
            animate={phase >= 1 ? { scale: 1, y: 0, rotate: 5 } : { scale: 0, y: -100, rotate: 20 }}
            transition={springBouncy}
          />

          {/* Shoes */}
          <motion.img
            src={`${import.meta.env.BASE_URL}images/shoes.jpeg`}
            className="absolute bottom-[5%] left-[20%] w-[40cqw] object-contain rounded-xl z-10"
            style={{ filter: 'drop-shadow(4px 6px 12px rgba(0,0,0,0.25))' }}
            initial={{ scale: 0, x: -100, rotate: -20 }}
            animate={phase >= 2 ? { scale: 1, x: 0, rotate: -10 } : { scale: 0, x: -100, rotate: -20 }}
            transition={springBouncy}
          />

          {/* Bag */}
          <motion.img
            src={`${import.meta.env.BASE_URL}images/bag.jpeg`}
            className="absolute top-[40%] right-[0%] w-[35cqw] object-contain rounded-xl z-20"
            style={{ filter: 'drop-shadow(4px 6px 12px rgba(0,0,0,0.25))' }}
            initial={{ scale: 0, x: 100, rotate: 30 }}
            animate={phase >= 3 ? { scale: 1, x: 0, rotate: 15 } : { scale: 0, x: 100, rotate: 30 }}
            transition={springBouncy}
          />

          {/* Earrings */}
          <motion.img
            src={`${import.meta.env.BASE_URL}images/earrings.jpeg`}
            className="absolute top-[10%] right-[10%] w-[25cqw] object-contain rounded-xl z-30"
            style={{ filter: 'drop-shadow(4px 6px 12px rgba(0,0,0,0.25))' }}
            initial={{ scale: 0, y: -50, rotate: 45 }}
            animate={phase >= 4 ? { scale: 1, y: 0, rotate: 10 } : { scale: 0, y: -50, rotate: 45 }}
            transition={springBouncy}
          />
        </div>
      </div>
    </SceneContainer>
  );
};
