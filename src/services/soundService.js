import { Vibration } from 'react-native';
import { createSound } from 'react-native-nitro-sound';

// Standard Telephone Ringback Tone (Classic double pulse "trrrrrr... trrrrrr..." ringing sound while calling)
const RINGBACK_TONE_URL = 'https://assets.mixkit.co/active_storage/sfx/2868/2868-preview.mp3';

// Standard Phone Ringtone (for Recipient User B alerting incoming phone call)
const INCOMING_RINGTONE_URL = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

// Short Call Ended / Busy Beep Tone
const CALL_ENDED_TONE_URL = 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3';

class SoundService {
  constructor() {
    this.soundInstance = null;
    this.isPlayingRingback = false;
    this.isPlayingRingtone = false;
    this.endListener = null;
  }

  getSoundInstance() {
    if (!this.soundInstance) {
      try {
        this.soundInstance = createSound();
      } catch (err) {
        console.log('SoundService: error initializing nitro-sound instance:', err);
      }
    }
    return this.soundInstance;
  }

  /**
   * Play Outgoing Ringback Tone continuously for Caller (User A)
   */
  async playOutgoingRingback() {
    try {
      this.stopAllRingtones();
      this.isPlayingRingback = true;

      const sound = this.getSoundInstance();
      if (!sound) return;

      console.log('🔊 [SoundService] Playing Outgoing Ringback Tone for caller...');

      // Add playback end listener to loop the ringback tone continuously
      sound.removePlaybackEndListener();
      sound.addPlaybackEndListener(async () => {
        if (this.isPlayingRingback) {
          console.log('🔊 [SoundService] Looping Ringback Tone...');
          try {
            await sound.startPlayer(RINGBACK_TONE_URL);
          } catch (e) {
            console.log('Error looping ringback tone:', e);
          }
        }
      });

      await sound.startPlayer(RINGBACK_TONE_URL);
    } catch (err) {
      console.log('SoundService: error starting outgoing ringback tone:', err);
    }
  }

  /**
   * Play Incoming Ringtone continuously with vibration for Recipient (User B)
   */
  async playIncomingRingtone() {
    try {
      this.stopAllRingtones();
      this.isPlayingRingtone = true;

      // Start continuous vibration pattern: [pause 0ms, vibrate 1000ms, pause 1500ms]
      Vibration.vibrate([0, 1000, 1500], true);

      const sound = this.getSoundInstance();
      if (!sound) return;

      console.log('🔔 [SoundService] Playing Incoming Ringtone & Vibration for recipient...');

      // Add playback end listener to loop the incoming ringtone continuously
      sound.removePlaybackEndListener();
      sound.addPlaybackEndListener(async () => {
        if (this.isPlayingRingtone) {
          console.log('🔔 [SoundService] Looping Incoming Ringtone...');
          try {
            await sound.startPlayer(INCOMING_RINGTONE_URL);
          } catch (e) {
            console.log('Error looping incoming ringtone:', e);
          }
        }
      });

      await sound.startPlayer(INCOMING_RINGTONE_URL);
    } catch (err) {
      console.log('SoundService: error starting incoming ringtone:', err);
    }
  }

  /**
   * Stop all active ringtones and cancel vibration immediately
   */
  async stopAllRingtones() {
    try {
      this.isPlayingRingback = false;
      this.isPlayingRingtone = false;

      // Cancel device vibration immediately
      Vibration.cancel();

      if (this.soundInstance) {
        try {
          this.soundInstance.removePlaybackEndListener();
          await this.soundInstance.stopPlayer();
          console.log('🛑 [SoundService] Stopped all active ringtones & vibration.');
        } catch (stopErr) {
          console.log('SoundService: error stopping player:', stopErr);
        }
      }
    } catch (err) {
      console.log('SoundService: error in stopAllRingtones:', err);
    }
  }

  /**
   * Play brief Call Ended / Busy Tone
   */
  async playCallEndedTone() {
    try {
      await this.stopAllRingtones();
      const sound = this.getSoundInstance();
      if (!sound) return;

      console.log('🔇 [SoundService] Playing Call Ended Tone...');
      sound.removePlaybackEndListener();
      await sound.startPlayer(CALL_ENDED_TONE_URL);
    } catch (err) {
      console.log('SoundService: error playing call ended tone:', err);
    }
  }
}

export const soundService = new SoundService();
export default soundService;
