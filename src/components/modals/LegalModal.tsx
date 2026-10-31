import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms' | null;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  type,
}) => {
  if (!type) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={type === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
      maxWidth="md"
    >
      <div className="space-y-4 text-xs text-[#574A6D] leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
        {type === 'privacy' ? (
          <>
            <p>
              <strong>Better-Half</strong> is committed to protecting your privacy. This policy outlines how your player data and game preferences are handled.
            </p>
            <h4 className="font-bold text-sm text-[#1E1035] pt-2">Data We Collect</h4>
            <p>
              We collect minimal information necessary to deliver multiplayer experiences: your display name, username, avatar preferences, match outcomes, and Google OAuth identifier.
            </p>
            <h4 className="font-bold text-sm text-[#1E1035] pt-2">In-Game Communication</h4>
            <p>
              Chat messages within game rooms are ephemeral and isolated to active participants. Answers submitted in private Couple Mode games are strictly protected by server-side tenancy rules.
            </p>
            <h4 className="font-bold text-sm text-[#1E1035] pt-2">Data Rights</h4>
            <p>
              You may update your profile details or request account deletion at any time through Account Settings or by contacting support.
            </p>
          </>
        ) : (
          <>
            <p>
              Welcome to <strong>Better-Half</strong>. By accessing or using our platform, you agree to these Terms of Service.
            </p>
            <h4 className="font-bold text-sm text-[#1E1035] pt-2">Community Guidelines</h4>
            <p>
              Better-Half is built for joyful, respectful gameplay. Harassment, hateful speech, cheating, or abusive behavior in public or private lobbies is strictly prohibited and subject to immediate suspension.
            </p>
            <h4 className="font-bold text-sm text-[#1E1035] pt-2">Fair Play & Game Integrity</h4>
            <p>
              All game actions, turns, and scores are verified server-side. Tampering with state versions, out-of-turn actions, or impersonation will trigger automated rejection.
            </p>
            <h4 className="font-bold text-sm text-[#1E1035] pt-2">Account Responsibility</h4>
            <p>
              You are responsible for activity conducted through your authenticated account and for keeping room invitation codes secure.
            </p>
          </>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-[#E8DEF8] flex justify-end">
        <Button variant="primary" size="sm" onClick={onClose} className="rounded-full">
          Understood
        </Button>
      </div>
    </Modal>
  );
};

