import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateCreatePoll } from "../middleware/validate.js";
import { createPoll } from "../services/polls.service.js";

const router = Router();

// Solo ADMIN puede crear encuestas en /api/admin/polls
router.post("/polls", requireAuth, requireRole("admin"), validateCreatePoll, createPoll);

export default router;
