import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileUpload } from './useFileUpload';

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock canvasStore selector
vi.mock('../stores/canvasStore', () => ({
  useActiveCanvasId: vi.fn(() => 'canvas-1'),
  useCanvasStore: vi.fn(),
}));

// Mock the API
vi.mock('../services/api', () => ({
  canvasApi: {
    uploadFileDirect: vi.fn(),
  },
}));

import { canvasApi } from '../services/api';
import { useActiveCanvasId } from '../stores/canvasStore';
import toast from 'react-hot-toast';

const mockUploadFileDirect = vi.mocked(canvasApi.uploadFileDirect);
const mockUseActiveCanvasId = vi.mocked(useActiveCanvasId);

describe('useFileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseActiveCanvasId.mockReturnValue('canvas-1');
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useFileUpload());

    expect(result.current.uploading).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.fileUploadId).toBeNull();
  });

  it('uploads a file successfully', async () => {
    mockUploadFileDirect.mockResolvedValue({
      data: { data: { id: 'upload-123', name: 'test.txt' } },
    } as never);

    const { result } = renderHook(() => useFileUpload());
    const file = new File(['hello world'], 'test.txt', { type: 'text/plain' });

    let uploadResult: unknown;
    await act(async () => {
      uploadResult = await result.current.uploadFile(file);
    });

    expect(uploadResult).toEqual({ id: 'upload-123', name: 'test.txt' });
    expect(result.current.uploading).toBe(false);
    expect(result.current.progress).toBe(100);
    expect(result.current.fileUploadId).toBe('upload-123');
    expect(toast.success).toHaveBeenCalledWith('Uploaded: test.txt');
  });

  it('handles upload error', async () => {
    mockUploadFileDirect.mockRejectedValue({
      response: { data: { error: 'File too large' } },
    });

    const { result } = renderHook(() => useFileUpload());
    const file = new File(['data'], 'big.csv', { type: 'text/csv' });

    let uploadResult: unknown;
    await act(async () => {
      uploadResult = await result.current.uploadFile(file);
    });

    expect(uploadResult).toBeNull();
    expect(result.current.uploading).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.fileUploadId).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('File too large');
  });

  it('handles generic error without response data', async () => {
    mockUploadFileDirect.mockRejectedValue(new Error('Network timeout'));

    const { result } = renderHook(() => useFileUpload());
    const file = new File(['data'], 'test.txt', { type: 'text/plain' });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    expect(toast.error).toHaveBeenCalledWith('Upload failed');
  });

  it('returns null when no activeCanvasId', async () => {
    mockUseActiveCanvasId.mockReturnValue(null);

    const { result } = renderHook(() => useFileUpload());
    const file = new File(['data'], 'test.txt', { type: 'text/plain' });

    let uploadResult: unknown;
    await act(async () => {
      uploadResult = await result.current.uploadFile(file);
    });

    expect(uploadResult).toBeNull();
    expect(mockUploadFileDirect).not.toHaveBeenCalled();
  });

  it('calls progress callback during upload', async () => {
    mockUploadFileDirect.mockImplementation(
      (_canvasId: string, _formData: FormData, onProgress?: (pct: number) => void) => {
        // Simulate progress callbacks
        if (onProgress) {
          onProgress(25);
          onProgress(50);
          onProgress(75);
        }
        return Promise.resolve({
          data: { data: { id: 'upload-1', name: 'file.txt' } },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        } as unknown as Awaited<ReturnType<typeof canvasApi.uploadFileDirect>>);
      },
    );

    const { result } = renderHook(() => useFileUpload());
    const file = new File(['content'], 'file.txt', { type: 'text/plain' });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    // After completion, progress should be 100
    expect(result.current.progress).toBe(100);
  });

  it('sets uploading=true while upload is in progress', async () => {
    let resolveUpload: (v: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveUpload = resolve;
    });
    mockUploadFileDirect.mockReturnValue(pending as never);

    const { result } = renderHook(() => useFileUpload());
    const file = new File(['data'], 'test.txt', { type: 'text/plain' });

    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.uploadFile(file);
    });

    expect(result.current.uploading).toBe(true);

    await act(async () => {
      resolveUpload!({ data: { data: { id: 'u1', name: 'test.txt' } } });
      await promise!;
    });

    expect(result.current.uploading).toBe(false);
  });

  it('reset clears upload state', async () => {
    mockUploadFileDirect.mockResolvedValue({
      data: { data: { id: 'upload-1', name: 'test.txt' } },
    } as never);

    const { result } = renderHook(() => useFileUpload());
    const file = new File(['data'], 'test.txt', { type: 'text/plain' });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    expect(result.current.fileUploadId).toBe('upload-1');

    act(() => {
      result.current.reset();
    });

    expect(result.current.uploading).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.fileUploadId).toBeNull();
  });

  it('sends FormData with the file to the API', async () => {
    mockUploadFileDirect.mockResolvedValue({
      data: { data: { id: 'u1', name: 'data.csv' } },
    } as never);

    const { result } = renderHook(() => useFileUpload());
    const file = new File(['col1,col2\n1,2'], 'data.csv', { type: 'text/csv' });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    expect(mockUploadFileDirect).toHaveBeenCalledWith('canvas-1', expect.any(FormData), expect.any(Function));

    const formData = mockUploadFileDirect.mock.calls[0][1] as FormData;
    expect(formData.get('file')).toBeInstanceOf(File);
  });
});
