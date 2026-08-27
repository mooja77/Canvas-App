import { describe, expect, it } from 'vitest';
import { isAcademicEmail } from '@qualcanvas/shared';

describe('isAcademicEmail', () => {
  it.each(['student@university.edu', 'researcher@ox.ac.uk', 'student@sydney.edu.au', 'person@tcd.ie'])(
    'recognises %s',
    (email) => expect(isAcademicEmail(email)).toBe(true),
  );

  it.each(['person@gmail.com', 'person@education.ie', 'person@example.edu.com', 'not-an-email'])(
    'rejects %s',
    (email) => expect(isAcademicEmail(email)).toBe(false),
  );
});
