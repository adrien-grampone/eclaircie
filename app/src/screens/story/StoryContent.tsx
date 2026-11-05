import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { formatDayLabel, formatSourceDate, readingMinutes, sourceLabel, titleSize } from "@/lib/daily.ts";
import { hapticTap } from "@/lib/haptics.ts";
import { frenchTypography } from "@/lib/typography.ts";
import type { DailyView } from "@/lib/stories.ts";
import { colors, radius, sizes, space, type } from "@/theme/tokens.ts";
import { DropCapParagraph } from "@/ui/DropCapParagraph.tsx";
import { ArrowUpRightIcon, ShareIcon } from "@/ui/Icons.tsx";

type Story = NonNullable<DailyView["pick"]["story"]>;

/** Actions de la feuille ; absentes pendant la transition (contenu non interactif). */
export interface StoryActions {
  share: () => void;
  report: () => void;
}
const NO_ACTIONS: StoryActions = { share: () => undefined, report: () => undefined };

/** Contenu de la feuille crème : date, titre en deux parties, lettrine, source, actions. */
export function StoryBody({ story, accent, actions }: { story: Story; accent: string; actions: StoryActions }) {
  const title = titleSize(story.title_main, story.title_accent);
  const sourceDate = formatSourceDate(story.source_date);
  return (
    <>
      <View style={styles.metaRow}>
        <Text style={type.caption}>{formatDayLabel(story.publish_date)}</Text>
        <Text style={type.caption}>{readingMinutes(story.summary)} MIN</Text>
      </View>
      <Text style={[styles.title, title]}>
        <Text style={[type.title, title, { color: colors.ink }]}>{frenchTypography(story.title_main)}</Text>
        {story.title_accent ? <Text style={[type.titleAccent, title, { color: accent }]}>{` ${frenchTypography(story.title_accent)}`}</Text> : null}
      </Text>
      <DropCapParagraph text={frenchTypography(story.summary)} accent={accent} cacheKey={story.id} />
      <Text style={styles.source}>{frenchTypography(`Source — ${sourceLabel(story.source_name)}${sourceDate ? `, ${sourceDate}` : ""}`)}</Text>
      <View style={styles.buttons}>
        <Pressable style={[styles.button, styles.buttonFilled]} accessibilityRole="button" onPressIn={hapticTap} onPress={actions.share}>
          <ShareIcon color={colors.paper} />
          <Text style={[type.button, { color: colors.paper }]}>Partager</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.buttonOutline]} accessibilityRole="button" onPressIn={hapticTap} onPress={() => void Linking.openURL(story.source_url)}>
          <Text style={[type.button, { color: colors.ink }]}>Lire la source</Text>
          <ArrowUpRightIcon color={colors.ink} />
        </Pressable>
      </View>
      <Pressable onPressIn={hapticTap} onPress={actions.report} accessibilityRole="link" style={styles.report}>
        <Text style={styles.reportText}>Signaler une erreur</Text>
      </Pressable>
    </>
  );
}

/** Aucune nouvelle validée aujourd'hui sur les thèmes de l'utilisateur. */
export const EMPTY_COPY = {
  title: "Ta bonne nouvelle arrive bientôt.",
  body: (themeLabel: string) => `Celle de ${themeLabel} est encore en relecture. Reviens un peu plus tard dans la journée.`,
} as const;

export function EmptyBody({ themeLabel }: { themeLabel: string }) {
  return (
    <>
      <Text style={[type.title, titleSize(EMPTY_COPY.title, null), { color: colors.ink }]}>{EMPTY_COPY.title}</Text>
      <Text style={[type.body, { marginTop: space.m }]}>{EMPTY_COPY.body(themeLabel)}</Text>
    </>
  );
}

/** Corps de la feuille selon qu'une nouvelle existe ou non. */
export function SheetContent({ view, actions = NO_ACTIONS }: { view: DailyView; actions?: StoryActions }) {
  const { pick, theme } = view;
  return pick.story
    ? <StoryBody story={pick.story} accent={theme.palette.accent} actions={actions} />
    : <EmptyBody themeLabel={theme.label} />;
}

const styles = StyleSheet.create({
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
