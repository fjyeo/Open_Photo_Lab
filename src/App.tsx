import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/dialog";
import "./App.css";

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
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [loadingFullImage, setLoadingFullImage] = useState(false);

  const [gridSize, setGridSize] = useState("medium");
  const [gridType, setGridType] = useState("grid");

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
            const metadata: ImageMetadata = await invoke("load_thumbnail", { path, maxDim: 200 });
            completed++;
            setImportProgress(Math.floor((completed / totalFiles) * 100));
            return { id: crypto.randomUUID(), path, filename: path.split("/").pop() || path, metadata };
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

  // --- Remove Selected Images with Backspace ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Backspace" && selectedImages.size > 0) {
        event.preventDefault();
        setImages((prev) => prev.filter((img) => !selectedImages.has(img.id)));
        setSelectedImages(new Set());
        if (activeImageId && selectedImages.has(activeImageId)) {
          setActiveImageId(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImages, activeImageId]);

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

  // --- Arrow Key Navigation ---
  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (!activeImageId) return;

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const currentIndex = images.findIndex((img) => img.id === activeImageId);
        if (currentIndex === -1) return;

        let newIndex = event.key === "ArrowLeft" 
          ? (currentIndex > 0 ? currentIndex - 1 : images.length - 1)
          : (currentIndex < images.length - 1 ? currentIndex + 1 : 0);

        const newImage = images[newIndex];
        if (newImage) {
          if (!newImage.fullDataUrl) {
            setLoadingFullImage(true);
            try {
              const fullDataUrl: string = await invoke("load_full_image", { path: newImage.path });
              setImages((prevImages) =>
                prevImages.map((img) =>
                  img.id === newImage.id ? { ...img, fullDataUrl } : img
                )
              );
            } catch (error) {
              console.error("Error loading full image:", error);
            } finally {
              setLoadingFullImage(false);
            }
          }
          setActiveImageId(newImage.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeImageId, images]);

  return (
    <div className="lightroom-layout">
      <header className="header">
        <div className="left-header">
          {importing && (
            <div className="header-progress-bar">
              <div className="header-progress" style={{ width: `${importProgress}%` }} />
            </div>
          )}
        </div>
        <nav className="module-nav">
          <button>Library</button>
          <button>Develop</button>
          <button>Map</button>
          <button>Book</button>
          <button>Slideshow</button>
          <button>Print</button>
          <button>Web</button>
        </nav>
      </header>

      <aside className="left-panel">
        <h3>Collections</h3>
        <div className="collection-tree"><p>[Collection Tree]</p></div>
        <div className="import-container">
          <button onClick={handleFileSelect}>Import</button>
        </div>
      </aside>

      <main className="main-content">
        {activeImageId ? (
          <div className="preview">
            <button className="back-btn" onClick={() => setActiveImageId(null)}>Back to Grid</button>
            {loadingFullImage ? <p>Loading full resolution...</p> : 
              <img src={images.find((img) => img.id === activeImageId)?.fullDataUrl || ""} alt="preview" className="preview-image" />
            }
          </div>
        ) : (
          <div className={`image-grid ${gridSize}`}>
            {images.map((image) => (
              <div key={image.id} className={`image-item ${selectedImages.has(image.id) ? "selected" : ""}`} 
                   onClick={() => setSelectedImages(prev => new Set(prev).add(image.id))}
                   onDoubleClick={() => openPreview(image.id)}>
                <img src={image.metadata?.thumbnail} alt="thumbnail" className="thumbnail" />
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="footer">
        <div className="bottom-controls">
          <label>Grid Size:
            <select value={gridSize} onChange={(e) => setGridSize(e.target.value)}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
        </div>
        <div className="filmstrip">
          {images.map((image) => (
            <img key={image.id} src={image.metadata?.thumbnail} alt="thumbnail"
              className={`filmstrip-thumbnail ${activeImageId === image.id ? "active" : ""}`} 
              onClick={() => openPreview(image.id)} />
          ))}
        </div>
      </footer>
    </div>
  );
}

export default App;
