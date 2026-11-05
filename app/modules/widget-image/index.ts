import { requireOptionalNativeModule } from "expo-modules-core";

interface WidgetImageModule {
  store(sourcePath: string, appGroup: string, maxSide: number): Promise<string>;
}

/** Absent dans Expo Go et sur Android : `null`, et la synchronisation du widget se contente du texte. */
export const WidgetImage = requireOptionalNativeModule<WidgetImageModule>("WidgetImage");
