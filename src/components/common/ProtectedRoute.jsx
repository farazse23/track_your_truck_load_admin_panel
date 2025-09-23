import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/FirebaseAuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  
  // Add debugging
  console.log('ProtectedRoute - currentUser:', currentUser, 'loading:', loading);

  if (loading) {
    console.log('ProtectedRoute: Still loading, showing spinner');
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <FontAwesomeIcon 
            icon={['fas', 'spinner']} 
            spin 
            className="text-4xl text-blue-600 mb-4" 
          />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    console.log('ProtectedRoute: No user, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  console.log('ProtectedRoute: User authenticated, rendering children');
  return children;
};

export default ProtectedRoute;
