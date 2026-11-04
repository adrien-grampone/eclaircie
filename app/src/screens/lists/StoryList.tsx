import { useRouter } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ARCHIVE_COPY, paginate } from "@/lib/archive.ts";
import { listFallbackFiles } from "@/lib/stories.ts";
import { space } from "@/theme/tokens.ts";
import type { Story, Theme } from "@/types.ts";
import { MoreButton, SectionTitle } from "@/ui/ListScreen.tsx";
import { StoryListItem } from "@/ui/StoryListItem.tsx";
import { demo as demoVar } from "@/lib/demo.ts";

/** Fichiers de secours par thème, listés une fois pour toute la liste (choix déterministe par story). */
export function useFallbackFiles(themeIds: readonly string[]): Record<string, string[]> {
  const [files, setFiles] = useState<Record<string, string[]>>({});
  const key = [...new Set(themeIds)].sort().join(",");
  useEffect(() => {
    const ids = key === "" ? [] : key.split(",");
    Promise.all(ids.map(async (id) => [id, await listFallbackFiles(id)] as const))
      .then((pairs) => setFiles(Object.fromEntries(pairs)))
      .catch(() => setFiles({}));
  }, [key]);
  return files;
}

interface Section {
  title: string;
  stories: readonly Story[];
  paginated?: boolean;
}

/**
 * Liste éditoriale par sections, pagination simple sur la section marquée, tap → écran Nouvelle.
 * Démonstration (simulateur sans tap) : EXPO_PUBLIC_DEMO_LIST=end fait défiler jusqu'au bas,
 * =open ouvre la première nouvelle de la dernière section par le même gestionnaire que le tap.
 */
export function StoryList({ sections, themes, header }: { sections: readonly Section[]; themes: readonly Theme[]; header?: ReactNode }) {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const files = useFallbackFiles(sections.flatMap((s) => s.stories.map((x) => x.theme_id)));
  const open = (story: Story) => router.push({ pathname: "/story/[id]", params: { id: story.id } });
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    const demo = demoVar("list");
    if (demo === "end") setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 1500);
    const last = sections.findLast((s) => s.stories.length > 0)?.stories[0];
    if (demo === "open" && last) setTimeout(() => open(last), 2500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <ScrollView ref={scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {header}
      {sections.map((section) => {
        if (section.stories.length === 0) return null;
        const { items, hasMore } = section.paginated ? paginate(section.stories, page) : { items: [...section.stories], hasMore: false };
        return (
          <View key={section.title}>
            <SectionTitle>{section.title}</SectionTitle>
            {items.map((story) => {
              const theme = themes.find((t) => t.id === story.theme_id);
              return theme ? <StoryListItem key={story.id} story={story} theme={theme} fallbackFiles={files[story.theme_id] ?? []} onPress={open} /> : null;
            })}
            {hasMore ? <MoreButton label={ARCHIVE_COPY.more} onPress={() => setPage((p) => p + 1)} /> : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.l, paddingBottom: space.xl },
});
