import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { BetterHalfLogo } from '../components/ui/BetterHalfLogo';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const SignupPage: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { loginWithGoogle, isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const fromState = (location.state as any)?.from;
  const rawFrom = fromState?.pathname
    ? `${fromState.pathname}${fromState.search || ''}`
    : typeof fromState === 'string'
    ? fromState
    : null;
  const destination = rawFrom && rawFrom !== '/login' && rawFrom !== '/signup' ? rawFrom : '/dashboard';

  useEffect(() => {
    if (destination && destination !== '/dashboard') {
      sessionStorage.setItem('auth_redirect_destination', destination);
    }
  }, [destination]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, navigate, destination]);

  const handleGoogleSignUp = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (destination && destination !== '/dashboard') {
        sessionStorage.setItem('auth_redirect_destination', destination);
      }
      await loginWithGoogle();
      addToast('Redirecting to Google secure authentication...', { type: 'info' });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initiate Google sign-up. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#FAF6FD] via-[#F4ECFB]/60 to-[#FAF6FD]">
      {/* Back to Home Link */}
      <div className="w-full max-w-md mx-auto mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6B5E82] hover:text-[#7C3AED] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>
      </div>

      {/* Brand Header */}
      <div className="w-full max-w-md mx-auto text-center mb-8">
        <div className="flex justify-center mb-4">
          <BetterHalfLogo size="lg" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E1035] font-heading">
          Get Started with Better-Half
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-[#6B5E82] font-sans">
          One click to start playing 11 original multiplayer games
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#E8DEF8] shadow-xl shadow-purple-950/5 p-6 sm:p-8">
        {/* Error Banner */}
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] flex items-center gap-2.5 text-xs text-[#DC2626] font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Google OAuth Signup */}
        <div className="space-y-4">
          <Button
            type="button"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            className="w-full font-bold flex items-center justify-center gap-3 py-3.5 rounded-2xl shadow-md shadow-purple-900/20"
            onClick={handleGoogleSignUp}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.7 0 3 .6 4 1.5l3-3C17.2 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.1-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 17C3.7 20.7 7.5 24 12 24z"
              />
            </svg>
            <span>Continue with Google</span>
          </Button>

          <p className="text-[11px] text-[#6B5E82] text-center px-4 leading-relaxed">
            Quick one-click onboarding with your Google account. We will set up your player profile automatically.
          </p>
        </div>

        {/* Footer Link to Login */}
        <div className="mt-6 pt-5 border-t border-[#F2EBF9] text-center">
          <p className="text-xs text-[#6B5E82]">
            Already have an account?{' '}
            <Link
              to="/login"
              state={{ from: destination }}
              className="font-bold text-[#7C3AED] hover:text-[#6D28D9] transition-colors"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
