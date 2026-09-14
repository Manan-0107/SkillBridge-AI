import { RoadmapNode } from "@/types/roadmap";

export interface NodeLayout {
  id: string;
  node: RoadmapNode;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  branch: number;
}

export interface ConnectorLayout {
  id: string;
  fromId: string;
  toId: string;
  path: string;
  fromPoint: { x: number; y: number };
  toPoint: { x: number; y: number };
}

export interface GraphLayoutResult {
  nodes: NodeLayout[];
  connectors: ConnectorLayout[];
  canvasWidth: number;
  canvasHeight: number;
  nodeMap: Map<string, NodeLayout>;
}

export interface SelectionGraph {
  selectedId: string | null;
  directParentIds: Set<string>;
  directChildIds: Set<string>;
  allAncestorIds: Set<string>;
  allDescendantIds: Set<string>;
}

/**
 * Pure function: Computes the ancestor chain and descendant subtree for a selected node.
 */
export function computeAncestorsAndDescendants(
  selectedId: string | null,
  nodes: RoadmapNode[]
): SelectionGraph {
  if (!selectedId) {
    return {
      selectedId: null,
      directParentIds: new Set(),
      directChildIds: new Set(),
      allAncestorIds: new Set(),
      allDescendantIds: new Set(),
    };
  }

  const nodeMap = new Map<string, RoadmapNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const target = nodeMap.get(selectedId);
  if (!target) {
    return {
      selectedId: null,
      directParentIds: new Set(),
      directChildIds: new Set(),
      allAncestorIds: new Set(),
      allDescendantIds: new Set(),
    };
  }

  const directParentIds = new Set(target.parentIds);
  const directChildIds = new Set(target.children);

  // Traverse Ancestors
  const allAncestorIds = new Set<string>();
  const parentQueue = [...target.parentIds];
  while (parentQueue.length > 0) {
    const pId = parentQueue.shift()!;
    if (!allAncestorIds.has(pId)) {
      allAncestorIds.add(pId);
      const pNode = nodeMap.get(pId);
      if (pNode) {
        parentQueue.push(...pNode.parentIds);
      }
    }
  }

  // Traverse Descendants
  const allDescendantIds = new Set<string>();
  const childQueue = [...target.children];
  while (childQueue.length > 0) {
    const cId = childQueue.shift()!;
    if (!allDescendantIds.has(cId)) {
      allDescendantIds.add(cId);
      const cNode = nodeMap.get(cId);
      if (cNode) {
        childQueue.push(...cNode.children);
      }
    }
  }

  return {
    selectedId,
    directParentIds,
    directChildIds,
    allAncestorIds,
    allDescendantIds,
  };
}

/**
 * Pure function: Computes 2D tree layout coordinates and SVG cubic bezier connectors.
 * Arranges nodes into vertical depth tiers with deliberate asymmetric branch offsets.
 */
export function computeGraphLayout(
  nodes: RoadmapNode[],
  containerWidth: number = 960
): GraphLayoutResult {
  if (nodes.length === 0) {
    return {
      nodes: [],
      connectors: [],
      canvasWidth: containerWidth,
      canvasHeight: 400,
      nodeMap: new Map(),
    };
  }

  // Group nodes by depth
  const depthGroups = new Map<number, RoadmapNode[]>();
  nodes.forEach((node) => {
    const depth = node.depth ?? 0;
    if (!depthGroups.has(depth)) depthGroups.set(depth, []);
    depthGroups.get(depth)!.push(node);
  });

  const sortedDepths = Array.from(depthGroups.keys()).sort((a, b) => a - b);

  const centerX = Math.max(containerWidth / 2, 400);
  const verticalSpacing = 160;
  const initialTopPadding = 60;
  const bottomPadding = 120;

  const nodeLayouts: NodeLayout[] = [];
  const nodeMap = new Map<string, NodeLayout>();

  let currentY = initialTopPadding;

  sortedDepths.forEach((depth) => {
    const tierNodes = depthGroups.get(depth)!;
    tierNodes.sort((a, b) => {
      const orderA = a.position?.order ?? 0;
      const orderB = b.position?.order ?? 0;
      return orderA - orderB;
    });

    const tierCount = tierNodes.length;
    // Compute horizontal offsets based on explicit branch definition or tier position
    tierNodes.forEach((node, index) => {
      let branch = node.position?.branch ?? 0;
      if (branch === 0 && tierCount > 1) {
        // Asymmetric branch arrangement if not explicitly defined
        branch = index % 2 === 0 ? -1 : 1;
        if (tierCount === 3 && index === 1) branch = 0;
      }

      // Variable node sizing by depth / importance
      let width = 260;
      let height = 86;
      if (depth === 0) {
        width = 280;
        height = 92;
      } else if (node.children.length === 0 && depth > 3) {
        width = 240;
        height = 80;
      }

      // Calculate horizontal positioning with asymmetric branch displacement
      let nodeX: number;
      if (branch === 0) {
        nodeX = centerX - width / 2;
      } else if (branch < 0) {
        const offset = Math.abs(branch) * 220 + (index % 2 === 1 ? 30 : 0);
        nodeX = centerX - width / 2 - offset;
      } else {
        const offset = branch * 230 + (index % 2 === 0 ? 35 : 0);
        nodeX = centerX - width / 2 + offset;
      }

      // Add gentle vertical organic stagger for multi-node tiers
      const staggerY = tierCount > 1 ? (index % 2 === 1 ? 24 : -12) : 0;
      const nodeY = currentY + staggerY;

      const layoutItem: NodeLayout = {
        id: node.id,
        node,
        x: nodeX,
        y: nodeY,
        width,
        height,
        depth,
        branch,
      };

      nodeLayouts.push(layoutItem);
      nodeMap.set(node.id, layoutItem);
    });

    currentY += verticalSpacing;
  });

  // Compute SVG Connectors between nodes
  const connectors: ConnectorLayout[] = [];

  nodes.forEach((node) => {
    const fromLayout = nodeMap.get(node.id);
    if (!fromLayout) return;

    node.children.forEach((childId) => {
      const toLayout = nodeMap.get(childId);
      if (!toLayout) return;

      const startX = fromLayout.x + fromLayout.width / 2;
      const startY = fromLayout.y + fromLayout.height;
      const endX = toLayout.x + toLayout.width / 2;
      const endY = toLayout.y;

      const deltaY = endY - startY;
      const controlY1 = startY + Math.max(deltaY * 0.45, 30);
      const controlY2 = endY - Math.max(deltaY * 0.45, 30);

      // Smooth Cubic Bezier SVG path
      const path = `M ${startX.toFixed(1)} ${startY.toFixed(1)} C ${startX.toFixed(1)} ${controlY1.toFixed(1)}, ${endX.toFixed(1)} ${controlY2.toFixed(1)}, ${endX.toFixed(1)} ${endY.toFixed(1)}`;

      connectors.push({
        id: `${node.id}->${childId}`,
        fromId: node.id,
        toId: childId,
        path,
        fromPoint: { x: startX, y: startY },
        toPoint: { x: endX, y: endY },
      });
    });
  });

  const minX = Math.min(...nodeLayouts.map((n) => n.x), 0);
  const maxX = Math.max(...nodeLayouts.map((n) => n.x + n.width), containerWidth);
  const totalWidth = Math.max(maxX - minX + 80, containerWidth);
  const totalHeight = currentY + bottomPadding;

  return {
    nodes: nodeLayouts,
    connectors,
    canvasWidth: totalWidth,
    canvasHeight: totalHeight,
    nodeMap,
  };
}
