/**
 * FlipBook Viewer - Sound Effects
 * Page turn sound encoded as base64 for offline use
 * Uses Web Audio API for low-latency playback
 */

const FlipBookSounds = (() => {
    let audioContext = null;
    let pageFlipBuffer = null;
    let enabled = true;

    // High-quality procedural synthesis of a page turn
    // This creates a more "organic" and premium sound than simple white noise
    function play() {
        if (!enabled || !audioContext) return;

        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        const now = audioContext.currentTime;
        const duration = 0.4 + Math.random() * 0.1;

        // 1. The "Initial Flick" (High frequency snap)
        const flick = audioContext.createBufferSource();
        const flickBuffer = createNoiseBuffer(0.05, true); // short high-passed noise
        flick.buffer = flickBuffer;
        const flickGain = audioContext.createGain();
        flickGain.gain.setValueAtTime(0, now);
        flickGain.gain.linearRampToValueAtTime(0.15, now + 0.01);
        flickGain.gain.linearRampToValueAtTime(0, now + 0.05);
        flick.connect(flickGain);
        flickGain.connect(audioContext.destination);

        // 2. The "Body Move" (Resonant noise sweep)
        const moveSource = audioContext.createBufferSource();
        moveSource.buffer = createNoiseBuffer(duration, false); // pink-ish noise
        
        const moveFilter = audioContext.createBiquadFilter();
        moveFilter.type = 'bandpass';
        moveFilter.Q.value = 3.0;
        moveFilter.frequency.setValueAtTime(2500, now);
        moveFilter.frequency.exponentialRampToValueAtTime(800, now + duration);

        const moveGain = audioContext.createGain();
        moveGain.gain.setValueAtTime(0, now);
        moveGain.gain.linearRampToValueAtTime(0.4, now + 0.05);
        moveGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        moveSource.connect(moveFilter);
        moveFilter.connect(moveGain);
        moveGain.connect(audioContext.destination);

        // 3. The "Landing Thump" (Low frequency air)
        const thumpSource = audioContext.createBufferSource();
        thumpSource.buffer = createNoiseBuffer(0.1, false);
        const thumpFilter = audioContext.createBiquadFilter();
        thumpFilter.type = 'lowpass';
        thumpFilter.frequency.value = 150;
        const thumpGain = audioContext.createGain();
        thumpGain.gain.setValueAtTime(0, now + duration - 0.1);
        thumpGain.gain.linearRampToValueAtTime(0.3, now + duration - 0.05);
        thumpGain.gain.linearRampToValueAtTime(0, now + duration);

        thumpSource.connect(thumpFilter);
        thumpFilter.connect(thumpGain);
        thumpGain.connect(audioContext.destination);

        // Start all
        flick.start(now);
        moveSource.start(now);
        thumpSource.start(now + 0.05);
    }

    // Helper to generate noise buffers
    function createNoiseBuffer(duration, highPass = false) {
        const sampleRate = audioContext.sampleRate;
        const length = sampleRate * duration;
        const buffer = audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        
        let lastOut = 0;
        for (let i = 0; i < length; i++) {
            // White noise
            let white = Math.random() * 2 - 1;
            
            // Apply a very simple pink filter (3dB/octave-ish)
            // This makes the noise sound "softer" and more natural
            let pink = (white + (lastOut * 0.7)) / 1.7;
            lastOut = pink;
            
            data[i] = pink;
        }
        return buffer;
    }

    function init() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    }

    function setEnabled(state) {
        enabled = state;
    }

    function isEnabled() {
        return enabled;
    }

    return { init, play, setEnabled, isEnabled };
})();
