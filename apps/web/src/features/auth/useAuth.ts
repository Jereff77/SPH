import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './AuthContext';

/** Hook para consumir el contexto de autenticación. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  }
  return ctx;
}
