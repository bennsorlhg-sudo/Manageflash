import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import networkRouter from "./network";
import dashboardRouter from "./dashboard";
import custodyRouter from "./custody";
import tasksRouter from "./tasks";
import financesRouter from "./finances";
import importRouter from "./import";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/network", networkRouter);
router.use(dashboardRouter);
router.use(custodyRouter);
router.use(tasksRouter);
router.use(financesRouter);
router.use(importRouter);

export default router;
