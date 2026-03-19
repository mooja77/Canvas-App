import React from 'react';
import type { CollaboratorPresence } from '../../../hooks/useCollaboration';

interface PresenceAvatarsProps {
  collaborators: CollaboratorPresence[];
  isConnected: boolean;
}

export default function PresenceAvatars({ collaborators, isConnected }: PresenceAvatarsProps) {
  if (collaborators.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {/* Connection indicator */}
      <div
        className={`w-2 h-2 rounded-full mr-1 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
        title={isConnected ? 'Connected' : 'Disconnected'}
      />

      {/* User avatars */}
      <div className="flex -space-x-2">
        {collaborators.slice(0, 5).map((user) => (
          <div
            key={user.userId}
            className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {user.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </div>
        ))}
        {collaborators.length > 5 && (
          <div
            className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] font-medium text-gray-600 bg-gray-200 dark:bg-gray-700 dark:text-gray-300 shadow-sm"
            title={`${collaborators.length - 5} more`}
          >
            +{collaborators.length - 5}
          </div>
        )}
      </div>
    </div>
  );
}
