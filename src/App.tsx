import { useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/dialog";
import "./App.css";

interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  thumbnail?: string;
}

interface ImageFile {
    id: string;
    path: string;
    filename: string;
    metadata?: ImageMetadata;
    thumbnail?: string;
}

function App() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

  const handleFileSelect = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp']
        }]
      });

      if (Array.isArray(selected)) {
        const newImages: ImageFile[] = await Promise.all(
          selected.map(async (path) => {
            const metadata = await invoke<ImageMetadata>('load_image', { path });
            return {
              id: crypto.randomUUID(),
              path,
              filename: path.split('/').pop() || path,
              metadata
            };
          })
        );
        setImages(prev => [...prev, ...newImages]);
      }
    } catch (error) {
      console.error('Error loading images:', error);
    }
  };

  const toggleImageSelection = (id: string) => {
    setSelectedImages(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
      return newSelection;
    });
  };

  const removeSelectedImages = () => {
    setImages(prev => prev.filter(img => !selectedImages.has(img.id)));
    setSelectedImages(new Set());
  };

  return (
    <div className="container">
      <h1>Image Processor</h1>
      <div className="actions">
        <button onClick={handleFileSelect}>Select Images</button>
        {selectedImages.size > 0 && (
          <button onClick={removeSelectedImages} className="remove-btn">
            Remove Selected ({selectedImages.size})
          </button>
        )}
      </div>
      
      <div className="image-grid">
        {images.map(image => (
          <div 
            key={image.id} 
            className={`image-item ${selectedImages.has(image.id) ? 'selected' : ''}`}
            onClick={() => toggleImageSelection(image.id)}
          >
            {image.metadata?.thumbnail && (
              <img 
                src={image.metadata.thumbnail} 
                alt={image.filename}
                className="thumbnail"
              />
            )}
            <p>{image.filename}</p>
            <p>
              {image.metadata?.width}x{image.metadata?.height}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
