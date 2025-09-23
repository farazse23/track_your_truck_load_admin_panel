import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import logo from '../assets/logo.jpg';

const LoginPage = () => {
  const { login, currentUser, loading, forgotPassword } = useAuth();
  
  // Add debugging
  console.log('LoginPage render - currentUser:', currentUser, 'loading:', loading);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // Redirect if already logged in
  if (currentUser && !loading) {
    console.log('LoginPage: Redirecting to dashboard - currentUser exists and not loading');
    return <Navigate to="/" replace />;
  }
  
  // Also check if user exists but still loading
  if (currentUser && loading) {
    console.log('LoginPage: User exists but still loading, staying on login page');
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFormLoading(true);

    try {
      await login(formData.email, formData.password, formData.rememberMe);
    } catch (error) {
      setError(error.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setForgotPasswordLoading(true);

    try {
      await forgotPassword(forgotPasswordEmail);
      setResetEmailSent(true);
    } catch (error) {
      setError(error.message);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const resetForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotPasswordEmail('');
    setResetEmailSent(false);
    setError('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="max-w-md w-full space-y-8 p-8">
        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <img
              src={logo}
              alt="Track Your Truck Load"
              className="mx-auto h-20 w-20 rounded-xl mb-4 bg-blue-500"
            />
            <h2 className="text-3xl font-bold text-gray-900">Track Your Truck Load</h2>
            <p className="mt-2 text-sm text-gray-600">Admin Dashboard</p>
          </div>

          {/* Form */}
          {!showForgotPassword ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex">
                    <FontAwesomeIcon
                      icon={['fas', 'exclamation-circle']}
                      className="text-red-400 mr-2 mt-0.5"
                    />
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                </div>
              )}

              <Input
                label="Email Address"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email"
                icon={['fas', 'envelope']}
                required
                disabled={formLoading}
              />

              <Input
                label="Password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                icon={['fas', 'lock']}
                required
                disabled={formLoading}
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="rememberMe"
                    name="rememberMe"
                    type="checkbox"
                    checked={formData.rememberMe}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    disabled={formLoading}
                  />
                  <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-900">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="font-medium text-blue-600 hover:text-blue-500"
                    disabled={formLoading}
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="large"
                loading={formLoading}
                disabled={formLoading}
                className="w-full"
              >
                {formLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              {!resetEmailSent ? (
                <>
                  <div className="text-center mb-6">
                    <FontAwesomeIcon
                      icon={['fas', 'envelope']}
                      className="text-4xl text-blue-600 mb-4"
                    />
                    <h3 className="text-lg font-medium text-gray-900">Reset your password</h3>
                    <p className="mt-2 text-sm text-gray-600">
                      Enter your email address and we'll send you a link to reset your password.
                    </p>
                  </div>

                  <form onSubmit={handleForgotPassword}>
                    {error && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                        <div className="flex">
                          <FontAwesomeIcon
                            icon={['fas', 'exclamation-circle']}
                            className="text-red-400 mr-2 mt-0.5"
                          />
                          <p className="text-sm text-red-600">{error}</p>
                        </div>
                      </div>
                    )}

                    <Input
                      label="Email Address"
                      type="email"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      placeholder="Enter your email address"
                      icon={['fas', 'envelope']}
                      required
                      disabled={forgotPasswordLoading}
                    />

                    <div className="flex space-x-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={resetForgotPassword}
                        disabled={forgotPasswordLoading}
                      >
                        Back to Login
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        className="flex-1"
                        loading={forgotPasswordLoading}
                        disabled={forgotPasswordLoading}
                      >
                        {forgotPasswordLoading ? 'Sending...' : 'Send Reset Link'}
                      </Button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="text-center">
                  <FontAwesomeIcon
                    icon={['fas', 'check-circle']}
                    className="text-4xl text-green-600 mb-4"
                  />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Check your email</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    We've sent a password reset link to <strong>{forgotPasswordEmail}</strong>
                  </p>
                  <Button
                    variant="outline"
                    onClick={resetForgotPassword}
                    className="w-full"
                  >
                    Back to Login
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              © 2025 Track Your Truck Load. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
