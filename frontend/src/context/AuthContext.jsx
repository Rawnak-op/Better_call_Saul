import { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext(null);

const AUTH_USER_KEY = 'saul_auth_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(AUTH_USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
  }, [user]);

  /**
   * Log in with Email & Password
   */
  const loginWithEmail = (email, password, name = '') => {
    const newUser = {
      id: 'usr_' + Math.random().toString(36).substr(2, 9),
      name: name.trim() || email.split('@')[0],
      email: email.trim(),
      avatar: null,
      provider: 'email',
      isGuest: false,
    };
    setUser(newUser);
    setIsAuthModalOpen(false);
    return newUser;
  };

  /**
   * Handle real Google OAuth credential response (JWT token)
   */
  const handleGoogleSuccess = (credentialResponse) => {
    try {
      if (credentialResponse.credential) {
        const decoded = jwtDecode(credentialResponse.credential);
        const newUser = {
          id: decoded.sub || 'goog_' + Math.random().toString(36).substr(2, 9),
          name: decoded.name || decoded.given_name || 'Client',
          email: decoded.email,
          avatar: decoded.picture || null,
          provider: 'google',
          isGuest: false,
        };
        setUser(newUser);
        setIsAuthModalOpen(false);
        return newUser;
      }
    } catch (err) {
      console.error('Failed to decode Google JWT token:', err);
    }
  };

  /**
   * Continue as Guest
   */
  const continueAsGuest = () => {
    const guestUser = {
      id: 'guest_' + Math.random().toString(36).substr(2, 9),
      name: 'Guest Client',
      email: null,
      avatar: null,
      provider: 'guest',
      isGuest: true,
    };
    setUser(guestUser);
    setIsAuthModalOpen(false);
    return guestUser;
  };

  /**
   * Log out
   */
  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isGuest: !!user?.isGuest,
        isAuthModalOpen,
        setIsAuthModalOpen,
        loginWithEmail,
        handleGoogleSuccess,
        continueAsGuest,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
