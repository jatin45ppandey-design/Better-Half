import React from 'react';
import { Navbar } from '../components/navigation/Navbar';
import { Footer } from '../components/navigation/Footer';
import { BetterHalfHeroSection } from '../components/landing/BetterHalfHeroSection';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#F7EFFE] via-[#F2E5FC] to-[#EBD6FD]">
      <Navbar />
      <main className="flex-1 flex flex-col justify-start">
        <BetterHalfHeroSection />
      </main>
      <Footer />
    </div>
  );
};
