import React from 'react';
import {
  Flame,
  HelpCircle,
  ListOrdered,
  Layers,
  Grid3X3,
  Swords,
  Crown,
  Trophy,
  Zap,
  Target,
  Heart,
  Users,
  Sparkles,
} from 'lucide-react';

interface GameIconProps {
  name: string;
  className?: string;
}

export const GameIcon: React.FC<GameIconProps> = ({ name, className = 'w-5 h-5' }) => {
  switch (name) {
    case 'Flame':
      return <Flame className={className} />;
    case 'HelpCircle':
      return <HelpCircle className={className} />;
    case 'ListOrdered':
      return <ListOrdered className={className} />;
    case 'Layers':
      return <Layers className={className} />;
    case 'Grid3X3':
      return <Grid3X3 className={className} />;
    case 'Swords':
      return <Swords className={className} />;
    case 'Crown':
      return <Crown className={className} />;
    case 'Trophy':
      return <Trophy className={className} />;
    case 'Zap':
      return <Zap className={className} />;
    case 'Target':
      return <Target className={className} />;
    case 'Heart':
      return <Heart className={className} />;
    case 'Users':
      return <Users className={className} />;
    default:
      return <Sparkles className={className} />;
  }
};
