const dbus = require("@homebridge/dbus-native");

const BROKER_SERVICE = "com.microsoft.identity.broker1";
const BROKER_PATH = "/com/microsoft/identity/broker1";
const BROKER_INTERFACE = "com.microsoft.identity.Broker1";
const PROTOCOL_VERSION = "0.0";
const ACCOUNT_CLIENT_ID = "88200948-af09-45a1-9c03-53cdcc75c183";
const SSO_CLIENT_ID = "d7b530a4-7680-4c23-a8bf-c52c121d2e87";
const LOG_PREFIX = "[INTUNE_SSO]";

const sessionBus = dbus.sessionBus();

let intuneAccount = null;

function invokeBrokerMethod(methodName, request, correlationId = "") {
  return new Promise((resolve, reject) => {
    sessionBus.invoke(
      {
        destination: BROKER_SERVICE,
        path: BROKER_PATH,
        interface: BROKER_INTERFACE,
        member: methodName,
        signature: "sss",
        body: [PROTOCOL_VERSION, correlationId, JSON.stringify(request)],
      },
      (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(result);
      }
    );
  });
}

function extractCookieContent(response) {
  if (
    Array.isArray(response.cookieItems) &&
    response.cookieItems.length > 0 &&
    response.cookieItems[0].cookieContent
  ) {
    return response.cookieItems[0].cookieContent;
  }

  return response.cookieContent || null;
}

function getAccountsRequest() {
  return {
    clientId: ACCOUNT_CLIENT_ID,
    redirectUri: "urn:ietf:oob",
  };
}

async function getBrokerAccounts() {
  return invokeBrokerMethod("getAccounts", getAccountsRequest());
}

async function waitForBrokerReady(retries = 10, delay = 500) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await getBrokerAccounts();
      return;
    } catch (error) {
      if (error?.name === "org.freedesktop.DBus.Error.ServiceUnknown") {
        throw new Error("Microsoft Identity Broker D-Bus service is unavailable");
      }

      if (attempt === retries) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

function selectBrokerAccount(responseText, configuredUser) {
  const response = JSON.parse(responseText);

  if (response.error) {
    console.warn(`${LOG_PREFIX} Broker account query failed`, {
      errorCode: response.error.code || "unknown",
    });
    return;
  }

  const accounts = Array.isArray(response.accounts) ? response.accounts : [];
  console.info(`${LOG_PREFIX} Broker accounts returned`, {
    count: accounts.length,
    hasConfiguredUser: Boolean(configuredUser),
  });

  if (accounts.length === 0) {
    console.warn(`${LOG_PREFIX} No broker accounts found`);
    return;
  }

  if (!configuredUser) {
    intuneAccount = accounts[0];
    console.info(`${LOG_PREFIX} Using first broker account`);
    return;
  }

  const configuredUserLower = configuredUser.toLowerCase();
  intuneAccount = accounts.find(
    (account) => account.username?.toLowerCase() === configuredUserLower
  );

  if (intuneAccount) {
    console.info(`${LOG_PREFIX} Matching broker account found`);
  } else if (accounts.length === 1) {
    intuneAccount = accounts[0];
    console.warn(`${LOG_PREFIX} Matching broker account missing; using only broker account`);
  } else {
    console.warn(`${LOG_PREFIX} Matching broker account missing`);
  }
}

function buildPrtSsoCookieRequest(ssoUrl) {
  return {
    account: intuneAccount,
    authParameters: {
      account: intuneAccount,
      additionalQueryParametersForAuthorization: {},
      authority: "https://login.microsoftonline.com/common",
      authorizationType: 8,
      clientId: SSO_CLIENT_ID,
      redirectUri: "https://login.microsoftonline.com/common/oauth2/nativeclient",
      requestedScopes: ["openid", "profile", "offline_access"],
      username: intuneAccount.username,
      uxContextHandle: -1,
      ssoUrl,
    },
    mamEnrollment: false,
    ssoUrl,
  };
}

function safeCallback(callback, requestHeaders) {
  callback({ requestHeaders });
}

async function addSsoCookieAsync(detail, callback) {
  try {
    const responseText = await invokeBrokerMethod(
      "acquirePrtSsoCookie",
      buildPrtSsoCookieRequest(detail.url)
    );
    const response = JSON.parse(responseText);

    if (response.error) {
      console.warn(`${LOG_PREFIX} Credential request failure`, {
        errorCode: response.error.code || "unknown",
      });
      safeCallback(callback, detail.requestHeaders);
      return;
    }

    const cookieContent = extractCookieContent(response);
    if (!cookieContent) {
      console.warn(`${LOG_PREFIX} Credential response missing cookie content`);
      safeCallback(callback, detail.requestHeaders);
      return;
    }

    detail.requestHeaders["X-Ms-Refreshtokencredential"] = cookieContent;
    console.info(`${LOG_PREFIX} SSO credential added to request`);
  } catch (error) {
    console.warn(`${LOG_PREFIX} Credential request failure`, {
      error: error.message || error,
    });
  }

  safeCallback(callback, detail.requestHeaders);
}

async function initSso(configuredUser) {
  intuneAccount = null;
  console.info(`${LOG_PREFIX} Broker initialization start`, {
    hasConfiguredUser: Boolean(configuredUser),
  });

  try {
    await waitForBrokerReady();
    const accountsResponse = await getBrokerAccounts();
    selectBrokerAccount(accountsResponse, configuredUser);
  } catch (error) {
    console.warn(`${LOG_PREFIX} Broker unavailable`, {
      error: error.message || error,
    });
  }
}

function setupUrlFilter(filter) {
  filter.urls.push("https://login.microsoftonline.com/*");
}

function isSsoUrl(url) {
  return (
    intuneAccount != null &&
    typeof url === "string" &&
    url.startsWith("https://login.microsoftonline.com/")
  );
}

function addSsoCookie(detail, callback) {
  if (intuneAccount == null) {
    safeCallback(callback, detail.requestHeaders);
    return;
  }

  addSsoCookieAsync(detail, callback).catch((error) => {
    console.warn(`${LOG_PREFIX} Credential request failure`, {
      error: error.message || error,
    });
    safeCallback(callback, detail.requestHeaders);
  });
}

module.exports = {
  initSso,
  setupUrlFilter,
  isSsoUrl,
  addSsoCookie,
};
