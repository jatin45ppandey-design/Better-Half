Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile("C:\Users\jatin\Downloads\Game\public\couple-gaming-hero.png")
$w = $src.Width
$h = $src.Height

# Create a 32-bit ARGB image
$dst = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

# Background color is approximately R=247, G=239, B=254 (Hex #F7EFFE)
# Let's see: for each pixel, calculate distance from background color
# Target bg: R=247, G=239, B=254
$bgR = 247.0
$bgG = 239.0
$bgB = 254.0

for ($x = 0; $x -lt $w; $x++) {
    for ($y = 0; $y -lt $h; $y++) {
        $c = $src.GetPixel($x, $y)
        
        # Color difference from background
        $dr = [Math]::Abs($c.R - $bgR)
        $dg = [Math]::Abs($c.G - $bgG)
        $db = [Math]::Abs($c.B - $bgB)
        $diff = [Math]::Max($dr, [Math]::Max($dg, $db))
        
        # If difference is tiny (< 8), it's pure background -> alpha = 0
        # If difference is between 8 and 24, smoothly ramp alpha from 0 to 255
        # If difference >= 24, fully opaque -> alpha = 255
        if ($diff -le 6) {
            $alpha = 0
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } elseif ($diff -lt 24) {
            $alpha = [int](($diff - 6) / 18.0 * 255)
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $c.R, $c.G, $c.B))
        } else {
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
        }
    }
}

$dstPath = "C:\Users\jatin\Downloads\Game\public\couple-gaming-transparent.png"
$dst.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
$dst.Dispose()
$src.Dispose()
Write-Host "Transparent PNG saved to $dstPath"

