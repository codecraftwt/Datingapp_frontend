const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  projectRoot: path.resolve(__dirname),
  watchFolders: [path.resolve(__dirname)],
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      // Force react-native-webrtc to resolve its own event-target-shim dependency (v6+)
      if (
        moduleName.startsWith('event-target-shim') &&
        context.originModulePath.includes('react-native-webrtc')
      ) {
        try {
          const shimPath = require.resolve(moduleName, {
            paths: [path.resolve(__dirname, 'node_modules/react-native-webrtc')],
          });
          return {
            filePath: shimPath,
            type: 'sourceFile',
          };
        } catch (err) {
          console.log('Failed to resolve event-target-shim:', err);
        }
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
