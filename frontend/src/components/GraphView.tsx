import { useRef, useMemo, useCallback, useEffect } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import { Network } from 'lucide-react';
import type { GraphData } from '../types';

/* ─── Colour / size helpers ───────────────────────────── */
const NODE_COLOR: Record<string, string> = {
  File:     '#00d2ff',
  Class:    '#8b5cf6',
  Function: '#10b981',
};

const NODE_SIZE: Record<string, number> = {
  File:     6,
  Class:    4,
  Function: 2.5,
};

/* ─── Component ───────────────────────────────────────── */
interface GraphViewProps {
  graphData: GraphData | null;
}

export function GraphView({ graphData }: GraphViewProps) {
  const fgRef = useRef<any>(null);

  /* Convert API format → force-graph format */
  const data = useMemo(() => {
    if (!graphData || graphData.nodes.length === 0) return { nodes: [], links: [] };

    return {
      nodes: graphData.nodes.map(n => ({
        id:   n.id,
        name: n.data.name ?? n.id.split(':').pop() ?? n.id,
        type: n.label,
      })),
      links: graphData.edges.map((e, i) => ({
        id:     `l-${i}`,
        source: e.source,
        target: e.target,
      })),
    };
  }, [graphData]);

  /* After data loads, zoom to fit */
  useEffect(() => {
    if (data.nodes.length > 0 && fgRef.current) {
      setTimeout(() => fgRef.current?.zoomToFit(600, 80), 800);
    }
  }, [data]);

  /* Custom node: glowing sphere + floating label */
  const nodeThreeObject = useCallback((node: any) => {
    const color = NODE_COLOR[node.type] ?? '#ffffff';
    const size  = NODE_SIZE[node.type]  ?? 3;

    const group = new THREE.Group();

    /* Core sphere */
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(size, 16, 16),
      new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.95 }),
    );
    group.add(sphere);

    /* Outer glow shell */
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(size * 1.8, 16, 16),
      new THREE.MeshLambertMaterial({
        color,
        transparent: true,
        opacity: 0.08,
        side: THREE.BackSide,
      }),
    );
    group.add(glow);

    /* Floating text label */
    const label = new SpriteText(node.name);
    label.color           = color;
    label.textHeight      = 2.2;
    label.backgroundColor = 'rgba(5,8,15,0.75)';
    label.padding         = 2;
    label.borderRadius    = 3;
    label.fontFace        = 'JetBrains Mono, monospace';
    (label as any).position.y = size + 5;
    group.add(label);

    return group;
  }, []);

  /* Link colour by target node type */
  const linkColor = useCallback(() => 'rgba(0,210,255,0.15)', []);

  /* ── Empty state ── */
  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div style={styles.empty}>
        <Network size={40} color="var(--text-3)" style={{ marginBottom: 16 }} />
        <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 6 }}>No graph loaded</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Analyze a repository to visualize its structure</div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <ForceGraph3D
        ref={fgRef}
        graphData={data}
        nodeId="id"
        nodeLabel="name"
        nodeColor={(n: any) => NODE_COLOR[n.type] ?? '#ffffff'}
        nodeVal={(n: any)   => NODE_SIZE[n.type]  ?? 3}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        linkColor={linkColor}
        linkWidth={0.4}
        linkOpacity={0.4}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkDirectionalArrowColor={linkColor}
        linkDirectionalParticles={1}
        linkDirectionalParticleWidth={1.2}
        linkDirectionalParticleColor={() => 'rgba(0,210,255,0.6)'}
        backgroundColor="#05080f"
        showNavInfo={false}
        enableNodeDrag
        onNodeClick={(node: any) => fgRef.current?.centerAt(node.x, node.y, 500)}
      />

      {/* Legend overlay */}
      <div style={styles.legend} className="glass">
        {Object.entries(NODE_COLOR).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: color,
              boxShadow: `0 0 6px ${color}`,
              display: 'inline-block',
            }} />
            <span style={{ fontSize: 10, color: 'var(--text-2)' }}>{type}</span>
          </div>
        ))}
        <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 10, marginLeft: 4 }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>
            {data.nodes.length} nodes · {data.links.length} edges
          </span>
        </div>
      </div>

      {/* Controls hint */}
      <div style={styles.hint} className="glass">
        <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>
          drag to rotate · scroll to zoom · click node to focus
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    flex: 1,
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
  },
  legend: {
    position: 'absolute',
    top: 12,
    left: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '6px 12px',
    borderRadius: 8,
    pointerEvents: 'none',
    zIndex: 10,
  },
  hint: {
    position: 'absolute',
    bottom: 12,
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '4px 12px',
    borderRadius: 20,
    pointerEvents: 'none',
    zIndex: 10,
  },
};
