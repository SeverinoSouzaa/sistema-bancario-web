import React, { useMemo } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

export default function BinaryTreeVisualizer({
  root,
  type = 'avl', // 'avl' or 'rb'
  showNil = true,
  highlightKey = null
}) {
  const { nodes, links, bounds } = useMemo(() => {
    if (!root) {
      return { nodes: [], links: [], bounds: { minX: 0, maxX: 600, minY: 0, maxY: 300 } };
    }

    const calculatedNodes = [];
    const calculatedLinks = [];

    // Binary layout using bounding box subdivision
    function traverse(node, depth, xMin, xMax, parent = null, isLeft = null) {
      if (!node) {
        if (showNil && type === 'rb' && parent) {
          const x = (xMin + xMax) / 2;
          const y = depth * 80 + 40;
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
      const y = depth * 80 + 40;

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

    // Determine initial canvas width based on approximate node count/depth
    const initialWidth = 900;
    traverse(root, 0, 40, initialWidth - 40);

    let minX = Infinity, maxX = -Infinity, minY = 0, maxY = -Infinity;
    calculatedNodes.forEach(n => {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y > maxY) maxY = n.y;
    });

    return {
      nodes: calculatedNodes,
      links: calculatedLinks,
      bounds: {
        minX: Math.min(minX - 50, 0),
        maxX: Math.max(maxX + 50, 700),
        minY: 0,
        maxY: Math.max(maxY + 60, 320)
      }
    };
  }, [root, type, showNil]);

  const viewBox = `${bounds.minX} ${bounds.minY} ${bounds.maxX - bounds.minX} ${bounds.maxY - bounds.minY}`;

  if (!root) {
    return (
      <div className="flex flex-col items-center justify-center h-72 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30 text-slate-500">
        <p className="text-sm font-medium">Árvore vazia no momento</p>
        <p className="text-xs text-slate-600 mt-1">Insira uma conta ou aplique um cenário demonstrativo acima</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto overflow-y-hidden rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-md shadow-inner p-2">
      <svg
        viewBox={viewBox}
        className="w-full h-[380px] min-w-[500px] transition-all duration-500 ease-out"
      >
        <defs>
          <linearGradient id="linkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#475569" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#334155" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Links / Edges */}
        {links.map((link, idx) => {
          const path = `M ${link.source.x} ${link.source.y} C ${link.source.x} ${(link.source.y + link.target.y) / 2}, ${link.target.x} ${(link.source.y + link.target.y) / 2}, ${link.target.x} ${link.target.y}`;
          return (
            <path
              key={`link-${idx}`}
              d={path}
              fill="none"
              stroke="url(#linkGrad)"
              strokeWidth="2"
              className="transition-all duration-500"
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
                className="transition-all duration-500 opacity-60 hover:opacity-100 cursor-default"
              >
                <rect
                  x="-14"
                  y="-10"
                  width="28"
                  height="20"
                  rx="4"
                  fill="#0f172a"
                  stroke="#334155"
                  strokeWidth="1.5"
                />
                <text
                  textAnchor="middle"
                  dy="4"
                  fontSize="9"
                  fontFamily="monospace"
                  fill="#64748b"
                  fontWeight="bold"
                >
                  NIL
                </text>
              </g>
            );
          }

          const isHighlighted = highlightKey === node.data.chave;
          const isAVL = type === 'avl';
          const isRed = !isAVL && node.data.cor === 'VERMELHO';

          // Node styling
          let circleFill = '#0f172a';
          let circleStroke = '#38bdf8';
          let glowColor = 'rgba(56, 189, 248, 0.4)';

          if (isAVL) {
            const fbAbs = Math.abs(node.data.fb);
            if (fbAbs >= 2) {
              circleStroke = '#f59e0b';
              glowColor = 'rgba(245, 158, 11, 0.6)';
            } else if (node.data.fb === 0) {
              circleStroke = '#10b981';
              glowColor = 'rgba(16, 185, 129, 0.4)';
            } else {
              circleStroke = '#06b6d4';
              glowColor = 'rgba(6, 182, 212, 0.4)';
            }
          } else {
            if (isRed) {
              circleFill = '#b91c1c';
              circleStroke = '#f87171';
              glowColor = 'rgba(239, 68, 68, 0.6)';
            } else {
              circleFill = '#020617';
              circleStroke = '#475569';
              glowColor = 'rgba(100, 116, 139, 0.3)';
            }
          }

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              className="cursor-pointer group transition-transform duration-500"
            >
              {/* Highlight Pulse Ring */}
              {isHighlighted && (
                <circle
                  r="28"
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="3"
                  className="animate-ping opacity-75"
                />
              )}

              {/* Main Node Circle */}
              <circle
                r="22"
                fill={circleFill}
                stroke={circleStroke}
                strokeWidth={isHighlighted ? 3 : 2}
                style={{ filter: `drop-shadow(0 0 8px ${glowColor})` }}
                className="transition-all duration-300 group-hover:scale-110"
              />

              {/* Account Key */}
              <text
                textAnchor="middle"
                dy="4"
                fontSize="11"
                fontFamily="system-ui, sans-serif"
                fontWeight="bold"
                fill="#ffffff"
                className="pointer-events-none select-none tracking-tight"
              >
                {node.data.chave}
              </text>

              {/* Metadata Badges (Height / FB / Color) */}
              {isAVL ? (
                <>
                  {/* FB Badge */}
                  <g transform="translate(-18, -18)">
                    <rect
                      x="-10"
                      y="-7"
                      width="20"
                      height="14"
                      rx="4"
                      fill="#1e293b"
                      stroke={Math.abs(node.data.fb) >= 2 ? '#f59e0b' : '#334155'}
                      strokeWidth="1"
                    />
                    <text
                      textAnchor="middle"
                      dy="3.5"
                      fontSize="8"
                      fontFamily="monospace"
                      fontWeight="bold"
                      fill={node.data.fb > 0 ? '#38bdf8' : (node.data.fb < 0 ? '#fb7185' : '#94a3b8')}
                    >
                      {node.data.fb > 0 ? `+${node.data.fb}` : node.data.fb}
                    </text>
                  </g>

                  {/* Height Badge */}
                  <g transform="translate(18, -18)">
                    <rect
                      x="-8"
                      y="-7"
                      width="16"
                      height="14"
                      rx="4"
                      fill="#1e293b"
                      stroke="#334155"
                      strokeWidth="1"
                    />
                    <text
                      textAnchor="middle"
                      dy="3.5"
                      fontSize="8"
                      fontFamily="monospace"
                      fill="#94a3b8"
                    >
                      h{node.data.altura}
                    </text>
                  </g>
                </>
              ) : (
                /* Color Indicator Pill */
                <g transform="translate(0, -22)">
                  <rect
                    x="-16"
                    y="-6"
                    width="32"
                    height="12"
                    rx="3"
                    fill={isRed ? '#991b1b' : '#0f172a'}
                    stroke={isRed ? '#fca5a5' : '#475569'}
                    strokeWidth="0.8"
                  />
                  <text
                    textAnchor="middle"
                    dy="3"
                    fontSize="7"
                    fontFamily="monospace"
                    fontWeight="bold"
                    fill={isRed ? '#fecaca' : '#94a3b8'}
                  >
                    {isRed ? 'RED' : 'BLACK'}
                  </text>
                </g>
              )}

              {/* Titular label below */}
              <text
                textAnchor="middle"
                dy="34"
                fontSize="9"
                fill="#94a3b8"
                className="opacity-75 group-hover:opacity-100 transition-opacity font-medium select-none"
              >
                {node.data.titular.length > 12 ? node.data.titular.substring(0, 10) + '..' : node.data.titular}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
