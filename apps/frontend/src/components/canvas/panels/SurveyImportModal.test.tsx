import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SurveyImportModal from './SurveyImportModal';

vi.mock('../../../hooks/useFocusTrap', () => ({ useFocusTrap: vi.fn() }));
vi.mock('../../../hooks/useEscapeToClose', () => ({ useEscapeToClose: vi.fn() }));

describe('SurveyImportModal first-use validation', () => {
  it('previews mapped columns and names skipped CSV rows before importing only valid responses', async () => {
    const onImport = vi.fn();
    const onClose = vi.fn();
    render(<SurveyImportModal isOpen onClose={onClose} onImport={onImport} />);

    const csv = 'name,response,group\nAlice,First answer,A\nBob,,B\nCarol,Third answer,C';
    fireEvent.change(screen.getByLabelText('Upload CSV File'), {
      target: { files: [new File([csv], 'responses.csv', { type: 'text/csv' })] },
    });

    expect(await screen.findByRole('combobox', { name: 'Content Column *' })).toHaveValue('response');
    expect(screen.getByRole('combobox', { name: 'Title Column *' })).toHaveValue('name');
    expect(screen.getByText(/This importer does not create cases from a CSV column/)).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('1 CSV row without response text will not be imported');
    expect(screen.getByRole('status')).toHaveTextContent('row 3');
    expect(screen.getByRole('button', { name: 'Import 2 valid rows' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Import 2 valid rows' }));
    expect(onImport).toHaveBeenCalledWith(
      [
        { title: 'Alice', content: 'First answer' },
        { title: 'Carol', content: 'Third answer' },
      ],
      expect.any(Function),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('explains a malformed quoted CSV and does not offer a false import', async () => {
    const onImport = vi.fn();
    render(<SurveyImportModal isOpen onClose={vi.fn()} onImport={onImport} />);

    fireEvent.change(screen.getByLabelText('Upload CSV File'), {
      target: { files: [new File(['name,response\n"Bad,unfinished'], 'broken.csv', { type: 'text/csv' })] },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('A quoted value is not closed');
    expect(screen.getByRole('button', { name: 'Import 0 valid rows' })).toBeDisabled();
    expect(onImport).not.toHaveBeenCalled();
  });

  it('keeps the modal open and retries only unsaved rows after a partial failure', async () => {
    const onClose = vi.fn();
    const onImport = vi
      .fn()
      .mockImplementationOnce(async (_rows, onSaved) => {
        onSaved();
        throw new Error('temporary write failure');
      })
      .mockImplementationOnce(async (_rows, onSaved) => {
        onSaved();
      });
    render(<SurveyImportModal isOpen onClose={onClose} onImport={onImport} />);

    fireEvent.change(screen.getByLabelText('Upload CSV File'), {
      target: {
        files: [
          new File(['name,response\nAlice,First answer\nCarol,Third answer'], 'responses.csv', { type: 'text/csv' }),
        ],
      },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Import 2 valid rows' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Saved 1 of 2 responses');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Upload CSV File')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry 1 remaining row' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onImport).toHaveBeenNthCalledWith(2, [{ title: 'Carol', content: 'Third answer' }], expect.any(Function));
  });
});
