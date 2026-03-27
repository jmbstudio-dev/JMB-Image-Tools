import { useState, useRef } from "react";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { Lock, Unlock } from "lucide-react";
import { formatBytes } from "../utils/formatBytes";
import { PreviewGrid } from "./PreviewGrid";

type ResizeMode = "px" | "percent";
type BatchMode = "same" | "individual";

interface PerImageSettings {
  width: number;
  height: number;
  percent: number;
}

const resizeImage = (file: File, width: number, height: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context failed"));
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Failed"))),
        file.type,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load ${file.name}`));
    };
    img.src = url;
  });
};

const getImageDimensions = (file: File): Promise<{ w: number; h: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
};

export const ResizerTab = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<ResizeMode>("px");
  const [batchMode, setBatchMode] = useState<BatchMode>("same");
  const [locked, setLocked] = useState<boolean>(true);
  const [width, setWidth] = useState<number>(800);
  const [height, setHeight] = useState<number>(600);
  const [percent, setPercent] = useState<number>(50);
  const [resizing, setResizing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number[]>([]);
  const [outputSizes, setOutputSizes] = useState<number[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [perImage, setPerImage] = useState<PerImageSettings[]>([]);
  const [outputBlobs, setOutputBlobs] = useState<(Blob | null)[]>([]);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [zipMode, setZipMode] = useState(false);

  const initState = async (sel: File[]) => {
    setFiles(sel);
    setProgress(Array(sel.length).fill(0));
    setOutputSizes(Array(sel.length).fill(0));
    setErrors(Array(sel.length).fill(""));
    setOutputBlobs(Array(sel.length).fill(null));
    setSelected(Array(sel.length).fill(false));
    const dims = await Promise.all(sel.map(getImageDimensions));
    setPerImage(dims.map((d) => ({ width: d.w, height: d.h, percent: 50 })));
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    await initState(Array.from(e.target.files).slice(0, 20));
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    await initState(
      Array.from(e.dataTransfer.files)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, 20),
    );
  };

  const handleWidthChange = async (val: number) => {
    setWidth(val);
    if (locked && files.length > 0) {
      const { w, h } = await getImageDimensions(files[0]);
      setHeight(Math.round((val / w) * h));
    }
  };

  const handleHeightChange = async (val: number) => {
    setHeight(val);
    if (locked && files.length > 0) {
      const { w, h } = await getImageDimensions(files[0]);
      setWidth(Math.round((val / h) * w));
    }
  };

  const handlePerImageWidth = async (idx: number, val: number) => {
    const updated = [...perImage];
    updated[idx].width = val;
    if (locked) {
      const { w, h } = await getImageDimensions(files[idx]);
      updated[idx].height = Math.round((val / w) * h);
    }
    setPerImage(updated);
  };

  const handlePerImageHeight = async (idx: number, val: number) => {
    const updated = [...perImage];
    updated[idx].height = val;
    if (locked) {
      const { w, h } = await getImageDimensions(files[idx]);
      updated[idx].width = Math.round((val / h) * w);
    }
    setPerImage(updated);
  };

  const getTargetDims = async (file: File, i: number) => {
    if (mode === "percent") {
      const p = batchMode === "individual" ? (perImage[i]?.percent ?? percent) : percent;
      const { w, h } = await getImageDimensions(file);
      return { targetW: Math.round((w * p) / 100), targetH: Math.round((h * p) / 100) };
    }
    if (batchMode === "individual") {
      return { targetW: perImage[i]?.width ?? width, targetH: perImage[i]?.height ?? height };
    }
    return { targetW: width, targetH: height };
  };

  const resizeAll = async () => {
    setResizing(true);
    setProgress(Array(files.length).fill(0));
    setOutputSizes(Array(files.length).fill(0));
    setErrors(Array(files.length).fill(""));
    setSelected(Array(files.length).fill(false));

    const blobs: (Blob | null)[] = Array(files.length).fill(null);
    const zip = new JSZip();

    await Promise.all(
      files.map(async (file, i) => {
        try {
          setProgress((prev) => { const c = [...prev]; c[i] = 10; return c; });

          const { targetW, targetH } = await getTargetDims(file, i);
          const blob = await resizeImage(file, targetW, targetH);
          blobs[i] = blob;

          setOutputSizes((prev) => { const c = [...prev]; c[i] = blob.size; return c; });
          setProgress((prev) => { const c = [...prev]; c[i] = 90; return c; });

          const ext = file.name.split(".").pop();
          const newName = file.name.replace(/\.[^/.]+$/, "") + `_${targetW}x${targetH}.${ext}`;

          if (zipMode) zip.file(newName, await blob.arrayBuffer());
          else saveAs(blob, newName);

          setProgress((prev) => { const c = [...prev]; c[i] = 100; return c; });
        } catch {
          setErrors((prev) => { const c = [...prev]; c[i] = "Failed"; return c; });
          setProgress((prev) => { const c = [...prev]; c[i] = 0; return c; });
        }
      }),
    );

    setOutputBlobs(blobs);
    if (zipMode) {
      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, "resized-images.zip");
    }
    setResizing(false);
  };

  const downloadSingle = async (idx: number) => {
    const blob = outputBlobs[idx];
    if (!blob) return;
    const file = files[idx];
    const ext = file.name.split(".").pop();
    const { targetW, targetH } = await getTargetDims(file, idx);
    saveAs(blob, file.name.replace(/\.[^/.]+$/, "") + `_${targetW}x${targetH}.${ext}`);
  };

  const handleToggle = (idx: number) => {
    setSelected((prev) => { const c = [...prev]; c[idx] = !c[idx]; return c; });
  };

  const handleSelectAll = () => {
    const allSelected = selected.every(Boolean);
    setSelected(outputBlobs.map((b) => (!allSelected && !!b)));
  };

  const handleDownloadSelected = async () => {
    const zip = new JSZip();
    await Promise.all(
      files.map(async (file, i) => {
        if (selected[i] && outputBlobs[i]) {
          const ext = file.name.split(".").pop();
          const { targetW, targetH } = await getTargetDims(file, i);
          const name = file.name.replace(/\.[^/.]+$/, "") + `_${targetW}x${targetH}.${ext}`;
          zip.file(name, outputBlobs[i]!);
        }
      }),
    );
    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, "selected-resized.zip");
  };

  return (
    <div className="space-y-6">

      {/* DROP ZONE */}
      <div
        className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" multiple accept="image/*" onChange={handleFiles} className="hidden" />
        <p className="text-sm text-muted-foreground">Drag & drop images here or click to upload</p>
      </div>

      {/* RESIZE MODE */}
      <div className="flex glass rounded-lg p-1">
        {(["px", "percent"] as ResizeMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-1.5 text-xs rounded-md transition-all ${
              mode === m ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "px" ? "Exact Size (px)" : "Percentage (%)"}
          </button>
        ))}
      </div>

      {/* BATCH MODE */}
      {files.length > 1 && (
        <div className="flex glass rounded-lg p-1">
          {(["same", "individual"] as BatchMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setBatchMode(m)}
              className={`flex-1 py-1.5 text-xs rounded-md transition-all ${
                batchMode === m ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "same" ? "Same size for all" : "Individual per image"}
            </button>
          ))}
        </div>
      )}

      {/* GLOBAL SETTINGS */}
      {(files.length <= 1 || batchMode === "same") && (
        <div className="space-y-3">
          {mode === "px" ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Width (px)</label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => handleWidthChange(Number(e.target.value))}
                  className="w-full bg-transparent border border-border/50 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <button onClick={() => setLocked(!locked)} className="mt-5 p-2 glass rounded-lg hover:text-primary transition-colors">
                {locked ? <Lock className="w-4 h-4 text-primary" /> : <Unlock className="w-4 h-4" />}
              </button>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Height (px)</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => handleHeightChange(Number(e.target.value))}
                  className="w-full bg-transparent border border-border/50 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Percentage</span>
                <span className="text-primary">{percent}%</span>
              </div>
              <input type="range" min={1} max={200} value={percent} onChange={(e) => setPercent(Number(e.target.value))} className="w-full accent-primary" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1%</span>
                <span>200%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* INDIVIDUAL SETTINGS */}
      {batchMode === "individual" && files.length > 1 && (
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {files.map((file, i) => (
            <div key={i} className="glass rounded-lg p-3 space-y-2">
              <p className="text-xs text-muted-foreground truncate">{file.name}</p>
              {mode === "px" ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={perImage[i]?.width ?? 0}
                    onChange={(e) => handlePerImageWidth(i, Number(e.target.value))}
                    placeholder="Width"
                    className="flex-1 bg-transparent border border-border/50 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-primary"
                  />
                  <button onClick={() => setLocked(!locked)} className="p-1 glass rounded">
                    {locked ? <Lock className="w-3 h-3 text-primary" /> : <Unlock className="w-3 h-3" />}
                  </button>
                  <input
                    type="number"
                    value={perImage[i]?.height ?? 0}
                    onChange={(e) => handlePerImageHeight(i, Number(e.target.value))}
                    placeholder="Height"
                    className="flex-1 bg-transparent border border-border/50 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-primary"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={200}
                    value={perImage[i]?.percent ?? 50}
                    onChange={(e) => {
                      const updated = [...perImage];
                      updated[i].percent = Number(e.target.value);
                      setPerImage(updated);
                    }}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-xs text-primary w-10 text-right">{perImage[i]?.percent ?? 50}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ZIP TOGGLE */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={zipMode} onChange={(e) => setZipMode(e.target.checked)} className="accent-primary w-4 h-4" />
        <span className="text-sm text-muted-foreground">Download as <span className="text-foreground">.zip</span></span>
      </label>

      {/* BUTTON */}
      <button onClick={resizeAll} disabled={files.length === 0 || resizing} className="w-full py-2 rounded-md bg-primary text-background hover:opacity-90 disabled:opacity-50 transition">
        {resizing ? "Resizing..." : "Resize Images"}
      </button>

      <p className="text-sm text-center text-muted-foreground">{files.length} file(s) selected</p>

      <PreviewGrid
        files={files}
        progress={progress}
        errors={errors}
        outputSizes={outputSizes}
        outputBlobs={outputBlobs}
        selected={selected}
        onToggle={handleToggle}
        onSelectAll={handleSelectAll}
        onDownload={downloadSingle}
        onDownloadSelected={handleDownloadSelected}
      />
    </div>
  );
};