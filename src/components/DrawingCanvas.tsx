import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export type DrawingTool = "pencil" | "eraser" | "line" | "rectangle" | "ellipse" | "fill";

type DrawingCanvasProps = {
  color: string;
  brushSize: number;
  tool: DrawingTool;
  clearSignal: number;
  undoSignal: number;
};

type PointerEventType = ReactPointerEvent<HTMLCanvasElement>;

export type DrawingCanvasHandle = {
  toDataURL: () => string | null;
  loadFromDataURL: (dataURL: string) => void;
};

const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  ({ color, brushSize, tool, clearSignal, undoSignal }, ref) => {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);
    const isDrawingRef = useRef(false);
    const historyRef = useRef<ImageData[]>([]);
    const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
    const shapeSnapshotRef = useRef<ImageData | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      const wrapper = wrapperRef.current;

      if (!canvas || !wrapper) {
        return;
      }

      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        return;
      }

      contextRef.current = context;

      const resizeToContainer = () => {
        if (!canvas || !wrapper || !contextRef.current) {
          return;
        }

        const rect = wrapper.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;

        let imageData: ImageData | null = null;

        if (canvas.width > 0 && canvas.height > 0) {
          try {
            imageData = contextRef.current.getImageData(0, 0, canvas.width, canvas.height);
          } catch (error) {
            imageData = null;
          }
        }

        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        if (!ctx) {
          return;
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(ratio, ratio);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        contextRef.current = ctx;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        if (imageData) {
          ctx.putImageData(imageData, 0, 0);
        } else {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.restore();
      };

      resizeToContainer();

      const resizeObserver = new ResizeObserver(resizeToContainer);
      resizeObserver.observe(wrapper);

      const handleWindowResize = () => {
        window.requestAnimationFrame(resizeToContainer);
      };

      window.addEventListener("resize", handleWindowResize);

      return () => {
        resizeObserver.disconnect();
        window.removeEventListener("resize", handleWindowResize);
      };
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      const context = contextRef.current;

      if (!canvas || !context) {
        return;
      }

      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.restore();
      historyRef.current = [];
    }, [clearSignal]);

    useEffect(() => {
      if (undoSignal === 0) {
        return;
      }

      const canvas = canvasRef.current;
      const context = contextRef.current;

      if (!canvas || !context) {
        return;
      }

      const history = historyRef.current;
      const previous = history.pop();

      if (!previous) {
        return;
      }

      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.putImageData(previous, 0, 0);
      context.restore();
    }, [undoSignal]);

    const getCanvasCoordinates = (event: PointerEventType) => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return null;
      }

      const rect = canvas.getBoundingClientRect();

      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const getPixelCoordinates = (point: { x: number; y: number }) => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return null;
      }

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      return {
        x: Math.floor(point.x * scaleX),
        y: Math.floor(point.y * scaleY),
      };
    };

    const stopDrawing = (event: PointerEventType) => {
      const canvas = canvasRef.current;
      const context = contextRef.current;

      if (!context) {
        return;
      }

      if (isDrawingRef.current) {
        if (tool === "pencil" || tool === "eraser") {
          context.closePath();
        }
        context.globalCompositeOperation = "source-over";
      }

      isDrawingRef.current = false;
      shapeStartRef.current = null;
      shapeSnapshotRef.current = null;

      if (canvas && canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    const pushSnapshotForUndo = (context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      try {
        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);
        const snapshot = context.getImageData(0, 0, canvas.width, canvas.height);
        context.restore();

        const history = historyRef.current;

        if (history.length >= 25) {
          history.shift();
        }

        history.push(snapshot);
        return snapshot;
      } catch {
        return null;
      }
    };

    const restoreSnapshot = (snapshot: ImageData | null) => {
      const canvas = canvasRef.current;
      const context = contextRef.current;

      if (!canvas || !context || !snapshot) {
        return;
      }

      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.putImageData(snapshot, 0, 0);
      context.restore();
    };

    const drawPreviewShape = (current: { x: number; y: number }) => {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      const start = shapeStartRef.current;
      const snapshot = shapeSnapshotRef.current;

      if (!canvas || !context || !start) {
        return;
      }

      restoreSnapshot(snapshot);

      context.lineWidth = brushSize;
      context.strokeStyle = color;
      context.fillStyle = color;
      context.globalCompositeOperation = "source-over";

      const width = current.x - start.x;
      const height = current.y - start.y;

      if (tool === "line") {
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(current.x, current.y);
        context.stroke();
        context.closePath();
        return;
      }

      if (tool === "rectangle") {
        context.strokeRect(start.x, start.y, width, height);
        return;
      }

      if (tool === "ellipse") {
        const radiusX = Math.abs(width) / 2;
        const radiusY = Math.abs(height) / 2;
        const centerX = start.x + width / 2;
        const centerY = start.y + height / 2;

        context.beginPath();
        context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        context.stroke();
        context.closePath();
      }
    };

    const hexToRgba = (hex: string) => {
      const normalized = hex.replace("#", "");
      const bigint = Number.parseInt(normalized, 16);

      if (normalized.length === 3) {
        const r = (bigint >> 8) & 0xf;
        const g = (bigint >> 4) & 0xf;
        const b = bigint & 0xf;
        return {
          r: (r << 4) | r,
          g: (g << 4) | g,
          b: (b << 4) | b,
          a: 255,
        };
      }

      return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255,
        a: 255,
      };
    };

    const colorsMatch = (
      a: [number, number, number, number],
      b: { r: number; g: number; b: number; a: number },
      tolerance = 26
    ) =>
      Math.abs(a[0] - b.r) <= tolerance &&
      Math.abs(a[1] - b.g) <= tolerance &&
      Math.abs(a[2] - b.b) <= tolerance &&
      Math.abs(a[3] - b.a) <= tolerance;

    const floodFill = (start: { x: number; y: number }) => {
      const canvas = canvasRef.current;
      const context = contextRef.current;

      if (!canvas || !context) {
        return;
      }

      const pixelPoint = getPixelCoordinates(start);

      if (!pixelPoint) {
        return;
      }

      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const { data, width, height } = imageData;
      const targetOffset = (pixelPoint.y * width + pixelPoint.x) * 4;
      const targetColor: [number, number, number, number] = [
        data[targetOffset],
        data[targetOffset + 1],
        data[targetOffset + 2],
        data[targetOffset + 3],
      ];
      const targetColorRgba = {
        r: targetColor[0],
        g: targetColor[1],
        b: targetColor[2],
        a: targetColor[3],
      };

      const fillColor = hexToRgba(color);

      if (colorsMatch(targetColor, fillColor)) {
        context.restore();
        return;
      }

      const stack: Array<{ x: number; y: number }> = [pixelPoint];
      const visited = new Uint8Array(width * height);

      const setPixel = (x: number, y: number) => {
        const offset = (y * width + x) * 4;
        data[offset] = fillColor.r;
        data[offset + 1] = fillColor.g;
        data[offset + 2] = fillColor.b;
        data[offset + 3] = fillColor.a;
      };

      const matchTarget = (x: number, y: number) => {
        const offset = (y * width + x) * 4;
        return colorsMatch(
          [
            data[offset],
            data[offset + 1],
            data[offset + 2],
            data[offset + 3],
          ],
          targetColorRgba
        );
      };

      while (stack.length > 0) {
        const { x, y } = stack.pop()!;
        const idx = y * width + x;

        if (x < 0 || x >= width || y < 0 || y >= height) {
          continue;
        }

        if (visited[idx]) {
          continue;
        }

        if (!matchTarget(x, y)) {
          continue;
        }

        visited[idx] = 1;
        setPixel(x, y);

        stack.push({ x: x + 1, y });
        stack.push({ x: x - 1, y });
        stack.push({ x, y: y + 1 });
        stack.push({ x, y: y - 1 });
      }

      context.putImageData(imageData, 0, 0);
      context.restore();
    };

    const handlePointerDown = (event: PointerEventType) => {
      event.preventDefault();

      const context = contextRef.current;
      const canvas = canvasRef.current;
      const point = getCanvasCoordinates(event);

      if (!context || !canvas || !point) {
        return;
      }

      const snapshot = pushSnapshotForUndo(context, canvas);

      if (tool === "fill") {
        floodFill(point);
        return;
      }

      canvas.setPointerCapture(event.pointerId);
      isDrawingRef.current = true;

      context.lineWidth = brushSize;
      context.strokeStyle = color;
      context.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";

      if (tool === "pencil" || tool === "eraser") {
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(point.x, point.y);
        context.stroke();
        return;
      }

      shapeStartRef.current = point;
      shapeSnapshotRef.current = snapshot;
      drawPreviewShape(point);
    };

    const handlePointerMove = (event: PointerEventType) => {
      if (!isDrawingRef.current) {
        return;
      }

      event.preventDefault();

      const context = contextRef.current;
      const point = getCanvasCoordinates(event);

      if (!context || !point) {
        return;
      }

      if (tool === "line" || tool === "rectangle" || tool === "ellipse") {
        drawPreviewShape(point);
        return;
      }

      context.lineWidth = brushSize;

      if (tool !== "eraser") {
        context.strokeStyle = color;
      }

      context.lineTo(point.x, point.y);
      context.stroke();
    };

    const handlePointerUp = (event: PointerEventType) => {
      if (tool === "line" || tool === "rectangle" || tool === "ellipse") {
        const point = getCanvasCoordinates(event);
        if (point) {
          drawPreviewShape(point);
        }
      }
      stopDrawing(event);
    };

    const handlePointerLeave = (event: PointerEventType) => {
      stopDrawing(event);
    };

    const handlePointerCancel = (event: PointerEventType) => {
      stopDrawing(event);
    };

    useImperativeHandle(
      ref,
      () => ({
        toDataURL: () => {
          const canvas = canvasRef.current;

          if (!canvas) {
            return null;
          }

          return canvas.toDataURL("image/png");
        },
        loadFromDataURL: (dataURL: string) => {
          const canvas = canvasRef.current;
          const context = contextRef.current;

          if (!canvas || !context) {
            return;
          }

          const image = new Image();

          image.onload = () => {
            context.save();
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            context.restore();
            historyRef.current = [];
          };

          image.src = dataURL;
        },
      }),
      []
    );

    return (
      <div
        ref={wrapperRef}
        className="flex h-[55vh] w-full items-stretch justify-center overflow-hidden rounded-2xl bg-white sm:h-[60vh]"
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Drawing canvas"
        className={`h-full w-full touch-none select-none rounded-2xl border border-emerald-200 bg-white shadow-inner transition ${
          tool === "eraser" ? "cursor-cell" : "cursor-crosshair"
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={handlePointerCancel}
          onContextMenu={(event) => event.preventDefault()}
        />
      </div>
    );
  }
);

DrawingCanvas.displayName = "DrawingCanvas";

export default DrawingCanvas;

