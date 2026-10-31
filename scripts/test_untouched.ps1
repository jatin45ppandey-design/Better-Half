Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\jatin\.gemini\antigravity\brain\f78e97f8-3b73-419e-a361-ab13c404552b\.user_uploaded\media_1793455285238_bf819b1d.jpg"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

# Let's crop from x=430, y=85, w=575, h=299 WITHOUT touching any pixels
$rect = New-Object System.Drawing.Rectangle(430, 85, 575, 299)
$crop = $img.Clone($rect, $img.PixelFormat)
$crop.Save("C:\Users\jatin\Downloads\Game\public\crop-untouched-430.png", [System.Drawing.Imaging.ImageFormat]::Png)
$crop.Dispose()

# Also let's crop from x=440, y=85, w=565, h=299 WITHOUT touching any pixels
$rect2 = New-Object System.Drawing.Rectangle(440, 85, 565, 299)
$crop2 = $img.Clone($rect2, $img.PixelFormat)
$crop2.Save("C:\Users\jatin\Downloads\Game\public\crop-untouched-440.png", [System.Drawing.Imaging.ImageFormat]::Png)
$crop2.Dispose()

$img.Dispose()
Write-Host "Saved untouched crops"

