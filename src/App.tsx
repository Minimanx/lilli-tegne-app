import { useEffect, useMemo, useRef, useState } from "react";
import DrawingCanvas, {
  type DrawingCanvasHandle,
  type DrawingTool,
} from "./components/DrawingCanvas";
import type { LucideIcon } from "lucide-react";
import {
  PenLine,
  Eraser,
  Slash,
  Square,
  Circle,
  PaintBucket,
  Undo2,
  Trash2,
  Save,
  Brush,
  Palette,
  Image as ImageIcon,
  Sparkles,
  PanelRightOpen,
  PanelRightClose,
} from "lucide-react";

type SavedDrawing = {
  id: string;
  dataURL: string;
  createdAt: number;
};

const STORAGE_KEY = "lilli-tegne-app.savedDrawings";
const STATE_STORAGE_KEY = "lilli-tegne-app.liveState";

const toolDefinitions: Array<{
  id: DrawingTool;
  label: string;
  description: string;
  Icon: LucideIcon;
}> = [
  {
    id: "pencil",
    label: "Blyant",
    description: "Frihåndstegning",
    Icon: PenLine,
  },
  {
    id: "eraser",
    label: "Viskelæder",
    description: "Fjern streger",
    Icon: Eraser,
  },
  {
    id: "line",
    label: "Linje",
    description: "Tegn lige streger",
    Icon: Slash,
  },
  {
    id: "rectangle",
    label: "Rektangel",
    description: "Tegn firkanter",
    Icon: Square,
  },
  {
    id: "ellipse",
    label: "Cirkel",
    description: "Tegn cirkler og ovaler",
    Icon: Circle,
  },
  {
    id: "fill",
    label: "Fyld",
    description: "Fyld områder med farve",
    Icon: PaintBucket,
  },
];

function App() {
  const [color, setColor] = useState("#22d3ee");
  const [brushSize, setBrushSize] = useState(10);
  const [activeTool, setActiveTool] = useState<DrawingTool>("pencil");
  const [toolsOpen, setToolsOpen] = useState(true);
  const [clearSignal, setClearSignal] = useState(0);
  const [undoSignal, setUndoSignal] = useState(0);
  const [savedDrawings, setSavedDrawings] = useState<SavedDrawing[]>([]);
  const canvasRef = useRef<DrawingCanvasHandle | null>(null);

  const brushSizeLabel = useMemo(
    () => `${brushSize.toString().padStart(2, "0")} px`,
    [brushSize]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed = JSON.parse(stored) as SavedDrawing[];

        if (Array.isArray(parsed)) {
          setSavedDrawings(parsed);
        }
      }

      const stateRaw = window.localStorage.getItem(STATE_STORAGE_KEY);

      if (stateRaw) {
        const parsed = JSON.parse(stateRaw) as Partial<{
          color: string;
          brushSize: number;
          activeTool: DrawingTool;
          toolsOpen: boolean;
          canvasData: string;
        }>;

        if (typeof parsed.color === "string") {
          setColor(parsed.color);
        }

        if (
          typeof parsed.brushSize === "number" &&
          Number.isFinite(parsed.brushSize)
        ) {
          setBrushSize(parsed.brushSize);
        }

        if (parsed.activeTool && typeof parsed.activeTool === "string") {
          setActiveTool(parsed.activeTool);
        }

        if (typeof parsed.toolsOpen === "boolean") {
          setToolsOpen(parsed.toolsOpen);
        }

        if (parsed.canvasData && typeof parsed.canvasData === "string") {
          requestAnimationFrame(() => {
            canvasRef.current?.loadFromDataURL(parsed.canvasData as string);
          });
        }
      }
    } catch (error) {
      console.error("Kunne ikke indlæse gemte tegninger eller tilstand", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedDrawings));
    } catch (error) {
      console.error("Kunne ikke gemme tegninger lokalt", error);
    }
  }, [savedDrawings]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const persist = () => {
      try {
        const canvasElement = canvasRef.current;
        const dataURL = canvasElement ? canvasElement.toDataURL() : null;

        window.localStorage.setItem(
          STATE_STORAGE_KEY,
          JSON.stringify({
            color,
            brushSize,
            activeTool,
            toolsOpen,
            canvasData: dataURL,
          })
        );
      } catch (error) {
        console.error("Kunne ikke gemme redigeringstilstand", error);
      }
    };

    const initialFrame = window.requestAnimationFrame(persist);
    const intervalId = window.setInterval(persist, 2500);
    const handleBeforeUnload = () => persist();

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.clearInterval(intervalId);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [color, brushSize, activeTool, toolsOpen, clearSignal, undoSignal]);

  const handleSaveDrawing = () => {
    const dataURL = canvasRef.current?.toDataURL();

    if (!dataURL) {
      return;
    }

    const id =
      typeof window !== "undefined" &&
      "crypto" in window &&
      window.crypto.randomUUID
        ? window.crypto.randomUUID()
        : `tegning-${Date.now()}-${Math.round(Math.random() * 1000)}`;

    const entry: SavedDrawing = {
      id,
      dataURL,
      createdAt: Date.now(),
    };

    setSavedDrawings((previous) => [entry, ...previous].slice(0, 12));
  };

  const handleLoadDrawing = (id: string) => {
    const drawing = savedDrawings.find((entry) => entry.id === id);

    if (!drawing) {
      return;
    }

    canvasRef.current?.loadFromDataURL(drawing.dataURL);
  };

  const handleDeleteDrawing = (id: string) => {
    setSavedDrawings((previous) => previous.filter((entry) => entry.id !== id));
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-br from-emerald-100 via-sky-100 to-emerald-200 px-4 py-7 text-emerald-900 sm:py-10">
      <div className="w-full max-w-5xl space-y-5 sm:space-y-6">
        <section className="space-y-5 rounded-3xl border border-sky-200 bg-white/75 p-4 shadow-[0_30px_70px_-20px_rgba(56,189,248,0.45)] backdrop-blur sm:p-6">
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white/80 px-4 py-3 shadow-[0_16px_45px_-25px_rgba(16,185,129,0.35)] backdrop-blur">
            <div className="flex items-center gap-2 text-emerald-700">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              <h1 className="text-2xl font-bold sm:text-[1.75rem]">
                Lillis Tegne App
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setUndoSignal((signal) => signal + 1)}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-gradient-to-r from-sky-100 to-sky-300 px-3 py-1.5 text-sm font-semibold text-sky-700 shadow-sm transition hover:from-sky-200 hover:to-sky-400"
              >
                <Undo2 className="h-4 w-4" aria-hidden="true" />
                <span>Fortryd</span>
              </button>
              <button
                type="button"
                onClick={() => setClearSignal((signal) => signal + 1)}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-gradient-to-r from-emerald-100 to-sky-100 px-3 py-1.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:from-emerald-200 hover:to-sky-200"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>Ryd</span>
              </button>
              <button
                type="button"
                onClick={handleSaveDrawing}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-gradient-to-r from-emerald-100 to-emerald-300 px-3 py-1.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:from-emerald-200 hover:to-emerald-400"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                <span>Gem</span>
              </button>
            </div>
          </header>

          <div className="space-y-4">
            <div className="relative rounded-3xl border border-emerald-100 bg-white/70 p-4 shadow-inner shadow-emerald-100">
              <div className="overflow-hidden rounded-2xl bg-white">
                <DrawingCanvas
                  ref={canvasRef}
                  tool={activeTool}
                  color={color}
                  brushSize={brushSize}
                  clearSignal={clearSignal}
                  undoSignal={undoSignal}
                />
              </div>

              <div className="pointer-events-none absolute top-6 right-6 flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={() => setToolsOpen((current) => !current)}
                  className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-white/90 text-emerald-500 shadow hover:border-emerald-300 hover:text-emerald-600"
                  aria-label={
                    toolsOpen ? "Skjul værktøjslinje" : "Vis værktøjslinje"
                  }
                  aria-expanded={toolsOpen}
                >
                  {toolsOpen ? (
                    <PanelRightClose className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <PanelRightOpen className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>

                <nav
                  aria-label="Vælg tegneværktøj"
                  className={`pointer-events-auto flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-white/95 p-2 shadow-lg shadow-emerald-200/60 transition-all duration-200 ${
                    toolsOpen ? "opacity-100" : "pointer-events-none opacity-0"
                  }`}
                >
                  {toolDefinitions.map((tool) => {
                    const isActive = activeTool === tool.id;
                    const ToolIcon = tool.Icon;

                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => setActiveTool(tool.id)}
                        className={`flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                          isActive
                            ? "border-sky-400 bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 shadow-[0_12px_30px_-12px_rgba(56,189,248,0.65)]"
                            : "border-transparent bg-white/70 text-emerald-400 hover:border-sky-200 hover:text-sky-600"
                        }`}
                        title={tool.description}
                        aria-pressed={isActive}
                        aria-label={tool.label}
                      >
                        <ToolIcon className="h-5 w-5" aria-hidden="true" />
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label
                style={{ backgroundColor: color }}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-emerald-100 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-500"
              >
                <span className="inline-flex items-center gap-2 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-500">
                  <Palette className="h-4 w-4" aria-hidden="true" />
                  Farve
                </span>
                <input
                  aria-label="Vælg farve"
                  type="color"
                  value={color}
                  onChange={(event) => {
                    setColor(event.target.value);
                    if (activeTool === "eraser") {
                      setActiveTool("pencil");
                    }
                  }}
                  className="-z-10"
                />
              </label>

              <div className="rounded-2xl border border-sky-100 bg-white/80 px-4 py-4 shadow-inner shadow-sky-100 sm:col-span-1 lg:col-span-2">
                <div className="flex items-center justify-between text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-sky-500">
                  <span className="inline-flex items-center gap-2">
                    <Brush className="h-4 w-4" aria-hidden="true" />
                    Penselstørrelse
                  </span>
                  <span className="font-bold text-emerald-400">
                    {brushSizeLabel}
                  </span>
                </div>
                <input
                  aria-label="Penselstørrelse"
                  type="range"
                  min={2}
                  max={52}
                  step={1}
                  value={brushSize}
                  onChange={(event) => setBrushSize(Number(event.target.value))}
                  className="mt-4 h-2 w-full cursor-pointer accent-emerald-500"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-3xl border border-emerald-200 bg-white/70 p-4 shadow-[0_30px_60px_-25px_rgba(16,185,129,0.35)] backdrop-blur">
          <header className="flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-emerald-700">
                Gemte tegninger
              </h2>
              <p className="text-sm text-emerald-500">
                Tryk på en miniature for at indlæse den igen.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
              Op til 12 gemmes automatisk
            </span>
          </header>

          {savedDrawings.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/70 px-4 py-6 text-center text-sm font-medium text-emerald-500">
              Du har ingen gemte tegninger endnu. Tryk på{" "}
              <span className="font-semibold">Gem tegning</span> for at gemme
              din kunst.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {savedDrawings.map((entry) => (
                <div
                  key={entry.id}
                  className="group flex flex-col items-stretch gap-2 rounded-2xl border border-emerald-200 bg-white/80 p-2 shadow-inner shadow-emerald-100 transition hover:shadow-emerald-200"
                >
                  <button
                    type="button"
                    onClick={() => handleLoadDrawing(entry.id)}
                    className="relative overflow-hidden rounded-xl border border-emerald-100 bg-white transition hover:border-emerald-300"
                    aria-label="Indlæs gemt tegning"
                  >
                    <img
                      src={entry.dataURL}
                      alt="Gemt tegning miniature"
                      className="h-28 w-full object-cover sm:h-32"
                    />
                  </button>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-emerald-500">
                      {new Date(entry.createdAt).toLocaleDateString("da-DK", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteDrawing(entry.id)}
                      className="rounded-full border border-rose-200 bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-500 transition hover:border-rose-300 hover:bg-rose-200"
                    >
                      Slet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <footer className="text-center text-sm text-emerald-500">
          <p>Lavet af Lilli My</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
