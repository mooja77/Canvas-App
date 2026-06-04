import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

// Keep collapse state on node.data so header clicks, context-menu toggles,
// Collapse-All, and keyboard shortcuts all read/write the same field.
// Local useState diverges when those other paths mutate data.collapsed.
export function useNodeCollapsed(nodeId: string, dataCollapsed: boolean | undefined) {
  const { setNodes, getNode } = useReactFlow();
  const collapsed = dataCollapsed ?? false;
  const toggleCollapsed = useCallback(() => {
    // Prefer the controlled toggle injected by CanvasWorkspace (onToggleCollapsed).
    // CanvasWorkspace renders controlled nodes (nodes={decoratedNodes} from
    // useNodesState), so writing via the React Flow store below is reverted by the
    // controlled prop on the next render — the header button would appear to do
    // nothing. The injected callback writes through the controlled state instead.
    const onToggleCollapsed = getNode(nodeId)?.data?.onToggleCollapsed as ((id: string) => void) | undefined;
    if (typeof onToggleCollapsed === 'function') {
      onToggleCollapsed(nodeId);
      return;
    }
    // Fallback (uncontrolled usage / tests): write directly to the store.
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                collapsed: !(n.data as Record<string, unknown>).collapsed,
              },
            }
          : n,
      ),
    );
  }, [setNodes, getNode, nodeId]);
  return { collapsed, toggleCollapsed };
}
