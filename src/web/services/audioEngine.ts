export type SwitchProfileId = 'cream' | 'holypanda' | 'buckling' | 'boxnavy' | 'topre';

export interface SwitchProfileMeta {
  id: SwitchProfileId;
  name: string;
  type: string;
  description: string;
}

export const SWITCH_PROFILES: SwitchProfileMeta[] = [
  {
    id: 'cream',
    name: 'NovelKeys Cream',
    type: 'Linear',
    description: 'Smooth, deep creamy thock',
  },
  {
    id: 'holypanda',
    name: 'Holy Panda',
    type: 'Tactile',
    description: 'Crisp tactile bump with deep bottom-out',
  },
  {
    id: 'buckling',
    name: 'Buckling Spring',
    type: 'Vintage Clicky',
    description: 'Classic IBM Model M acoustic typewriter ping',
  },
  {
    id: 'boxnavy',
    name: 'Kailh Box Navy',
    type: 'Clickbar',
    description: 'Heavy, sharp and thick clickbar snap',
  },
  {
    id: 'topre',
    name: 'Topre',
    type: 'Capacitive',
    description: 'Subtle, cushioned electro-capacitive thud',
  },
];

// Map keyboard physical codes to keyboard rows (0 to 4)
const ROW_0_CODES = new Set([
  'Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
  'Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'
]);

const ROW_1_CODES = new Set([
  'Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'
]);

const ROW_2_CODES = new Set([
  'CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'
]);

const ROW_3_CODES = new Set([
  'ShiftLeft', 'ShiftRight', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'
]);

function getRowForCode(code: string): number {
  if (ROW_0_CODES.has(code)) return 0;
  if (ROW_1_CODES.has(code)) return 1;
  if (ROW_2_CODES.has(code)) return 2;
  if (ROW_3_CODES.has(code)) return 3;
  return 4; // Space bar row and bottom modifiers
}

class KeyAudioEngine {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private bufferCache: Map<string, AudioBuffer> = new Map();
  private loadingPromises: Map<string, Promise<AudioBuffer | null>> = new Map();
  private currentSwitch: SwitchProfileId = 'cream';
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  constructor() {
    // Read persisted switch profile & mute state
    if (typeof window !== 'undefined') {
      const savedSwitch = localStorage.getItem('pujangga_switch_profile') as SwitchProfileId | null;
      if (savedSwitch && SWITCH_PROFILES.some((p) => p.id === savedSwitch)) {
        this.currentSwitch = savedSwitch;
      }
      const savedMuted = localStorage.getItem('pujangga_audio_muted');
      if (savedMuted !== null) {
        this.isMuted = savedMuted === 'true';
      }
    }
  }

  private initContext() {
    if (this.ctx || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
      this.gainNode.connect(this.ctx.destination);
      this.isInitialized = true;
    } catch (err) {
      console.warn('[Pujangga Audio] Failed to initialize AudioContext:', err);
    }
  }

  public async preloadSwitch(switchId: SwitchProfileId): Promise<void> {
    const pressKeys = [
      'BACKSPACE.mp3',
      'ENTER.mp3',
      'GENERIC_R0.mp3',
      'GENERIC_R1.mp3',
      'GENERIC_R2.mp3',
      'GENERIC_R3.mp3',
      'GENERIC_R4.mp3',
      'SPACE.mp3',
    ];
    const releaseKeys = ['BACKSPACE.mp3', 'ENTER.mp3', 'GENERIC.mp3', 'SPACE.mp3'];

    const promises: Promise<any>[] = [];
    for (const f of pressKeys) {
      promises.push(this.loadBuffer(`/audio/switches/${switchId}/press/${f}`));
    }
    for (const f of releaseKeys) {
      promises.push(this.loadBuffer(`/audio/switches/${switchId}/release/${f}`));
    }
    await Promise.allSettled(promises);
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(url)) {
      return this.bufferCache.get(url)!;
    }
    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    const promise = (async () => {
      try {
        this.initContext();
        if (!this.ctx) return null;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        const decoded = await this.ctx.decodeAudioData(arrayBuffer);
        this.bufferCache.set(url, decoded);
        return decoded;
      } catch (err) {
        console.warn(`[Pujangga Audio] Error loading audio asset ${url}:`, err);
        return null;
      } finally {
        this.loadingPromises.delete(url);
      }
    })();

    this.loadingPromises.set(url, promise);
    return promise;
  }

  private playBuffer(buffer: AudioBuffer | null) {
    if (!buffer || !this.ctx || !this.gainNode) return;
    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.gainNode);
      source.start(0);
    } catch (err) {
      console.warn('[Pujangga Audio] Failed to play buffer:', err);
    }
  }

  public setSwitch(switchId: SwitchProfileId) {
    this.currentSwitch = switchId;
    if (typeof window !== 'undefined') {
      localStorage.setItem('pujangga_switch_profile', switchId);
    }
    this.preloadSwitch(switchId);
  }

  public getSwitch(): SwitchProfileId {
    return this.currentSwitch;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('pujangga_audio_muted', String(muted));
    }
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(muted ? 0 : 1, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    const nextState = !this.isMuted;
    this.setMuted(nextState);
    return nextState;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public playPress(code: string, forcePreview = false) {
    if (this.isMuted && !forcePreview) return;
    this.initContext();

    let filename = '';
    if (code === 'Space') {
      filename = 'SPACE.mp3';
    } else if (code === 'Enter' || code === 'NumpadEnter') {
      filename = 'ENTER.mp3';
    } else if (code === 'Backspace') {
      filename = 'BACKSPACE.mp3';
    } else {
      const row = getRowForCode(code);
      filename = `GENERIC_R${row}.mp3`;
    }

    const url = `/audio/switches/${this.currentSwitch}/press/${filename}`;
    const buffer = this.bufferCache.get(url);
    if (buffer) {
      this.playBuffer(buffer);
    } else {
      this.loadBuffer(url).then((b) => this.playBuffer(b));
    }
  }

  public playRelease(code: string, forcePreview = false) {
    if (this.isMuted && !forcePreview) return;
    this.initContext();

    let filename = '';
    if (code === 'Space') {
      filename = 'SPACE.mp3';
    } else if (code === 'Enter' || code === 'NumpadEnter') {
      filename = 'ENTER.mp3';
    } else if (code === 'Backspace') {
      filename = 'BACKSPACE.mp3';
    } else {
      filename = 'GENERIC.mp3';
    }

    const url = `/audio/switches/${this.currentSwitch}/release/${filename}`;
    const buffer = this.bufferCache.get(url);
    if (buffer) {
      this.playBuffer(buffer);
    } else {
      this.loadBuffer(url).then((b) => this.playBuffer(b));
    }
  }
}

export const audioEngine = new KeyAudioEngine();
