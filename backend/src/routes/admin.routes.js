import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateCreatePoll } from "../middleware/validate.js";
import { createPoll,listPollsWithStats, deletePoll, closePoll } from "../services/polls.service.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

// Solo ADMIN puede crear encuestas en /api/admin/polls
router.post("/polls", validateCreatePoll, createPoll);
router.get("/polls", listPollsWithStats);
router.patch("/polls/:id/close", closePoll);        
router.delete("/polls/:id", deletePoll);    

export default router;
