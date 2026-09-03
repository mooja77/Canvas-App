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

  // L7: an academic suffix needs at least one institution label in front of
  // it. `edu.au` / `ac.uk` / `edu.ie` on their own are not universities.
  it.each(['x@ucc.ie', 'x@student.ucc.ie', 'x@cam.ac.uk', 'x@unsw.edu.au', 'x@mit.edu', 'X@Student.UCC.IE'])(
    'accepts institution address %s',
    (email) => expect(isAcademicEmail(email)).toBe(true),
  );

  it.each([
    'x@ac.uk',
    'x@edu.au',
    'x@edu.ie',
    'x@edu',
    'x@.edu',
    'x@fakeac.uk',
    'x@notedu.au',
    'x@ucc.ie.evil.com',
    'x@evil.com\u200B.edu',
    'x@evil.com\u0000.edu',
    'x@evil.com\u00A0.edu',
    'x@ucc.ie@evil.com',
  ])('rejects bare suffix or lookalike %j', (email) => expect(isAcademicEmail(email)).toBe(false));
});
