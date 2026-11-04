import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ARCHIVE_COPY, isRetracted } from "@/lib/archive.ts";
import { formatDayLabel } from "@/lib/daily.ts";
import { hapticTap } from "@/lib/haptics.ts";
import { colors, fonts, space, type } from "@/theme/tokens.ts";
import type { Story, Theme } from "@/types.ts";
import { Thumb } from "./Thumb.tsx";

interface Props {
  story: Story;
  theme: Theme;
  fallbackFiles: readonly string[];
  onPress: (story: Story) => void;
}

/** Ligne éditoriale : date, pastille du thème, titre en deux parties, vignette. Retirée : mention seule. */
export const StoryListItem = memo(function StoryListItem({ story, theme, fallbackFiles, onPress }: Props) {
  const retracted = isRetracted(story);
  return (
    <Pressable
      style={styles.row} disabled={retracted} onPressIn={hapticTap} onPress={() => onPress(story)}
      accessibilityRole="button" accessibilityLabel={retracted ? ARCHIVE_COPY.retracted : `${story.title_main} ${story.title_accent ?? ""}`}>
      <View style={styles.text}>
        <View style={styles.meta}>
          <Text style={type.caption}>{formatDayLabel(story.publish_date)}</Text>
          <View style={[styles.dot, { backgroundColor: theme.palette.accent }]} />
          <Text style={styles.themeLabel}>{theme.label}</Text>
        </View>
        {retracted
          ? <Text style={styles.retracted}>{ARCHIVE_COPY.retracted}</Text>
          : <Text style={styles.title}>
              <Text style={[type.title, styles.titleText]}>{story.title_main}</Text>
              {story.title_accent ? <Text style={[type.titleAccent, styles.titleText, { color: theme.palette.accent }]}>{` ${story.title_accent}`}</Text> : null}
            </Text>}
      </View>
      <Thumb story={story} palette={theme.palette} fallbackFiles={fallbackFiles} dimmed={retracted} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.m, paddingVertical: space.m, borderTopWidth: 1, borderColor: "rgba(31,27,22,0.12)" },
  text: { flex: 1, gap: space.xs },
  meta: { flexDirection: "row", alignItems: "center", gap: space.xs },
  dot: { width: 7, height: 7, borderRadius: 4, marginLeft: space.xs },
  themeLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.caption },
  title: { fontSize: 21, lineHeight: 24 },
  titleText: { color: colors.ink, fontSize: 21, lineHeight: 24 },
  retracted: { fontFamily: fonts.titleAccent, fontSize: 18, color: colors.caption },
});
