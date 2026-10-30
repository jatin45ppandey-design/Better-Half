import React from 'react';
import { Link } from 'react-router-dom';
import { Gamepad2, Home } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FCFAFF] px-4 text-center">
      <div className="w-16 h-16 rounded-3xl bg-[#F1EAFF] text-[#593B91] flex items-center justify-center mb-6 shadow-sm">
        <Gamepad2 className="w-8 h-8 text-[#9670E8]" />
      </div>
      <h1 className="text-6xl font-extrabold text-[#593B91] mb-2 tracking-tight">404</h1>
      <h2 className="text-2xl font-bold text-[#211A2D] mb-2">Page Not Found</h2>
      <p className="text-sm text-[#756D82] max-w-sm mb-6 leading-relaxed">
        The route you are looking for does not exist or has moved. Head back home to continue playing!
      </p>
      <div className="flex items-center gap-3">
        <Link to="/">
          <Button variant="primary" leftIcon={<Home className="w-4 h-4" />}>
            Back to Home
          </Button>
        </Link>
        <Link to="/dashboard">
          <Button variant="secondary">
            Go to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
};
