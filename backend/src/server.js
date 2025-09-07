// src/server.js
import dotenv from "dotenv";
dotenv.config();
import "./db/migrate.js";
import app from "./app.js";

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API de encuestas (SQLite) en http://localhost:${PORT}`);
});
