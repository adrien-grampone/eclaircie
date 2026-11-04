import { ScrollView, StyleSheet, Text } from "react-native";
import { METHOD_TEXT, SETTINGS_COPY } from "@/lib/settings.ts";
import { colors, space, type } from "@/theme/tokens.ts";
import { ListScreen } from "@/ui/ListScreen.tsx";

/** « Comment on choisit les nouvelles » : texte court et honnête sur le pipeline. */
export function MethodScreen() {
  return (
    <ListScreen title={SETTINGS_COPY.method}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {METHOD_TEXT.map((paragraph) => <Text key={paragraph.slice(0, 24)} style={[type.body, styles.paragraph]}>{paragraph}</Text>)}
      </ScrollView>
    </ListScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.l, paddingBottom: space.xl, paddingTop: space.s },
  paragraph: { color: colors.ink, marginBottom: space.m },
});
