export interface ApiGraphNode {
  id: string;
  label: 'File' | 'Class' | 'Function';
  data: Record<string, string>;
}

export interface ApiGraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface GraphData {
  nodes: ApiGraphNode[];
  edges: ApiGraphEdge[];
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
}
