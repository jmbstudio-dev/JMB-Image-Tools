import { useState, useRef, useCallback, useEffect } from "react";
import { saveAs } from "file-saver";

const RATIOS = [
  { label: "Free", value: null },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
  { label: "3:4", value: 3 / 4 },
  { label: "9:16", value: 9 / 16 },
];

const HANDLE_SIZE = 8;

interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Handle =
  | "nw" | "n" | "ne"
  | "w"  |       "e"
  | "sw" | "s" | "se"
  | "move" | null;

const getCursor = (handle: Handle): string => {
  switch (handle) {
    case "nw": case "se": return "nwse-resize";
    case "ne": case "sw": return "nesw-resize";
    case "n":  case "s":  return "ns-resize";
    case "w":  case "e":  return "ew-resize";
    case "move": return "move";
    default: return "crosshair";
  }
};

const getHandle = (box: CropBox, x: number, y: number): Handle => {
  const hs = HANDLE_SIZE;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;

  const handles: { name: Handle; hx: number; hy: number }[] = [
    { name: "nw", hx: box.x,      hy: box.y },
    { name: "n",  hx: cx,          hy: box.y },
    { name: "ne", hx: box.x + box.w, hy: box.y },
    { name: "w",  hx: box.x,       hy: cy },
    { name: "e",  hx: box.x + box.w, hy: cy },
    { name: "sw", hx: box.x,       hy: box.y + box.h },
    { name: "s",  hx: cx,           hy: box.y + box.h },
    { name: "se", hx: box.x + box.w, hy: box.y + box.h },
  ];

  for (const h of handles) {
    if (Math.abs(x - h.hx) <= hs && Math.abs(y - h.hy) <= hs) return h.name;
  }

  if (x > box.x && x < box.x + box.w && y > box.y && y < box.y + box.h) {
    return "move";
  }

  return null;
};

export const CropperTab = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  const [cropBox, setCropBox] = useState<CropBox>({ x: 0, y: 0, w: 200, h: 200 });
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });

  const activeHandle = useRef<Handle>(null);
  const dragStart = useRef({ mx: 0, my: 0, box: { x: 0, y: 0, w: 0, h: 0 } });
  const currentBox = useRef<CropBox>({ x: 0, y: 0, w: 200, h: 200 });
  const currentRatio = useRef<number | null>(null);

  const drawOverlay = useCallback((box: CropBox) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.clearRect(box.x, box.y, box.w, box.h);
    ctx.drawImage(
      img,
      (box.x / canvas.width) * naturalSize.w,
      (box.y / canvas.height) * naturalSize.h,
      (box.w / canvas.width) * naturalSize.w,
      (box.h / canvas.height) * naturalSize.h,
      box.x, box.y, box.w, box.h,
    );

    // border
    ctx.strokeStyle = "var(--color-primary)";
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.w, box.h);

    // grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(box.x + (box.w / 3) * i, box.y);
      ctx.lineTo(box.x + (box.w / 3) * i, box.y + box.h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(box.x, box.y + (box.h / 3) * i);
      ctx.lineTo(box.x + box.w, box.y + (box.h / 3) * i);
      ctx.stroke();
    }

    // handles
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const handlePoints = [
      { x: box.x,        y: box.y },
      { x: cx,           y: box.y },
      { x: box.x + box.w, y: box.y },
      { x: box.x,        y: cy },
      { x: box.x + box.w, y: cy },
      { x: box.x,        y: box.y + box.h },
      { x: cx,           y: box.y + box.h },
      { x: box.x + box.w, y: box.y + box.h },
    ];

    handlePoints.forEach(({ x, y }) => {
      ctx.fillStyle = "white";
      ctx.strokeStyle = "var(--color-primary)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
      ctx.fill();
      ctx.stroke();
    });

    updatePreview(box);
  }, [naturalSize]);

  const updatePreview = (box: CropBox) => {
    const preview = previewRef.current;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!preview || !img || !canvas) return;
    const ctx = preview.getContext("2d");
    if (!ctx) return;

    const scaleX = naturalSize.w / canvas.width;
    const scaleY = naturalSize.h / canvas.height;

    preview.width = Math.max(1, box.w * scaleX);
    preview.height = Math.max(1, box.h * scaleY);

    ctx.drawImage(
      img,
      box.x * scaleX, box.y * scaleY,
      box.w * scaleX, box.h * scaleY,
      0, 0, preview.width, preview.height,
    );
  };

  const loadImage = (f: File) => {
    setFile(f);
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      imgRef.current = img;
      const container = containerRef.current;
      if (!container) return;

      const maxW = container.clientWidth;
      const scale = Math.min(1, maxW / img.naturalWidth);
      const dw = Math.round(img.naturalWidth * scale);
      const dh = Math.round(img.naturalHeight * scale);

      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      setDisplaySize({ w: dw, h: dh });

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = dw;
      canvas.height = dh;

      const initialBox: CropBox = {
        x: Math.round(dw * 0.1),
        y: Math.round(dh * 0.1),
        w: Math.round(dw * 0.8),
        h: Math.round(dh * 0.8),
      };

      currentBox.current = initialBox;
      setCropBox(initialBox);

      setTimeout(() => drawOverlay(initialBox), 50);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) loadImage(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("image/")) loadImage(f);
  };

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = canvasRef.current!.width / rect.width;
    const scaleY = canvasRef.current!.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasPos(e);
    const handle = getHandle(currentBox.current, x, y);
    activeHandle.current = handle;
    dragStart.current = { mx: x, my: y, box: { ...currentBox.current } };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasPos(e);
    const handle = activeHandle.current;
    const start = dragStart.current;
    const r = currentRatio.current;

    // update cursor
    if (!handle) {
      canvas.style.cursor = getCursor(getHandle(currentBox.current, x, y));
      return;
    }

    canvas.style.cursor = getCursor(handle);

    const dx = x - start.mx;
    const dy = y - start.my;
    const b = { ...start.box };
    const minSize = 20;

    if (handle === "move") {
      b.x = Math.max(0, Math.min(b.x + dx, canvas.width - b.w));
      b.y = Math.max(0, Math.min(b.y + dy, canvas.height - b.h));
    } else {
      if (handle.includes("e")) b.w = Math.max(minSize, Math.min(b.w + dx, canvas.width - b.x));
      if (handle.includes("s")) b.h = Math.max(minSize, Math.min(b.h + dy, canvas.height - b.y));
      if (handle.includes("w")) {
        const newW = Math.max(minSize, b.w - dx);
        b.x = b.x + b.w - newW;
        b.w = newW;
      }
      if (handle.includes("n")) {
        const newH = Math.max(minSize, b.h - dy);
        b.y = b.y + b.h - newH;
        b.h = newH;
      }

      // enforce ratio if set
      if (r !== null) {
        if (handle.includes("e") || handle.includes("w")) {
          b.h = Math.round(b.w / r);
        } else {
          b.w = Math.round(b.h * r);
        }
        b.h = Math.min(b.h, canvas.height - b.y);
        b.w = Math.min(b.w, canvas.width - b.x);
      }
    }

    currentBox.current = b;
    setCropBox(b);
    drawOverlay(b);
  };

  const handleMouseUp = () => {
    activeHandle.current = null;
  };

  const applyRatio = (r: number | null) => {
    setRatio(r);
    currentRatio.current = r;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const b = { ...currentBox.current };
    if (r !== null) {
      b.h = Math.round(b.w / r);
      if (b.y + b.h > canvas.height) {
        b.h = canvas.height - b.y;
        b.w = Math.round(b.h * r);
      }
    }
    currentBox.current = b;
    setCropBox(b);
    drawOverlay(b);
  };

  const handleCrop = () => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !file) return;

    const scaleX = naturalSize.w / canvas.width;
    const scaleY = naturalSize.h / canvas.height;
    const box = currentBox.current;

    const out = document.createElement("canvas");
    out.width = Math.round(box.w * scaleX);
    out.height = Math.round(box.h * scaleY);
    const ctx = out.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      img,
      box.x * scaleX, box.y * scaleY,
      out.width, out.height,
      0, 0, out.width, out.height,
    );

    out.toBlob((blob) => {
      if (!blob) return;
      const ext = file.name.split(".").pop();
      saveAs(blob, file.name.replace(/\.[^/.]+$/, "") + `_cropped.${ext}`);
    }, file.type);
  };

  // redraw when naturalSize updates
  useEffect(() => {
    if (naturalSize.w > 0) drawOverlay(currentBox.current);
  }, [naturalSize, drawOverlay]);

  return (
    <div className="space-y-6">

      {/* DROP ZONE */}
      {!file && (
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFiles}
            className="hidden"
          />
          <p className="text-sm text-muted-foreground">
            Drag & drop an image here or click to upload
          </p>
        </div>
      )}

      {/* CHANGE IMAGE */}
      {file && (
        <button
          onClick={() => {
            setFile(null);
            setCropBox({ x: 0, y: 0, w: 200, h: 200 });
            currentBox.current = { x: 0, y: 0, w: 200, h: 200 };
          }}
          className="text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          ← Change image
        </button>
      )}

      {/* RATIO SELECTOR */}
      {file && (
        <div className="flex flex-wrap gap-2">
          {RATIOS.map((r) => (
            <button
              key={r.label}
              onClick={() => applyRatio(r.value)}
              className={`px-3 py-1 text-xs rounded-lg border transition-all ${
                ratio === r.value
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border/50 text-muted-foreground hover:text-primary hover:border-primary/50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {/* CANVAS */}
      <div ref={containerRef} className="w-full">
        {file && (
          <canvas
            ref={canvasRef}
            width={displaySize.w}
            height={displaySize.h}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="w-full rounded-lg"
          />
        )}
      </div>

      {/* PREVIEW */}
      {file && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            Preview
          </p>
          <canvas
            ref={previewRef}
            className="max-w-full rounded-lg border border-border/50 max-h-40"
          />
          <p className="text-xs text-muted-foreground">
            Crop size: {Math.round(cropBox.w)} × {Math.round(cropBox.h)}px
          </p>
        </div>
      )}

      {/* CROP BUTTON */}
      <button
        onClick={handleCrop}
        disabled={!file}
        className="w-full py-2 rounded-md bg-primary text-background hover:opacity-90 disabled:opacity-50 transition"
      >
        Crop & Download
      </button>

    </div>
  );
};