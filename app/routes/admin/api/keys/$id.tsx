import { Tenant } from "@prisma/client";
import { ActionFunction, json, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import { useTypedLoaderData } from "remix-typedjson";
import ApiKeyForm from "~/components/core/apiKeys/ApiKeyForm";
import OpenModal from "~/components/ui/modals/OpenModal";
import { getTranslations } from "~/locale/i18next.server";
import { useAdminData } from "~/utils/data/useAdminData";
import { ApiKeyWithDetails, deleteApiKey, getApiKeyById, getApiKeys, updateApiKey } from "~/utils/db/apiKeys.db.server";
import { createAdminLog } from "~/utils/db/logs.db.server";
import { adminGetAllTenants } from "~/utils/db/tenants.db.server";
import { getUserHasPermission } from "~/utils/helpers/PermissionsHelper";
import { verifyUserHasPermission } from "~/utils/helpers/.server/PermissionsService";

type LoaderData = {
  tenants: Tenant[];
  item: ApiKeyWithDetails;
};
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const item = await getApiKeyById(params.id ?? "");
  if (!item) {
    return redirect("/admin/api");
  }
  const tenants = await adminGetAllTenants();
  const data: LoaderData = {
    item,
    tenants,
  };
  return json(data);
};

type ActionData = {
  error?: string;
};
const badRequest = (data: ActionData) => json(data, { status: 400 });
export const action: ActionFunction = async ({ request, params }) => {
  const { t } = await getTranslations(request);
  const form = await request.formData();
  const action = form.get("action")?.toString() ?? "";
  const existing = await getApiKeyById(params.id ?? "");
  if (!existing) {
    return badRequest({ error: t("shared.notFound") });
  }
  if (action === "edit") {
    await verifyUserHasPermission(request, "admin.apiKeys.update");
    const entities: { entityId: string; create: boolean; read: boolean; update: boolean; delete: boolean }[] = form
      .getAll("entities[]")
      .map((f: FormDataEntryValue) => {
        return JSON.parse(f.toString());
      });
    let expirationDate: Date | null = null;
    let expires = form.get("expires")?.toString();
    if (expires) {
      expirationDate = new Date(expires);
    }
    const tenantId = form.get("tenant-id")?.toString() ?? "";
    const alias = form.get("alias")?.toString() ?? "";
    const existingAlias = await getApiKeys(tenantId);
    if (existingAlias.filter((f) => f.id !== existing.id && f.alias === alias).length > 0) {
      return badRequest({ error: "API key with this alias already exists: " + alias });
    }
    const active = Boolean(form.get("active"));
    await updateApiKey(
      params.id ?? "",
      {
        tenantId,
        alias,
        expires: expirationDate,
        active,
      },
      entities
    );
    await createAdminLog(request, "API Key Updated", JSON.stringify({ tenantId, alias, expirationDate, active, entities }));
    return redirect(`/admin/api/keys`);
  } else if (action === "delete") {
    await verifyUserHasPermission(request, "admin.apiKeys.delete");
    await deleteApiKey(params.id ?? "");
    await createAdminLog(request, "API Key Deleted", "");
    return redirect(`/admin/api/keys`);
  } else {
    return badRequest({ error: t("shared.invalidForm") });
  }
};

export default function AdminApiEditKeyRoute() {
  const data = useTypedLoaderData<LoaderData>();
  const navigate = useNavigate();
  const adminData = useAdminData();
  return (
    <>
      <OpenModal className="sm:max-w-xl" onClose={() => navigate(`/admin/api`)}>
        <ApiKeyForm
          entities={adminData.entities}
          tenants={data.tenants}
          item={data.item}
          canUpdate={getUserHasPermission(adminData, "admin.apiKeys.update")}
          canDelete={getUserHasPermission(adminData, "admin.apiKeys.delete")}
        />
      </OpenModal>
    </>
  );
}
