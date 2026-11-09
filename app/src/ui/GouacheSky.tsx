import { LinearGradient } from "expo-linear-gradient";
import { memo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { HALO, HILL_PLANES, SPLASH_GRAIN, sunLayout, themeStage } from "@/lib/splash.ts";
import type { Palette } from "@/theme/tokens.ts";
import { PaperTexture } from "./PaperTexture.tsx";

const HALO_IMAGE = require("../../assets/splash/halo.png");
const HILL_IMAGES = [require("../../assets/splash/hill-1.png"), require("../../assets/splash/hill-2.png"), require("../../assets/splash/hill-3.png")];
const HILL_VALUES = [require("../../assets/splash/hill-1-value.png"), require("../../assets/splash/hill-2-value.png"), require("../../assets/splash/hill-3-value.png")];
const SUN_VALUE = require("../../assets/splash/sun-value.png");

/**
 * Ciel peint à la gouache, figé : la dernière image du splash (dégradé du thème, halo, soleil et sa
 * carte de valeur, trois plans de collines aux bords irréguliers teintés de la palette, grain papier).
 * Mêmes assets que le splash, à la taille de son cadre (mesurée).
 */
/**
 * Bandeau (onboarding en page unique) : les collines sont mises à l'échelle pour que leur plus haut sommet
 * reste à `hillsTop` (juste sous le titre), et le soleil se lève à droite derrière la crête réelle.
 */
export interface BannerFit {
  hillsTop: number;
}

/**
 * Hauteur des crêtes des masques (part de la hauteur de chaque masque), mesurée sur assets/splash/hill-*.png :
 * sommet le plus haut sur toute la largeur, et crête à 85 % de la largeur (là où se lève le soleil du bandeau).
 * À remesurer si design/splash/make_masks.py régénère les masques.
 */
const MASK_PEAK = [0.65, 0.59, 0.41] as const;
const MASK_AT_SUN = [0.38, 0.59, 0.35] as const;
const BANNER_SUN_X = 0.85;
const BANNER_SUN_SIZE = 0.25;
/** Part du disque au-dessus de la crête, comme le soleil du splash. */
const BANNER_SUN_ABOVE = 0.65;

export const GouacheSky = memo(function GouacheSky({ palette, banner }: { palette: Palette; banner?: BannerFit }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const stage = themeStage(palette);
  const hills = [palette.hill_light, palette.hill_mid, palette.accent];
  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
      <LinearGradient colors={[stage.top, stage.horizon]} style={StyleSheet.absoluteFill} />
      {size ? <Scene palette={palette} hills={hills} width={size.width} height={size.height} banner={banner} /> : null}
      <PaperTexture opacity={SPLASH_GRAIN} />
    </View>
  );
});

function Scene({ palette, hills, width, height, banner }: { palette: Palette; hills: string[]; width: number; height: number; banner?: BannerFit | undefined }) {
  let scale = 1;
  let sun = sunLayout(width, height);
  if (banner) {
    const peak = Math.max(...HILL_PLANES.map((p, i) => p.heightShare * (MASK_PEAK[i] ?? 0)));
    scale = Math.max(0, height - banner.hillsTop) / (height * peak);
    const crestAtSun = height - height * scale * Math.max(...HILL_PLANES.map((p, i) => p.heightShare * (MASK_AT_SUN[i] ?? 0)));
    const size = width * BANNER_SUN_SIZE;
    sun = { ...sun, size, cx: width * BANNER_SUN_X, cy: crestAtSun - size * (BANNER_SUN_ABOVE - 0.5) };
  }
  const haloSize = sun.size * HALO.size;
  return (
    <>
      <Image source={HALO_IMAGE} style={[styles.abs, { width: haloSize, height: haloSize, left: sun.cx - haloSize / 2, top: sun.cy - haloSize / 2, tintColor: palette.sun, opacity: HALO.opacity }]} />
      <View style={[styles.sun, { width: sun.size, height: sun.size, borderRadius: sun.size / 2, left: sun.cx - sun.size / 2, top: sun.cy - sun.size / 2, backgroundColor: palette.sun }]}>
        <Image source={SUN_VALUE} resizeMode="stretch" style={[StyleSheet.absoluteFill, styles.value]} />
      </View>
      {HILL_PLANES.map((plane, i) => (
        <View key={i} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image source={HILL_IMAGES[i]} resizeMode="stretch" style={[styles.hill, { width, height: height * plane.heightShare * scale, tintColor: hills[i] }]} />
          <Image source={HILL_VALUES[i]} resizeMode="stretch" style={[styles.hill, styles.value, { width, height: height * plane.heightShare * scale }]} />
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  sun: { position: "absolute", overflow: "hidden" },
  value: { mixBlendMode: "soft-light" },
  hill: { position: "absolute", left: 0, bottom: 0 },
});
