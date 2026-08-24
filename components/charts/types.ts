export interface GraphNode {
  id: string;
  name: string;
  importance: number;
  mastery: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface ArtifactRef {
  id: string;
  title: string;
  kind: string;
}
