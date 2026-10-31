$csharp = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Collections.Generic;

public class ImageProcessor {
    public static void Process(string srcPath, string outPath) {
        using (Bitmap src = new Bitmap(srcPath)) {
            int w = src.Width;
            int h = src.Height;
            
            bool[,] isBg = new bool[w, h];
            Queue<Point> q = new Queue<Point>();

            // Lock source bits
            BitmapData srcData = src.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            int stride = srcData.Stride;
            IntPtr scan0 = srcData.Scan0;

            byte[] pixels = new byte[stride * h];
            System.Runtime.InteropServices.Marshal.Copy(scan0, pixels, 0, pixels.Length);
            src.UnlockBits(srcData);

            Func<int, int, bool> isBgPixel = (x, y) => {
                int idx = y * stride + x * 4;
                byte b = pixels[idx];
                byte g = pixels[idx + 1];
                byte r = pixels[idx + 2];
                // Pale lavender background check
                if (r >= 210 && g >= 190 && b >= 225) {
                    if (Math.Abs(r - g) <= 35 && Math.Abs(g - b) <= 45) {
                        return true;
                    }
                }
                return false;
            };

            // Seed perimeter
            for (int x = 0; x < w; x++) {
                if (isBgPixel(x, 0)) { isBg[x, 0] = true; q.Enqueue(new Point(x, 0)); }
                if (isBgPixel(x, h - 1)) { isBg[x, h - 1] = true; q.Enqueue(new Point(x, h - 1)); }
            }
            for (int y = 0; y < h; y++) {
                if (isBgPixel(0, y)) { isBg[0, y] = true; q.Enqueue(new Point(0, y)); }
                if (isBgPixel(w - 1, y)) { isBg[w - 1, y] = true; q.Enqueue(new Point(w - 1, y)); }
            }

            // BFS
            int[] dx = { 1, -1, 0, 0 };
            int[] dy = { 0, 0, 1, -1 };

            while (q.Count > 0) {
                Point p = q.Dequeue();
                for (int i = 0; i < 4; i++) {
                    int nx = p.X + dx[i];
                    int ny = p.Y + dy[i];
                    if (nx >= 0 && nx < w && ny >= 0 && ny < h && !isBg[nx, ny]) {
                        if (isBgPixel(nx, ny)) {
                            isBg[nx, ny] = true;
                            q.Enqueue(new Point(nx, ny));
                        }
                    }
                }
            }

            // Create destination buffer
            byte[] outPixels = new byte[stride * h];

            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    int idx = y * stride + x * 4;
                    byte b = pixels[idx];
                    byte g = pixels[idx + 1];
                    byte r = pixels[idx + 2];

                    if (isBg[x, y]) {
                        // Check if 1-pixel neighbor is foreground (for soft antialiasing)
                        bool nearFg = false;
                        for (int kx = -1; kx <= 1 && !nearFg; kx++) {
                            for (int ky = -1; ky <= 1 && !nearFg; ky++) {
                                int tx = x + kx;
                                int ty = y + ky;
                                if (tx >= 0 && tx < w && ty >= 0 && ty < h && !isBg[tx, ty]) {
                                    nearFg = true;
                                }
                            }
                        }
                        if (nearFg) {
                            outPixels[idx] = b;
                            outPixels[idx + 1] = g;
                            outPixels[idx + 2] = r;
                            outPixels[idx + 3] = 90; // soft alpha
                        } else {
                            outPixels[idx] = 0;
                            outPixels[idx + 1] = 0;
                            outPixels[idx + 2] = 0;
                            outPixels[idx + 3] = 0; // transparent
                        }
                    } else {
                        outPixels[idx] = b;
                        outPixels[idx + 1] = g;
                        outPixels[idx + 2] = r;
                        outPixels[idx + 3] = 255; // solid
                    }
                }
            }

            using (Bitmap dst = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
                BitmapData dstData = dst.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                System.Runtime.InteropServices.Marshal.Copy(outPixels, 0, dstData.Scan0, outPixels.Length);
                dst.UnlockBits(dstData);
                dst.Save(outPath, ImageFormat.Png);
            }
        }
    }
}
"@

Add-Type -TypeDefinition $csharp -ReferencedAssemblies "System.Drawing"

$src = "C:\Users\jatin\Downloads\Game\public\crop-untouched-440.png"
$dst = "C:\Users\jatin\Downloads\Game\public\couple-gaming-hero.png"

# First ensure crop-untouched-440.png has "ny." removed:
# We already know "ny." was in x=0..45, y=85..145
# Let's run ImageProcessor
[ImageProcessor]::Process($src, $dst)

# Also remove "ny." if any remains on the left
$bmp = [System.Drawing.Bitmap]::FromFile($dst)
for ($x = 0; $x -le 46; $x++) {
    for ($y = 85; $y -le 145; $y++) {
        $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    }
}
$bmp.Save("C:\Users\jatin\Downloads\Game\public\couple-gaming-hero-clean.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Copy-Item -Force "C:\Users\jatin\Downloads\Game\public\couple-gaming-hero-clean.png" "C:\Users\jatin\Downloads\Game\public\couple-gaming-hero.png"
Copy-Item -Force "C:\Users\jatin\Downloads\Game\public\couple-gaming-hero-clean.png" "C:\Users\jatin\Downloads\Game\src\assets\couple-gaming-hero.png"
Copy-Item -Force "C:\Users\jatin\Downloads\Game\public\couple-gaming-hero-clean.png" "C:\Users\jatin\Downloads\Game\dist\couple-gaming-hero.png"
Copy-Item -Force "C:\Users\jatin\Downloads\Game\public\couple-gaming-hero-clean.png" "C:\Users\jatin\Downloads\Game\public\better-half-hero.jpg"
Copy-Item -Force "C:\Users\jatin\Downloads\Game\public\couple-gaming-hero-clean.png" "C:\Users\jatin\Downloads\Game\dist\better-half-hero.jpg"

Write-Host "Processed in milliseconds!"

