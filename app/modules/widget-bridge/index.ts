import { requireOptionalNativeModule } from "expo-modules-core";

interface WidgetBridgeModule {
  writePayload(key: string, json: string, appGroup: string): void;
  reload(kind: string): void;
  store(sourcePath: string, appGroup: string, maxSide: number): Promise<string>;
}

/** Absent dans Expo Go et sur Android : `null`, et la synchronisation du widget ne fait rien. */
export const WidgetBridge = requireOptionalNativeModule<WidgetBridgeModule>("WidgetBridge");
