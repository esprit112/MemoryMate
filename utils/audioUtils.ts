// Utility to decode raw PCM audio data from Gemini TTS
export const decodeAudioData = async (
  base64Data: string,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> => {
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const dataInt16 = new Int16Array(bytes.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

let audioContext: AudioContext | null = null;

export const playAudio = async (base64Data: string): Promise<void> => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
    }

    // Ensure context is running (it might be suspended by default in some browsers)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    const audioBuffer = await decodeAudioData(base64Data, audioContext);
    
    return new Promise((resolve) => {
      const source = audioContext!.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext!.destination);
      source.onended = () => {
        source.disconnect();
        resolve();
      };
      source.start();
    });
  } catch (error) {
    console.error("Error playing audio:", error);
  }
};