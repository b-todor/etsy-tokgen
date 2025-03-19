import express from "express";
import fetch from "node-fetch";
import "dotenv/config";

const app = express();
app.set("view engine", "hbs");
app.set("views", `${process.cwd()}/views`);

app.get("/", (_req, res) => {
  res.render("index");
});

app.use(express.urlencoded({ extended: false }));

const data = {
  access_token: null,
  amazon_access_token: null,
};

app.get("/connect", async (req, res) => {
  const url = "https://www.etsy.com/oauth/connect";

  const params = {
    response_type: "code",
    redirect_uri: process.env.REDIRECT_URI,
    client_id: process.env.CLIENT_ID,
    state: process.env.STATE,
    scope: process.env.SCOPE,
    code_challenge_method: "S256",
    code_challenge: process.env.CODE_CHALLENGE,
  };
  let queryString = "?";
  for (const [key, value] of Object.entries(params)) {
    queryString = queryString.concat("&", `${key}=${value}`);
  }

  const oauthUrl = url + queryString;
  console.log("Etsy oauth url", oauthUrl);

  res.redirect(oauthUrl);
});

app.get("/oauth/redirect", async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  if (state !== process.env.STATE) {
    console.error("State doesn't match");
    return;
  }

  const tokenUrl = "https://api.etsy.com/v3/public/oauth/token";
  const requestOptions = {
    method: "POST",
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: process.env.CLIENT_ID,
      redirect_uri: process.env.REDIRECT_URI,
      code: code,
      code_verifier: process.env.CODE_VERIFIER,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  };

  const response = await fetch(tokenUrl, requestOptions);
  if (response.ok) {
    const tokenData = await response.json();
    res.send(tokenData);
  } else {
    res.send("oops");
  }
});

app.post("/refresh", async (req, res) => {
  const refreshToken = req.body.ref;
  if (!refreshToken) {
    res.render("index");
  }

  const tokenUrl = "https://api.etsy.com/v3/public/oauth/token";
  const requestOptions = {
    method: "POST",
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: process.env.CLIENT_ID,
      refresh_token: refreshToken,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  };

  const response = await fetch(tokenUrl, requestOptions);
  if (response.ok) {
    const tokenData = await response.json();
    data.access_token = tokenData.access_token;
  } else {
    console.log(await response.json());
    data.access_token = "Something went wrong while refreshing the token";
  }
  res.render("index", data);
});

// Website Authorization Workflow for Amazon
// Steps to authorize our application
app.get("/amazon/authorize", async (_req, res) => {
  // OAuth authorization URI for the marketplaces in which selling partners will authorize our application
  // Can be found on Amazons Solution Provider Portal
  const OAuthLoginURI =
    "https://sellercentral.amazon.com/apps/authorize/consent?application_id=" +
    process.env.AMAZON_APP_ID;

  const params = {
    redirect_uri: process.env.AMAZON_AUTHORIZE_REDIRECT_URI,
    state: process.env.STATE,
    // version=beta authorizes an application in DRAFT status
    version: "beta",
  };

  const url = new URL(OAuthLoginURI);
  Object.keys(params).forEach((key) =>
    url.searchParams.append(key, params[key]),
  );

  // console.log(url.toString());
  res.redirect(url.toString());
});

app.get("/amazon/redirect", async (req, res) => {
  // extract data returned from Amazon
  const state = req.query.state;
  const selling_partner_id = req.query.selling_partner_id;
  const oauth_code = req.query.spapi_oauth_code;

  if (state !== process.env.STATE) {
    console.error("State doesn't match");
    return;
  }

  const amazon_auth_server_url = "https://api.amazon.com/auth/o2/token";
  const req_options = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: oauth_code,
      redirect_uri: process.env.AMAZON_OAUTH_REDIRECT_URI,
      client_id: process.env.AMAZON_CLIENT_ID,
      client_secret: process.env.AMAZON_CLIENT_SECRET,
    }).toString(),
  };

  const response = await fetch(amazon_auth_server_url, req_options);
  let received_data = await response.json();
  console.log(received_data);
  res.send(received_data);
});

app.post("/amazon/refresh-token", async (req, res) => {
  const refresh_token = req.body["amazon_refresh_token"];
  if (!refresh_token) {
    res.render("index");
  }

  const amazon_auth_server_url = "https://api.amazon.com/auth/o2/token";
  const req_options = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh_token,
      client_id: process.env.AMAZON_CLIENT_ID,
      client_secret: process.env.AMAZON_CLIENT_SECRET,
    }).toString(),
  };

  const response = await fetch(amazon_auth_server_url, req_options);
  if (response.ok) {
    const data = await response.json();
    console.log(data);
    data.amazon_access_token = data.access_token;
    console.log("AAAAAAAAAA");
    console.log(data.access_token);
  } else {
    data.amazon_access_token = "Something went wrong";
  }

  res.render("index", data);
});

const port = 3003;
app.listen(port, () => {});
