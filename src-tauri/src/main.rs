// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use image::{DynamicImage, imageops::thumbnail};
use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Mutex;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use std::io::Cursor;

#[derive(Serialize, Deserialize, Clone)]
struct ImageMetadata {
    width: u32,
    height: u32,
    format: String,
    thumbnail: String,  // Base64 encoded thumbnail
}

#[derive(Default)]
struct ImageCache(Mutex<Vec<DynamicImage>>);

#[tauri::command]
async fn load_image(path: String, cache: State<'_, ImageCache>) -> Result<ImageMetadata, String> {
    let img = image::open(&path).map_err(|e| e.to_string())?;
    
    // Generate thumbnail
    let thumbnail = img.resize(200, 200, image::imageops::FilterType::Lanczos3);
    let mut thumbnail_bytes: Vec<u8> = Vec::new();
    thumbnail.write_to(&mut Cursor::new(&mut thumbnail_bytes), image::ImageOutputFormat::Jpeg(80))
        .map_err(|e| e.to_string())?;
    
    let thumbnail_base64 = format!("data:image/jpeg;base64,{}", BASE64.encode(&thumbnail_bytes));

    let metadata = ImageMetadata {
        width: img.width(),
        height: img.height(),
        format: path.split('.').last().unwrap_or("unknown").to_string(),
        thumbnail: thumbnail_base64,
    };
    
    cache.0.lock().unwrap().push(img);
    
    Ok(metadata)
}

fn main() {
    tauri::Builder::default()
        .manage(ImageCache::default())
        .invoke_handler(tauri::generate_handler![load_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
