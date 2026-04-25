const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('vrm')) {
  config.resolver.assetExts.push('vrm');
}

module.exports = config;
