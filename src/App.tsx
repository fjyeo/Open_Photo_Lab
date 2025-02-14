import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/dialog";
import "./App.css";
import Histogram from "./histogram";

interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  thumbnail: string;
}

interface ImageFile {
  id: string;
  path: string;
  filename: string;
  metadata?: ImageMetadata;
  fullDataUrl?: string;
}

function App() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [loadingFullImage, setLoadingFullImage] = useState(false);

  // --- Import images ---
  const handleFileSelect = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
      });

      if (Array.isArray(selected)) {
        setImporting(true);
        const totalFiles = selected.length;
        let completed = 0;

        const newImages: ImageFile[] = await Promise.all(
          selected.map(async (path) => {
            const metadata: ImageMetadata = await invoke("load_thumbnail", {
              path,
              maxDim: 200,
            });
            completed++;
            setImportProgress(Math.floor((completed / totalFiles) * 100));
            return {
              id: crypto.randomUUID(),
              path,
              filename: path.split("/").pop() || path,
              metadata,
            };
          })
        );

        setImages((prev) => [...prev, ...newImages]);
        setImporting(false);
        setImportProgress(0);
      }
    } catch (error) {
      console.error("Error loading images:", error);
      setImporting(false);
      setImportProgress(0);
    }
  };

  // --- Export only the selected image ---
  const exportImages = async () => {
    if (!selectedImageId) {
      alert("Please select an image to export.");
      return;
    }
    const destination = await open({
      directory: true,
      multiple: false,
    });
    if (typeof destination !== "string") {
      console.error("No destination selected");
      return;
    }
    const selectedImage = images.find((img) => img.id === selectedImageId);
    if (!selectedImage) return;
    try {
      await invoke("export_images", { destination, imagePaths: [selectedImage.path] });
      alert("Image exported successfully!");
    } catch (error) {
      console.error("Error exporting image:", error);
      alert("Error exporting image. Check console for details.");
    }
  };

  // --- Open Full Preview ---
  const openPreview = async (id: string) => {
    const image = images.find((img) => img.id === id);
    if (!image) return;

    if (image.fullDataUrl) {
      setActiveImageId(id);
      return;
    }

    setLoadingFullImage(true);
    try {
      const fullDataUrl: string = await invoke("load_full_image", { path: image.path });
      setImages((prevImages) =>
        prevImages.map((img) => (img.id === id ? { ...img, fullDataUrl } : img))
      );
      setActiveImageId(id);
    } catch (error) {
      console.error("Error loading full image:", error);
    } finally {
      setLoadingFullImage(false);
    }
  };

  // --- Delete Selected Image on Backspace with Confirmation ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Backspace" && selectedImageId) {
        event.preventDefault();
        const confirmed = window.confirm("Are you sure you want to delete the selected image?");
        if (confirmed) {
          setImages((prev) => prev.filter((img) => img.id !== selectedImageId));
          if (activeImageId === selectedImageId) {
            setActiveImageId(null);
          }
          setSelectedImageId(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImageId, activeImageId]);

  // --- Arrow Key Navigation for Preview Mode ---
  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (!activeImageId) return;

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const currentIndex = images.findIndex((img) => img.id === activeImageId);
        if (currentIndex === -1) return;

        let newIndex =
          event.key === "ArrowLeft"
            ? currentIndex > 0
              ? currentIndex - 1
              : images.length - 1
            : currentIndex < images.length - 1
            ? currentIndex + 1
            : 0;

        const newImage = images[newIndex];
        if (newImage) {
          if (!newImage.fullDataUrl) {
            setLoadingFullImage(true);
            try {
              const fullDataUrl: string = await invoke("load_full_image", { path: newImage.path });
              setImages((prevImages) =>
                prevImages.map((img) => (img.id === newImage.id ? { ...img, fullDataUrl } : img))
              );
            } catch (error) {
              console.error("Error loading full image:", error);
            } finally {
              setLoadingFullImage(false);
            }
          }
          setActiveImageId(newImage.id);
          setSelectedImageId(newImage.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeImageId, images]);

  const selectedImage = images.find((img) => img.id === selectedImageId);
  const activeImage = images.find((img) => img.id === activeImageId);

  return (
    <div className="lightroom-layout">
      {/* HEADER */}
      <header className="header">
        <div className="left-header">
          {importing && (
            <div className="header-progress-bar">
              <div className="header-progress" style={{ width: `${importProgress}%` }} />
            </div>
          )}
        </div>
      </header>

      {/* LEFT PANEL (Collections) */}
      <aside className="left-panel">
        <div className="left-panel-top">
          <h3>Collections</h3>
          <div className="collection-preview">
            {selectedImage ? (
              <img
                src={selectedImage.metadata?.thumbnail}
                alt="Selected Collection Thumbnail"
                className="collection-thumbnail"
              />
            ) : (
              <div className="collection-placeholder">
                <p>No image selected</p>
              </div>
            )}
          </div>
        </div>
        <div className="import-export-container">
          <button onClick={handleFileSelect}>Import</button>
          <button onClick={exportImages} disabled={!selectedImageId}>
            Export
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT (Grid or Full Preview) */}
      <main className="main-content">
        {activeImageId ? (
          <div className="preview">
            <button className="back-btn" onClick={() => setActiveImageId(null)}>
              Back to Grid
            </button>
            {loadingFullImage ? (
              <p>Loading full resolution...</p>
            ) : (
              <img
                src={activeImage?.fullDataUrl || ""}
                alt="preview"
                className="preview-image"
              />
            )}
          </div>
        ) : (
          <div className="image-grid">
            {images.map((image, index) => (
              <div
                key={image.id}
                className={`image-item ${selectedImageId === image.id ? "selected" : ""}`}
                onClick={() => setSelectedImageId(image.id)}
                onDoubleClick={() => {
                  setSelectedImageId(image.id);
                  openPreview(image.id);
                }}
              >
                <img src={image.metadata?.thumbnail} alt="thumbnail" className="thumbnail" />
                {/* Big number in top-right corner */}
                <div className="thumbnail-label big-number">{index + 1}</div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* RIGHT PANEL (Histogram & Photo Information) */}
      <aside className="right-panel">
        <h3>Photo Information</h3>
        {selectedImage ? (
          <>
            <div className="histogram">
              <Histogram imagePath={selectedImage.path} />
            </div>
            <div className="photo-info">
              <p>
                <strong>Filename:</strong>{" "}
                <span className="truncate-text">{selectedImage.filename}</span>
              </p>
              <p>
                <strong>Path:</strong>{" "}
                <span className="truncate-text">{selectedImage.path}</span>
              </p>
              <p>
                <strong>Width:</strong> {selectedImage.metadata?.width}
              </p>
              <p>
                <strong>Height:</strong> {selectedImage.metadata?.height}
              </p>
              <p>
                <strong>Format:</strong> {selectedImage.metadata?.format}
              </p>
            </div>
          </>
        ) : (
          <p>No image selected</p>
        )}
      </aside>

      {/* FOOTER (Filmstrip Always Visible) */}
      <footer className="footer">
        <div className="filmstrip">
          {images.map((image) => (
            <img
              key={image.id}
              src={image.metadata?.thumbnail}
              alt="thumbnail"
              className={`filmstrip-thumbnail ${selectedImageId === image.id ? "selected" : ""}`}
              onClick={() => setSelectedImageId(image.id)}
              onDoubleClick={() => {
                setSelectedImageId(image.id);
                openPreview(image.id);
              }}
            />
          ))}
        </div>
      </footer>
    </div>
  );
}

export default App;
