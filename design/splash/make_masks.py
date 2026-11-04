"""
Masques et cartes de valeur des collines du splash (app/assets/splash/), avec ImageMagick.
Lancer depuis la racine : python3 design/splash/make_masks.py
Affiche, pour chaque plan, la hauteur de la crête au centre (part du masque) à reporter dans HILL_PLANES.
"""
import math, subprocess, pathlib

OUT = pathlib.Path("app/assets/splash")
W, H = 1536, 768

# Trois plans : (bosse centrée en x, largeur de la bosse, amplitude, base, ondulation, fréquences, phase)
PLANES = [
    dict(name=1, peak=0.22, width=0.26, amp=0.32, base=0.62, ripple=0.022, f=(2.3, 5.1), phase=0.4),   # arrière : monte depuis la gauche
    dict(name=2, peak=0.80, width=0.24, amp=0.28, base=0.66, ripple=0.026, f=(1.7, 4.3), phase=2.1),   # médian : monte depuis la droite
    dict(name=3, peak=0.50, width=0.60, amp=0.12, base=0.72, ripple=0.030, f=(2.9, 6.2), phase=1.1),   # avant : plus bas, plus large
]

def profile(p, u):
    bump = p["amp"] * math.exp(-((u - p["peak"]) / p["width"]) ** 2)
    ripple = p["ripple"] * (0.6 * math.sin(2 * math.pi * p["f"][0] * u + p["phase"]) + 0.4 * math.sin(2 * math.pi * p["f"][1] * u + p["phase"] * 1.7 + p["name"]))
    return p["base"] - bump - ripple

def run(*args):
    subprocess.run(["magick", *args], check=True)

for p in PLANES:
    pts = [(x, profile(p, x / W) * H) for x in range(0, W + 1, 8)]
    poly = " ".join(f"{x},{y:.1f}" for x, y in pts) + f" {W},{H} 0,{H}"
    mask = OUT / f"hill-{p['name']}.png"
    run("-size", f"{W}x{H}", "xc:none", "-fill", "white", "-draw", f"polygon {poly}", "-resize", "50%", f"PNG32:{mask}")
    # Carte de valeur : taches larges (bruit minuscule agrandi, étiré en largeur) autour du gris neutre ± 5 %,
    # crête assombrie (bande sous le bord, floutée), même alpha que le masque.
    t = pathlib.Path("/tmp/eclaircie-splash"); t.mkdir(exist_ok=True)
    run("-size", "28x7", "xc:gray", "-seed", str(p["name"] * 11), "+noise", "Random", "-colorspace", "gray", "-resize", "768x384!", "-blur", "0x6", "-auto-level", "-evaluate", "multiply", "0.10", "-evaluate", "add", "45%", str(t / "blobs.png"))
    run(str(mask), "-alpha", "extract", str(t / "alpha.png"))
    run(str(t / "alpha.png"), "-morphology", "Erode", "Disk:9", str(t / "eroded.png"))
    run(str(t / "alpha.png"), str(t / "eroded.png"), "-compose", "Minus_Src", "-composite", "-blur", "0x3", str(t / "band.png"))
    run(str(t / "blobs.png"), "(", str(t / "band.png"), "-evaluate", "multiply", "0.09", ")", "-compose", "Minus_Src", "-composite", str(t / "gray.png"))
    run(str(t / "gray.png"), str(t / "alpha.png"), "-alpha", "off", "-compose", "CopyOpacity", "-composite", f"PNG32:{OUT / f'hill-{p['name']}-value.png'}")
    centre = profile(p, 0.5)
    print(f"hill-{p['name']}: crête au centre = {centre:.3f} (part du masque depuis le haut), sommet = {min(y for _, y in pts) / H:.3f}")
