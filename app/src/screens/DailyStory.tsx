import { Image } from "expo-image";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDayLabel, formatSourceDate, readingMinutes, titleSize } from "@/lib/daily.ts";
import type { DailyView } from "@/lib/stories.ts";
import { colors, radius, sizes, space, type } from "@/theme/tokens.ts";
import { DropCapParagraph } from "@/ui/DropCapParagraph.tsx";
import { GlassButton, ThemePill } from "@/ui/Glass.tsx";
import { ArrowUpRightIcon, BookmarkIcon, MenuIcon, ShareIcon } from "@/ui/Icons.tsx";
import { PaperTexture } from "@/ui/PaperTexture.tsx";
import { Sky } from "@/ui/Sky.tsx";

/** Part de l'écran occupée par l'illustration avant que la feuille crème ne commence. */
const IMAGE_SHARE = 0.47;

export function DailyStoryScreen({ view }: { view: DailyView }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme, pick, image } = view;
  const accent = theme.palette.accent;
  const imageHeight = Math.round(height * IMAGE_SHARE) + radius.sheet;

  return (
    <View style={styles.screen}>
      <View style={[styles.illustration, { height: imageHeight }]}>
        {image ? <Image source={{ uri: image.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} /> : <Sky palette={theme.palette} />}
        <PaperTexture />
      </View>
      <View style={[styles.topBar, { top: insets.top + space.s }]}>
        <ThemePill label={theme.label} accent={accent} />
        <View style={styles.topActions}>
          <GlassButton label="Garder"><BookmarkIcon color={colors.ink} /></GlassButton>
          <GlassButton label="Menu"><MenuIcon color={colors.ink} /></GlassButton>
        </View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingTop: imageHeight - radius.sheet }} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={[styles.sheet, { minHeight: height - imageHeight + radius.sheet, paddingBottom: insets.bottom + space.l }]}>
          <PaperTexture />
          {pick.story ? <StoryBody story={pick.story} accent={accent} stale={pick.stale} /> : <EmptyBody themeLabel={theme.label} />}
        </View>
      </ScrollView>
    </View>
  );
}

function StoryBody({ story, accent, stale }: { story: NonNullable<DailyView["pick"]["story"]>; accent: string; stale: boolean }) {
  const title = titleSize(story.title_main, story.title_accent);
  const sourceDate = formatSourceDate(story.source_date);
  return (
    <>
      <View style={styles.metaRow}>
        <Text style={type.caption}>{formatDayLabel(story.publish_date)}{stale ? " · DERNIÈRE PARUE" : ""}</Text>
        <Text style={type.caption}>{readingMinutes(story.summary)} MIN</Text>
      </View>
      <Text style={[styles.title, title]}>
        <Text style={[type.title, title, { color: colors.ink }]}>{story.title_main}</Text>
        {story.title_accent ? <Text style={[type.titleAccent, title, { color: accent }]}>{` ${story.title_accent}`}</Text> : null}
      </Text>
      <DropCapParagraph text={story.summary} accent={accent} />
      <Text style={styles.source}>Source — {story.source_name}{sourceDate ? `, ${sourceDate}` : ""}</Text>
      <View style={styles.buttons}>
        <Pressable style={[styles.button, styles.buttonFilled]} accessibilityRole="button" onPress={() => undefined}>
          <ShareIcon color={colors.paper} />
          <Text style={[type.button, { color: colors.paper }]}>Partager</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.buttonOutline]} accessibilityRole="button" onPress={() => void Linking.openURL(story.source_url)}>
          <Text style={[type.button, { color: colors.ink }]}>Lire la source</Text>
          <ArrowUpRightIcon color={colors.ink} />
        </Pressable>
      </View>
      <Pressable onPress={() => undefined} accessibilityRole="link" style={styles.report}>
        <Text style={styles.reportText}>Signaler une erreur</Text>
      </Pressable>
    </>
  );
}

function EmptyBody({ themeLabel }: { themeLabel: string }) {
  return (
    <>
      <Text style={[type.title, titleSize("Pas encore de nouvelle", null), { color: colors.ink }]}>Pas encore de nouvelle</Text>
      <Text style={[type.body, { marginTop: space.m }]}>Aucune bonne nouvelle n'est encore publiée pour {themeLabel}. Reviens demain matin.</Text>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  illustration: { position: "absolute", left: 0, right: 0, top: 0, overflow: "hidden" },
  topBar: { position: "absolute", left: space.l, right: space.l, flexDirection: "row", justifyContent: "space-between", alignItems: "center", zIndex: 2 },
  topActions: { flexDirection: "row", gap: space.s },
  scroll: { flex: 1 },
  sheet: {
    backgroundColor: colors.paper, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.l, paddingTop: space.xl, overflow: "hidden",
    shadowColor: colors.ink, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 16,
  },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: space.m },
  title: { marginBottom: space.l },
  source: { ...type.source, marginTop: space.l },
  buttons: { flexDirection: "row", gap: space.s, marginTop: space.xl },
  button: { flex: 1, height: sizes.button, borderRadius: radius.button, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.s },
  buttonFilled: { backgroundColor: colors.ink },
  buttonOutline: { borderWidth: 1.5, borderColor: "rgba(31,27,22,0.25)" },
  report: { alignSelf: "center", marginTop: space.l, padding: space.xs },
  reportText: { fontFamily: type.body.fontFamily, fontSize: 14, color: colors.caption, textDecorationLine: "underline" },
});
