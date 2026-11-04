import * as Notifications from "expo-notifications";

/**
 * Notification locale quotidienne (spec §9 : locales, pas de serveur de push). L'autorisation est
 * demandée à l'écran Heure du rendez-vous, jamais avant ; un refus ne bloque rien.
 */
export const DAILY_NOTIFICATION = {
  title: "Ta bonne nouvelle t'attend.",
  body: "Une minute pour toi, vérifiée et sourcée.",
  data: { screen: "arrival" },
} as const;

/** À appeler une fois au démarrage : une notification reçue app ouverte s'affiche en bannière, sans son. */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: () => Promise.resolve({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

/** Demande l'autorisation (iOS affiche la fenêtre système) ; true si accordée. */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
    return asked.granted;
  } catch (cause) {
    console.warn(`notifications : autorisation impossible (${cause instanceof Error ? cause.message : String(cause)})`);
    return false;
  }
}

/** Remplace toute programmation précédente par UNE notification quotidienne à l'heure choisie. */
export async function scheduleDailyNotification(hour: number, minute: number): Promise<boolean> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: { ...DAILY_NOTIFICATION, data: { ...DAILY_NOTIFICATION.data } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
    });
    return true;
  } catch (cause) {
    console.warn(`notifications : programmation impossible (${cause instanceof Error ? cause.message : String(cause)})`);
    return false;
  }
}

/** Vrai si l'app a été ouverte en touchant la notification du jour : on montre l'Arrivée. */
export function opensArrival(response: Notifications.NotificationResponse | null | undefined): boolean {
  return response?.notification.request.content.data?.screen === DAILY_NOTIFICATION.data.screen;
}

export const useLastNotificationResponse = Notifications.useLastNotificationResponse;

/** État actuel de l'autorisation, sans rien demander (Réglages). */
export async function notificationPermissionGranted(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}
