import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { api } from '../services/api';

export type GameMode = 'couple' | 'friend';

export interface GameAvailability {
  gameId: string;
  isEnabled: boolean;
  coupleEnabled: boolean;
  friendEnabled: boolean;
  maintenanceMessage: string | null;
}

interface GameCatalogContextValue {
  catalog: Record<string, GameAvailability>;
  isLoading: boolean;
  error: string | null;
  refreshCatalog: () => Promise<void>;
  getAvailability: (gameId: string) => GameAvailability | undefined;
  isAvailable: (gameId: string, mode: GameMode) => boolean;
  isAvailableInAnyMode: (gameId: string) => boolean;
}

const GameCatalogContext = createContext<GameCatalogContextValue | undefined>(undefined);

function normalizeGameId(gameId: string): string {
  const normalized = gameId.trim().toLowerCase();
  return normalized === 'original-card-game' ? 'uno-style' : normalized;
}

export const GameCatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isProfileHydrating } = useAuth();
  const [catalog, setCatalog] = useState<Record<string, GameAvailability>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCatalog = useCallback(async () => {
    if (!isAuthenticated) {
      setCatalog({});
      setError(null);
      setIsLoading(false);
      return;
    }

    // /games/catalog uses the regular authenticated middleware, which expects
    // the user's profile bootstrap to be complete. Wait for AuthContext's
    // dedicated /profiles/me bootstrap endpoint before making catalog calls.
    if (isProfileHydrating) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.games.getCatalog();
      if (!response.success || !Array.isArray(response.data) || response.data.length === 0) {
        throw new Error('Game availability is not initialized yet. Please retry shortly.');
      }

      const nextCatalog = Object.fromEntries(
        response.data.map((entry) => [normalizeGameId(entry.gameId), entry])
      ) as Record<string, GameAvailability>;

      setCatalog(nextCatalog);
    } catch (err) {
      setCatalog({});
      setError(
        err instanceof Error
          ? err.message
          : 'Game availability could not be loaded. Check your connection and retry.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, isProfileHydrating]);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const getAvailability = useCallback(
    (gameId: string) => catalog[normalizeGameId(gameId)],
    [catalog]
  );

  const isAvailable = useCallback(
    (gameId: string, mode: GameMode) => {
      const entry = getAvailability(gameId);
      if (!entry || !entry.isEnabled) return false;
      return mode === 'couple' ? entry.coupleEnabled : entry.friendEnabled;
    },
    [getAvailability]
  );

  const isAvailableInAnyMode = useCallback(
    (gameId: string) => {
      const entry = getAvailability(gameId);
      return Boolean(entry?.isEnabled && (entry.coupleEnabled || entry.friendEnabled));
    },
    [getAvailability]
  );

  const value = useMemo(
    () => ({
      catalog,
      isLoading,
      error,
      refreshCatalog,
      getAvailability,
      isAvailable,
      isAvailableInAnyMode,
    }),
    [catalog, isLoading, error, refreshCatalog, getAvailability, isAvailable, isAvailableInAnyMode]
  );

  return (
    <GameCatalogContext.Provider value={value}>
      {children}
    </GameCatalogContext.Provider>
  );
};

// oxlint-disable-next-line react/only-export-components
export function useGameCatalog(): GameCatalogContextValue {
  const context = useContext(GameCatalogContext);
  if (!context) {
    throw new Error('useGameCatalog must be used within a GameCatalogProvider');
  }
  return context;
}
