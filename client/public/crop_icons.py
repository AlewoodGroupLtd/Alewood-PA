from PIL import Image
import os

files_to_process = ['pwa-192x192.png', 'pwa-512x512.png', 'favicon.png']

for filename in files_to_process:
    if not os.path.exists(filename):
        continue
    img = Image.open(filename).convert("RGBA")
    bbox = img.getbbox()
    if bbox:
        # Crop to bounding box of non-transparent pixels
        img_cropped = img.crop(bbox)
        
        # Add a tiny 5% padding so it doesn't bleed off the absolute edge
        w, h = img_cropped.size
        pad = int(max(w, h) * 0.05)
        
        # Create a square canvas
        size = max(w, h) + pad * 2
        new_img = Image.new("RGBA", (size, size), (255, 255, 255, 0))
        
        # Paste cropped image into center
        paste_x = (size - w) // 2
        paste_y = (size - h) // 2
        new_img.paste(img_cropped, (paste_x, paste_y))
        
        # Resize to original target sizes
        if '192' in filename:
            new_img = new_img.resize((192, 192), Image.Resampling.LANCZOS)
        elif '512' in filename:
            new_img = new_img.resize((512, 512), Image.Resampling.LANCZOS)
        
        new_img.save(filename)
        print(f"Processed {filename}")
