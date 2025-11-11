import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth } from '../lib/firebase';
import { User, onAuthStateChanged, signOut as firebaseSignOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getCouponDaysRemaining: () => number | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  const getCouponDaysRemaining = (): number | null => {
    if (!user) return null;
    
    const couponData = localStorage.getItem('bcs_coupon');
    if (!couponData) return null;
    
    try {
      const parsed = JSON.parse(couponData);
      
      // Check if this coupon belongs to the current user or machine
      const machineId = getMachineIdSync();
      if (parsed.userId !== user.email && parsed.machineId !== machineId) {
        return null;
      }
      
      // Check if coupon is still valid
      const expiryDate = new Date(parsed.expiryDate);
      const currentDate = new Date();
      
      if (currentDate > expiryDate) {
        // Coupon expired, remove it
        localStorage.removeItem('bcs_coupon');
        return null;
      }
      
      // Calculate remaining days
      const diffTime = expiryDate.getTime() - currentDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays > 0 ? diffDays : 0;
    } catch (error) {
      console.error('Error parsing coupon data:', error);
      return null;
    }
  };

  // Synchronous version of machine ID generation for use in getCouponDaysRemaining
  const getMachineIdSync = (): string => {
    // Create a fingerprint based on browser characteristics
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      !!navigator.cookieEnabled,
      !!navigator.onLine
    ].join('|');
    
    // Simple hash function for fingerprint
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(36);
  };

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    getCouponDaysRemaining
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};