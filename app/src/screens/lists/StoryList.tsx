import { useRouter } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ARCHIVE_COPY, paginate } from "@/lib/archive.ts";
import { listFallbackFiles } from "@/lib/stories.ts";
import { space } from "@/theme/tokens.ts";
import type { Story, Theme } from "@/types.ts";
import { MoreButton, SectionTitle } from "@/ui/ListScreen.tsx";
import { StoryListItem } from "@/ui/StoryListItem.tsx";

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

/** Liste éditoriale par sections, pagination simple sur la section marquée, tap → écran Nouvelle. */
export function StoryList({ sections, themes, header }: { sections: readonly Section[]; themes: readonly Theme[]; header?: ReactNode }) {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const files = useFallbackFiles(sections.flatMap((s) => s.stories.map((x) => x.theme_id)));
  const open = (story: Story) => router.push({ pathname: "/story/[id]", params: { id: story.id } });
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
