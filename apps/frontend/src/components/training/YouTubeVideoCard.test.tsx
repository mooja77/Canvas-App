import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { YouTubeVideoCard } from './YouTubeVideoCard';
import type { TrainingVideo } from '../../data/trainingVideos';

const video: TrainingVideo = {
  id: 'test',
  videoId: 'abcdefghijk',
  title: 'A test training video',
  shortTitle: 'Test the player',
  outcome: 'Verify that third-party content loads only after an explicit choice.',
  category: 'Start here',
  duration: '1:23',
  thumbnail: '/training/test.jpg',
};

describe('YouTubeVideoCard', () => {
  it('does not contact YouTube until the viewer chooses play', () => {
    const { container } = render(<YouTubeVideoCard video={video} />);

    expect(container.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /play test the player/i }));

    const player = screen.getByTitle('Test the player video player');
    expect(player).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/abcdefghijk?rel=0');
  });

  it('links to the public YouTube watch page', () => {
    render(<YouTubeVideoCard video={video} />);
    expect(screen.getByRole('link', { name: /watch directly on youtube/i })).toHaveAttribute(
      'href',
      'https://www.youtube.com/watch?v=abcdefghijk',
    );
  });
});
