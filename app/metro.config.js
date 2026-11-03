// Le module pur du pipeline (rotation, image de secours) est importé depuis la racine du dépôt.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");
const config = getDefaultConfig(projectRoot);
config.watchFolders = [path.join(repoRoot, "supabase", "functions", "_shared", "pipeline")];
config.resolver.nodeModulesPaths = [path.join(projectRoot, "node_modules")];
module.exports = config;
