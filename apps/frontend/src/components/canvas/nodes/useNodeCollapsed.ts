import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

// Keep collapse state on node.data so header clicks, context-menu toggles,
// Collapse-All, and keyboard shortcuts all read/write the same field.
// Local useState diverges when those other paths mutate data.collapsed.
export function useNodeCollapsed(nodeId: string, dataCollapsed: boolean | undefined) {
  const { setNodes } = useReactFlow();
  const collapsed = dataCollapsed ?? false;
  const toggleCollapsed = useCallback(() => {
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
  }, [setNodes, nodeId]);
  return { collapsed, toggleCollapsed };
}
