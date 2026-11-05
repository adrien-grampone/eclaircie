import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent, type TextLayoutEvent } from "react-native";
import { splitMeasuredLines } from "@/lib/daily.ts";
import { sizes, type } from "@/theme/tokens.ts";

/** Lignes à côté de la lettrine. */
const BESIDE_LINES = 2;
/** Écart entre le glyphe de la lettrine et le texte ; largeur estimée du glyphe avant mesure. */
const CAP_GAP = 4;
const CAP_WIDTH_GUESS = Math.round(sizes.dropCap * 0.72);

/** Lignes mesurées, mémorisées par story et largeur : la mesure (onTextLayout) ne se fait qu'une fois. */
const measured = new Map<string, { text: string }[]>();

interface Props {
  text: string;
  accent: string;
  /** Identifiant stable du texte (id de la story), clé de la mémorisation. */
  cacheKey: string;
}

/**
 * Paragraphe à lettrine : le texte (sans sa première lettre) est mesuré une fois, invisible, dans la
 * largeur réduite (largeur − lettrine − écart). Les deux premières lignes mesurées vont à côté de la
 * lettrine, le reste en pleine largeur, avec le même interlignage : aucun trou entre les lignes 2 et 3.
 */
export function DropCapParagraph({ text, accent, cacheKey }: Props) {
  const trimmed = text.trim();
  const cap = trimmed.slice(0, 1);
  const body = trimmed.slice(1).trimStart();
  const [width, setWidth] = useState(0);
  const [capWidth, setCapWidth] = useState(CAP_WIDTH_GUESS);
  const [, bump] = useState(0);
  const key = `${cacheKey}:${width}:${capWidth}`;
  const lines = measured.get(key) ?? null;
  // La lettrine colle au texte : son conteneur fait la largeur de son glyphe plus CAP_GAP.
  const besideWidth = Math.max(0, width - capWidth - CAP_GAP);
  const onCapLayout = (e: TextLayoutEvent) => {
    const glyph = Math.ceil(e.nativeEvent.lines[0]?.width ?? CAP_WIDTH_GUESS);
    if (glyph > 0 && glyph !== capWidth) setCapWidth(glyph);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
  };
  const onTextLayout = (e: TextLayoutEvent) => {
    if (measured.has(key)) return;
    measured.set(key, e.nativeEvent.lines.map((l) => ({ text: l.text })));
    bump((n) => n + 1);
  };

  const split = lines ? splitMeasuredLines(lines, BESIDE_LINES) : null;
  return (
    <View onLayout={onLayout}>
      {width > 0 && !lines ? (
        <Text style={[type.body, styles.measure, { width: besideWidth }]} onTextLayout={onTextLayout}>{body}</Text>
      ) : null}
      <View style={styles.row}>
        <Text style={[styles.cap, { color: accent, width: capWidth + CAP_GAP }]} onTextLayout={onCapLayout}>{cap}</Text>
        <Text style={[type.body, { width: besideWidth }]}>{split ? split.beside : body}</Text>
      </View>
      {split?.rest ? <Text style={type.body}>{split.rest}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  measure: { position: "absolute", opacity: 0, top: 0, left: 0 },
  // La rangée fait exactement deux lignes de texte : la lettrine, plus haute, déborde sans décaler la suite.
  row: { flexDirection: "row", alignItems: "flex-start", height: BESIDE_LINES * type.body.lineHeight, overflow: "visible" },
  cap: { fontFamily: type.title.fontFamily, fontSize: sizes.dropCap, lineHeight: sizes.dropCap, textAlign: "left", marginTop: -6 },
});
