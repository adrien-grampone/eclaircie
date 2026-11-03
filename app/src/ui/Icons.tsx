import { SymbolView, type SFSymbol } from "expo-symbols";

/** Icônes SF Symbols (expo-symbols). */
function Icon({ name, color, size = 22 }: { name: SFSymbol; color: string; size?: number }) {
  return <SymbolView name={name} tintColor={color} size={size} weight="medium" resizeMode="scaleAspectFit" />;
}

export const BookmarkIcon = ({ color }: { color: string }) => <Icon name="bookmark" color={color} />;
export const MenuIcon = ({ color }: { color: string }) => <Icon name="line.3.horizontal" color={color} />;
export const ShareIcon = ({ color }: { color: string }) => <Icon name="square.and.arrow.up" color={color} size={20} />;
export const ArrowUpRightIcon = ({ color }: { color: string }) => <Icon name="arrow.up.right" color={color} size={18} />;
