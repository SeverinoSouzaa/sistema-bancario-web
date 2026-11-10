import React, { useMemo, useState, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Info } from 'lucide-react';

export default function BinaryTreeVisualizer({
  root,
  type = 'avl', // 'avl' or 'rb'
  showNil = true,
  highlightKey = null,
  onSelectNode = null
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState(null);

  // Layout calculation
  const { nodes, links, bounds } = useMemo(() => {
    if (!root) {
      return { nodes: [], links: [], bounds: { minX: 0, maxX: 800, minY: 0, maxY: 400 } };
    }

    const calculatedNodes = [];
    const calculatedLinks = [];

    // Calculate maximum depth to give appropriate horizontal space
    function getMaxDepth(n) {
      if (!n) return 0;
      return 1 + Math.max(getMaxDepth(n.esquerda), getMaxDepth(n.direita));
    }

    const maxDepth = getMaxDepth(root);
    const canvasWidth = Math.max(800, Math.pow(2, Math.min(maxDepth, 6)) * 80);

    function traverse(node, depth, xMin, xMax, parent = null, isLeft = null) {
      if (!node) {
        if (showNil && type === 'rb' && parent) {
          const x = (xMin + xMax) / 2;
          const y = depth * 88 + 48;
          const nilNode = {
            id: `nil-${parent.id}-${isLeft ? 'L' : 'R'}`,
            isNil: true,
            x,
            y,
            parent
          };
          calculatedNodes.push(nilNode);
          calculatedLinks.push({
            source: { x: parent.x, y: parent.y },
            target: { x, y }
          });
        }
        return;
      }

      const x = (xMin + xMax) / 2;
      const y = depth * 88 + 48;

      const currentNode = {
        id: `node-${node.chave}`,
        data: node,
        x,
        y,
        isNil: false,
        parent
      };

      calculatedNodes.push(currentNode);

      if (parent) {
        calculatedLinks.push({
          source: { x: parent.x, y: parent.y },
          target: { x, y }
        });
      }

      traverse(node.esquerda, depth + 1, xMin, x, currentNode, true);
      traverse(node.direita, depth + 1, x, xMax, currentNode, false);
    }

    traverse(root, 0, 40, canvasWidth - 40);

    let minX = Infinity, maxX = -Infinity, minY = 0, maxY = -Infinity;
    calculatedNodes.forEach(n => {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y > maxY) maxY = n.y;
    });

    const paddingX = 80;
    const paddingY = 80;

    return {
      nodes: calculatedNodes,
      links: calculatedLinks,
      bounds: {
        minX: Math.min(minX - paddingX, 0),
        maxX: Math.max(maxX + paddingX, 800),
        minY: 0,
        maxY: Math.max(maxY + paddingY, 400)
      }
    };
  }, [root, type, showNil]);

  const viewBoxWidth = bounds.maxX - bounds.minX;
  const viewBoxHeight = bounds.maxY - bounds.minY;

  // Pan & Drag handlers
  const handleMouseDown = (e) => {
    // Only drag with left mouse button when not clicking a node directly
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setZoom(z => Math.min(z + 0.15, 2.0));
  };

  const handleZoomOut = () => {
    setZoom(z => Math.max(z - 0.15, 0.4));
  };

  if (!root) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[360px] border border-dashed border-slate-300 rounded-xl bg-white/60 text-slate-500 p-8">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
          <Info className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-slate-700">Árvore vazia no momento</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm text-center">
          Cadastre uma nova conta no menu superior ou execute uma bateria automática de testes.
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full min-h-[420px] rounded-xl border border-slate-200 bg-grid-dots overflow-hidden shadow-xs select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Floating Canvas Controls (Helicon style: Zoom In, Zoom Out, Reset) */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg shadow-sm p-1 gap-1 text-slate-700">
        <button
          onClick={handleZoomIn}
          title="Aumentar Zoom"
          className="p-1.5 rounded-md hover:bg-slate-100 active:bg-slate-200 transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Diminuir Zoom"
          className="p-1.5 rounded-md hover:bg-slate-100 active:bg-slate-200 transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-slate-200 mx-0.5" />
        <span className="text-xs font-mono px-1.5 font-medium text-slate-600">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleResetZoom}
          title="Centralizar e redefinir visão (100%)"
          className="p-1.5 rounded-md hover:bg-slate-100 active:bg-slate-200 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* SVG Canvas */}
      <svg
        viewBox={`${bounds.minX} ${bounds.minY} ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full h-full min-h-[420px] transition-transform duration-75"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center'
        }}
      >
        <defs>
          {/* Subtle clean shadows */}
          <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.08" />
          </filter>
          <filter id="activeShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.18" />
          </filter>
        </defs>

        {/* Links / Edges (smooth bezier curves matching AWS Explorer & Twinize) */}
        {links.map((link, idx) => {
          const dy = link.target.y - link.source.y;
          const path = `M ${link.source.x} ${link.source.y + 20} C ${link.source.x} ${link.source.y + dy * 0.55}, ${link.target.x} ${link.target.y - dy * 0.45}, ${link.target.x} ${link.target.y - 18}`;
          return (
            <path
              key={`link-${idx}`}
              d={path}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.75"
              strokeLinecap="round"
              className="transition-colors duration-300"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          if (node.isNil) {
            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className="opacity-60 hover:opacity-100 cursor-default transition-opacity"
              >
                <rect
                  x="-16"
                  y="-11"
                  width="32"
                  height="22"
                  rx="6"
                  fill="#f1f5f9"
                  stroke="#cbd5e1"
                  strokeWidth="1.2"
                  strokeDasharray="2,2"
                />
                <text
                  textAnchor="middle"
                  dy="4"
                  fontSize="9"
                  fontFamily="ui-monospace, monospace"
                  fill="#64748b"
                  fontWeight="600"
                >
                  NIL
                </text>
              </g>
            );
          }

          const isHighlighted = highlightKey === node.data.chave;
          const isHovered = hoveredNode === node.data.chave;
          const isAVL = type === 'avl';
          const isRed = !isAVL && node.data.cor === 'VERMELHO';

          // Node styling following Image 1 (AWS) and Image 3 (Twinize)
          let circleFill = '#ffffff';
          let circleStroke = '#0f172a';
          let textColor = '#0f172a';

          if (isAVL) {
            // AVL: Pure crisp white card with charcoal border
            const fbAbs = Math.abs(node.data.fb);
            circleFill = '#ffffff';
            if (fbAbs >= 2) {
              circleStroke = '#d97706'; // Amber risk indicator
            } else {
              circleStroke = '#0f172a';
            }
            textColor = '#0f172a';
          } else {
            // Rubro-Negra: Black nodes are obsidian (#0f172a), Red nodes are crimson (#e11d48)
            if (isRed) {
              circleFill = '#e11d48'; // Rose/Crimson
              circleStroke = '#be123c';
              textColor = '#ffffff';
            } else {
              circleFill = '#0f172a'; // Deep obsidian
              circleStroke = '#1e293b';
              textColor = '#ffffff';
            }
          }

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              className="cursor-pointer group"
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectNode) onSelectNode(node.data);
              }}
              onMouseEnter={() => setHoveredNode(node.data.chave)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              {/* Highlight / Search Halo */}
              {isHighlighted && (
                <circle
                  r="30"
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2.5"
                  strokeDasharray="4,3"
                  className="animate-spin"
                  style={{ animationDuration: '6s' }}
                />
              )}

              {/* Main Node Circle */}
              <circle
                r="22"
                fill={circleFill}
                stroke={isHighlighted ? '#2563eb' : circleStroke}
                strokeWidth={isHighlighted ? 2.5 : 2}
                filter={isHovered ? 'url(#activeShadow)' : 'url(#nodeShadow)'}
                className="transition-all duration-200"
              />

              {/* Account Key */}
              <text
                textAnchor="middle"
                dy="4"
                fontSize="12"
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight="700"
                fill={textColor}
                className="pointer-events-none select-none tracking-tight"
              >
                {node.data.chave}
              </text>

              {/* Badges */}
              {isAVL ? (
                <>
                  {/* Balance Factor (FB) Badge */}
                  <g transform="translate(-18, -18)">
                    <rect
                      x="-11"
                      y="-7"
                      width="22"
                      height="14"
                      rx="4"
                      fill={Math.abs(node.data.fb) >= 2 ? '#fef3c7' : '#f1f5f9'}
                      stroke={Math.abs(node.data.fb) >= 2 ? '#d97706' : '#cbd5e1'}
                      strokeWidth="1"
                    />
                    <text
                      textAnchor="middle"
                      dy="3.5"
                      fontSize="8"
                      fontFamily="ui-monospace, monospace"
                      fontWeight="700"
                      fill={Math.abs(node.data.fb) >= 2 ? '#b45309' : (node.data.fb === 0 ? '#475569' : '#0284c7')}
                    >
                      {node.data.fb > 0 ? `+${node.data.fb}` : node.data.fb}
                    </text>
                  </g>

                  {/* Height Badge */}
                  <g transform="translate(18, -18)">
                    <rect
                      x="-9"
                      y="-7"
                      width="18"
                      height="14"
                      rx="4"
                      fill="#f1f5f9"
                      stroke="#cbd5e1"
                      strokeWidth="1"
                    />
                    <text
                      textAnchor="middle"
                      dy="3.5"
                      fontSize="8"
                      fontFamily="ui-monospace, monospace"
                      fontWeight="600"
                      fill="#64748b"
                    >
                      h{node.data.altura}
                    </text>
                  </g>
                </>
              ) : (
                /* Color Indicator Pill for Red-Black */
                <g transform="translate(0, -22)">
                  <rect
                    x="-14"
                    y="-6"
                    width="28"
                    height="13"
                    rx="4"
                    fill={isRed ? '#ffe4e6' : '#f1f5f9'}
                    stroke={isRed ? '#fda4af' : '#cbd5e1'}
                    strokeWidth="1"
                  />
                  <text
                    textAnchor="middle"
                    dy="3.5"
                    fontSize="7.5"
                    fontFamily="system-ui, sans-serif"
                    fontWeight="700"
                    fill={isRed ? '#be123c' : '#334155'}
                  >
                    {isRed ? 'RUBRO' : 'NEGRO'}
                  </text>
                </g>
              )}

              {/* Titular label below (AWS Resource Explorer style) */}
              <text
                textAnchor="middle"
                dy="35"
                fontSize="10"
                fontFamily="system-ui, -apple-system, sans-serif"
                fill="#475569"
                fontWeight="500"
                className="select-none pointer-events-none"
              >
                {node.data.titular.length > 13 ? node.data.titular.substring(0, 11) + '…' : node.data.titular}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
