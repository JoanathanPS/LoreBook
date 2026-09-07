export interface UnderlyingConceptItem {
  name: string;
  brief: string;
  category?: string;
  importance?: number;
}

export interface ConceptDrilldownData {
  summary?: string;
  mechanisms?: string[];
  subconcepts?: UnderlyingConceptItem[];
  prerequisites?: string[];
  formulas?: string[];
  keyQuestions?: string[];
}

export interface GraphNode {
  id: string;
  name: string;
  importance: number;
  mastery: number;
  parentId?: string | null;
  description?: string | null;
  level?: number;
  underlyingData?: ConceptDrilldownData | null;
  childIds?: string[];
  childCount?: number;
}

export interface GraphEdge {
  id?: string;
  source: string;
  target: string;
  label?: string;
  kind?: "hierarchy" | "cooccurrence" | "prerequisite";
}

export interface ArtifactRef {
  id: string;
  title: string;
  kind: string;
}

export interface CourseMindMapData {
  courseId: string;
  courseName: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  artifactsByConcept: Record<string, ArtifactRef[]>;
}

