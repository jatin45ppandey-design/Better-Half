Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\jatin\.gemini\antigravity\brain\f78e97f8-3b73-419e-a361-ab13c404552b\.user_uploaded\media_1793455285238_bf819b1d.jpg"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

# Let's inspect where floating items and couch are located:
# Left-most floating item: die around x=480..560, y=150..240
# Couch left arm: x ~ 420..480, y ~ 380..420? Wait, does the couch start around x=420?
# Top-most item: controller around y=100..180, heart around y=120..180
# Right-most item: tic tac toe tile around x=930..990, basketball around x=910..970
# Bottom edge: where does the couch end?

# Let's crop candidate 1: full couple + couch + floating elements
# x: 410, y: 80, width: 590 (to 1000), height: 320 (to 400)
$rect1 = New-Object System.Drawing.Rectangle(410, 80, 595, 310)
$crop1 = $img.Clone($rect1, $img.PixelFormat)
$crop1.Save("C:\Users\jatin\Downloads\Game\public\crop-test-1.png", [System.Drawing.Imaging.ImageFormat]::Png)
$crop1.Dispose()

# Let's crop candidate 2: slightly tighter x: 440, y: 85, width: 565, height: 305
$rect2 = New-Object System.Drawing.Rectangle(430, 85, 575, 305)
$crop2 = $img.Clone($rect2, $img.PixelFormat)
$crop2.Save("C:\Users\jatin\Downloads\Game\public\crop-test-2.png", [System.Drawing.Imaging.ImageFormat]::Png)
$crop2.Dispose()

$img.Dispose()
Write-Host "Crops saved successfully"

