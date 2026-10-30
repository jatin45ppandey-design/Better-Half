import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Gamepad2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const completionRef = useRef<Promise<void> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const completeSignIn = async (): Promise<void> => {
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

      const providerError =
        query.get('error_description') ||
        query.get('error') ||
        hash.get('error_description') ||
        hash.get('error');

      if (providerError) {
        throw new Error(providerError);
      }

      let session = null;
      const code = query.get('code');

      if (code) {
        // PKCE callback: exchange the one-time authorization code for a session.
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        session = data.session;
      } else {
        // Compatibility with an implicit-flow callback or a session already
        // restored by another tab. Tokens are never logged or rendered.
        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          session = data.session;
        } else {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          session = data.session;
        }
      }

      if (!session?.user?.id) {
        throw new Error(
          'Google returned to PlaySpace, but no authenticated session was established. Please retry sign-in.'
        );
      }
    };

    // React StrictMode replays effects in development. Keep one in-flight
    // exchange promise so the single-use PKCE code is never exchanged twice.
    if (!completionRef.current) {
      completionRef.current = completeSignIn();
    }

    void completionRef.current
      .then(() => {
        if (active) {
          navigate('/dashboard', { replace: true });
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error(
          '[Auth Callback] Google sign-in could not be completed:',
          error instanceof Error ? error.message : 'Unknown callback error'
        );
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Google sign-in could not be completed. Please try again.'
        );
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#FCFAFF] px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-[#EAE3F3] bg-white p-8 text-center shadow-xl shadow-[#593B91]/5">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#9670E8] to-[#593B91] text-white">
          <Gamepad2 className="h-6 w-6" />
        </div>

        {errorMessage ? (
          <>
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#FDF0F2] text-[#D94C65]">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-extrabold text-[#211A2D]">
              Sign-in could not be completed
            </h1>
            <p role="alert" className="mt-3 break-words text-sm leading-relaxed text-[#756D82]">
              {errorMessage}
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#593B91] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#6C42B3]"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto mb-4 h-7 w-7 animate-spin text-[#9670E8]" />
            <h1 className="text-xl font-extrabold text-[#211A2D]">
              Completing your sign-in
            </h1>
            <p className="mt-2 text-sm text-[#756D82]">
              Verifying your Google session and preparing your game lobby.
            </p>
          </>
        )}
      </section>
    </main>
  );
};
