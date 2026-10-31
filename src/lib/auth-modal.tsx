import { createContext, useContext } from 'react';

export const AuthModalContext = createContext<(mode: 'signin' | 'signup') => void>(() => {});
export function useOpenAuth() {
  return useContext(AuthModalContext);
}
