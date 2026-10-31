$csharp = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Collections.Generic;

public class HeroExtractor {
    public static void Extract(string originalPath, string outPath) {
        using (Bitmap fullImg = new Bitmap(originalPath)) {
            int cropX = 440;
            int cropY = 85;
            int w = 565;
            int h = 294;

            Bitmap crop = new Bitmap(w, h, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(crop)) {
                g.DrawImage(fullImg, new Rectangle(0, 0, w, h), new Rectangle(cropX, cropY, w, h), GraphicsUnit.Pixel);
            }

            // Remove residual text "ny." in x = 0..45, y = 85..145
            for (int x = 0; x <= 46; x++) {
                for (int y = 85; y <= 145; y++) {
                    crop.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
                }
            }

            // Lock bits
            BitmapData data = crop.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            int stride = data.Stride;
            byte[] pixels = new byte[stride * h];
            System.Runtime.InteropServices.Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);

            bool[,] isBg = new bool[w, h];
            Queue<Point> q = new Queue<Point>();

            Func<int, int, bool> isBgPixel = (x, y) => {
                int idx = y * stride + x * 4;
                byte b = pixels[idx];
                byte g_val = pixels[idx + 1];
                byte r = pixels[idx + 2];
                byte a = pixels[idx + 3];

                if (a == 0) return true; // Already removed text

                // Background check: pale lavender R >= 210, G >= 190, B >= 225
                if (r >= 212 && g_val >= 192 && b >= 228) {
                    if (Math.Abs(r - g_val) <= 35 && Math.Abs(g_val - b) <= 45) {
                        return true;
                    }
                }
                return false;
            };

            // Seed outer border
            for (int x = 0; x < w; x++) {
                if (isBgPixel(x, 0)) { isBg[x, 0] = true; q.Enqueue(new Point(x, 0)); }
                if (isBgPixel(x, h - 1)) { isBg[x, h - 1] = true; q.Enqueue(new Point(x, h - 1)); }
            }
            for (int y = 0; y < h; y++) {
                if (isBgPixel(0, y)) { isBg[0, y] = true; q.Enqueue(new Point(0, y)); }
                if (isBgPixel(w - 1, y)) { isBg[w - 1, y] = true; q.Enqueue(new Point(w - 1, y)); }
            }

            // BFS Flood Fill
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

            // Apply transparency to all flood-filled pixels
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    int idx = y * stride + x * 4;
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
                            pixels[idx + 3] = 80; // soft alpha
                        } else {
                            pixels[idx] = 0;
                            pixels[idx + 1] = 0;
                            pixels[idx + 2] = 0;
                            pixels[idx + 3] = 0; // completely transparent
                        }
                    } else {
                        pixels[idx + 3] = 255; // solid
                    }
                }
            }

            System.Runtime.InteropServices.Marshal.Copy(pixels, 0, data.Scan0, pixels.Length);
            crop.UnlockBits(data);
            crop.Save(outPath, ImageFormat.Png);
            crop.Dispose();
        }
    }
}
"@

Add-Type -TypeDefinition $csharp -ReferencedAssemblies "System.Drawing"

$orig = "C:\Users\jatin\.gemini\antigravity\brain\f78e97f8-3b73-419e-a361-ab13c404552b\.user_uploaded\media_1793455285238_bf819b1d.jpg"
$out = "C:\Users\jatin\Downloads\Game\public\couple-gaming-hero.png"

[HeroExtractor]::Extract($orig, $out)

Copy-Item -Force $out "C:\Users\jatin\Downloads\Game\src\assets\couple-gaming-hero.png"
Copy-Item -Force $out "C:\Users\jatin\Downloads\Game\dist\couple-gaming-hero.png"
Copy-Item -Force $out "C:\Users\jatin\Downloads\Game\public\better-half-hero.jpg"
Copy-Item -Force $out "C:\Users\jatin\Downloads\Game\dist\better-half-hero.jpg"

Write-Host "Extracted pure transparent couple gaming illustration!"

