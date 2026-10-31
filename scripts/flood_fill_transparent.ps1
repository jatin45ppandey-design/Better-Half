Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile("C:\Users\jatin\Downloads\Game\public\couple-gaming-hero.png")
$w = $src.Width
$h = $src.Height

# We will create a boolean mask for background: isBg[x, y]
$isBg = New-Object 'bool[,]' $w, $h

# A queue for BFS flood-fill from all 4 boundaries
$queue = New-Object System.Collections.Generic.Queue[System.Drawing.Point]

# Function to check if a pixel is background candidate
# Background in the image is pale lavender: R >= 215, G >= 195, B >= 235
# and saturation is low: |R - G| <= 35, |R - B| <= 35, |G - B| <= 35
function IsBgColor($r, $g, $b) {
    if ($r -ge 212 -and $g -ge 192 -and $b -ge 230) {
        if ([Math]::Abs($r - $g) -le 35 -and [Math]::Abs($g - $b) -le 45) {
            return $true
        }
    }
    return $false
}

# Seed the queue with all perimeter pixels that match background color
for ($x = 0; $x -lt $w; $x++) {
    # Top edge
    $c = $src.GetPixel($x, 0)
    if (IsBgColor $c.R $c.G $c.B) {
        $isBg[$x, 0] = $true
        $queue.Enqueue((New-Object System.Drawing.Point($x, 0)))
    }
    # Bottom edge (except where couch sits: x between 50 and 520)
    # The couch is at y=h-1 for x > 30. Couch has R < 120, so IsBgColor won't match anyway!
    $c = $src.GetPixel($x, $h - 1)
    if (IsBgColor $c.R $c.G $c.B) {
        $isBg[$x, $h - 1] = $true
        $queue.Enqueue((New-Object System.Drawing.Point($x, $h - 1)))
    }
}

for ($y = 0; $y -lt $h; $y++) {
    # Left edge
    $c = $src.GetPixel(0, $y)
    if (IsBgColor $c.R $c.G $c.B) {
        $isBg[0, $y] = $true
        $queue.Enqueue((New-Object System.Drawing.Point(0, $y)))
    }
    # Right edge
    $c = $src.GetPixel($w - 1, $y)
    if (IsBgColor $c.R $c.G $c.B) {
        $isBg[$w - 1, $y] = $true
        $queue.Enqueue((New-Object System.Drawing.Point($w - 1, $y)))
    }
}

Write-Host "Initial queue count: $($queue.Count)"

# 4-connected BFS flood fill
$dx = @(1, -1, 0, 0)
$dy = @(0, 0, 1, -1)

while ($queue.Count -gt 0) {
    $pt = $queue.Dequeue()
    $px = $pt.X
    $py = $pt.Y
    
    for ($i = 0; $i -lt 4; $i++) {
        $nx = $px + $dx[$i]
        $ny = $py + $dy[$i]
        
        if ($nx -ge 0 -and $nx -lt $w -and $ny -ge 0 -and $ny -lt $h) {
            if (-not $isBg[$nx, $ny]) {
                $c = $src.GetPixel($nx, $ny)
                if (IsBgColor $c.R $c.G $c.B) {
                    $isBg[$nx, $ny] = $true
                    $queue.Enqueue((New-Object System.Drawing.Point($nx, $ny)))
                }
            }
        }
    }
}

# Create output ARGB image
$dst = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

# Also let's feather 2 pixels at the boundary between isBg and non-isBg
for ($x = 0; $x -lt $w; $x++) {
    for ($y = 0; $y -lt $h; $y++) {
        $c = $src.GetPixel($x, $y)
        if ($isBg[$x, $y]) {
            # Check distance to non-bg
            $hasNearFg = $false
            for ($kx = -1; $kx -le 1; $kx++) {
                for ($ky = -1; $ky -le 1; $ky++) {
                    $tx = $x + $kx; $ty = $y + $ky
                    if ($tx -ge 0 -and $tx -lt $w -and $ty -ge 0 -and $ty -lt $h) {
                        if (-not $isBg[$tx, $ty]) {
                            $hasNearFg = $true
                            break
                        }
                    }
                }
                if ($hasNearFg) { break }
            }
            if ($hasNearFg) {
                # soft 50% anti-aliasing edge
                $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(70, $c.R, $c.G, $c.B))
            } else {
                $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            }
        } else {
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
        }
    }
}

$dstPath = "C:\Users\jatin\Downloads\Game\public\couple-gaming-hero.png"
$dst.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
$dst.Save("C:\Users\jatin\Downloads\Game\src\assets\couple-gaming-hero.png", [System.Drawing.Imaging.ImageFormat]::Png)
$dst.Save("C:\Users\jatin\Downloads\Game\dist\couple-gaming-hero.png", [System.Drawing.Imaging.ImageFormat]::Png)

$dst.Dispose()
$src.Dispose()
Write-Host "Flood-filled transparent PNG saved to $dstPath"

