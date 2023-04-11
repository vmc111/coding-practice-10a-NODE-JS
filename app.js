const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
app.use(express.json());

// Initialize DataBase
let db = null;
const RunDB = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at https://localhost:3000");
    });
  } catch (error) {
    console.log(`D+Base Initialization Error: ${error.message}`);
  }
};
RunDB();

// AUTHENTICATION

const authentication = (request, response, next) => {
  let jwtToken;
  const headerPart = request.headers["authorization"];
  if (headerPart === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwtToken = headerPart.split(" ")[1];
    console.log(jwtToken);
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "SECRET_KEY", (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.username = payload.username;
          next();
        }
      });
    }
  }
};

// API 1

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserFromDb = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUserFromDb);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const checkPassword = await bcrypt.compare(password, dbUser.password);
    // console.log(checkPassword);
    if (checkPassword) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "SECRET_KEY");
      console.log(jwtToken);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// API 2
app.get("/states/", authentication, async (request, response) => {
  const { username } = request;
  const getStates = `
  SELECT 
    state_id AS stateId, 
    state_name AS stateName,
    population 
    FROM state;`;

  let statesArray = await db.all(getStates);
  response.send(statesArray);
});

// Get state for StateId

app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;

  const getById = `
    SELECT
        state_id AS stateId, 
        state_name AS stateName, 
        population
     FROM
      state
      WHERE 
        state_id = ${stateId};`;
  try {
    let stateById = await db.get(getById);
    response.send(stateById);
  } catch (e) {
    console.log(e.message);
  }
});

// API 4
app.post("/districts/", authentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const addDistrictQuery = `
  INSERT INTO 
  district (district_name, state_id, cases, cured, active, deaths)
  VALUES ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;

  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

// API 5

app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;

    const districtByIdQuery = `
    SELECT 
    district_id AS districtId, 
    district_name AS districtName,
    state_id AS stateId, 
    cases, 
    cured, 
    active,
    deaths
    FROM district 
    WHERE district_id = ${districtId};`;

    let districtForId = await db.get(districtByIdQuery);
    response.send(districtForId);
  }
);

// API 6

app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;

    const deleteRowQuery = `
    DELETE 
    FROM district 
    WHERE 
        district_id = ${districtId};`;

    await db.run(deleteRowQuery);
    response.send("District Removed");
  }
);

// API 7

app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    //   console.log(request.body);
    const updateQuery = `
  UPDATE 
    district 
    SET 
        district_name = '${districtName}', 
        state_id = ${stateId}, 
        cases = ${cases}, 
        cured = ${cured}, 
        active = ${active}, 
        deaths = ${deaths}
    WHERE 
        district_id = ${districtId};`;

    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

// API 8

app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;

    const getStatsQuery = `
  SELECT 
    SUM(cases) AS totalCases, 
    SUM(cured) AS totalCured, 
    SUM(active) AS totalActive, 
    SUM(cured) AS totalCured, 
    SUM(deaths) AS totalDeaths
    FROM district 
    WHERE state_id = ${stateId}
    GROUP BY state_id;`;

    let stats = await db.get(getStatsQuery);
    response.send(stats);
  }
);

module.exports = app;
