import AsyncStorage from "@react-native-async-storage/async-storage";
import { ARRIVAL_HINT_KEY, ARRIVAL_SEEN_KEY } from "./arrival.ts";

async function read(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Sans stockage, l'arrivée (ou le rebond) se réaffichera : préférable à un écran manquant.
  }
}

export const readArrivalSeen = (): Promise<string | null> => read(ARRIVAL_SEEN_KEY);
export const writeArrivalSeen = (today: string): Promise<void> => write(ARRIVAL_SEEN_KEY, today);
export const readHintShown = async (): Promise<boolean> => (await read(ARRIVAL_HINT_KEY)) === "1";
export const writeHintShown = (): Promise<void> => write(ARRIVAL_HINT_KEY, "1");
