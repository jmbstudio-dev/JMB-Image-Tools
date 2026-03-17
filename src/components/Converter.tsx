import { useState, useRef } from "react";
import { saveAs } from "file-saver";
import JSZip from "jszip";

const FORMATS = [
  { label: "WebP", value: "image/webp", ext: "webp", hasQuality: true },
  { label: "JPEG", value: "image/jpeg", ext: "jpg", hasQuality: true },
  { label: "PNG", value: "image/png", ext: "png", hasQuality: false },
  { label: "BMP", value: "image/bmp", ext: "bmp", hasQuality: false },
  { label: "AVIF", value: "image/avif", ext: "avif", hasQuality: true },
];

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const convertWithCanvas = (
  file: File,
  format: string,
  quality: number,
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context failed"));

      if (format === "image/jpeg" || format === "image/bmp") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Conversion failed"));
        },
        format,
        quality / 100,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load ${file.name}`));
    };

    img.src = url;
  });
};

export const Converter = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState("image/webp");
  const [quality, setQuality] = useState(85);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<number[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [outputSizes, setOutputSizes] = useState<number[]>([]); 

  const selectedFormat = FORMATS.find((f) => f.value === format)!;

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files).slice(0, 20);
    setFiles(selected);
    setProgress(Array(selected.length).fill(0));
    setErrors(Array(selected.length).fill(""));
    setOutputSizes(Array(selected.length).fill(0));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 20);
    setFiles(dropped);
    setProgress(Array(dropped.length).fill(0));
    setErrors(Array(dropped.length).fill(""));
    setOutputSizes(Array(dropped.length).fill(0));
  };

  const convertImages = async () => {
    setConverting(true);
    setProgress(Array(files.length).fill(0));
    setErrors(Array(files.length).fill(""));
    setOutputSizes(Array(files.length).fill(0));

    const zip = new JSZip();

    await Promise.all(
      files.map(async (file, i) => {
        try {
          setProgress((prev) => {
            const copy = [...prev];
            copy[i] = 10;
            return copy;
          });

          const blob = await convertWithCanvas(file, format, quality);
          setOutputSizes((prev) => {
            const copy = [...prev];
            copy[i] = blob.size;
            return copy;
          });

          setProgress((prev) => {
            const copy = [...prev];
            copy[i] = 90;
            return copy;
          });

          const newName =
            file.name.replace(/\.[^/.]+$/, "") + "." + selectedFormat.ext;
          zip.file(newName, await blob.arrayBuffer());

          setProgress((prev) => {
            const copy = [...prev];
            copy[i] = 100;
            return copy;
          });
        } catch (err) {
          setErrors((prev) => {
            const copy = [...prev];
            copy[i] = "Failed";
            return copy;
          });
          setProgress((prev) => {
            const copy = [...prev];
            copy[i] = 0;
            return copy;
          });
        }
      }),
    );

    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, "converted-images.zip");

    setConverting(false);
  };

  return (
    <section className="flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="space-y-3 text-center animate-fade-in animate-delay-100">
          <h2 className="text-3xl font-bold text-primary uppercase">
            Image Converter
          </h2>
          <p className="text-muted-foreground text-sm">
            Convert multiple images into different formats instantly. Got tired
            of looking on the internet so i made a simple one. 👍
          </p>
          <p className="text-bold text-primary">NO LOG-IN NEEDED.</p>
          {/* Info notes */}
          <div className="text-left space-y-1 text-xs text-muted-foreground border border-dashed rounded-lg p-3">
            <p>📁 Max 20 files per batch</p>
            <p>🎚️ Adjust quality to control output file size</p>
            <p>
              ⚠️ <strong>AVIF</strong> is supported on Chrome/Edge but may fail
              on Firefox or Safari — use WebP for best compatibility
            </p>
            <p>
              ⚠️ Very large images (16,000×16,000px+) may fail silently due to
              browser canvas limits
            </p>
            <p>
              🔒 <strong>100% private</strong> — your images never leave your
              device. Everything runs directly in your browser, no uploads, no
              server.
            </p>
          </div>
        </div>
 
        {/* Card */}
        <div className="glass rounded-xl p-5 space-y-6 shadow-lg hover:scale-[1.01] transition animate-fade-in animate-delay-200">
          {/* Drop zone */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFiles}
              className="hidden"
            />
            <p className="text-sm text-muted-foreground">
              Drag & drop images here or click to upload
            </p>
          </div>

          {/* Format select */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground">Convert to:</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="bg-primary border rounded-md px-3 py-1 text-sm text-background"
            >
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quality slider */}
          {selectedFormat.hasQuality && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">
                  Quality:
                </label>
                <span className="text-sm text-primary font-medium">
                  {quality}%
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Smaller file</span>
                <span>Best quality</span>
              </div>
            </div>
          )}

          {/* Button */}
          <button
            onClick={convertImages}
            disabled={files.length === 0 || converting}
            className="w-full py-2 rounded-md bg-primary text-background
                     hover:opacity-90 disabled:opacity-50 transition"
          >
            {converting ? "Converting..." : "Convert Images"}
          </button>

          {/* Info */}
          <p className="text-sm text-center text-muted-foreground">
            {files.length} file(s) selected
          </p>

          {/* Previews + Progress */}
          <div className="grid grid-cols-3 gap-2">
            {files.map((file, i) => (
              <div key={i} className="space-y-1">
                <img
                  src={URL.createObjectURL(file)}
                  alt="preview"
                  className="w-full h-20 object-cover rounded-md"
                />
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      errors[i]
                        ? "bg-red-500"
                        : progress[i] === 100
                          ? "bg-green-500"
                          : "bg-primary"
                    }`}
                    style={{
                      width: `${errors[i] ? 100 : (progress[i] ?? 0)}%`,
                    }}
                  />
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  {errors[i] ? (
                    <span className="text-red-500">Failed</span>
                  ) : progress[i] === 100 && outputSizes[i] ? (
                    <span className="text-green-500">
                      {formatBytes(file.size)} → {formatBytes(outputSizes[i])}
                    </span>
                  ) : (
                    `${progress[i] ?? 0}%`
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
