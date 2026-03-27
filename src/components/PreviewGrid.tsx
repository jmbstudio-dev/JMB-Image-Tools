import { useState } from "react";
import { Download, Copy, Check, CheckSquare, Square } from "lucide-react";
import { formatBytes } from "../utils/formatBytes";

interface PreviewGridProps {
  files: File[];
  progress: number[];
  errors: string[];
  outputSizes: number[];
  outputBlobs: (Blob | null)[];
  selected: boolean[];
  onToggle: (idx: number) => void;
  onSelectAll: () => void;
  onDownload: (idx: number) => void;
  onDownloadSelected: () => void;
}

export const PreviewGrid = ({
  files,
  progress,
  errors,
  outputSizes,
  outputBlobs,
  selected,
  onToggle,
  onSelectAll,
  onDownload,
  onDownloadSelected,
}: PreviewGridProps) => {
  const [copied, setCopied] = useState<number | null>(null);

  if (files.length === 0) return null;

  const doneCount = outputBlobs.filter(Boolean).length;
  const allSelected = selected.every(Boolean);
  const selectedCount = selected.filter(Boolean).length;

  const handleCopy = async (idx: number) => {
    const blob = outputBlobs[idx];
    if (!blob) return;
    try {
      // Determine a clipboard-compatible type
      const type = blob.type === "image/png" ? "image/png" : "image/png";
      let copyBlob = blob;

      // Navigator clipboard only supports image/png reliably
      // Convert to PNG via canvas if needed
      if (blob.type !== "image/png") {
        const bmp = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bmp, 0, 0);
        copyBlob = await new Promise<Blob>((res, rej) =>
          canvas.toBlob((b) => (b ? res(b) : rej()), "image/png"),
        );
      }

      await navigator.clipboard.write([
        new ClipboardItem({ [type]: copyBlob }),
      ]);

      setCopied(idx);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  return (
    <div className="space-y-3">

      {/* SELECTION CONTROLS */}
      <div className="flex items-center justify-between">
        <button
          onClick={onSelectAll}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          {allSelected
            ? <CheckSquare className="w-3.5 h-3.5 text-primary" />
            : <Square className="w-3.5 h-3.5" />
          }
          {allSelected ? "Deselect all" : "Select all"}
        </button>

        {doneCount > 0 && (
          <button
            onClick={onDownloadSelected}
            disabled={selectedCount === 0}
            className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download selected ({selectedCount})
          </button>
        )}
      </div>

      {/* GRID */}
      <div className="grid grid-cols-3 gap-2">
        {files.map((file, i) => {
          const isDone = progress[i] === 100 && !!outputBlobs[i];
          const hasFailed = !!errors[i];

          return (
            <div key={i} className="space-y-1">
              <div className="relative group">
                <img
                  src={URL.createObjectURL(file)}
                  alt="preview"
                  className={`w-full h-20 object-cover rounded-md transition-opacity ${
                    selected[i] ? "ring-2 ring-primary" : ""
                  }`}
                />

                {/* CHECKBOX — always visible when done */}
                {isDone && (
                  <button
                    onClick={() => onToggle(i)}
                    className="absolute top-1 left-1 z-10"
                    aria-label="Select image"
                  >
                    {selected[i]
                      ? <CheckSquare className="w-4 h-4 text-primary drop-shadow" />
                      : <Square className="w-4 h-4 text-white drop-shadow opacity-70 group-hover:opacity-100 transition-opacity" />
                    }
                  </button>
                )}

                {/* ACTION BUTTONS — appear on hover when done */}
                {isDone && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
                    <button
                      onClick={() => onDownload(i)}
                      className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={() => handleCopy(i)}
                      className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
                      title="Copy to clipboard"
                    >
                      {copied === i
                        ? <Check className="w-4 h-4 text-green-400" />
                        : <Copy className="w-4 h-4 text-white" />
                      }
                    </button>
                  </div>
                )}
              </div>

              {/* PROGRESS BAR */}
              <div className="w-full bg-surface rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    hasFailed
                      ? "bg-red-500"
                      : isDone
                        ? "bg-green-500"
                        : "bg-primary"
                  }`}
                  style={{ width: `${hasFailed ? 100 : (progress[i] ?? 0)}%` }}
                />
              </div>

              {/* LABEL */}
              <p className="text-xs text-center text-muted-foreground">
                {hasFailed ? (
                  <span className="text-red-500">Failed</span>
                ) : isDone && outputSizes[i] ? (
                  <span className="text-green-500">
                    {formatBytes(file.size)} → {formatBytes(outputSizes[i])}
                  </span>
                ) : (
                  `${progress[i] ?? 0}%`
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};