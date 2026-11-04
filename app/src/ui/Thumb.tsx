import { Image } from "expo-image";
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { storyImageUrl } from "@/lib/illustration.ts";
import { colors, type Palette } from "@/theme/tokens.ts";
import { Sky, type SkyLayout } from "./Sky.tsx";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
/** Vignette 3:4 des listes (Archives, Gardées). */
export const THUMB = { width: 66, height: 88, radius: 12 } as const;
const THUMB_SKY: SkyLayout = { sun: { top: "22%", right: "18%", size: 22 }, hills: [34, 24, 14] };

interface Props {
  story: { id: string; theme_id: string; image_path: string | null };
  palette: Palette;
  /** Fichiers de secours du thème, déjà listés (choix déterministe par story). */
  fallbackFiles: readonly string[];
  dimmed?: boolean;
}

/** Illustration de la story, sinon image de secours du thème, sinon ciel dessiné en miniature. */
export const Thumb = memo(function Thumb({ story, palette, fallbackFiles, dimmed = false }: Props) {
  const image = storyImageUrl(SUPABASE_URL, story, fallbackFiles);
  return (
    <View style={[styles.thumb, dimmed ? styles.dimmed : null]}>
      {image ? <Image source={{ uri: image.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : <Sky palette={palette} layout={THUMB_SKY} />}
    </View>
  );
});

const styles = StyleSheet.create({
  thumb: { width: THUMB.width, height: THUMB.height, borderRadius: THUMB.radius, overflow: "hidden", backgroundColor: colors.paper },
  dimmed: { opacity: 0.35 },
});
