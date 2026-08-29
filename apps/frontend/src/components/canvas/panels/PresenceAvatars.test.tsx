import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PresenceAvatars, { accessibleInitialsColor } from './PresenceAvatars';

describe('PresenceAvatars', () => {
  it('chooses the higher-contrast initials colour for server palette colours', () => {
    expect(accessibleInitialsColor('#EF4444')).toBe('#000000');
    expect(accessibleInitialsColor('#1E3A8A')).toBe('#ffffff');
  });

  it('applies the accessible initials colour to each collaborator avatar', () => {
    render(
      <PresenceAvatars
        isConnected
        collaborators={[{ userId: 'fictional-user', name: 'Fictional Rowan Blake', color: '#EF4444' }]}
      />,
    );

    expect(screen.getByTitle('Fictional Rowan Blake')).toHaveStyle({
      backgroundColor: '#EF4444',
      color: '#000000',
    });
  });
});
