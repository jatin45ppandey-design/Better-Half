import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gamepad2, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const SignupPage: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { loginWithGoogle, isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleGoogleSignUp = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await loginWithGoogle();
      addToast('Redirecting to Google secure authentication...', { type: 'info' });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initiate Google sign-up. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#FCFAFF] via-[#F8F4FF] to-[#FCFAFF]">
      {/* Brand Header */}
      <div className="w-full max-w-md mx-auto text-center mb-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 p-1 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9670E8]"
        >
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#9670E8] to-[#593B91] flex items-center justify-center text-white shadow-md shadow-[#593B91]/15">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <span className="font-extrabold text-2xl tracking-tight text-[#211A2D]">
            Play<span className="text-[#9670E8]">Space</span>
          </span>
        </Link>
        <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#211A2D]">
          Create Your Account
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-[#756D82]">
          Join to invite friends and partners into instant real-time games
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#EAE3F3] shadow-xl shadow-[#593B91]/5 p-6 sm:p-8">
        {/* Error Banner */}
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-2xl bg-[#FDF0F2] border border-[#F8D2D9] flex items-center gap-2.5 text-xs text-[#D94C65] font-medium">
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
            className="w-full font-bold flex items-center justify-center gap-3 py-3.5 shadow-md shadow-[#593B91]/15"
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

          <p className="text-[11px] text-[#756D82] text-center px-4 leading-relaxed">
            Quick one-click onboarding with your Google account. We will set up your player profile automatically.
          </p>
        </div>

        {/* Link to Login */}
        <p className="mt-8 text-center text-xs text-[#756D82] border-t border-[#EAE3F3] pt-5">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-bold text-[#593B91] hover:text-[#9670E8] transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
