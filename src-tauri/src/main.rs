#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::sync::Mutex;
use std::io::Cursor;
use std::fs;
use std::path::Path;

// Tauri
use tauri::{State, command};

// For serialization
use serde::{Deserialize, Serialize};

// For images
use image::{DynamicImage, GenericImageView, ImageOutputFormat};

// For base64
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

// ----------------- Data Structures -----------------

#[derive(Serialize, Deserialize, Clone)]
struct ImageMetadata {
    width: u32,
    height: u32,
    format: String,
    thumbnail: String,
}

#[derive(Default)]
struct ImageCache(Mutex<Vec<DynamicImage>>);

#[derive(Serialize)]
struct HistogramData {
    red: Vec<u32>,
    green: Vec<u32>,
    blue: Vec<u32>,
    lum: Vec<u32>,
}

// ----------------- Commands -----------------

/// Load thumbnail + metadata
#[command]
fn load_thumbnail(path: String, max_dim: u32, cache: State<ImageCache>) -> Result<ImageMetadata, String> {
    let img = image::open(&path).map_err(|e| e.to_string())?;
    let width = img.width();
    let height = img.height();

    // Create a thumbnail with maximum dimensions (max_dim x max_dim)
    let thumbnail_img = img.thumbnail(max_dim, max_dim);

    // Encode as JPEG
    let mut thumb_bytes: Vec<u8> = Vec::new();
    thumbnail_img
        .write_to(&mut Cursor::new(&mut thumb_bytes), ImageOutputFormat::Jpeg(80))
        .map_err(|e| e.to_string())?;
    let thumbnail_base64 = format!("data:image/jpeg;base64,{}", BASE64.encode(&thumb_bytes));

    // Derive format from file extension
    let format = path
        .split('.')
        .last()
        .unwrap_or("unknown")
        .to_lowercase();

    // Optionally cache the original
    cache.0.lock().unwrap().push(img);

    Ok(ImageMetadata {
        width,
        height,
        format,
        thumbnail: thumbnail_base64,
    })
}

/// Load full image as Base64 data URL
#[command]
fn load_full_image(path: String) -> Result<String, String> {
    let buffer = fs::read(&path).map_err(|e| e.to_string())?;
    let base64_data = BASE64.encode(&buffer);
    let data_url = format!("data:image/jpeg;base64,{}", base64_data);
    Ok(data_url)
}

/// Compute a histogram by iterating over every pixel (no partial sampling).
#[command]
fn compute_histogram(path: String) -> Result<HistogramData, String> {
    let img = image::open(&path).map_err(|e| e.to_string())?;
    let mut red = vec![0u32; 256];
    let mut green = vec![0u32; 256];
    let mut blue = vec![0u32; 256];
    let mut lum = vec![0u32; 256];

    // Iterate over every pixel
    for pixel in img.pixels() {
        let [r, g, b, _a] = pixel.2.0;
        red[r as usize] += 1;
        green[g as usize] += 1;
        blue[b as usize] += 1;
        // approximate luminance
        let y = (0.299 * (r as f32) + 0.587 * (g as f32) + 0.114 * (b as f32)) as usize;
        if y < 256 {
            lum[y] += 1;
        }
    }

    Ok(HistogramData { red, green, blue, lum })
}

/// Export only the specified images (here we do just one, or a list).
#[command]
fn export_images(destination: String, image_paths: Vec<String>) -> Result<(), String> {
    for path in image_paths {
        let file_name = Path::new(&path)
            .file_name()
            .ok_or("Invalid file name")?;
        let dest_path = Path::new(&destination).join(file_name);
        fs::copy(&path, &dest_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ----------------- main -----------------

fn main() {
    tauri::Builder::default()
        .manage(ImageCache::default())
        .invoke_handler(tauri::generate_handler![
            load_thumbnail,
            load_full_image,
            compute_histogram,
            export_images
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
