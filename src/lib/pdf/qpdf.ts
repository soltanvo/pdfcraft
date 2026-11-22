interface QpdfInstance {
  FS: {
    writeFile: (path: string, data: Uint8Array) => void;
    readFile: (path: string) => Uint8Array;
    unlink: (path: string) => void;
  };
  callMain: (args: string[]) => number;
}

declare global {
  interface Window {
    Module?: (args?: Record<string, unknown>) => Promise<QpdfInstance>;
  }
}

let scriptLoaded = false;

async function ensureQpdfScript(): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('QPDF WASM only runs in the browser');
  }
  if (scriptLoaded && typeof window.Module === 'function') return;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-qpdf="true"]');
    if (existing && typeof window.Module === 'function') {
      scriptLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = '/qpdf.js';
    script.async = true;
    script.dataset.qpdf = 'true';
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load QPDF WASM script'));
    document.head.appendChild(script);
  });
}

export async function runQpdf(
  inputBytes: Uint8Array,
  buildArgs: (inPath: string, outPath: string) => string[]
): Promise<Uint8Array> {
  await ensureQpdfScript();
  if (typeof window.Module !== 'function') {
    throw new Error('QPDF WASM factory not initialized');
  }

  const stderrLines: string[] = [];
  const qpdf = await window.Module({
    locateFile: (file: string) => (file.endsWith('.wasm') ? '/qpdf.wasm' : `/${file}`),
    noInitialRun: true,
    print: () => {},
    printErr: (line: string) => {
      if (line) stderrLines.push(line);
    },
  });

  const inPath = `/in_${Date.now()}.pdf`;
  const outPath = `/out_${Date.now()}.pdf`;
  qpdf.FS.writeFile(inPath, inputBytes);

  try {
    const args = buildArgs(inPath, outPath);
    const exitCode = qpdf.callMain(args);
    // Exit code 0 = success, 3 = success with warnings
    if (exitCode !== 0 && exitCode !== 3) {
      const msg = stderrLines.join(' ').trim() || `QPDF exited with code ${exitCode}`;
      throw new Error(msg);
    }
    const result = qpdf.FS.readFile(outPath);
    return new Uint8Array(result);
  } finally {
    try {
      qpdf.FS.unlink(inPath);
    } catch {}
    try {
      qpdf.FS.unlink(outPath);
    } catch {}
  }
}
