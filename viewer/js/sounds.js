/**
 * FlipBook Viewer - Sound Effects
 * Page turn sound encoded as base64 for offline use
 * Uses Web Audio API for low-latency playback
 */

const FlipBookSounds = (() => {
    let audioContext = null;
    let pageFlipBuffer = null;
    let enabled = true;

    // Tiny page flip sound - synthesized
    function createPageFlipSound() {
        if (!audioContext) return;
        
        const sampleRate = audioContext.sampleRate;
        const duration = 0.35;
        const length = sampleRate * duration;
        const buffer = audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;
            const envelope = Math.exp(-t * 12) * 0.3;
            
            // Papery rustling sound - layered noise with filtering
            const noise = (Math.random() * 2 - 1);
            const crinkle = Math.sin(t * 800 + Math.sin(t * 200) * 3) * 0.5;
            const whoosh = Math.sin(t * 120) * Math.exp(-t * 8) * 0.6;
            
            // Combine for realistic page turn
            data[i] = (noise * 0.4 + crinkle * 0.3 + whoosh * 0.3) * envelope;
        }

        return buffer;
    }

    function init() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            pageFlipBuffer = createPageFlipSound();
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    }

    function play() {
        if (!enabled || !audioContext || !pageFlipBuffer) return;

        // Resume context if suspended (autoplay policy)
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        const source = audioContext.createBufferSource();
        source.buffer = pageFlipBuffer;

        // Add subtle variation each time
        source.playbackRate.value = 0.9 + Math.random() * 0.2;

        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.6;

        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        source.start(0);
    }

    function setEnabled(state) {
        enabled = state;
    }

    function isEnabled() {
        return enabled;
    }

    return { init, play, setEnabled, isEnabled };
})();
