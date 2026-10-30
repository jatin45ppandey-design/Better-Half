import React from 'react';
import { Link } from 'react-router-dom';
import { Gamepad2, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#F8F4FF] border-t border-[#EAE3F3] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand Info */}
          <div className="md:col-span-2 flex flex-col gap-3">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#593B91] flex items-center justify-center text-white shadow-xs">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-[#211A2D]">
                Play<span className="text-[#9670E8]">Space</span>
              </span>
            </Link>
            <p className="text-sm text-[#756D82] max-w-sm leading-relaxed">
              A playful social gaming platform crafted for couples and groups of friends.
              Bringing people closer through 11 lighthearted games, laughter, and cozy vibes.
            </p>
            <div className="inline-flex items-center gap-1.5 text-xs text-[#593B91] font-semibold mt-1">
              <span>Made with</span>
              <Heart className="w-3.5 h-3.5 fill-[#D94C65] text-[#D94C65]" />
              <span>for memorable game nights</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#593B91]">
              Social & Arena
            </h4>
            <ul className="flex flex-col gap-2 text-sm text-[#756D82]">
              <li>
                <Link to="/friends" className="hover:text-[#593B91] transition-colors">
                  Friends & Presence
                </Link>
              </li>
              <li>
                <Link to="/invitations" className="hover:text-[#593B91] transition-colors">
                  Lobby Invitations
                </Link>
              </li>
              <li>
                <Link to="/history" className="hover:text-[#593B91] transition-colors">
                  Match History
                </Link>
              </li>
              <li>
                <Link to="/rivalry" className="hover:text-[#593B91] transition-colors">
                  Rivalry Arena
                </Link>
              </li>
            </ul>
          </div>

          {/* Account / Dashboard */}
          <div className="flex flex-col gap-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#593B91]">
              Account & Settings
            </h4>
            <ul className="flex flex-col gap-2 text-sm text-[#756D82]">
              <li>
                <Link to="/dashboard" className="hover:text-[#593B91] transition-colors">
                  Games & Dashboard
                </Link>
              </li>
              <li>
                <Link to="/profile" className="hover:text-[#593B91] transition-colors">
                  My Player Profile
                </Link>
              </li>
              <li>
                <Link to="/settings" className="hover:text-[#593B91] transition-colors">
                  Audio & Preferences
                </Link>
              </li>

            </ul>
          </div>
        </div>

        {/* Bottom divider and copyright */}
        <div className="pt-8 border-t border-[#EAE3F3] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#756D82]">
          <p>© 2026 PlaySpace.</p>
          <p className="text-center sm:text-right">
            11 games • Couple & Friend modes
          </p>
        </div>
      </div>
    </footer>
  );
};
