import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FCFAFF] flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-2xl bg-[#F1EAFF] border border-[#E3D6FA] flex items-center justify-center animate-spin mb-4">
          <div className="w-4 h-4 rounded-full bg-[#593B91]" />
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-[#756D82]">
          Verifying PlaySpace Session...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

