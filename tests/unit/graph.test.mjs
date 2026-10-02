import test from "node:test";
import assert from "node:assert/strict";

// Test data
const sampleNodes = [
  {
    id: "node-root",
    title: "Root Node",
    description: "First step",
    status: "completed",
    track: "frontend",
    depth: 0,
    parentIds: [],
    children: ["node-child-1", "node-child-2"],
    concepts: [{ id: "c1", label: "Concept 1" }],
    prerequisites: [],
    resources: [],
    position: { branch: 0, order: 0 },
  },
  {
    id: "node-child-1",
    title: "Branch Left",
    description: "Second step A",
    status: "in-progress",
    track: "frontend",
    depth: 1,
    parentIds: ["node-root"],
    children: ["node-leaf"],
    concepts: [{ id: "c2", label: "Concept 2" }],
    prerequisites: ["node-root"],
    resources: [],
    position: { branch: -1, order: 0 },
  },
  {
    id: "node-child-2",
    title: "Branch Right",
    description: "Second step B",
    status: "planned",
    track: "frontend",
    depth: 1,
    parentIds: ["node-root"],
    children: [],
    concepts: [{ id: "c3", label: "Concept 3" }],
    prerequisites: ["node-root"],
    resources: [],
    position: { branch: 1, order: 1 },
  },
  {
    id: "node-leaf",
    title: "Leaf Node",
    description: "Final step",
    status: "planned",
    track: "frontend",
    depth: 2,
    parentIds: ["node-child-1"],
    children: [],
    concepts: [{ id: "c4", label: "Concept 4" }],
    prerequisites: ["node-child-1"],
    resources: [],
    position: { branch: 0, order: 0 },
  },
];

// Pure layout & ancestor logic mirrored for unit testing
function computeAncestorsAndDescendants(selectedId, nodes) {
  if (!selectedId) {
    return {
      selectedId: null,
      directParentIds: new Set(),
      directChildIds: new Set(),
      allAncestorIds: new Set(),
      allDescendantIds: new Set(),
    };
  }
  const map = new Map(nodes.map((n) => [n.id, n]));
  const target = map.get(selectedId);
  if (!target) {
    return {
      selectedId: null,
      directParentIds: new Set(),
      directChildIds: new Set(),
      allAncestorIds: new Set(),
      allDescendantIds: new Set(),
    };
  }
  const allAncestors = new Set();
  const qParent = [...target.parentIds];
  while (qParent.length > 0) {
    const p = qParent.shift();
    if (!allAncestors.has(p)) {
      allAncestors.add(p);
      const parentNode = map.get(p);
      if (parentNode) qParent.push(...parentNode.parentIds);
    }
  }

  const allDescendants = new Set();
  const qChild = [...target.children];
  while (qChild.length > 0) {
    const c = qChild.shift();
    if (!allDescendants.has(c)) {
      allDescendants.add(c);
      const childNode = map.get(c);
      if (childNode) qChild.push(...childNode.children);
    }
  }

  return {
    selectedId,
    directParentIds: new Set(target.parentIds),
    directChildIds: new Set(target.children),
    allAncestorIds: allAncestors,
    allDescendantIds: allDescendants,
  };
}

function computeBezierPath(startX, startY, endX, endY) {
  const deltaY = endY - startY;
  const controlY1 = startY + Math.max(deltaY * 0.45, 30);
  const controlY2 = endY - Math.max(deltaY * 0.45, 30);
  return `M ${startX.toFixed(1)} ${startY.toFixed(1)} C ${startX.toFixed(1)} ${controlY1.toFixed(1)}, ${endX.toFixed(1)} ${controlY2.toFixed(1)}, ${endX.toFixed(1)} ${endY.toFixed(1)}`;
}

test("computeAncestorsAndDescendants resolves multi-tier hierarchy correctly", () => {
  const leafSelection = computeAncestorsAndDescendants("node-leaf", sampleNodes);

  assert.equal(leafSelection.selectedId, "node-leaf");
  assert.equal(leafSelection.directParentIds.has("node-child-1"), true);
  assert.equal(leafSelection.allAncestorIds.has("node-child-1"), true);
  assert.equal(leafSelection.allAncestorIds.has("node-root"), true);
  assert.equal(leafSelection.allDescendantIds.size, 0);

  const rootSelection = computeAncestorsAndDescendants("node-root", sampleNodes);
  assert.equal(rootSelection.allAncestorIds.size, 0);
  assert.equal(rootSelection.allDescendantIds.has("node-child-1"), true);
  assert.equal(rootSelection.allDescendantIds.has("node-child-2"), true);
  assert.equal(rootSelection.allDescendantIds.has("node-leaf"), true);
});

test("computeBezierPath generates valid SVG cubic bezier syntax", () => {
  const path = computeBezierPath(100, 50, 200, 250);
  assert.match(path, /^M 100\.0 50\.0 C 100\.0 \d+\.\d+, 200\.0 \d+\.\d+, 200\.0 250\.0$/);
});
