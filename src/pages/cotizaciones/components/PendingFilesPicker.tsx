// Pre-upload file picker for the create / add-oferta forms. Holds files
// in local state until the oferta exists, then the parent uploads them
// via FormData. Mirrors the pendingFiles pattern in SolicitudPagoForm.

import { useRef } from 'react';
import { Paperclip, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
}

export function PendingFilesPicker({ files, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              onChange([...files, ...Array.from(e.target.files)]);
              e.target.value = '';
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          <Plus className="mr-1 h-3 w-3" />
          Agregar archivos
        </Button>
        <span className="text-xs text-muted-foreground">
          PDF, JPG o PNG. Máx 10MB por archivo.
        </span>
      </div>
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded border p-2 text-sm"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Paperclip className="h-3 w-3 shrink-0" />
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
