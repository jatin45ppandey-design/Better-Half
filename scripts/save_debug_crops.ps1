Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\jatin\.gemini\antigravity\brain\f78e97f8-3b73-419e-a361-ab13c404552b\.user_uploaded\media_1793455285238_bf819b1d.jpg"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

# Let's save a crop of y: 0 to 420, x: 400 to 1024
$rect = New-Object System.Drawing.Rectangle(410, 50, 600, 340)
$crop = $img.Clone($rect, $img.PixelFormat)
$crop.Save("C:\Users\jatin\Downloads\Game\public\crop-410-50-600-340.png", [System.Drawing.Imaging.ImageFormat]::Png)
$crop.Dispose()

# Also let's save y: 70 to 390, x: 440 to 1000
$rect2 = New-Object System.Drawing.Rectangle(430, 70, 580, 320)
$crop2 = $img.Clone($rect2, $img.PixelFormat)
$crop2.Save("C:\Users\jatin\Downloads\Game\public\crop-430-70-580-320.png", [System.Drawing.Imaging.ImageFormat]::Png)
$crop2.Dispose()

Write-Host "Crops saved"
$img.Dispose()

