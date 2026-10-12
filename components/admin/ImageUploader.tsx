'use client';
import { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useToast } from './Toast';

type UploadedImage = { id: string; url: string };

type Props = {
  onUploaded: (img: UploadedImage) => void;
  multiple?: boolean;
  /** Custom trigger content (overrides the default 800×800 dashed slot). */
  children?: React.ReactNode;
  className?: string;
  accept?: string;
};

/** Compress and resize image client-side to ensure lightweight Base64 in MongoDB */
async function compressImageFile(file: File, maxDim = 1200, quality = 0.82): Promise<File> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/') || file.type.includes('svg') || file.type.includes('gif')) {
    return file;
  }
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob && (blob.size < file.size || file.size > 200 * 1024)) {
            const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        },
        'image/webp',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export default function ImageUploader({ onUploaded, multiple = false, children, className = '', accept = 'image/*' }: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function uploadOne(rawFile: File): Promise<UploadedImage | null> {
    const file = await compressImageFile(rawFile);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.id || !data?.url) {
      toast.error(`Échec : ${data?.error ?? 'upload'}`);
      return null;
    }
    return { id: String(data.id), url: data.url };
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const result = await uploadOne(file);
        if (result) onUploaded(result);
      }
      toast.success('Image téléversée');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={className || 'grid aspect-square place-items-center rounded-xl border-2 border-dashed border-ink-200 bg-ink-100 text-xs font-bold text-ink-700 transition hover:border-brand-300 hover:bg-ink-200 disabled:opacity-60'}
        aria-label="Téléverser une image"
      >
        {children ?? (
          busy ? (
            <span className="flex flex-col items-center gap-1">
              <Loader2 size={18} className="animate-spin text-brand-500" />
              <span>Téléversement…</span>
            </span>
          ) : (
            <span className="flex flex-col items-center gap-1">
              <Upload size={18} className="text-brand-500" />
              <span>800 × 800</span>
            </span>
          )
        )}
      </button>
    </>
  );
}
