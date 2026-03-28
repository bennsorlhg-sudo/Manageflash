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
import transactionsRouter from "./transactions";
import ticketsRouter from "./tickets";
import subscriptionDeliveryRouter from "./subscription-delivery";
import fieldTasksRouter from "./fieldTasks";
import salesPointsRouter from "./salesPoints";

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
router.use(transactionsRouter);
router.use(ticketsRouter);
router.use(subscriptionDeliveryRouter);
router.use(fieldTasksRouter);
router.use(salesPointsRouter);

export default router;
