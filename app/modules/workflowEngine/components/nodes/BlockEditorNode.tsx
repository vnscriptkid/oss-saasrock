import { Position, Handle, NodeProps } from "reactflow";
import { WorkflowBlockDto } from "../../dtos/WorkflowBlockDto";
import { WorkflowBlockTypes } from "../../dtos/WorkflowBlockTypes";
import WorkflowContext from "../../context/WorkflowContext";
import { useContext, useEffect, useState } from "react";
import WorkflowBlockUtils from "../../helpers/WorkflowBlockUtils";
import { WorkflowDto } from "../../dtos/WorkflowDto";
import clsx from "clsx";

export default function BlockEditorNode({ id, data }: NodeProps) {
  const { onNodeDelete, isNodeSelected } = useContext(WorkflowContext);
  const block = data.block as WorkflowBlockDto;
  const workflow = data.workflow as WorkflowDto;
  const workflowBlock = WorkflowBlockTypes.find((x) => x.value === block.type);

  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => {
    setErrors(WorkflowBlockUtils.getBlockErrors({ workflow, block }));
  }, [workflow, block]);

  if (!workflow) {
    return <div>Unknown workflow</div>;
  }
  if (!workflowBlock) {
    return <div>Unknown block type: {block.type}</div>;
  }
  return (
    <button
      type="button"
      className={clsx(
        "relative flex h-[80px] w-[250px] flex-col justify-center rounded-md border p-2 text-left focus:ring-1 focus:ring-blue-600 focus:ring-offset-2",
        isNodeSelected(id) ? "bg-blue-50 ring-1 ring-blue-600 ring-offset-2" : "bg-white",
        errors.length ? "border-red-300" : "border-slate-300"
      )}
      onKeyDown={(e) => {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          e.stopPropagation();
          onNodeDelete(block.id);
        }
      }}
    >
      <div className="w-full space-y-2">
        <div className="flex justify-between space-x-2">
          <div className="flex items-center space-x-2 truncate">
            <workflowBlock.icon className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <div className="truncate text-sm font-medium text-gray-700">{workflowBlock.name}</div>
          </div>
          <div>
            <div
              className={clsx(
                "rounded-md border px-2 py-1 text-xs",
                workflowBlock.type === "trigger" ? "border-yellow-200 bg-yellow-50 text-yellow-800" : "border-gray-200 bg-gray-50 text-gray-500"
              )}
            >
              {workflowBlock.type === "trigger" ? <span>Trigger</span> : <span>{workflowBlock.category}</span>}
            </div>
          </div>
        </div>
        <div className="border-border border-t" />
        {errors.length > 0 ? (
          <div>
            <div className="line-clamp-1 text-xs text-red-500">{errors.join(", ")}</div>
          </div>
        ) : (
          <div className=" line-clamp-1 text-xs text-gray-500">{block.description || "No description"}</div>
        )}

        {workflowBlock.type === "action" && (
          <Handle type="target" position={Position.Top} id="in" style={{ opacity: 0, width: "100%", height: "100%", top: 0 }} />
        )}

        <Handle
          type="source"
          position={Position.Bottom}
          id="out"
          style={{
            bottom: "-7px",
            left: "calc(50%)",
            width: "15px",
            height: "15px",
            background: "#fff",
            border: "1px solid #2563eb",
          }}
        />
      </div>
    </button>
  );
}
