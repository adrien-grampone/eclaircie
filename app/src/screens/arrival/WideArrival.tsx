import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VEIL_INK } from "@/lib/arrivalBackdrop.ts";
import { darkGlassColor, mix } from "@/lib/color.ts";
import type { Span } from "@/lib/fold.ts";
import type { DailyView } from "@/lib/stories.ts";
import { colors, glass, radius, space } from "@/theme/tokens.ts";
import { PaperTexture } from "@/ui/PaperTexture.tsx";
import { Spread } from "@/ui/fold/Spread.tsx";
import { ARRIVAL_CARD_HEIGHT, ArrivalCardContent, ArrivalHeader } from "../Arrival.tsx";
import { Backdrop } from "../story/Backdrop.tsx";

/** Largeur maximale de la carte « Ta bonne nouvelle t'attend » sur la page droite. */
const CARD_MAX_WIDTH = 460;
/** Opacité du grain en lumière douce sur la page foncée. */
const DARK_GRAIN = 0.6;

/**
 * Arrivée du jour en double page (iPhone Duo déplié) : l'illustration en pleine couleur occupe la page
 * gauche (aucun texte dessus, donc aucun voile), la page droite, foncée et grainée, porte « Bonjour » et la carte. Pas de verre flou : un aplat du verre sombre, comme la
 * carte en mouvement de la transition. « Découvrir » mène à la Nouvelle en double page par un fondu.
 */
export function WideArrival({ layout, view, onDiscover }: { layout: { left: Span; gutter: Span; right: Span }; view: DailyView; onDiscover: () => void }) {
  const insets = useSafeAreaInsets();
  const accent = view.theme.palette.accent;
  const page = mix(accent, colors.ink, 0.55);
  const card = darkGlassColor(accent, colors.ink, VEIL_INK);
  return (
    <View style={[styles.screen, { backgroundColor: page }]}>
      <Spread
        layout={layout}
        gutterColor={page}
        left={<Backdrop view={view} />}
        right={
          <View style={[styles.right, { backgroundColor: page, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.l, paddingLeft: space.xl, paddingRight: insets.right + space.xl }]}>
            <ArrivalHeader today={view.today} />
            <View style={[styles.card, { backgroundColor: card }]}>
              <ArrivalCardContent view={view} onDiscover={onDiscover} grow />
            </View>
            {/* Grain papier visible sur la page foncée : enfant direct de la page qui porte la couleur, sinon la
                lumière douce se compose contre du vide et ne fait qu'éclaircir. */}
            <PaperTexture opacity={DARK_GRAIN} dark />
          </View>
        }
      />
      <PaperTexture />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  right: { flex: 1, justifyContent: "space-between" },
  // Hauteur minimale, pas fixe : sur une page étroite, le titre passe sur trois lignes sans rogner l'en-tête.
  card: { width: "100%", maxWidth: CARD_MAX_WIDTH, minHeight: ARRIVAL_CARD_HEIGHT, borderRadius: radius.sheet, borderWidth: 1, borderColor: glass.border, overflow: "hidden" },
});
