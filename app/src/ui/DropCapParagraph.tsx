import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent, type TextLayoutEvent } from "react-native";
import { splitMeasuredLines } from "@/lib/daily.ts";
import { sizes, space, type } from "@/theme/tokens.ts";

/** Lignes à côté de la lettrine. */
const BESIDE_LINES = 2;

/**
 * Paragraphe à lettrine : le texte (sans sa première lettre) est d'abord mesuré, invisible, dans la
 * largeur réduite (largeur − lettrine − écart). Les deux premières lignes mesurées vont à côté de la
 * lettrine, le reste en pleine largeur, avec le même interlignage : aucun trou entre les lignes 2 et 3.
 */
export function DropCapParagraph({ text, accent }: { text: string; accent: string }) {
  const trimmed = text.trim();
  const cap = trimmed.slice(0, 1);
  const body = trimmed.slice(1).trimStart();
  const [width, setWidth] = useState(0);
  const [lines, setLines] = useState<{ text: string }[] | null>(null);
  const besideWidth = Math.max(0, width - sizes.dropCap - space.s);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next !== width) { setWidth(next); setLines(null); }
  };
  const onTextLayout = (e: TextLayoutEvent) => setLines(e.nativeEvent.lines.map((l) => ({ text: l.text })));

  const split = lines ? splitMeasuredLines(lines, BESIDE_LINES) : null;
  return (
    <View onLayout={onLayout}>
      {width > 0 && !lines ? (
        <Text style={[type.body, styles.measure, { width: besideWidth }]} onTextLayout={onTextLayout}>{body}</Text>
      ) : null}
      <View style={styles.row}>
        <Text style={[styles.cap, { color: accent }]}>{cap}</Text>
        <Text style={[type.body, { width: besideWidth }]}>{split ? split.beside : body}</Text>
      </View>
      {split?.rest ? <Text style={type.body}>{split.rest}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  measure: { position: "absolute", opacity: 0, top: 0, left: 0 },
  // La rangée fait exactement deux lignes de texte : la lettrine, plus haute, déborde sans décaler la suite.
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.s, height: BESIDE_LINES * type.body.lineHeight, overflow: "visible" },
  cap: { fontFamily: type.title.fontFamily, fontSize: sizes.dropCap, lineHeight: sizes.dropCap, width: sizes.dropCap, textAlign: "center", marginTop: -6 },
});
