// src/app.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pollsRoutes from "./routes/polls.routes.js";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5500";

const app = express();
app.use(helmet());
app.use(express.json({ limit: "64kb" }));
app.use(cors({ origin: [FRONTEND_ORIGIN, "http://localhost:5500"] }));
app.use(rateLimit({ windowMs: 60_000, limit: 120 }));

// Rutas API
app.use("/api/admin", adminRoutes); 
app.use("/api/polls", pollsRoutes);
app.use("/api/auth", authRoutes);

app.get("/api/health", (_req,res)=>res.json({ok:true}));
export default app;
