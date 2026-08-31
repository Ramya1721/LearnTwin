import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { api } from "../services/api";
import { Card, LoadingBlock, Badge, EmptyState } from "../components/ui";

interface GraphNode {
  id: string;
  name: string;
  difficulty: string;
  description: string;
}
interface GraphEdge {
  from: string;
  to: string;
}

export default function SkillsGraphPage() {
  const [domains, setDomains] = useState<string[]>([]);
  const [domain, setDomain] = useState<string>("");
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GraphNode | null>(null);

  useEffect(() => {
    api.get("/skills/domains").then((res) => {
      const list: string[] = res.data.domains || [];
      setDomains(list);
      if (list.length > 0) setDomain(list[0]);
      else setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!domain) return;
    setLoading(true);
    api
      .get("/skills/graph", { params: { domain } })
      .then((res) => {
        setNodes(res.data.nodes);
        setEdges(res.data.edges);
        setSelected(null);
      })
      .finally(() => setLoading(false));
  }, [domain]);

  const { layers, positions } = useMemo(() => computeLayers(nodes, edges), [nodes, edges]);

  const nodeW = 168;
  const nodeH = 56;
  const gapX = 48;
  const gapY = 36;
  const width = Math.max(600, layers.reduce((m, l) => Math.max(m, l.length), 0) * (nodeW + gapX));
  const height = layers.length * (nodeH + gapY) + gapY;

  return (
    <DashboardLayout title="Skills & Skill Graph" subtitle="Prerequisites flow upward — trace any failure back to its root.">
      {domains.length === 0 && !loading && (
        <Card className="mb-5">
          <EmptyState title="No skill graph yet" description="Complete onboarding to generate your learning path and skill graph." />
        </Card>
      )}

      <div className="flex gap-2 mb-5 flex-wrap">
        {domains.map((d) => (
          <button
            key={d}
            onClick={() => setDomain(d)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              domain === d ? "bg-signal-soft text-signal border border-signal-dim/40" : "bg-graphite-800 text-mist-300 border border-graphite-600 hover:bg-graphite-700"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card title="Dependency Graph" eyebrow={`${nodes.length} skills`} className="lg:col-span-2 overflow-x-auto">
          {loading ? (
            <LoadingBlock />
          ) : (
            <svg width={width} height={height} className="min-w-full">
              {edges.map((e, i) => {
                const from = positions[e.from];
                const to = positions[e.to];
                if (!from || !to) return null;
                const x1 = from.x + nodeW / 2;
                const y1 = from.y;
                const x2 = to.x + nodeW / 2;
                const y2 = to.y + nodeH;
                const midY = (y1 + y2) / 2;
                return (
                  <path
                    key={i}
                    d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                    fill="none"
                    stroke="#28303F"
                    strokeWidth={1.5}
                  />
                );
              })}
              {nodes.map((n) => {
                const pos = positions[n.id];
                if (!pos) return null;
                const isSelected = selected?.id === n.id;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="cursor-pointer"
                    onClick={() => setSelected(n)}
                  >
                    <rect
                      width={nodeW}
                      height={nodeH}
                      rx={10}
                      fill={isSelected ? "#1D2330" : "#151A24"}
                      stroke={isSelected ? "#2FE6D0" : "#28303F"}
                      strokeWidth={isSelected ? 1.5 : 1}
                    />
                    <text x={12} y={22} fill="#DDE1EA" fontSize={12} fontWeight={600} fontFamily="Inter, sans-serif">
                      {truncate(n.name, 20)}
                    </text>
                    <text x={12} y={40} fill="#8B93A7" fontSize={10} fontFamily="'IBM Plex Mono', monospace">
                      {n.difficulty}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </Card>

        <Card title="Skill Details" eyebrow="Selected node">
          {selected ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-mist-50">{selected.name}</p>
              <Badge tone={selected.difficulty === "ADVANCED" ? "alert" : selected.difficulty === "INTERMEDIATE" ? "twin" : "signal"}>
                {selected.difficulty}
              </Badge>
              <p className="text-sm text-mist-300 leading-relaxed">{selected.description}</p>
              <div>
                <p className="text-xs text-mist-400 mb-1">Direct prerequisites</p>
                <div className="flex flex-wrap gap-1.5">
                  {edges
                    .filter((e) => e.to === selected.id)
                    .map((e) => nodes.find((n) => n.id === e.from))
                    .filter(Boolean)
                    .map((p) => (
                      <Badge key={p!.id}>{p!.name}</Badge>
                    ))}
                  {edges.filter((e) => e.to === selected.id).length === 0 && (
                    <span className="text-xs text-mist-500">No prerequisites — foundational skill.</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-mist-400">Click any node in the graph to inspect it.</p>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/** Layered layout: layer = longest path from a root (skill with no prerequisites). */
function computeLayers(nodes: GraphNode[], edges: GraphEdge[]) {
  const incoming = new Map<string, string[]>(); // to -> [from,...]
  for (const e of edges) {
    if (!incoming.has(e.to)) incoming.set(e.to, []);
    incoming.get(e.to)!.push(e.from);
  }

  const layerOf = new Map<string, number>();
  function computeLayer(id: string, visiting: Set<string> = new Set()): number {
    if (layerOf.has(id)) return layerOf.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const prereqs = incoming.get(id) || [];
    const layer = prereqs.length === 0 ? 0 : Math.max(...prereqs.map((p) => computeLayer(p, visiting))) + 1;
    layerOf.set(id, layer);
    return layer;
  }
  for (const n of nodes) computeLayer(n.id);

  const maxLayer = Math.max(0, ...Array.from(layerOf.values()));
  const layers: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const n of nodes) layers[layerOf.get(n.id) ?? 0].push(n.id);

  const nodeW = 168;
  const nodeH = 56;
  const gapX = 48;
  const gapY = 36;

  const positions: Record<string, { x: number; y: number }> = {};
  layers.forEach((layerIds, layerIdx) => {
    layerIds.forEach((id, i) => {
      positions[id] = {
        x: i * (nodeW + gapX) + gapX / 2,
        y: (maxLayer - layerIdx) * (nodeH + gapY) + gapY / 2,
      };
    });
  });

  return { layers, positions };
}
