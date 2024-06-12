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
};

app.get("/connect", async (_req, _res) => {
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
    data.access_token = "Something went wrong while refreshing the token";
  }
  res.render("index", data);
});

const port = 3003;
app.listen(port, () => {});
