let audio: AudioContext | undefined;
let source: AudioBufferSourceNode | undefined;
export async function setRainSound(enabled: boolean) {
  if (!enabled) { if (audio) await audio.suspend(); return; }
  audio ??= new AudioContext();
  if (!source) {
    const buffer = audio.createBuffer(1, audio.sampleRate * 4, audio.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) { last = (last + Math.random() * 0.1 - 0.05) / 1.02; data[i] = last * 3.5; }
    source = audio.createBufferSource(); source.buffer = buffer; source.loop = true;
    const filter = audio.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 900;
    const volume = audio.createGain(); volume.gain.value = 0.17;
    source.connect(filter); filter.connect(volume); volume.connect(audio.destination); source.start();
  }
  await audio.resume();
}
