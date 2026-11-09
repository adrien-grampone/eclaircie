import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import type { Palette } from "@/theme/tokens.ts";
import { GouacheSky, type BannerFit } from "./GouacheSky.tsx";
import { FULL_SKY, Sky, type SkyLayout } from "./Sky.tsx";

/** Durée du fondu d'une palette à la suivante. */
const FADE_MS = 500;
/** Couches gardées sous la plus récente, pour qu'un enchaînement rapide ne découvre jamais le fond. */
const KEEP = 2;

/**
 * Ciel dont la palette change en douceur : chaque nouvelle palette se fond par-dessus la précédente
 * (animation d'entrée Reanimated), les anciennes couches sont retirées une fois recouvertes.
 */
/** `gouache` : ciel peint du splash au lieu du ciel vectoriel ; `banner` l'ajuste à un bandeau court. */
export function CrossfadeSky({ palette, layout = FULL_SKY, gouache = false, banner }: { palette: Palette; layout?: SkyLayout; gouache?: boolean; banner?: BannerFit }) {
  const [layers, setLayers] = useState([{ key: 0, palette }]);
  useEffect(() => {
    setLayers((previous) => {
      const last = previous[previous.length - 1];
      if (!last || last.palette === palette) return previous;
      return [...previous.slice(-KEEP), { key: last.key + 1, palette }];
    });
  }, [palette]);
  return (
    <View style={StyleSheet.absoluteFill}>
      {layers.map((layer, index) => (
        <Animated.View key={layer.key} style={StyleSheet.absoluteFill} {...(index === 0 ? {} : { entering: FadeIn.duration(FADE_MS) })}>
          {gouache ? <GouacheSky palette={layer.palette} {...(banner ? { banner } : {})} /> : <Sky palette={layer.palette} layout={layout} />}
        </Animated.View>
      ))}
    </View>
  );
}
