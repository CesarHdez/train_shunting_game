/**
 * Global player-name state, shared across screens without prop/param
 * drilling. Mirrors ref/js/core/app.js's `app.playerName` singleton, but as
 * a React context so screens re-render on change. Persistence (AsyncStorage)
 * lives in ./player.ts; this context is purely the in-memory, live copy.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getSavedPlayerName, savePlayerName } from './player';

interface PlayerContextValue {
  playerName: string;
  /** True once the saved name (if any) has been loaded from storage. */
  loaded: boolean;
  setPlayerName: (name: string) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [playerName, setPlayerNameState] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSavedPlayerName().then((saved) => {
      if (cancelled) return;
      if (saved) setPlayerNameState(saved);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPlayerName = (name: string) => {
    setPlayerNameState(name);
    void savePlayerName(name);
  };

  const value = useMemo(() => ({ playerName, loaded, setPlayerName }), [playerName, loaded]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer() must be used within a <PlayerProvider>');
  return ctx;
}
