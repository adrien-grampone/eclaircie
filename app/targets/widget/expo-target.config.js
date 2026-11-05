/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
// Widget « Nouvelle du jour » (SwiftUI). Les fichiers de ce dossier forment la cible ; `assets/`
// (polices, grain papier, illustrations de secours) devient ses ressources.
module.exports = (config) => ({
  type: "widget",
  name: "EclaircieWidget",
  displayName: "Éclaircie",
  bundleIdentifier: ".widget",
  deploymentTarget: "17.0",
  frameworks: ["SwiftUI", "WidgetKit"],
  colors: {
    $accent: "#7A4E14",
    $widgetBackground: { color: "#F5EFE4", darkColor: "#1F1B16" },
  },
  entitlements: {
    "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
  },
});
