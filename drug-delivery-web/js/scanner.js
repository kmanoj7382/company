/**
 * High-Efficiency Barcode Scanner Engine for Anand Delivery Desk
 * Supports:
 * 1. Native BarcodeDetector API (Hardware accelerated 30-60 FPS, ML-based)
 * 2. Fallback Html5Qrcode with all 1D/2D formats enabled (Code 128, Code 39, EAN-13, etc.)
 * 3. USB / Handheld Laser/CCD Barcode Gun (Global keyboard wedge interceptor)
 * 4. Image Upload File Barcode Scanning (Multi-engine)
 * 5. Audio feedback (Web Audio API synthetic beep)
 * 6. Camera selection & Torch control
 */

export function playBeep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // Crisp A5 tone
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (err) {
    console.debug('Audio beep not available', err);
  }
}

// Global listener for USB / Bluetooth Handheld Barcode Scanners (Keyboard wedge)
export function initHardwareBarcodeListener(onScan) {
  let buffer = '';
  let lastTime = 0;
  const SCANNER_MAX_INTERVAL_MS = 50; // Barcode scanners send keys < 40ms apart
  const MIN_BARCODE_LENGTH = 3;

  window.addEventListener('keydown', (event) => {
    // If the user is currently typing in an input/textarea/select, let normal typing happen
    // UNLESS it's an Enter key preceded by ultra-fast typing
    const activeEl = document.activeElement;
    const isTextInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

    const now = Date.now();
    const interval = now - lastTime;
    lastTime = now;

    if (event.key === 'Enter') {
      if (buffer.length >= MIN_BARCODE_LENGTH && interval < SCANNER_MAX_INTERVAL_MS * 2.5) {
        event.preventDefault();
        const scannedCode = buffer.trim();
        buffer = '';
        playBeep();
        onScan(scannedCode, 'hardware_gun');
      } else {
        buffer = '';
      }
      return;
    }

    if (event.key.length === 1) {
      if (interval < SCANNER_MAX_INTERVAL_MS || buffer.length === 0) {
        buffer += event.key;
      } else {
        buffer = event.key; // Reset if typing speed is too slow (human typing)
      }
    }
  });
}

export class BarcodeScannerEngine {
  constructor() {
    this.mediaStream = null;
    this.animationId = null;
    this.barcodeDetector = null;
    this.html5Qrcode = null;
    this.activeEngine = 'none'; // 'native' | 'html5' | 'none'
    this.currentTrack = null;
    this.isScanning = false;
    this.lastScanTime = 0;
  }

  // Check if native BarcodeDetector is available
  hasNativeDetector() {
    return typeof window !== 'undefined' && 'BarcodeDetector' in window;
  }

  // List available video cameras
  async getCameras() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, index) => ({
          id: d.deviceId,
          label: d.label || `Camera ${index + 1}`,
        }));
    } catch {
      return [];
    }
  }

  // Start video scanning
  async start({
    nativeVideoEl,
    html5ContainerId,
    onSuccess,
    onStatusUpdate,
    deviceId = null,
  }) {
    await this.stop();
    this.isScanning = true;

    // Throttle duplicate scans within 1.5 seconds
    const handleSuccess = (code, meta = {}) => {
      const now = Date.now();
      if (now - this.lastScanTime < 1500) return;
      this.lastScanTime = now;
      playBeep();
      onSuccess(code, meta);
    };

    // Attempt Engine 1: Native BarcodeDetector (fastest, lowest CPU/battery, ML-backed)
    if (this.hasNativeDetector()) {
      try {
        const supportedFormats = await window.BarcodeDetector.getSupportedFormats();
        const formatsToUse = [
          'code_128',
          'code_39',
          'code_93',
          'codabar',
          'ean_13',
          'ean_8',
          'itf',
          'qr_code',
          'upc_a',
          'upc_e',
          'data_matrix',
        ].filter((f) => supportedFormats.includes(f));

        this.barcodeDetector = new window.BarcodeDetector({
          formats: formatsToUse.length ? formatsToUse : supportedFormats,
        });

        // Request camera with high quality and continuous autofocus
        const constraints = {
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 },
              },
        };

        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch {
          // Fallback to basic video constraint if overconstrained
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        this.mediaStream = stream;
        this.currentTrack = stream.getVideoTracks()[0];
        nativeVideoEl.srcObject = stream;
        nativeVideoEl.classList.remove('hidden');

        await new Promise((resolve) => {
          nativeVideoEl.onloadedmetadata = () => {
            nativeVideoEl.play().then(resolve).catch(resolve);
          };
        });

        this.activeEngine = 'native';
        onStatusUpdate({
          status: 'running',
          engine: 'Native BarcodeDetector (Hardware Accelerated)',
          canTorch: this.supportsTorch(),
        });

        // Scanning loop
        const detectFrame = async () => {
          if (!this.isScanning || this.activeEngine !== 'native') return;

          if (nativeVideoEl.readyState >= 2 && !nativeVideoEl.paused) {
            try {
              const barcodes = await this.barcodeDetector.detect(nativeVideoEl);
              if (barcodes && barcodes.length > 0) {
                const primary = barcodes[0];
                handleSuccess(primary.rawValue, {
                  format: primary.format,
                  engine: 'native',
                });
              }
            } catch (err) {
              // Frame dropped or decoding error, continue loop
            }
          }
          this.animationId = requestAnimationFrame(detectFrame);
        };

        this.animationId = requestAnimationFrame(detectFrame);
        return;
      } catch (err) {
        console.warn('Native BarcodeDetector failed, falling back to Html5Qrcode', err);
        await this.stop();
      }
    }

    // Engine 2: Html5Qrcode with all 1D & 2D formats enabled
    if (window.Html5Qrcode) {
      try {
        nativeVideoEl.classList.add('hidden');
        this.activeEngine = 'html5';

        // All 1D linear and 2D formats
        const formatsToSupport = [
          0, // QR_CODE
          1, // AZTEC
          2, // CODABAR
          3, // CODE_39
          4, // CODE_93
          5, // CODE_128
          6, // DATA_MATRIX
          7, // MAXICODE
          8, // ITF
          9, // EAN_13
          10, // EAN_8
          11, // PDF_417
          12, // RSS_14
          13, // RSS_EXPANDED
          14, // UPC_A
          15, // UPC_E
          16, // UPC_EAN_EXTENSION
        ];

        this.html5Qrcode = new window.Html5Qrcode(html5ContainerId, {
          formatsToSupport,
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        });

        const config = {
          fps: 20,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            // Wide box for 1D invoice barcodes
            const width = Math.floor(viewfinderWidth * 0.85);
            const height = Math.floor(viewfinderHeight * 0.45);
            return { width: Math.max(width, 260), height: Math.max(height, 120) };
          },
          aspectRatio: 1.6,
        };

        const cameraId = deviceId || { facingMode: 'environment' };

        await this.html5Qrcode.start(
          cameraId,
          config,
          (decodedText, decodedResult) => {
            handleSuccess(decodedText, {
              format: decodedResult?.result?.format?.formatName || 'Barcode',
              engine: 'html5qrcode',
            });
          },
          () => {}
        );

        onStatusUpdate({
          status: 'running',
          engine: 'Multi-Format 1D/2D Engine (Code 128 / Code 39 / EAN-13)',
          canTorch: false,
        });
        return;
      } catch (err) {
        console.warn('Html5Qrcode start failed', err);
        throw new Error(err.message || 'Camera permission denied or camera unavailable.');
      }
    }

    throw new Error('No barcode scanning engine available on this device.');
  }

  // Stop all camera streams and scanning loops
  async stop() {
    this.isScanning = false;

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.currentTrack) {
      try {
        this.currentTrack.stop();
      } catch {}
      this.currentTrack = null;
    }

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch {}
      this.mediaStream = null;
    }

    if (this.html5Qrcode) {
      try {
        await this.html5Qrcode.stop();
      } catch {}
      try {
        await this.html5Qrcode.clear();
      } catch {}
      this.html5Qrcode = null;
    }

    this.activeEngine = 'none';
  }

  // Check if camera supports flashlight/torch
  supportsTorch() {
    if (!this.currentTrack) return false;
    const capabilities = this.currentTrack.getCapabilities ? this.currentTrack.getCapabilities() : {};
    return Boolean(capabilities.torch);
  }

  // Toggle flashlight
  async toggleTorch(enabled) {
    if (!this.supportsTorch()) return false;
    try {
      await this.currentTrack.applyConstraints({
        advanced: [{ torch: enabled }],
      });
      return true;
    } catch {
      return false;
    }
  }

  // Scan from an uploaded image file
  async scanFile(file) {
    // Attempt 1: Native BarcodeDetector with ImageBitmap
    if (this.hasNativeDetector() && window.createImageBitmap) {
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const detector = new window.BarcodeDetector({ formats: supported });
        const bitmap = await createImageBitmap(file);
        const results = await detector.detect(bitmap);
        if (results && results.length > 0) {
          playBeep();
          return results[0].rawValue;
        }
      } catch (err) {
        console.warn('Native image detection failed, trying html5qrcode', err);
      }
    }

    // Attempt 2: Html5Qrcode
    if (window.Html5Qrcode) {
      const tempId = 'temp_html5_scanner';
      let tempDiv = document.getElementById(tempId);
      if (!tempDiv) {
        tempDiv = document.createElement('div');
        tempDiv.id = tempId;
        tempDiv.style.display = 'none';
        document.body.appendChild(tempDiv);
      }

      const scanner = new window.Html5Qrcode(tempId, {
        formatsToSupport: [0, 2, 3, 4, 5, 6, 8, 9, 10, 14, 15],
        verbose: false,
      });

      try {
        const result = await scanner.scanFile(file, true);
        playBeep();
        return result;
      } finally {
        try {
          await scanner.clear();
        } catch {}
        tempDiv.remove();
      }
    }

    throw new Error('Could not read barcode from image.');
  }
}

const CODE39_PATTERNS = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
  'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
  'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
  'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
  'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
  'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
  '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100',
  '$': '010101000', '/': '010100010', '+': '010001010', '%': '000101010',
};

export function generateBarcodeSvg(text, height = 46) {
  const upper = '*' + String(text || '').toUpperCase().replace(/[^*A-Z0-9\-.\s]/g, '') + '*';
  let x = 12;
  const narrow = 2;
  const wide = 5;
  let rects = '';

  for (let i = 0; i < upper.length; i++) {
    const ch = upper[i];
    const pattern = CODE39_PATTERNS[ch] || CODE39_PATTERNS['*'];
    for (let p = 0; p < 9; p++) {
      const isBar = p % 2 === 0;
      const w = pattern[p] === '1' ? wide : narrow;
      if (isBar) {
        rects += `<rect x="${x}" y="4" width="${w}" height="${height}" fill="#102a43"/>`;
      }
      x += w;
    }
    x += narrow;
  }

  const totalWidth = x + 12;
  const totalHeight = height + 24;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" class="barcode-svg" style="background:#fff;border-radius:6px;padding:4px;display:inline-block;max-width:100%;">
      ${rects}
      <text x="${totalWidth / 2}" y="${totalHeight - 5}" text-anchor="middle" font-family="'DM Mono', monospace" font-size="11" font-weight="700" fill="#102a43">${text}</text>
    </svg>
  `;
}

