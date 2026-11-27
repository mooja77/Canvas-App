import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CoursePage from './CoursePage';
import { COURSE_MODULES } from '../data/courseModules';

describe('CoursePage (qualcanvas-26)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders the free self-paced 6-module course with no login wall', () => {
    render(
      <MemoryRouter initialEntries={['/course']}>
        <CoursePage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: /Practical Qualitative Coding: Transcript to Defensible Report/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(`0 of ${COURSE_MODULES.length} modules complete`)).toBeInTheDocument();
    for (const mod of COURSE_MODULES) {
      expect(screen.getAllByText(mod.title).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('navigates between modules and checks knowledge-check answers', () => {
    render(
      <MemoryRouter initialEntries={['/course']}>
        <CoursePage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Next module/i }));
    expect(screen.getByRole('heading', { name: /Build a codebook and code your first passages/i })).toBeInTheDocument();

    const correctRadio = screen.getByLabelText(
      /Enough of the sentence or paragraph so the quote still makes sense out of context/i,
    );
    fireEvent.click(correctRadio);
    expect(screen.getByText(/Correct\./i)).toBeInTheDocument();
  });

  it('marks a module complete, persists progress in localStorage, and resets cleanly', () => {
    render(
      <MemoryRouter initialEntries={['/course']}>
        <CoursePage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Mark module complete/i }));
    expect(screen.getByText(`1 of ${COURSE_MODULES.length} modules complete`)).toBeInTheDocument();
    expect(window.localStorage.getItem('qualcanvas_course_progress_v1')).toContain(COURSE_MODULES[0].id);

    fireEvent.click(screen.getByRole('button', { name: /Reset course progress/i }));
    expect(screen.getByText(`0 of ${COURSE_MODULES.length} modules complete`)).toBeInTheDocument();
  });
});
