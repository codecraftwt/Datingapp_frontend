import Reactotron from 'reactotron-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let reactotron;

if (__DEV__) {
  reactotron = Reactotron
    .setAsyncStorageHandler(AsyncStorage)
    .configure({
      name: 'DatingFrontend',
      host: 'localhost',
      port: 9090,
    })
    .useReactNative({
      asyncStorage: false,
      networking: {
        ignoreUrls: /symbolicate/,
      },
    })
    .connect();

  Reactotron.clear();

  console.tron = Reactotron;

  // Forward standard console.log / console.warn / console.error directly to Reactotron Timeline
  const originalLog = console.log;
  console.log = (...args) => {
    originalLog(...args);
    try {
      if (Reactotron) {
        if (typeof Reactotron.log === 'function') {
          Reactotron.log(...args);
        }
        if (typeof Reactotron.display === 'function') {
          const firstArg = args[0];
          const preview = typeof firstArg === 'string' ? firstArg.substring(0, 100) : 'Log';
          Reactotron.display({
            name: 'LOG',
            value: args.length === 1 ? args[0] : args,
            preview,
          });
        }
      }
    } catch (e) {}
  };

  const originalWarn = console.warn;
  console.warn = (...args) => {
    originalWarn(...args);
    try {
      if (Reactotron) {
        if (typeof Reactotron.logImportant === 'function') {
          Reactotron.logImportant(...args);
        }
        if (typeof Reactotron.display === 'function') {
          const firstArg = args[0];
          const preview = typeof firstArg === 'string' ? firstArg.substring(0, 100) : 'Warn';
          Reactotron.display({
            name: 'WARN',
            value: args.length === 1 ? args[0] : args,
            preview,
            important: true,
          });
        }
      }
    } catch (e) {}
  };

  const originalError = console.error;
  console.error = (...args) => {
    originalError(...args);
    try {
      if (Reactotron) {
        if (typeof Reactotron.error === 'function') {
          Reactotron.error(args[0], args.slice(1));
        } else if (typeof Reactotron.logImportant === 'function') {
          Reactotron.logImportant('❌ ERROR:', ...args);
        }
        if (typeof Reactotron.display === 'function') {
          const firstArg = args[0];
          const preview = typeof firstArg === 'string' ? firstArg.substring(0, 100) : 'Error';
          Reactotron.display({
            name: 'ERROR',
            value: args.length === 1 ? args[0] : args,
            preview,
            important: true,
          });
        }
      }
    } catch (e) {}
  };
}

export default reactotron;
