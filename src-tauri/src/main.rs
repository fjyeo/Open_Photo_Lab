#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use image::{DynamicImage, ImageOutputFormat};
use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Mutex;
use std::io::Cursor;
use std::fs;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

#[derive(Serialize, Deserialize, Clone)]
struct ImageMetadata {
    width: u32,
    height: u32,
    format: String,
    thumbnail: String, // Base64 encoded thumbnail data URL
}

#[derive(Default)]
struct ImageCache(Mutex<Vec<DynamicImage>>);

#[tauri::command]
async fn load_thumbnail(path: String, maxDim: u32, cache: State<'_, ImageCache>) -> Result<ImageMetadata, String> {
    let img = image::open(&path).map_err(|e| e.to_string())?;
    let width = img.width();
    let height = img.height();

    // Create a thumbnail with maximum dimensions (maxDim x maxDim)
    let thumbnail_img = img.thumbnail(maxDim, maxDim);
    let mut thumb_bytes: Vec<u8> = Vec::new();
    thumbnail_img.write_to(&mut Cursor::new(&mut thumb_bytes), ImageOutputFormat::Jpeg(80))
        .map_err(|e| e.to_string())?;
    let thumbnail_base64 = format!("data:image/jpeg;base64,{}", BASE64.encode(&thumb_bytes));

    // Determine image format from file extension
    let format = path.split('.').last().unwrap_or("unknown").to_lowercase();

    // Optionally cache the full image (be cautious with memory usage)
    cache.0.lock().unwrap().push(img);

    Ok(ImageMetadata {
        width,
        height,
        format,
        thumbnail: thumbnail_base64,
    })
}

#[tauri::command]
async fn load_full_image(path: String) -> Result<String, String> {
    let buffer = fs::read(&path).map_err(|e| e.to_string())?;
    let base64_data = BASE64.encode(&buffer);
    let data_url = format!("data:image/jpeg;base64,{}", base64_data);
    Ok(data_url)
}

fn main() {
    tauri::Builder::default()
        .manage(ImageCache::default())
        .invoke_handler(tauri::generate_handler![load_thumbnail, load_full_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
