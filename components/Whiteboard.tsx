import React, { useRef, useEffect, useState, useCallback } from 'react';

interface WhiteboardProps {
  socket: any;
  roomCode: string;
}

const Whiteboard: React.FC<WhiteboardProps> = ({ socket, roomCode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#FFFFFF');
  const [lineWidth] = useState(2);
  const lastPointRef = useRef<{x: number, y: number} | null>(null);

  const drawLine = useCallback((x0, y0, x1, y1, drawColor, width) => {
    if (!contextRef.current) return;
    const context = contextRef.current;
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = drawColor;
    context.lineWidth = width;
    context.stroke();
    context.closePath();
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (canvas && context) {
        context.fillStyle = '#1e1e1e';
        context.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // This function will be called to resize the canvas and redraw its content
    const resizeCanvas = () => {
        const parent = canvas.parentElement;
        if(parent) {
            // We don't save/restore content on resize because it's a shared board.
            // A more advanced version might buffer drawings and redraw.
            canvas.width = parent.clientWidth;
            canvas.height = parent.clientHeight;
            clearCanvas(); // Clear on resize to avoid distorted drawings
        }
    };
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const context = canvas.getContext('2d');
    if (!context) return;
    context.lineCap = 'round';
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    contextRef.current = context;
    
    return () => {
        window.removeEventListener('resize', resizeCanvas);
    };
  }, [clearCanvas, color, lineWidth]);

  useEffect(() => {
    if (!socket) return;
    
    const handleDrawData = (data: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const { x0, y0, x1, y1, drawColor, width } = data;
        drawLine(x0 * canvas.width, y0 * canvas.height, x1 * canvas.width, y1 * canvas.height, drawColor, width);
    };

    const handleClearCanvas = () => {
      clearCanvas();
    }
    
    socket.on('whiteboard-data', handleDrawData);
    socket.on('whiteboard-clear', handleClearCanvas);

    return () => {
        socket.off('whiteboard-data', handleDrawData);
        socket.off('whiteboard-clear', handleClearCanvas);
    };
  }, [socket, drawLine, clearCanvas]);

  const startDrawing = ({ nativeEvent }: React.MouseEvent) => {
    const { offsetX, offsetY } = nativeEvent;
    setIsDrawing(true);
    lastPointRef.current = { x: offsetX, y: offsetY };
  };

  const draw = ({ nativeEvent }: React.MouseEvent) => {
    if (!isDrawing || !lastPointRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const { offsetX, offsetY } = nativeEvent;

    const x0 = lastPointRef.current.x;
    const y0 = lastPointRef.current.y;
    const x1 = offsetX;
    const y1 = offsetY;

    drawLine(x0, y0, x1, y1, color, lineWidth);
    
    socket.emit('whiteboard-data', {
      roomCode,
      data: {
        x0: x0 / canvas.width,
        y0: y0 / canvas.height,
        x1: x1 / canvas.width,
        y1: y1 / canvas.height,
        drawColor: color,
        width: lineWidth,
      },
    });
    
    lastPointRef.current = { x: offsetX, y: offsetY };
  };
  
  const stopDrawing = () => {
    setIsDrawing(false);
    lastPointRef.current = null;
  };
  
  const handleClear = () => {
    clearCanvas();
    socket.emit('whiteboard-clear', { roomCode });
  }

  const colors = ['#FFFFFF', '#EF4444', '#3B82F6', '#22C55E', '#F97316', '#FBBF24'];

  return (
    <div className="bg-gray-900 rounded-lg flex flex-col flex-1 min-h-0">
        <div className="p-2 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Color:</span>
                {colors.map(c => (
                    <button key={c} onClick={() => setColor(c)} style={{ backgroundColor: c }}
                        className={`w-6 h-6 rounded-full transition-transform focus:outline-none
                            ${color === c ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-white scale-110' : 'hover:scale-110'}`}>
                    </button>
                ))}
            </div>
            <button onClick={handleClear} className="px-3 py-1 bg-red-600 text-white text-sm font-semibold rounded hover:bg-red-500">
                Clear
            </button>
        </div>
        <div className="relative flex-grow w-full h-full p-1">
            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
                onMouseMove={draw}
                className="bg-[#1e1e1e] cursor-crosshair rounded-b-md"
            />
        </div>
    </div>
  );
};

export default Whiteboard;
