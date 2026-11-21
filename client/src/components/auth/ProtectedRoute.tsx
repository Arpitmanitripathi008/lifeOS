import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory flex flex-col items-center justify-center p-6 text-charcoal">
        <div className="w-10 h-10 rounded-xl bg-olive flex items-center justify-center shadow-md animate-pulse mb-4">
          <span className="text-paper text-base font-serif font-bold">L</span>
        </div>
        <p className="text-sm font-serif text-muted">Restoring your LifeOS workspace...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
