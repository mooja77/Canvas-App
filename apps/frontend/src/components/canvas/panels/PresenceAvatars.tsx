import React from 'react';
import type { CollaboratorPresence } from '../../../hooks/useCollaboration';

interface PresenceAvatarsProps {
  collaborators: CollaboratorPresence[];
  isConnected: boolean;
}

/** Pick whichever of black or white has the stronger WCAG contrast against a
 * collaboration colour. Presence colours come from the server palette, but
 * keeping this calculation local also protects initials if that palette grows. */
export function accessibleInitialsColor(backgroundColor: string): '#000000' | '#ffffff' {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(backgroundColor);
  if (!match) return '#000000';

  const luminance = match.slice(1).reduce((total, channel, index) => {
    const srgb = Number.parseInt(channel, 16) / 255;
    const linear = srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    return total + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);

  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);
  return blackContrast >= whiteContrast ? '#000000' : '#ffffff';
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
            className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] font-bold shadow-sm"
            style={{ backgroundColor: user.color, color: accessibleInitialsColor(user.color) }}
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
