import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gamepad2, User as UserIcon, Mail, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { PasswordInput } from '../components/ui/PasswordInput';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const SignupPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signup } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const validate = () => {
    const errs: typeof errors = {};

    if (!name.trim()) {
      errs.name = 'Full name is required';
    } else if (name.trim().length < 2) {
      errs.name = 'Name must be at least 2 characters';
    }

    if (!email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Please enter a valid email address';
    }

    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }

    if (!confirmPassword) {
      errs.confirmPassword = 'Confirm your password';
    } else if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
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
      const res = await signup(name, email, password);
      if (res.success) {
        addToast(`Welcome to PlaySpace, ${name}!`, {
          type: 'success',
          message: 'Account initialized in development mock environment.',
        });
        navigate('/dashboard');
      } else {
        setErrors({ general: res.error || 'Failed to create account' });
      }
    } catch {
      setErrors({ general: 'Something went wrong. Please try again.' });
    } finally {
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
          Join to invite friends and partners into instant games
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#EAE3F3] shadow-xl shadow-[#593B91]/5 p-6 sm:p-8">
        {/* Development Mock Notice */}
        <div className="mb-5 p-3 rounded-xl bg-[#F8F4FF] border border-[#EAE3F3] flex items-start gap-2.5 text-xs text-[#593B91]">
          <Sparkles className="w-4 h-4 text-[#9670E8] shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Development Sandbox:</span> Signup creates an isolated mock user session. No real passwords or sensitive data are stored.
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
            label="Your Name"
            type="text"
            placeholder="e.g. Jordan Miller"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            error={errors.name}
            leftIcon={<UserIcon className="w-4 h-4" />}
            autoComplete="name"
            required
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="jordan@example.com"
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

          <PasswordInput
            label="Password"
            placeholder="Create password (min 6 chars)"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={errors.password}
            showStrength
            autoComplete="new-password"
            required
          />

          <PasswordInput
            label="Confirm Password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (errors.confirmPassword)
                setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
            }}
            error={errors.confirmPassword}
            autoComplete="new-password"
            required
          />

          {/* Guidelines acknowledgement */}
          <div className="pt-1">
            <label className="flex items-start gap-2 text-xs text-[#756D82] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="rounded border-[#EAE3F3] text-[#593B91] focus:ring-[#9670E8] w-4 h-4 mt-0.5"
                required
              />
              <span>
                I agree to the friendly community gaming etiquette and Phase 1 preview terms.
              </span>
            </label>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            className="w-full mt-2 font-bold"
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Create Account
          </Button>
        </form>

        {/* Link to Login */}
        <p className="mt-6 text-center text-xs text-[#756D82]">
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
