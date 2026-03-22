import { useState, useCallback } from 'react';
import { canvasApi } from '../services/api';
import { useActiveCanvasId } from '../stores/canvasStore';
import toast from 'react-hot-toast';

interface UploadState {
  uploading: boolean;
  progress: number;
  fileUploadId: string | null;
}

export function useFileUpload() {
  const [state, setState] = useState<UploadState>({
    uploading: false,
    progress: 0,
    fileUploadId: null,
  });
  const activeCanvasId = useActiveCanvasId();

  const uploadFile = useCallback(
    async (file: File) => {
      if (!activeCanvasId) return null;
      setState({ uploading: true, progress: 0, fileUploadId: null });

      try {
        // Use direct upload (simpler for dev; works with both local and S3)
        const formData = new FormData();
        formData.append('file', file);

        const res = await canvasApi.uploadFileDirect(activeCanvasId, formData, (progress) => {
          setState((prev) => ({ ...prev, progress }));
        });

        const fileUpload = res.data.data;
        setState({ uploading: false, progress: 100, fileUploadId: fileUpload.id });
        toast.success(`Uploaded: ${file.name}`);
        return fileUpload;
      } catch (err: unknown) {
        setState({ uploading: false, progress: 0, fileUploadId: null });
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Upload failed';
        toast.error(msg);
        return null;
      }
    },
    [activeCanvasId],
  );

  return {
    ...state,
    uploadFile,
    reset: () => setState({ uploading: false, progress: 0, fileUploadId: null }),
  };
}
