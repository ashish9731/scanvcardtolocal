import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { useToast } from './ui/use-toast';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, getCouponDaysRemaining } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      const daysRemaining = getCouponDaysRemaining();
      if (daysRemaining !== null && daysRemaining <= 0) {
        toast({
          title: "Access Expired",
          description: "Your free trial period has ended. Please upgrade to continue using the service.",
          variant: "destructive",
        });
        navigate('/');
      }
    }
  }, [user, navigate, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;