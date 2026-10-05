import assert from 'node:assert';
import { audioEngine, SWITCH_PROFILES, SwitchProfileId } from '../src/web/services/audioEngine.js';

console.log('--- 1. Testing Switch Profiles Metadata ---');
assert.strictEqual(SWITCH_PROFILES.length, 5, 'Must contain 5 curated switch profiles');
const expectedIds: SwitchProfileId[] = ['cream', 'holypanda', 'buckling', 'boxnavy', 'topre'];
expectedIds.forEach((id) => {
  const profile = SWITCH_PROFILES.find((p) => p.id === id);
  assert.ok(profile, `Profile ${id} must exist in SWITCH_PROFILES`);
  assert.ok(profile.name.length > 0, `Profile ${id} must have a name`);
  assert.ok(profile.description.length > 0, `Profile ${id} must have a description`);
});
console.log('✓ All 5 curated switch profiles exist with valid metadata');

console.log('--- 2. Testing Audio Mute State Machine ---');
audioEngine.setMuted(false);
assert.strictEqual(audioEngine.getIsMuted(), false, 'Mute should be false');

const muted = audioEngine.toggleMute();
assert.strictEqual(muted, true, 'toggleMute should toggle false -> true');
assert.strictEqual(audioEngine.getIsMuted(), true, 'getIsMuted should return true');

const unmuted = audioEngine.toggleMute();
assert.strictEqual(unmuted, false, 'toggleMute should toggle true -> false');
assert.strictEqual(audioEngine.getIsMuted(), false, 'getIsMuted should return false');
console.log('✓ Audio mute toggle and state machine work deterministically');

console.log('--- 3. Testing Switch Selection & Persistence ---');
audioEngine.setSwitch('boxnavy');
assert.strictEqual(audioEngine.getSwitch(), 'boxnavy', 'Active switch should be boxnavy');

audioEngine.setSwitch('holypanda');
assert.strictEqual(audioEngine.getSwitch(), 'holypanda', 'Active switch should be holypanda');
console.log('✓ Switch selection works cleanly');

console.log('=== All KeyAudioEngine Tests Passed! ===');
