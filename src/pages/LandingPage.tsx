import React from 'react';
import { Navbar } from '../components/navigation/Navbar';
import { Footer } from '../components/navigation/Footer';
import { ProductHeroSection } from '../components/landing/ProductHeroSection';
import { ProductModeSection } from '../components/landing/ProductModeSection';
import { CompactGameDiscovery } from '../components/landing/CompactGameDiscovery';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
      <Navbar />
      <main className="flex-1">
        <ProductHeroSection />
        <ProductModeSection />
        <CompactGameDiscovery />
      </main>
      <Footer />
    </div>
  );
};
