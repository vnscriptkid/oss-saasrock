import { useTypedActionData, useTypedLoaderData } from "remix-typedjson";
import { Link, Outlet, useParams, useSearchParams, useSubmit } from "@remix-run/react";
import TabsWithIcons from "~/components/ui/tabs/TabsWithIcons";
import ButtonPrimary from "~/components/ui/buttons/ButtonPrimary";
import PlusIcon from "~/components/ui/icons/PlusIcon";
import TableSimple from "~/components/ui/tables/TableSimple";
import InputCheckbox from "~/components/ui/input/InputCheckbox";
import DateCell from "~/components/ui/dates/DateCell";
import ButtonSecondary from "~/components/ui/buttons/ButtonSecondary";
import { useEffect, useRef } from "react";
import ConfirmModal, { RefConfirmModal } from "~/components/ui/modals/ConfirmModal";
import { WorkflowDto } from "~/modules/workflowEngine/dtos/WorkflowDto";
import NumberUtils from "~/utils/shared/NumberUtils";
import { WorkflowsIndexApi } from "./workflows.index.api.server";
import UrlUtils from "~/utils/app/UrlUtils";
import toast from "react-hot-toast";
import TenantBadge from "~/components/core/tenants/TenantBadge";
import { useTranslation } from "react-i18next";

export default function WorkflowsIndexView() {
  const { t } = useTranslation();
  const params = useParams();
  const data = useTypedLoaderData<WorkflowsIndexApi.LoaderData>();
  const actionData = useTypedActionData<WorkflowsIndexApi.ActionData>();
  const submit = useSubmit();

  const confirmDelete = useRef<RefConfirmModal>(null);

  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (actionData?.success) {
      toast.success(actionData.success, { position: "bottom-right" });
    } else if (actionData?.error) {
      toast.error(actionData.error, { position: "bottom-right" });
    }
  }, [actionData]);

  function countStatus(status?: "live" | "draft" | "archived") {
    if (status === undefined) {
      return data.items.length;
    }
    return data.items.filter((item) => item.status === status).length;
  }
  function onToggle(item: WorkflowDto, type: string, enabled: boolean) {
    const form = new FormData();
    form.set("action", type);
    form.set("enabled", enabled ? "true" : "false");
    form.set("id", item.id.toString() ?? "");
    submit(form, {
      method: "post",
    });
  }
  function onNew() {
    const form = new FormData();
    form.set("action", "create");
    submit(form, {
      method: "post",
    });
  }
  function onDelete(item: WorkflowDto) {
    confirmDelete.current?.setValue(item);
    confirmDelete.current?.show("Are you sure you want to delete this workflow?", "Delete", "No", "All blocks and executions will be deleted.");
  }
  function onDeleteConfirm(item: WorkflowDto) {
    const form = new FormData();
    form.set("action", "delete");
    form.set("id", item.id.toString() ?? "");
    submit(form, {
      method: "post",
    });
  }
  function filteredItems() {
    const status = searchParams.get("status");
    if (["live", "draft", "archived"].includes(status ?? "")) {
      return data.items.filter((i) => i.status === status);
    }
    return data.items;
  }

  function onExport() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data.template, null, "\t"));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "workflows.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }
  return (
    <div className="mx-auto mb-12 max-w-5xl space-y-5 px-4 py-4 sm:px-6 lg:px-8 xl:max-w-7xl">
      <div className="flex items-center justify-between space-x-2">
        <div className="flex-grow">
          <TabsWithIcons
            tabs={[
              {
                name: `All ${countStatus() ? `(${countStatus()})` : ""}`,
                href: "?",
                current: !searchParams.get("status") || searchParams.get("status") === "all",
              },
              {
                name: `Live ${countStatus("live") ? `(${countStatus("live")})` : ""}`,
                href: "?status=live",
                current: searchParams.get("status") === "live",
              },
              {
                name: `Draft ${countStatus("draft") ? `(${countStatus("draft")})` : ""}`,
                href: "?status=draft",
                current: searchParams.get("status") === "draft",
              },
              {
                name: `Archived ${countStatus("archived") ? `(${countStatus("archived")})` : ""}`,
                href: "?status=archived",
                current: searchParams.get("status") === "archived",
              },
            ]}
          />
        </div>
        <div className="flex space-x-1">
          <ButtonSecondary to={UrlUtils.getModulePath(params, `workflow-engine/templates`)}>Templates</ButtonSecondary>
          <ButtonSecondary onClick={onExport} disabled={data.items.length === 0}>
            Export
          </ButtonSecondary>
          <ButtonPrimary onClick={onNew}>
            <div>New</div>
            <PlusIcon className="h-5 w-5" />
          </ButtonPrimary>
        </div>
      </div>

      <TableSimple
        items={filteredItems()}
        actions={[
          {
            title: "Edit",
            onClickRoute: (_, i) => `${i.id}`,
          },
          {
            title: "Delete",
            onClick: (_, i) => onDelete(i),
            destructive: true,
          },
        ]}
        headers={[
          {
            name: "status",
            title: "Status",
            value: (i) => <InputCheckbox asToggle value={i.status === "live"} setValue={(checked) => onToggle(i, "toggle-status", Boolean(checked))} />,
          },
          {
            name: "tenant",
            title: t("models.tenant.object"),
            value: (i) => (i.tenant ? <TenantBadge item={i.tenant} /> : <span className="italic text-gray-600">Admin</span>),
            hidden: !!params.tenant,
          },
          {
            name: "title",
            title: "Title",
            className: "w-full",
            value: (i) => (
              <div className="flex flex-col">
                <div className="flex flex-col">
                  <Link to={`${i.id}`} className="text-base font-bold hover:underline">
                    {i.name}
                  </Link>
                  <div className="text-xs text-gray-500">{i.description || "No description"}</div>
                </div>
              </div>
            ),
          },
          {
            name: "blocks",
            title: "Blocks",
            value: (i) => (
              <Link to={`${i.id}`} className="text-sm text-gray-500 underline hover:text-gray-800">
                {NumberUtils.numberFormat(i.blocks.length)}
              </Link>
            ),
          },
          {
            name: "executions",
            title: "Executions",
            value: (i) => (
              <Link to={`${i.id}/executions`} className="text-sm text-gray-500 underline hover:text-gray-800">
                {NumberUtils.numberFormat(i._count.executions)}
              </Link>
            ),
          },
          {
            name: "createdAt",
            title: "Created at",
            value: (i) => <DateCell date={i.createdAt ?? null} />,
          },
        ]}
        noRecords={
          <div className="p-12 text-center">
            <h3 className="mt-1 text-sm font-medium text-gray-900">{"No workflows"}</h3>
            <p className="mt-1 text-sm text-gray-500">{"Get started by creating a new workflow"}</p>
          </div>
        }
      />

      <ConfirmModal ref={confirmDelete} onYes={onDeleteConfirm} destructive />

      <Outlet />
    </div>
  );
}
