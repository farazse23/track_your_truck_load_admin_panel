import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const ProfileImageModal = ({ open, onClose, user }) => {
  if (!open || !user) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="relative max-w-lg max-h-full p-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 bg-gray-900 bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-75 transition-all"
        >
          <FontAwesomeIcon icon={['fas', 'times']} className="w-4 h-4" />
        </button>
        
        {/* Profile image */}
        <div className="bg-white rounded-lg p-4">
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{user.name || 'User'}</h3>
            <p className="text-gray-600">{user.email}</p>
          </div>
          
          <div className="flex justify-center">
            {(user.profileImage || user.profilePicture || user.avatar || user.photoURL) ? (
              <img
                src={user.profileImage || user.profilePicture || user.avatar || user.photoURL}
                alt={`${user.name}'s profile`}
                className="max-w-full max-h-96 rounded-lg shadow-lg"
                onError={(e) => {
                  // If image fails to load, hide it and show initials
                  console.log('Modal image failed to load:', e.target.src);
                  e.target.style.display = 'none';
                  const initialsDiv = e.target.nextElementSibling;
                  if (initialsDiv) initialsDiv.style.display = 'flex';
                }}
              />
            ) : null}
            
            {/* Fallback initials display */}
            <div 
              className={`w-72 h-72 rounded-lg bg-blue-500 flex items-center justify-center shadow-lg ${(user.profileImage || user.profilePicture || user.avatar || user.photoURL) ? 'hidden' : 'flex'}`}
            >
              <span className="text-white text-6xl font-bold">
                {user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 
                 user.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </span>
            </div>
          </div>
          
          {(user.profileImage || user.profilePicture || user.avatar || user.photoURL) && (
            <div className="text-center mt-4">
              <a
                href={user.profileImage || user.profilePicture || user.avatar || user.photoURL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                View original image
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileImageModal;