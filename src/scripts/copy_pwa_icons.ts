import fs from "fs";
import path from "path";

async function main() {
  const sourceImage = "C:\\Users\\badal\\.gemini\\antigravity-ide\\brain\\e860130d-2132-44df-afc4-78606ef74c56\\pwa_icon_512_1781276928715.png";
  const targetDir = path.resolve("e:/goan/CRM/public/icons");

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log("Created directory:", targetDir);
  }

  const dest512 = path.join(targetDir, "icon-512x512.png");
  const dest192 = path.join(targetDir, "icon-192x192.png");

  if (fs.existsSync(sourceImage)) {
    fs.copyFileSync(sourceImage, dest512);
    console.log("Copied 512x512 icon to:", dest512);
    fs.copyFileSync(sourceImage, dest192);
    console.log("Copied 192x192 icon to:", dest192);
  } else {
    console.error("Source image not found at:", sourceImage);
    process.exit(1);
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Error setting up icons:", err);
  process.exit(1);
});
