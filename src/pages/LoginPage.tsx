import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gamepad2, Mail, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { PasswordInput } from '../components/ui/PasswordInput';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const validate = () => {
    const errs: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errs.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Please enter a valid email address';
    }

    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const res = await login(email, password);
      if (res.success) {
        addToast('Welcome back to PlaySpace!', {
          type: 'success',
          message: 'Development mock session active.',
        });
        navigate('/dashboard');
      } else {
        setErrors({ general: res.error || 'Failed to sign in' });
      }
    } catch {
      setErrors({ general: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemo = async () => {
    setEmail('alex.rivera@example.com');
    setPassword('playspace123');
    setIsSubmitting(true);
    await login('alex.rivera@example.com', 'playspace123');
    addToast('Demo Account Loaded!', {
      type: 'success',
      message: 'Signed in as Alex Rivera',
    });
    navigate('/dashboard');
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
          Welcome Back
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-[#756D82]">
          Sign in to access your couple and friend game lobbies
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#EAE3F3] shadow-xl shadow-[#593B91]/5 p-6 sm:p-8">
        {/* Development Mock Notice */}
        <div className="mb-5 p-3 rounded-xl bg-[#F8F4FF] border border-[#EAE3F3] flex items-start gap-2.5 text-xs text-[#593B91]">
          <Sparkles className="w-4 h-4 text-[#9670E8] shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Development Mock Auth:</span> You can sign in with any valid test email or click the instant 1-click Demo button below.
          </div>
        </div>

        {/* General Error Banner */}
        {errors.general && (
          <div className="mb-5 p-3 rounded-xl bg-[#FDF0F2] border border-[#F8D2D9] flex items-center gap-2 text-xs text-[#D94C65] font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errors.general}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            error={errors.email}
            leftIcon={<Mail className="w-4 h-4" />}
            autoComplete="email"
            required
          />

          <div>
            <PasswordInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              error={errors.password}
              autoComplete="current-password"
              required
            />
          </div>

          {/* Remember me & Forgot Password */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 text-[#756D82] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-[#EAE3F3] text-[#593B91] focus:ring-[#9670E8] w-4 h-4"
              />
              <span>Remember me</span>
            </label>

            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-[#593B91] hover:text-[#9670E8] font-semibold transition-colors cursor-pointer"
            >
              Forgot password?
            </button>
          </div>

          {/* Primary Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            className="w-full mt-2 font-bold"
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Sign In
          </Button>
        </form>

        {/* Quick Demo Login Option */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#EAE3F3]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-[#9D96A8] uppercase tracking-wider font-semibold">
              Or Instant Preview
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="md"
          className="w-full font-bold"
          onClick={handleQuickDemo}
          leftIcon={<Sparkles className="w-4 h-4 text-[#9670E8]" />}
        >
          1-Click Demo Login (Alex Rivera)
        </Button>

        {/* Link to Signup */}
        <p className="mt-6 text-center text-xs text-[#756D82]">
          Do not have an account yet?{' '}
          <Link
            to="/signup"
            className="font-bold text-[#593B91] hover:text-[#9670E8] transition-colors"
          >
            Create free account
          </Link>
        </p>
      </div>

      {/* Forgot Password Honest Modal */}
      <Modal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        title="Password Recovery"
        description="Phase 1 Development Notice"
        maxWidth="sm"
      >
        <div className="flex flex-col gap-4 text-xs text-[#756D82] leading-relaxed pt-1">
          <p>
            In this Phase 1 frontend preview, an external SMTP email delivery service is intentionally not configured.
          </p>
          <p className="p-3 rounded-xl bg-[#F8F4FF] border border-[#EAE3F3] text-[#593B91] font-medium">
            You can enter any valid test email and password (min 6 characters), or click <strong>1-Click Demo Login</strong> to immediately access the full platform!
          </p>
          <div className="pt-2 flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowForgotModal(false)}
            >
              Understood
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
