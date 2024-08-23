import { ActionFunction, json, LoaderFunctionArgs, MetaFunction, redirect } from "@remix-run/node";
import { useNavigate, useOutlet } from "@remix-run/react";
import { getTranslations } from "~/locale/i18next.server";
import { useState } from "react";
import UrlUtils from "~/utils/app/UrlUtils";
import LinkedAccountsTable from "~/components/app/linkedAccounts/LinkedAccountsTable";
import { getLinkedAccounts, getLinkedAccount, updateLinkedAccount, deleteLinkedAccount, LinkedAccountWithDetails } from "~/utils/db/linkedAccounts.db.server";
import { getTenantIdFromUrl } from "~/utils/services/.server/urlService";
import { useAppData } from "~/utils/data/useAppData";
import { loadAppData } from "~/utils/data/.server/appData";
import { getUser } from "~/utils/db/users.db.server";
import { LinkedAccountStatus } from "~/application/enums/tenants/LinkedAccountStatus";
import { sendEmail } from "~/utils/email.server";
import InputSearch from "~/components/ui/input/InputSearch";
import { getUserHasPermission } from "~/utils/helpers/PermissionsHelper";
import { verifyUserHasPermission } from "~/utils/helpers/.server/PermissionsService";
import { getBaseURL } from "~/utils/url.server";
import SlideOverWideEmpty from "~/components/ui/slideOvers/SlideOverWideEmpty";
import { useTypedLoaderData } from "remix-typedjson";
import { createMetrics } from "~/modules/metrics/services/.server/MetricTracker";
import { getAppConfiguration } from "~/utils/db/appConfiguration.db.server";

type LoaderData = {
  title: string;
  items: LinkedAccountWithDetails[];
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { t } = await getTranslations(request);
  const tenantId = await getTenantIdFromUrl(params);
  await verifyUserHasPermission(request, "app.settings.linkedAccounts.view", tenantId);
  const appConfiguration = await getAppConfiguration({ request });
  if (!appConfiguration.app.features.linkedAccounts) {
    return redirect(UrlUtils.currentTenantUrl(params, "settings"));
  }

  const items = await getLinkedAccounts(tenantId);
  const data: LoaderData = {
    title: `${t("models.linkedAccount.plural")} | ${process.env.APP_NAME}`,
    items,
  };
  return json(data);
};

type ActionData = {
  error?: string;
  success?: string;
  items?: LinkedAccountWithDetails[];
};
const badRequest = (data: ActionData) => json(data, { status: 400 });
export const action: ActionFunction = async ({ request, params }) => {
  const { time, getServerTimingHeader } = await createMetrics({ request, params }, "app.$tenant.settings.linked-accounts");
  const { t } = await getTranslations(request);
  const appData = await time(loadAppData({ request, params, t }, time), "loadAppData");

  const form = await request.formData();
  const action = form.get("action")?.toString();
  const linkedAccountId = form.get("linked-account-id")?.toString();
  if (!linkedAccountId) {
    return badRequest({ error: "Invalid tenant relationship" });
  }
  const existing = await getLinkedAccount(linkedAccountId);
  if (!existing) {
    return badRequest({ error: t("shared.notFound") });
  }

  if (action === "delete") {
    await deleteLinkedAccount(existing.id);
    return redirect(UrlUtils.currentTenantUrl(params, "settings/linked-accounts"));
  } else if (action === "update-status") {
    const accepted = form.get("accepted")?.toString() === "true";
    const user = await getUser(existing?.createdByUserId);
    if (!user) {
      return badRequest({
        error: "Invalid user",
      });
    }

    await updateLinkedAccount(linkedAccountId, {
      status: accepted ? LinkedAccountStatus.LINKED : LinkedAccountStatus.REJECTED,
    });

    const relatedTenant = existing.providerTenantId === appData.currentTenant.id ? existing.clientTenant : existing.providerTenant;
    if (accepted) {
      await sendEmail({
        request,
        to: user.email,
        alias: "linked-account-accepted",
        data: {
          action_url: getBaseURL(request) + `/app/${relatedTenant.slug}/settings/linked-accounts`,
          name: user.firstName,
          user_invitee_name: appData.user?.firstName,
          user_invitee_email: appData.user?.email,
          tenant_invitee: appData.currentTenant?.name,
          action_text: "View tenant relationships",
        },
      });
    } else {
      await sendEmail({
        request,
        to: user.email,
        alias: "linked-account-rejected",
        data: {
          action_url: getBaseURL(request) + `/app/${relatedTenant.slug}/settings/linked-accounts`,
          name: user.firstName,
          email: appData.user?.email,
          tenant: appData.currentTenant?.name,
          action_text: "View tenant relationships",
        },
      });
    }

    const tenantId = await getTenantIdFromUrl(params);
    return json(
      {
        items: await getLinkedAccounts(tenantId, LinkedAccountStatus.PENDING),
      },
      {
        headers: getServerTimingHeader(),
      }
    );
  }
};

export const meta: MetaFunction<typeof loader> = ({ data }) => [{ title: data?.title }];

export default function LinkedAccountsRoute() {
  const data = useTypedLoaderData<LoaderData>();
  const appData = useAppData();
  const outlet = useOutlet();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState("");

  const filteredItems = () => {
    if (!data.items) {
      return [];
    }
    return data.items.filter(
      (f) =>
        f.clientTenant.name?.toString().toUpperCase().includes(searchInput.toUpperCase()) ||
        f.providerTenant.name?.toString().toUpperCase().includes(searchInput.toUpperCase())
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-2 px-4 py-4 sm:px-6 lg:px-8 xl:max-w-7xl">
      <div>
        <div>
          <div className="space-y-2">
            <InputSearch
              value={searchInput}
              setValue={setSearchInput}
              onNewRoute={getUserHasPermission(appData, "app.settings.linkedAccounts.create") ? "new" : ""}
            />
            <LinkedAccountsTable items={filteredItems()} canDelete={getUserHasPermission(appData, "app.settings.linkedAccounts.delete")} />
          </div>
        </div>
      </div>

      <SlideOverWideEmpty
        withTitle={false}
        withClose={false}
        title={""}
        open={!!outlet}
        onClose={() => {
          navigate(".", { replace: true });
        }}
        className="sm:max-w-sm"
        overflowYScroll={true}
      >
        <div className="space-y-4">{outlet}</div>
      </SlideOverWideEmpty>
    </div>
  );
}
