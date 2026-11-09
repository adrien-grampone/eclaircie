import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFold } from "@/ui/fold/FoldProvider.tsx";
import { pageSheetStyle } from "@/ui/fold/pageSheet.ts";
import { hapticTap } from "@/lib/haptics.ts";
import { REPORT_COPY, REPORT_MESSAGE_MAX, REPORT_REASONS, buildReport, type ReportReason } from "@/lib/report.ts";
import { submitReport } from "@/lib/reports.ts";
import { absoluteFill, colors, fonts, radius, sizes, space, type } from "@/theme/tokens.ts";

interface Props {
  visible: boolean;
  userId: string;
  storyId: string;
  onClose: () => void;
}

/** Feuille « Signaler une erreur » : trois raisons rapides, champ libre facultatif, remerciement. */
export function ReportSheet({ visible, userId, storyId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const fold = useFold();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<{ status: "editing" | "sending" | "sent" | "failed"; error?: string }>({ status: "editing" });
  const validation = buildReport({ userId, storyId, reason, message });

  const close = () => {
    onClose();
    setReason(null);
    setMessage("");
    setState({ status: "editing" });
  };
  const send = async () => {
    if (!validation.ok) return;
    setState({ status: "sending" });
    const result = await submitReport(validation.row);
    if (result.ok) {
      hapticTap();
      setState({ status: "sent" });
    } else {
      setState({ status: "failed", error: result.message });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel={REPORT_COPY.close} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.avoid} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.m }, pageSheetStyle(fold, insets.right, space.l)]}>
          <View style={styles.handle} />
          {state.status === "sent" ? (
            <>
              <Text style={styles.title}>{REPORT_COPY.thanksTitle}</Text>
              <Text style={[type.body, styles.help]}>{REPORT_COPY.thanksBody}</Text>
              <Pressable style={styles.button} onPressIn={hapticTap} onPress={close} accessibilityRole="button">
                <Text style={[type.button, { color: colors.paper }]}>{REPORT_COPY.close}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>{REPORT_COPY.title}</Text>
              <Text style={[type.body, styles.help]}>{REPORT_COPY.help}</Text>
              <View style={styles.reasons}>
                {REPORT_REASONS.map((r) => {
                  const on = reason === r.id;
                  return (
                    <Pressable key={r.id} style={[styles.reason, on ? styles.reasonOn : null]} onPressIn={hapticTap}
                      onPress={() => setReason(on ? null : r.id)} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                      <Text style={[styles.reasonText, on ? styles.reasonTextOn : null]}>{r.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                style={styles.input} value={message} onChangeText={setMessage} placeholder={REPORT_COPY.placeholder} placeholderTextColor={colors.caption}
                multiline maxLength={REPORT_MESSAGE_MAX} textAlignVertical="top" accessibilityLabel={REPORT_COPY.placeholder} />
              {state.status === "failed" ? <Text style={styles.error}>{state.error}</Text> : null}
              <Pressable
                style={[styles.button, !validation.ok || state.status === "sending" ? styles.buttonDisabled : null]}
                disabled={!validation.ok || state.status === "sending"} onPressIn={hapticTap} onPress={() => void send()} accessibilityRole="button">
                <Text style={[type.button, { color: colors.paper }]}>{REPORT_COPY.send}</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...absoluteFill, backgroundColor: "rgba(31,27,22,0.35)" },
  avoid: { flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space.l, paddingTop: space.s },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "rgba(31,27,22,0.2)", marginBottom: space.m },
  title: { fontFamily: fonts.title, fontSize: 28, lineHeight: 32, color: colors.ink },
  help: { marginTop: space.xs, marginBottom: space.m },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: space.s, marginBottom: space.m },
  reason: { paddingHorizontal: space.m, height: 40, borderRadius: radius.pill, borderWidth: 1.5, borderColor: "rgba(31,27,22,0.25)", justifyContent: "center" },
  reasonOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  reasonText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  reasonTextOn: { color: colors.paper },
  input: { minHeight: 88, borderWidth: 1.5, borderColor: "rgba(31,27,22,0.18)", borderRadius: radius.button, padding: space.m, fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  error: { fontFamily: fonts.body, fontSize: 14, color: "#8A2E2E", marginTop: space.s },
  button: { height: sizes.button, borderRadius: radius.button, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", marginTop: space.m },
  buttonDisabled: { opacity: 0.35 },
});
