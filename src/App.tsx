import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { toPng } from 'html-to-image';
import { 
  Download, 
  FileCode, 
  Layers, 
  Loader2, 
  Monitor, 
  Play, 
  PlayCircle, 
  RefreshCcw, 
  Settings, 
  Video 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Prism from 'prismjs';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup';
import { useEffect, useRef, useState } from 'react';
import Editor from 'react-simple-code-editor';
import { DEFAULT_HTML } from './constants';

export default function App() {
  const [code, setCode] = useState(DEFAULT_HTML);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exportSettings, setExportSettings] = useState({
    duration: 5,
    fps: 30,
    width: 1280,
    height: 720
  });

  const previewRef = useRef<HTMLIFrameElement>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  useEffect(() => {
    Prism.highlightAll();
  }, [code]);

  const loadFFmpeg = async () => {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    const ffmpeg = new FFmpeg();
    
    ffmpeg.on('log', ({ message }) => {
      setLogs(prev => [...prev.slice(-15), message]);
    });

    ffmpegRef.current = ffmpeg;
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    return ffmpeg;
  };

  const handleExport = async () => {
    if (!previewRef.current) return;
    
    if (!window.crossOriginIsolated) {
        console.warn('Cross-origin isolation is not enabled. FFmpeg wasm might fail.');
        setLogs(prev => [...prev, 'CRITICAL WARN: Cross-origin isolation not detected. Video encoding may stall.']);
        setLogs(prev => [...prev, 'TIP: Try opening the app in a new tab if export fails.']);
    }

    setIsExporting(true);
    setProgress(0);
    setError(null);
    setLogs(['Initializing render pipeline...']);

    try {
        const { duration, fps, width, height } = exportSettings;
        const totalFrames = duration * fps;
        const ffmpeg = ffmpegRef.current || (await loadFFmpeg());

        const previewDoc = previewRef.current.contentDocument || previewRef.current.contentWindow?.document;
        if (!previewDoc) {
          throw new Error('Could not access preview document');
        }

        // Capture frames
        setLogs(prev => [...prev, `Capturing ${totalFrames} frames...`]);
        
        // Inject seek helper to preview
        const style = previewDoc.createElement('style');
        style.id = 'seek-helper';
        previewDoc.head.appendChild(style);

        try {
            for (let i = 0; i < totalFrames; i++) {
                const currentTime = i / fps;
                
                // Seek CSS animations
                style.innerHTML = `
                    * {
                        animation-play-state: paused !important;
                        animation-delay: -${currentTime}s !important;
                        transition: none !important;
                    }
                `;

                // Wait a tiny bit for render
                await new Promise(r => setTimeout(r, 50));

                const dataUrl = await toPng(previewDoc.body, {
                    width,
                    height,
                    skipFonts: false
                });
                
                await ffmpeg.writeFile(`frame${i.toString().padStart(5, '0')}.png`, await fetchFile(dataUrl));
                
                if (i % fps === 0) {
                    setLogs(prev => [...prev.slice(-15), `Captured frame ${i}/${totalFrames}`]);
                }
                setProgress(Math.round(((i + 1) / totalFrames) * 80));
            }

            // Stitch frames with FFmpeg
            setLogs(prev => [...prev, 'Encoding video with H.264...']);
            setProgress(90);
            await ffmpeg.exec([
                '-framerate', `${fps}`,
                '-i', 'frame%05d.png',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-preset', 'ultrafast',
                'output.mp4'
            ]);

            const data = await ffmpeg.readFile('output.mp4');
            const url = URL.createObjectURL(new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' }));
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `flashvid_${Date.now()}.mp4`;
            a.click();

            setLogs(prev => [...prev, 'Export successful!']);

            // Clean up
            for (let i = 0; i < totalFrames; i++) {
                try {
                    await ffmpeg.deleteFile(`frame${i.toString().padStart(5, '0')}.png`);
                } catch (e) {}
            }
            try { await ffmpeg.deleteFile('output.mp4'); } catch(e) {}
        } finally {
            if (style.parentNode) {
                previewDoc.head.removeChild(style);
            }
        }
    } catch (err: any) {
        console.error('Export Error:', err);
        setError(err.message || 'Unknown error during export');
        setLogs(prev => [...prev, `ERROR: ${err.message}`]);
    } finally {
        setIsExporting(false);
        setProgress(100);
        
        // Refresh preview after export finishes to unpause animations
        const iframe = previewRef.current;
        if (iframe) {
            iframe.srcdoc = code;
        }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans antialiased overflow-hidden">
      {/* Header */}
      <nav className="h-14 border-b border-neutral-200 bg-white flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <Video className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold tracking-tight text-[#1a1a1a]">FlashVid Pro</span>
          <span className="text-[10px] font-bold text-neutral-400 border border-neutral-200 px-1.5 py-0.5 rounded ml-1">v.1.2.0</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-400 uppercase tracking-widest leading-none">
            <span>Engine:</span>
            <span className="flex items-center gap-1.5 text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Ready
            </span>
          </div>

          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 bg-black text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? 'Exporting...' : 'Export MP4'}
          </button>
        </div>
      </nav>

      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar Settings */}
        <aside className="w-72 border-r border-neutral-200 bg-white flex flex-col p-6 gap-8 shrink-0">
          <section>
            <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-4 border-b border-neutral-50 pb-2">Capture Settings</h3>
            <div className="space-y-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-tight">Duration (Seconds)</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" min="1" max="30" 
                    value={exportSettings.duration}
                    onChange={e => setExportSettings(s => ({ ...s, duration: Number(e.target.value) }))}
                    className="flex-1 accent-black h-1 bg-neutral-100 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs font-mono bg-neutral-50 border border-neutral-100 px-2 py-0.5 rounded text-neutral-600 min-w-[32px] text-center">{exportSettings.duration}s</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-tight">Resolution</label>
                <div className="relative">
                  <select 
                    className="w-full text-sm p-2 rounded-md border border-neutral-200 bg-neutral-50 appearance-none outline-none cursor-pointer hover:border-neutral-300 transition-colors pr-8"
                    value={`${exportSettings.width}x${exportSettings.height}`}
                    onChange={e => {
                        const [w, h] = e.target.value.split('x').map(Number);
                        setExportSettings(s => ({ ...s, width: w, height: h }));
                    }}
                  >
                        <option value="1920x1080">1080p (FHD) • 16:9</option>
                        <option value="1280x720">720p (HD) • 16:9</option>
                        <option value="1080x1080">Social • 1:1</option>
                        <option value="1080x1920">Mobile • 9:16</option>
                  </select>
                  <Settings className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-tight">Framerate</label>
                <select 
                    className="w-full text-sm p-2 rounded-md border border-neutral-200 bg-neutral-50 appearance-none outline-none cursor-pointer hover:border-neutral-300 transition-colors"
                    value={exportSettings.fps}
                    onChange={e => setExportSettings(s => ({ ...s, fps: Number(e.target.value) }))}
                >
                    <option value="15">15 FPS (Draft)</option>
                    <option value="24">24 FPS (Cinema)</option>
                    <option value="30">30 FPS (Default)</option>
                    <option value="60">60 FPS (Smooth)</option>
                </select>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-4 border-b border-neutral-50 pb-2">Technical Info</h3>
            <div className="p-3 rounded-lg border border-neutral-100 bg-neutral-50/50 space-y-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-neutral-400">Driver:</span>
                <span className="font-mono font-medium">ffmpeg-wasm</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-neutral-400">Codec:</span>
                <span className="font-mono font-medium">libx264</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-neutral-400">Render:</span>
                <span className="font-mono font-medium">deterministic</span>
              </div>
            </div>
          </section>

          <div className="mt-auto space-y-4">
             {isExporting && (
                <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                        <span>RENDERING</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <motion.div 
                            className="h-full bg-emerald-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
             )}
             
             <div 
               onClick={!isExporting ? handleExport : undefined}
               className={`p-4 rounded-xl flex items-center justify-center gap-3 group transition-all duration-300 ${isExporting ? 'bg-neutral-100 cursor-not-allowed opacity-50' : 'bg-neutral-900 cursor-pointer active:scale-[0.98]'}`}
             >
                <div className={`w-3 h-3 rounded-full ${isExporting ? 'bg-neutral-400 animate-pulse' : 'bg-red-500 group-hover:shadow-[0_0_12px_rgba(239,68,68,0.5)]'}`}></div>
                <span className="text-white font-bold text-sm tracking-wide uppercase">{isExporting ? 'Processing' : 'START RENDERING'}</span>
             </div>
          </div>
        </aside>

        {/* Content Area */}
        <section className="flex-1 flex flex-col p-8 gap-6 overflow-hidden">
            <div className="flex-1 flex gap-6 overflow-hidden">
                {/* Editor Panel */}
                <div className="w-1/2 flex flex-col bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                    <div className="h-10 bg-white border-b border-neutral-200 flex items-center px-4 justify-between shrink-0">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-neutral-400">
                        <FileCode className="w-3.5 h-3.5" />
                        index.html
                        </div>
                        <button 
                        onClick={() => setCode(DEFAULT_HTML)}
                        className="text-neutral-300 hover:text-neutral-900 transition-colors"
                        >
                        <RefreshCcw className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <Editor
                        value={code}
                        onValueChange={setCode}
                        highlight={code => Prism.highlight(code, Prism.languages.markup, 'markup')}
                        padding={24}
                        className="min-h-full font-mono leading-relaxed"
                        style={{
                            fontFamily: '"Geist Mono", "JetBrains Mono", monospace',
                        }}
                        />
                    </div>
                </div>

                {/* Preview Panel */}
                <div className="w-1/2 flex flex-col gap-6 overflow-hidden">
                    <div className="flex-1 bg-[#050505] rounded-2xl shadow-2xl relative overflow-hidden flex items-center justify-center border-[6px] border-white ring-1 ring-neutral-200">
                        <div 
                            className="bg-white relative overflow-hidden shrink-0" 
                            style={{ 
                                width: exportSettings.width, 
                                height: exportSettings.height,
                                transform: `scale(${Math.min(0.4, (window.innerWidth / 3) / exportSettings.width)})`
                            }}
                        >
                            <iframe
                                ref={previewRef}
                                title="Preview"
                                srcDoc={code}
                                className="w-full h-full border-none"
                                sandbox="allow-scripts allow-modals allow-popups allow-same-origin"
                            />
                        </div>
                        <div className="absolute top-4 left-4 flex gap-2">
                            <div className="px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[9px] text-white/80 font-bold uppercase tracking-wider">Preview</div>
                            <div className="px-2 py-1 bg-white/10 backdrop-blur-md rounded text-[9px] text-white/60 font-mono italic">{exportSettings.width}x{exportSettings.height}</div>
                        </div>
                    </div>

                    <div className="h-44 bg-neutral-900 rounded-xl border border-white/5 p-5 font-mono text-[11px] overflow-hidden leading-relaxed shadow-inner shrink-0 flex flex-col">
                        <div className="text-neutral-500 mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-neutral-700"></span>
                                System Terminal.log
                            </div>
                            {error && <span className="text-red-500 font-bold uppercase text-[9px] tracking-widest">Process Failed</span>}
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar space-y-1">
                            {logs.map((log, i) => (
                                <div key={i} className={`${log.startsWith('ERROR') ? 'text-red-400' : log.startsWith('WARN') ? 'text-amber-400' : 'text-neutral-400'}`}>
                                    {log}
                                </div>
                            ))}
                            {isExporting && (
                                <div className="space-y-1.5 pt-2">
                                    <div className="text-white font-bold flex items-center gap-2">
                                        <span className="animate-pulse text-emerald-500">●</span> 
                                        Processing: Frame {Math.floor((progress / 100) * (exportSettings.duration * exportSettings.fps))} / {exportSettings.duration * exportSettings.fps} ({progress}%)
                                    </div>
                                    <div className="w-full h-1 bg-neutral-800 mt-2 rounded-full overflow-hidden">
                                        <motion.div 
                                            className="h-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            style={{ backgroundColor: '#10b981' }}
                                        />
                                    </div>
                                </div>
                            )}
                            {!isExporting && logs.length === 0 && (
                                <div className="text-neutral-600 italic">Waiting for render trigger... System idle.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
      </main>

      <AnimatePresence>
        {isExporting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/60 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="max-w-md w-full bg-white border border-neutral-200 p-10 rounded-2xl shadow-2xl"
            >
                <div className="w-16 h-16 bg-neutral-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-neutral-100">
                    <Loader2 className="w-8 h-8 text-black animate-spin" />
                </div>
                <h2 className="text-xl font-bold text-[#1a1a1a] mb-2 tracking-tight">Exporting Production Video</h2>
                <p className="text-sm text-neutral-500 mb-8 leading-relaxed">
                    We're frame-stepping your code for perfect motion blur and zero stutter.
                </p>
                
                <div className="space-y-4">
                    <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                        <span>ENGINE STATUS</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="w-full h-1 bg-neutral-100 rounded-full overflow-hidden">
                        <motion.div 
                            className="h-full bg-black"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-[11px] font-medium text-neutral-400 pt-2 uppercase tracking-wide">
                        {progress < 80 ? 'Capturing Frames' : 
                         progress < 95 ? 'Assembling H.264 Stream' : 'Packaging Container'}
                    </p>
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
