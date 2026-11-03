import { useRef } from "react";
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, StyleSheet, Text, View } from "react-native";
import { hapticSelect } from "@/lib/haptics.ts";
import { colors, fonts } from "@/theme/tokens.ts";

/** Hauteur d'une ligne de la molette et nombre de lignes visibles (impair, la centrale est la valeur). */
export const WHEEL_ITEM = 56;
const VISIBLE = 3;

interface Props<T extends number> {
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
  format: (value: T) => string;
  width: number;
  label: string;
}

/**
 * Molette verticale sans dépendance : une ScrollView qui s'aimante ligne par ligne, la valeur est la
 * ligne au centre. Haptique de sélection à chaque changement.
 */
export function Wheel<T extends number>({ values, value, onChange, format, width, label }: Props<T>) {
  const current = useRef(value);
  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.min(values.length - 1, Math.max(0, Math.round(event.nativeEvent.contentOffset.y / WHEEL_ITEM)));
    const next = values[index];
    if (next !== undefined && next !== current.current) {
      current.current = next;
      hapticSelect();
      onChange(next);
    }
  };
  const padding = (WHEEL_ITEM * (VISIBLE - 1)) / 2;
  return (
    <View style={[styles.wheel, { width }]} accessibilityLabel={label} accessibilityValue={{ text: format(value) }}>
      <View style={styles.band} pointerEvents="none" />
      <ScrollView
        snapToInterval={WHEEL_ITEM} decelerationRate="fast" showsVerticalScrollIndicator={false}
        contentOffset={{ x: 0, y: Math.max(0, values.indexOf(value)) * WHEEL_ITEM }}
        contentContainerStyle={{ paddingVertical: padding }}
        onMomentumScrollEnd={settle} onScrollEndDrag={settle}>
        {values.map((v) => (
          <View key={v} style={styles.item}>
            <Text style={[styles.text, v === value ? styles.selected : null]}>{format(v)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wheel: { height: WHEEL_ITEM * VISIBLE },
  band: { position: "absolute", left: 0, right: 0, top: WHEEL_ITEM * ((VISIBLE - 1) / 2), height: WHEEL_ITEM, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(31,27,22,0.18)" },
  item: { height: WHEEL_ITEM, alignItems: "center", justifyContent: "center" },
  text: { fontFamily: fonts.title, fontSize: 34, color: colors.caption, opacity: 0.55 },
  selected: { color: colors.ink, opacity: 1 },
});
