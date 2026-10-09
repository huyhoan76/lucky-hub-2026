
/**
 * Service for managing configuration shared with the Magic Mirror.
 */
export const configService = {
  /**
   * Gets the configuration for the Magic Mirror.
   * @returns Non-secret audio settings for the Magic Mirror.
   */
  getMirrorConfig: async (): Promise<{ ttsModel: string; voiceName: string }> => {
    return {
      ttsModel: 'gemini-3.1-flash-tts-preview',
      voiceName: 'Kore'
    };
  }
};
