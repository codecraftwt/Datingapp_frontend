import Reactotron from 'reactotron-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let reactotron;

if (__DEV__) {
  reactotron = Reactotron
    .setAsyncStorageHandler(AsyncStorage)
    .configure({
      name: 'DatingFrontend',
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
}

export default reactotron;
